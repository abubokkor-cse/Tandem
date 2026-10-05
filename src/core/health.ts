// From verified answers to an overall ecosystem-health view.
//
// The four dimensions are the ones the official OneAquaHealth rating names:
// Good = "riparian vegetation, natural channel, good water quality, biodiversity";
// Poor = "highly modified / artificialized, loss of riparian vegetation, loss of habitats, polluted".
// This is transparent decision support built from the citizen's final answers, not a
// validated ecological index and not an AI opinion. The citizen's own rating is the record.

import type { AiAnomaly, AnomalyKind } from './ai';
import { HEALTH_RATINGS, type Answers, type HealthRating, type QuestionId } from './protocol';

export type CategoryId = 'water' | 'pollution' | 'biodiversity' | 'vegetation' | 'channel' | 'surroundings' | 'anomalies';

export const CATEGORIES: { id: CategoryId; icon: string; title: string; questions: QuestionId[]; anomalies: AnomalyKind[] }[] = [
  { id: 'water', icon: '💧', title: 'Water & visible quality', questions: ['water_aspect', 'water_flow', 'water_height'], anomalies: [] },
  {
    id: 'pollution',
    icon: '🗑️',
    title: 'Pollution & waste',
    questions: ['draining_pipes', 'sewage_discharge', 'water_withdrawal', 'construction'],
    anomalies: ['litter', 'oil_sheen', 'dead_animals', 'algal_bloom'],
  },
  { id: 'biodiversity', icon: '🐟', title: 'Biodiversity', questions: ['habitats', 'natural_debris', 'invasive_species'], anomalies: ['wildlife'] },
  {
    id: 'vegetation',
    icon: '🌿',
    title: 'Vegetation & riparian zone',
    questions: ['vegetation_left', 'vegetation_type_left', 'vegetation_right', 'vegetation_type_right', 'vegetation_cut'],
    anomalies: [],
  },
  { id: 'channel', icon: '🦟', title: 'Ecological indicators: channel & banks', questions: ['channel_form', 'bottom_type', 'bank_type', 'barriers'], anomalies: [] },
  { id: 'surroundings', icon: '🌡️', title: 'Environmental conditions: surroundings', questions: ['impervious_left', 'impervious_right'], anomalies: [] },
  { id: 'anomalies', icon: '⚠️', title: 'Anomalies', questions: [], anomalies: ['other'] },
];

export interface Dimension {
  id: 'channel' | 'vegetation' | 'water' | 'habitats';
  title: string;
  /** 0 (poor) .. 1 (good), or null when there are not enough answers. */
  score: number | null;
  because: string[];
}

export interface HealthProfile {
  dimensions: Dimension[];
  indicated: HealthRating | null;
  score: number | null;
  capped?: string;
  citizen?: HealthRating;
  /** 0 = same class, 1 = neighbouring class, 2 = opposite ends. */
  gap: number | null;
}

