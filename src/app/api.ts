import type { AiReport } from '../core/ai';

export interface AiAvailability {
  available: boolean;
  model?: string;
}

export async function aiAvailability(): Promise<AiAvailability> {
  try {
    const r = await fetch('/api/analyze', { method: 'GET' });
    if (!r.ok) return { available: false };
    return (await r.json()) as AiAvailability;
  } catch {
    return { available: false };
  }
}

export class AnalyzeError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export async function analyze(photos: { role: string; data: string }[], signal?: AbortSignal): Promise<AiReport> {
  let r: Response;
  try {
    r = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photos: photos.map((p) => ({ role: p.role, mimeType: 'image/jpeg', data: p.data })) }),
      signal,
    });
  } catch {
    throw new AnalyzeError('No connection to the AI. Your check continues without it.', 'offline');
  }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new AnalyzeError(body.error ?? `AI error ${r.status}`, body.code ?? 'upstream');
  return body as AiReport;
}
