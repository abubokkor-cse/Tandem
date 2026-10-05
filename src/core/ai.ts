// What the AI returns, and how several independent looks become one finding.
//
// We ask the vision model the same thing several times (self-consistency). A
// model's own "I am 90% sure" is poorly calibrated; how often independent looks
// agree is a better, measurable signal. Agreement is what we calibrate in eval/.

import { AI_QUESTIONS, type QuestionId, question, NOT_SURE } from './protocol.js';

export const NOT_VISIBLE = 'not_visible';

export type SceneQuality = 'ok' | 'too_dark' | 'blurry' | 'obstructed' | 'no_water_visible';

/** One answer from one look. value holds option ids (one for single/yes-no, 0+ for multi). */
export interface SampleAnswer {
  question: QuestionId;
  not_visible: boolean;
  value: string[];
  photo: string; // which photo shows it: upstream | downstream | context | biodiversity | none
  evidence: string;
}

/** Things the official form does not ask about, but a researcher would want to know. */
export const ANOMALY_KINDS = ['litter', 'oil_sheen', 'algal_bloom', 'dead_animals', 'wildlife', 'other'] as const;
export type AnomalyKind = (typeof ANOMALY_KINDS)[number];

export const ANOMALY_LABELS: Record<AnomalyKind, string> = {
  litter: 'Litter or waste',
  oil_sheen: 'Oily or rainbow sheen',
  algal_bloom: 'Algal bloom or green scum',
  dead_animals: 'Dead fish or animals',
  wildlife: 'Animals seen (birds, fish, insects…)',
  other: 'Something else unusual',
};

export interface SampleAnomaly {
  kind: AnomalyKind;
  photo: string;
  evidence: string;
}

export interface Sample {
  scene: { is_stream: boolean; quality: SceneQuality; note: string };
  answers: SampleAnswer[];
  anomalies: SampleAnomaly[];
}

export interface AiAnomaly {
  kind: AnomalyKind;
  support: number; // share of looks that reported it
  photo: string;
  evidence: string;
}

export interface AiFinding {
  question: QuestionId;
  /** Majority answer, or NOT_VISIBLE when the looks mostly could not tell. */
  value: string[] | typeof NOT_VISIBLE;
  /** Share of looks that gave exactly this answer (0..1). */
  support: number;
  /** For multi questions: share of looks that ticked each option. */
  optionSupport?: Record<string, number>;
  looks: number;
  evidence: string;
  photo: string;
}

export interface AiReport {
  model: string;
  looks: number;
  scene: { is_stream: boolean; quality: SceneQuality; note: string; support: number };
  findings: AiFinding[];
  anomalies: AiAnomaly[];
  createdAt: string;
  /** Present when the result was served from a stored run (sample photos). */
  cached?: boolean;
}

const QUALITIES: SceneQuality[] = ['ok', 'too_dark', 'blurry', 'obstructed', 'no_water_visible'];
const PHOTOS = ['upstream', 'downstream', 'context', 'biodiversity', 'none'];

/** Keep only well-formed answers to questions we asked, with allowed values. */
export function sanitizeSample(raw: unknown): Sample | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const scene = (r.scene ?? {}) as Record<string, unknown>;
  const answersIn = Array.isArray(r.answers) ? r.answers : [];
  const allowed = new Set(AI_QUESTIONS.map((q) => q.id));
  const seen = new Set<string>();
  const answers: SampleAnswer[] = [];
  for (const a of answersIn) {
    if (!a || typeof a !== 'object') continue;
    const x = a as Record<string, unknown>;
    const id = String(x.question ?? '') as QuestionId;
    if (!allowed.has(id) || seen.has(id)) continue;
    const q = question(id);
    const valid = new Set(q.options.map((o) => o.id).filter((o) => o !== NOT_SURE));
    const values = (Array.isArray(x.value) ? x.value : []).map(String).filter((v) => valid.has(v));
    let notVisible = x.not_visible === true;
    const unique = [...new Set(values)];
    // A single-answer question needs exactly one value; anything else counts as "cannot tell".
    if (q.kind !== 'multi' && unique.length !== 1) notVisible = true;
    seen.add(id);
    answers.push({
      question: id,
      not_visible: notVisible,
      value: notVisible ? [] : q.kind === 'multi' ? unique.sort() : unique,
      photo: PHOTOS.includes(String(x.photo)) ? String(x.photo) : 'none',
      evidence: String(x.evidence ?? '').slice(0, 280),
    });
  }
  const anomalies: SampleAnomaly[] = [];
  for (const a of Array.isArray(r.anomalies) ? r.anomalies : []) {
    if (!a || typeof a !== 'object') continue;
    const x = a as Record<string, unknown>;
    const kind = String(x.kind) as AnomalyKind;
    if (!ANOMALY_KINDS.includes(kind) || anomalies.some((y) => y.kind === kind)) continue;
    anomalies.push({
      kind,
      photo: PHOTOS.includes(String(x.photo)) ? String(x.photo) : 'none',
      evidence: String(x.evidence ?? '').slice(0, 280),
    });
  }
  return {
    anomalies,
    scene: {
      is_stream: scene.is_stream !== false,
      quality: QUALITIES.includes(scene.quality as SceneQuality) ? (scene.quality as SceneQuality) : 'ok',
      note: String(scene.note ?? '').slice(0, 280),
    },
    answers,
  };
}