const v = (a: Answers, q: QuestionId) => a[q];
const is = (a: Answers, q: QuestionId, x: string) => v(a, q) === x;
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export function healthProfile(answers: Answers, confirmedAnomalies: AiAnomaly[] = [], citizen?: HealthRating): HealthProfile {
  const a = answers;
  const has = (k: AnomalyKind) => confirmedAnomalies.some((x) => x.kind === k);

  // Natural channel
  const ch: number[] = [];
  const chWhy: string[] = [];
  if (is(a, 'bottom_type', 'natural')) (ch.push(1), chWhy.push('natural bed'));
  if (is(a, 'bottom_type', 'artificial')) (ch.push(0), chWhy.push('artificial bed'));
  if (is(a, 'bank_type', 'natural')) (ch.push(1), chWhy.push('natural banks'));
  if (is(a, 'bank_type', 'laid_stones')) (ch.push(0.5), chWhy.push('laid-stone banks'));
  if (is(a, 'bank_type', 'artificial')) (ch.push(0), chWhy.push('artificial banks'));
  if (is(a, 'barriers', 'yes')) (ch.push(0.25), chWhy.push('a barrier across the stream'));

  // Riparian vegetation
  const veg: number[] = [];
  const vegWhy: string[] = [];
  for (const side of ['left', 'right'] as const) {
    if (is(a, `vegetation_${side}`, 'yes')) (veg.push(is(a, `impervious_${side}`, 'yes') ? 0.6 : 1), vegWhy.push(`vegetated ${side} margin`));
    if (is(a, `vegetation_${side}`, 'no')) (veg.push(0), vegWhy.push(`bare ${side} margin`));
    if (is(a, `impervious_${side}`, 'yes')) vegWhy.push(`paved ${side} margin`);
  }
  if (is(a, 'vegetation_cut', 'yes')) vegWhy.push('recent vegetation cuts');

  // Water quality
  const wq: number[] = [];
  const wqWhy: string[] = [];
  const aspect = v(a, 'water_aspect');
  if (aspect === 'clear') (wq.push(1), wqWhy.push('clear water'));
  if (aspect === 'turbid') (wq.push(0.5), wqWhy.push('muddy water'));
  if (aspect === 'foam' || aspect === 'colored') (wq.push(0.2), wqWhy.push(aspect === 'foam' ? 'foam' : 'altered colour'));
  if (is(a, 'sewage_discharge', 'yes')) (wq.push(0), wqWhy.push('sewage discharge'));
  if (is(a, 'draining_pipes', 'yes')) (wq.push(0), wqWhy.push('pipes draining polluted water'));
  if (has('oil_sheen')) (wq.push(0), wqWhy.push('oily sheen (confirmed)'));
  if (has('dead_animals')) (wq.push(0), wqWhy.push('dead animals (confirmed)'));
  if (has('algal_bloom')) (wq.push(0.3), wqWhy.push('algal bloom (confirmed)'));
  // With nothing said about how the water looks, "no polluted inflow" is the only water evidence.
  if (!wq.length && is(a, 'sewage_discharge', 'no') && is(a, 'draining_pipes', 'no')) (wq.push(1), wqWhy.push('no polluted inflow seen'));

  // Habitats and biodiversity
  const hab: number[] = [];
  const habWhy: string[] = [];
  const habitats = Array.isArray(a.habitats) ? a.habitats : undefined;
  if (habitats) {
    hab.push(habitats.length === 0 ? 0 : habitats.length === 1 ? 0.5 : 1);
    habWhy.push(habitats.length ? `${habitats.length} habitat type${habitats.length > 1 ? 's' : ''}` : 'no habitats seen');
  }
  if (Array.isArray(a.natural_debris) && a.natural_debris.length) (hab.push(1), habWhy.push('natural debris (shelter for life)'));
  if (has('wildlife')) (hab.push(1), habWhy.push('animals seen (confirmed)'));
  if (is(a, 'invasive_species', 'yes')) (hab.push(0.25), habWhy.push('invasive plants'));

  const dimensions: Dimension[] = [
    { id: 'channel', title: 'Natural channel', score: mean(ch), because: chWhy },
    { id: 'vegetation', title: 'Riparian vegetation', score: mean(veg), because: vegWhy },
    { id: 'water', title: 'Water quality', score: wq.length ? Math.min(...wq) : null, because: wqWhy },
    { id: 'habitats', title: 'Habitats & biodiversity', score: mean(hab), because: habWhy },
  ];

  const known = dimensions.filter((d) => d.score !== null).map((d) => d.score as number);
  let score = known.length >= 2 ? mean(known) : null;
  let indicated: HealthRating | null = score === null ? null : score >= 0.7 ? 'good' : score >= 0.4 ? 'moderate' : 'poor';
  let capped: string | undefined;
  const polluted = is(a, 'sewage_discharge', 'yes') || is(a, 'draining_pipes', 'yes');
  if (indicated === 'good' && polluted) {
    // "Polluted" is part of the official Poor definition, so Good is ruled out.
    indicated = 'moderate';
    capped = 'Reported polluted inflow rules out Good under the official definition.';
  }

  const order: HealthRating[] = ['poor', 'moderate', 'good'];
  const gap = indicated && citizen ? Math.abs(order.indexOf(indicated) - order.indexOf(citizen)) : null;
  if (score !== null) score = Math.round(score * 100) / 100;
  return { dimensions, indicated, score, capped, citizen, gap };
}

export type Tone = 'good' | 'fair' | 'bad' | 'unknown';

export interface CategoryStatus {
  id: 'water' | 'pollution' | 'biodiversity' | 'habitat';
  icon: string;
  title: string;
  word: string; // what the citizen reads: Good, Watch, High...
  tone: Tone;
  because: string[];
}

const word3 = (s: number | null, good: string, mid: string, bad: string): [string, Tone] =>
  s === null ? ['Not enough answers', 'unknown'] : s >= 0.7 ? [good, 'good'] : s >= 0.4 ? [mid, 'fair'] : [bad, 'bad'];

