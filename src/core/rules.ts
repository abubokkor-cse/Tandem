// Validation checks that need no AI: answers that contradict each other, or the
// overall rating against the official definitions of Good / Moderate / Poor.
// Every check says which answers it used and why. None of them blocks a record.

import { HEALTH_RATINGS, NOT_SURE, optionLabel, question, type Answers, type HealthRating, type QuestionId } from './protocol';

export type Severity = 'check' | 'safety' | 'info';

export interface RuleHit {
  id: string;
  severity: Severity;
  title: string;
  message: string;
  /** The answers the check looked at. */
  uses: (QuestionId | 'overall')[];
  /** Where the rule comes from. */
  basis: string;
}

/** The most recent earlier check at the same site, if this device has one. */
export interface PreviousCheck {
  date: string;
  answers: Answers;
  synthetic?: boolean;
}

export interface RuleInput {
  answers: Answers;
  overall?: HealthRating;
  previous?: PreviousCheck;
}

/** Features of a stretch of stream that rarely change between two visits. */
export const STABLE_FEATURES: QuestionId[] = ['channel_form', 'bottom_type', 'bank_type', 'impervious_left', 'impervious_right'];

const has = (a: Answers, q: QuestionId, v: string) => {
  const x = a[q];
  return Array.isArray(x) ? x.includes(v) : x === v;
};

const OFFICIAL = 'Official OneAquaHealth rating definitions';
const PHYSICAL = 'Physical consistency';

interface Rule {
  id: string;
  severity: Severity;
  title: string;
  uses: (QuestionId | 'overall')[];
  basis: string;
  test: (i: RuleInput) => string | null;
}

const good = HEALTH_RATINGS.find((r) => r.id === 'good')!.description;
const poor = HEALTH_RATINGS.find((r) => r.id === 'poor')!.description;