const key = (v: string[]) => v.join('|');

/** Combine n looks into one finding per question by majority vote. */
export function aggregate(samples: Sample[], model: string): AiReport {
  const n = samples.length;
  const findings: AiFinding[] = [];

  for (const q of AI_QUESTIONS) {
    const answers = samples.map((s) => s.answers.find((a) => a.question === q.id));
    const votes = new Map<string, { count: number; evidence: string; photo: string }>();
    let abstain = 0;
    for (const a of answers) {
      if (!a || a.not_visible) {
        abstain++;
        continue;
      }
      const k = key(a.value);
      const v = votes.get(k) ?? { count: 0, evidence: a.evidence, photo: a.photo };
      v.count++;
      votes.set(k, v);
    }
    const ranked = [...votes.entries()].sort((a, b) => b[1].count - a[1].count);
    const top = ranked[0];

    let optionSupport: Record<string, number> | undefined;
    if (q.kind === 'multi') {
      optionSupport = {};
      for (const o of q.options) {
        const ticked = answers.filter((a) => a && !a.not_visible && a.value.includes(o.id)).length;
        optionSupport[o.id] = n ? ticked / n : 0;
      }
    }

    // Ties and abstention majorities are reported as "cannot tell": the model did not settle.
    const tied = ranked.length > 1 && ranked[1][1].count === top?.[1].count;
    if (!top || tied || abstain >= top[1].count) {
      findings.push({
        question: q.id,
        value: NOT_VISIBLE,
        support: n ? abstain / n : 0,
        optionSupport,
        looks: n,
        evidence: answers.find((a) => a?.not_visible)?.evidence ?? '',
        photo: 'none',
      });
      continue;
    }
    findings.push({
      question: q.id,
      value: top[0] === '' ? [] : top[0].split('|'),
      support: top[1].count / n,
      optionSupport,
      looks: n,
      evidence: top[1].evidence,
      photo: top[1].photo,
    });
  }

  const streamVotes = samples.filter((s) => s.scene.is_stream).length;
  const qualityVotes = new Map<SceneQuality, number>();
  for (const s of samples) qualityVotes.set(s.scene.quality, (qualityVotes.get(s.scene.quality) ?? 0) + 1);
  const quality = [...qualityVotes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'ok';
  const isStream = streamVotes * 2 > n;

  // An anomaly is reported only when most looks saw it.
  const anomalies: AiAnomaly[] = [];
  for (const kind of ANOMALY_KINDS) {
    const hits = samples.map((s) => s.anomalies.find((a) => a.kind === kind)).filter((a): a is SampleAnomaly => !!a);
    if (hits.length * 2 > n) anomalies.push({ kind, support: hits.length / n, photo: hits[0].photo, evidence: hits[0].evidence });
  }

  return {
    model,
    looks: n,
    anomalies,
    scene: {
      is_stream: isStream,
      quality,
      note: samples.find((s) => s.scene.quality === quality)?.scene.note ?? '',
      support: n ? (isStream ? streamVotes : n - streamVotes) / n : 0,
    },
    findings,
    createdAt: new Date().toISOString(),
  };
}