/** Words, not percentages: what each One Health dimension looks like after verification. */
export function categoryStatuses(p: HealthProfile, answers: Answers, confirmed: AiAnomaly[] = []): CategoryStatus[] {
  const dim = (id: Dimension['id']) => p.dimensions.find((d) => d.id === id)!;
  const has = (k: AnomalyKind) => confirmed.some((x) => x.kind === k);

  const [wWord, wTone] = word3(dim('water').score, 'Good', 'Watch', 'Poor');

  // Pollution is a pressure, so the scale runs the other way: High is bad.
  const high: string[] = [];
  const medium: string[] = [];
  if (answers.sewage_discharge === 'yes') high.push('sewage discharge');
  if (answers.draining_pipes === 'yes') high.push('pipes draining polluted water');
  if (has('oil_sheen')) high.push('oily sheen');
  if (has('dead_animals')) high.push('dead animals');
  if (has('litter')) medium.push('litter');
  if (has('algal_bloom')) medium.push('algal bloom');
  if (answers.construction === 'yes') medium.push('works in the stream');
  if (answers.water_withdrawal === 'yes') medium.push('water taken out');
  const answeredPollution = ['sewage_discharge', 'draining_pipes', 'construction'].some((q) => answers[q as QuestionId] !== undefined);
  const [pWord, pTone]: [string, Tone] = high.length
    ? ['High', 'bad']
    : medium.length
      ? ['Medium', 'fair']
      : answeredPollution
        ? ['Low', 'good']
        : ['Not enough answers', 'unknown'];

  const [bWord, bTone] = word3(dim('habitats').score, 'Good', 'Moderate', 'Low');
  const habitatScores = [dim('channel').score, dim('vegetation').score].filter((x): x is number => x !== null);
  const [hWord, hTone] = word3(habitatScores.length ? habitatScores.reduce((s, x) => s + x, 0) / habitatScores.length : null, 'Good', 'Moderate', 'Poor');

  return [
    { id: 'water', icon: '💧', title: 'Water indicators', word: wWord, tone: wTone, because: dim('water').because },
    { id: 'pollution', icon: '🗑️', title: 'Pollution', word: pWord, tone: pTone, because: [...high, ...medium] },
    { id: 'biodiversity', icon: '🐟', title: 'Biodiversity', word: bWord, tone: bTone, because: dim('habitats').because },
    { id: 'habitat', icon: '🌿', title: 'Habitat', word: hWord, tone: hTone, because: [...dim('channel').because, ...dim('vegetation').because] },
  ];
}

export interface AiConfidence {
  /** Share of answered AI findings where every look agreed (0..1), or null without AI. */
  value: number | null;
  /** The same as natural frequencies, which people read more reliably than percentages. */
  unanimous: number;
  answered: number;
  word: 'High' | 'Medium' | 'Low' | 'No AI';
  explanation: string;
}

/**
 * One number a citizen can read, with its meaning attached. It is look agreement, not a
 * probability of being right; the model card shows how agreement relates to accuracy.
 */
export function aiConfidence(report: { looks: number; scene: { is_stream: boolean; quality: string }; findings: { value: unknown; support: number }[] } | null): AiConfidence {
  if (!report) return { value: null, unanimous: 0, answered: 0, word: 'No AI', explanation: 'The AI was not used for this check.' };
  const answered = report.findings.filter((f) => f.value !== 'not_visible');
  if (!answered.length) return { value: 0, unanimous: 0, answered: 0, word: 'Low', explanation: 'The AI could not tell anything from these photos.' };
  const unanimous = answered.filter((f) => f.support >= 1).length;
  const value = unanimous / answered.length;
  const base = `On ${unanimous} of the ${answered.length} answers it could judge, all ${report.looks} independent AI looks agreed (${Math.round(value * 100)}%). Agreement, not a guarantee.`;
  const r = { value, unanimous, answered: answered.length };
  if (!report.scene.is_stream) return { ...r, word: 'Low', explanation: `Low: the AI did not see a stream in the photos. ${base}` };
  if (report.scene.quality !== 'ok') return { ...r, word: 'Low', explanation: `Low: photo ${report.scene.quality.replace(/_/g, ' ')}. ${base}` };
  return { ...r, word: value >= 0.75 ? 'High' : value >= 0.5 ? 'Medium' : 'Low', explanation: base };
}

export function ratingLabel(r: HealthRating): string {
  return HEALTH_RATINGS.find((x) => x.id === r)!.label;
}