export const RULES: Rule[] = [
  {
    id: 'dry-but-water-described',
    severity: 'check',
    title: 'Dry channel, but the water is described',
    uses: ['water_flow', 'water_aspect'],
    basis: PHYSICAL,
    test: ({ answers: a }) =>
      has(a, 'water_flow', 'dry') && ['clear', 'turbid', 'foam', 'colored'].some((v) => has(a, 'water_aspect', v))
        ? 'You said the channel is dry, and also described how the water looks. If there are pools, “Stagnant/intermittent” may fit better.'
        : null,
  },
  {
    id: 'dry-but-water-height',
    severity: 'check',
    title: 'Dry channel with a water height',
    uses: ['water_flow', 'water_height'],
    basis: PHYSICAL,
    test: ({ answers: a }) =>
      has(a, 'water_flow', 'dry') && typeof a.water_height === 'number' && a.water_height > 0
        ? `You said the channel is dry, and gave a water height of ${a.water_height} m.`
        : null,
  },
  {
    id: 'water-height-range',
    severity: 'check',
    title: 'Unusual water height',
    uses: ['water_height'],
    basis: 'Urban streams in the OneAquaHealth sites are small; heights over 3 m are rare.',
    test: ({ answers: a }) =>
      typeof a.water_height === 'number' && (a.water_height < 0 || a.water_height > 3)
        ? `${a.water_height} m is unusual for an urban stream. Is the unit metres (0.5 = half a metre)?`
        : null,
  },
  {
    id: 'riffles-in-still-water',
    severity: 'check',
    title: 'Riffles in water that is not moving',
    uses: ['habitats', 'water_flow'],
    basis: PHYSICAL,
    test: ({ answers: a }) =>
      has(a, 'habitats', 'riffles') && (has(a, 'water_flow', 'stagnant') || has(a, 'water_flow', 'dry'))
        ? 'Riffles and rapids need flowing water, but the flow was described as stagnant or dry.'
        : null,
  },
  ...(['left', 'right'] as const).map<Rule>((side) => ({
    id: `no-vegetation-but-type-${side}`,
    severity: 'check',
    title: `Vegetation type on a bare ${side} margin`,
    uses: [`vegetation_${side}`, `vegetation_type_${side}`],
    basis: PHYSICAL,
    test: ({ answers: a }) =>
      has(a, `vegetation_${side}`, 'no') && a[`vegetation_type_${side}`] && !has(a, `vegetation_type_${side}`, 'not_sure')
        ? `The ${side} margin was described as not covered by vegetation, but a dominant vegetation type was chosen.`
        : null,
  })),
  {
    id: 'good-with-sewage',
    severity: 'check',
    title: 'Rated Good, with polluted inflow',
    uses: ['overall', 'sewage_discharge', 'draining_pipes'],
    basis: `${OFFICIAL}: Good means “${good}”.`,
    test: ({ answers: a, overall }) =>
      overall === 'good' && (has(a, 'sewage_discharge', 'yes') || has(a, 'draining_pipes', 'yes'))
        ? 'Good quality includes good water quality, but you reported sewage or pipes draining polluted water.'
        : null,
  },
  {
    id: 'good-artificial-channel',
    severity: 'check',
    title: 'Rated Good, in an artificial channel',
    uses: ['overall', 'bottom_type', 'bank_type'],
    basis: `${OFFICIAL}: Good means “${good}”.`,
    test: ({ answers: a, overall }) =>
      overall === 'good' && has(a, 'bottom_type', 'artificial') && has(a, 'bank_type', 'artificial')
        ? 'Good quality includes a natural channel, but both the bottom and the banks were described as artificial.'
        : null,
  },
  {
    id: 'good-no-riparian-vegetation',
    severity: 'check',
    title: 'Rated Good, with bare margins',
    uses: ['overall', 'vegetation_left', 'vegetation_right'],
    basis: `${OFFICIAL}: Good means “${good}”.`,
    test: ({ answers: a, overall }) =>
      overall === 'good' && has(a, 'vegetation_left', 'no') && has(a, 'vegetation_right', 'no')
        ? 'Good quality includes riparian vegetation, but neither margin was described as vegetated.'
        : null,
  },
  {
    id: 'poor-but-natural',
    severity: 'check',
    title: 'Rated Poor, but described as natural',
    uses: ['overall', 'bottom_type', 'bank_type', 'water_aspect', 'vegetation_left', 'vegetation_right', 'sewage_discharge', 'draining_pipes'],
    basis: `${OFFICIAL}: Poor means “${poor}”.`,
    test: ({ answers: a, overall }) =>
      overall === 'poor' &&
      has(a, 'bottom_type', 'natural') &&
      has(a, 'bank_type', 'natural') &&
      has(a, 'water_aspect', 'clear') &&
      has(a, 'vegetation_left', 'yes') &&
      has(a, 'vegetation_right', 'yes') &&
      !has(a, 'sewage_discharge', 'yes') &&
      !has(a, 'draining_pipes', 'yes')
        ? 'Poor quality means a highly modified, polluted stream, but you described a natural, vegetated stretch with clear water. If something else worried you, a short note helps researchers.'
        : null,
  },
  {
    id: 'changed-since-last-check',
    severity: 'check',
    title: 'Different from the last check here',
    uses: STABLE_FEATURES,
    basis: 'Site memory: the channel shape, bed and banks of a stretch rarely change between visits',
    test: ({ answers: a, previous: p }) => {
      if (!p) return null;
      const known = (v: unknown) => v !== undefined && v !== '' && v !== NOT_SURE && !Array.isArray(v);
      const diffs = STABLE_FEATURES.filter((q) => known(a[q]) && known(p.answers[q]) && a[q] !== p.answers[q]);
      if (!diffs.length) return null;
      const when = new Date(p.date).toLocaleDateString('en-GB', { dateStyle: 'medium' });
      const was = diffs.map((q) => `${question(q).title.toLowerCase()}: ${optionLabel(q, String(p.answers[q]))}`).join('; ');
      return `The last check at this site (${when}${p.synthetic ? ', a demo record' : ''}) recorded ${was}. These rarely change between visits. If works, a flood or a different stretch explain it, keep your answer and add a note: that is valuable news for researchers.`;
    },
  },
  {
    id: 'foam-or-colour-near-discharge',
    severity: 'safety',
    title: 'Avoid touching the water',
    uses: ['water_aspect', 'draining_pipes', 'sewage_discharge'],
    basis: 'One Health precaution',
    test: ({ answers: a }) =>
      (has(a, 'water_aspect', 'foam') || has(a, 'water_aspect', 'colored')) &&
      (has(a, 'draining_pipes', 'yes') || has(a, 'sewage_discharge', 'yes'))
        ? 'Foam or unusual colour next to a discharge can carry pathogens or chemicals. Keep skin, children and pets out of the water, and wash your hands.'
        : null,
  },
  {
    id: 'many-not-sure',
    severity: 'info',
    title: 'Many “not sure” answers',
    uses: [],
    basis: 'Data completeness',
    test: ({ answers: a }) => {
      const vals = Object.values(a);
      const unsure = vals.filter((v) => v === 'not_sure').length;
      return vals.length >= 6 && unsure / vals.length > 0.4
        ? `${unsure} of ${vals.length} answers are “not sure”. That is fine: honest uncertainty is better than a guess. The help text under each question may make the next check easier.`
        : null;
    },
  },
];

export function runRules(input: RuleInput): RuleHit[] {
  const hits: RuleHit[] = [];
  for (const r of RULES) {
    const message = r.test(input);
    if (message) hits.push({ id: r.id, severity: r.severity, title: r.title, message, uses: r.uses, basis: r.basis });
  }
  return hits;
}
