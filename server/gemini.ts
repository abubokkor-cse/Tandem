// Calls the Gemini API (free tier works) and turns several looks into one AiReport.
// Runs on the server only: the API key never reaches the browser.

import { aggregate, sanitizeSample, type AiReport, type Sample } from '../src/core/ai.js';
import { buildPrompt, responseSchema } from './prompt.js';

export interface PhotoInput {
  role: string;
  mimeType: string;
  data: string; // base64, no data: prefix
}

export interface AnalyzeOptions {
  apiKey: string;
  model?: string;
  looks?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export class AiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: 'quota' | 'bad_request' | 'upstream' | 'blocked',
  ) {
    super(message);
  }
}

const API = 'https://generativelanguage.googleapis.com/v1beta';
export const DEFAULT_MODEL = 'gemini-3.8-flash';

async function generate(photos: PhotoInput[], opts: AnalyzeOptions, candidates: number): Promise<Sample[]> {
  const model = opts.model || DEFAULT_MODEL;
  const parts: unknown[] = [{ text: buildPrompt(photos.map((p) => p.role)) }];
  for (const p of photos) {
    parts.push({ text: `Photo: ${p.role}` });
    parts.push({ inline_data: { mime_type: p.mimeType, data: p.data } });
  }
  const res = await fetch(`${API}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': opts.apiKey },
    signal: opts.signal,
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema(),
        // Some sampling spread is the point: identical looks would hide uncertainty.
        temperature: opts.temperature ?? 0.7,
        candidateCount: candidates,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 429) throw new AiError('The free AI quota is used up for now. Try again in a minute.', 429, 'quota');
    if (res.status === 400 && /candidate/i.test(text) && candidates > 1) {
      // Model does not support several candidates in one call: fall back to one per call.
      return generate(photos, opts, 1);
    }
    throw new AiError(`Gemini error ${res.status}: ${text.slice(0, 300)}`, res.status >= 500 ? 502 : 400, res.status >= 500 ? 'upstream' : 'bad_request');
  }

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  if (body.promptFeedback?.blockReason) throw new AiError(`Blocked: ${body.promptFeedback.blockReason}`, 422, 'blocked');

  const samples: Sample[] = [];
  for (const c of body.candidates ?? []) {
    const text = c.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    try {
      const s = sanitizeSample(JSON.parse(text));
      if (s) samples.push(s);
    } catch {
      // A malformed look is dropped; the others still count.
    }
  }
  return samples;
}

/** Ask for `looks` independent readings of the photos and combine them. */
export async function analyzePhotos(photos: PhotoInput[], opts: AnalyzeOptions): Promise<AiReport> {
  const looks = Math.max(1, Math.min(5, opts.looks ?? 3));
  let samples = await generate(photos, opts, looks);
  // Models without multi-candidate support return one look: fetch the rest in parallel.
  const missing = looks - samples.length;
  if (missing > 0) {
    const extra = await Promise.allSettled(Array.from({ length: missing }, () => generate(photos, opts, 1)));
    for (const r of extra) if (r.status === 'fulfilled') samples = samples.concat(r.value);
  }
  if (!samples.length) throw new AiError('The AI returned no usable answer.', 502, 'upstream');
  return aggregate(samples.slice(0, looks), opts.model || DEFAULT_MODEL);
}
