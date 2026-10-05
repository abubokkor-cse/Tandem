// Synthetic demo records so the researcher view is not empty. Every one is flagged
// synthetic: true and labelled "Demo" wherever it appears. Sites are real OAH site codes;
// the observations and AI outputs are invented for illustration.

import type { AiFinding, AiReport, AnomalyKind } from '../core/ai';
import { AI_QUESTIONS, type Answers, type HealthRating, type QuestionId } from '../core/protocol';
import { compare, resolve } from '../core/reconcile';
import type { StreamCheck } from '../core/record';
import { integritySignals } from '../core/integrity';
import { runRules } from '../core/rules';

type AiSpec = Partial<Record<QuestionId, [string[] | 'not_visible', number, string]>>;

function report(spec: AiSpec, anomalies: { kind: AnomalyKind; evidence: string }[] = []): AiReport {
  const findings: AiFinding[] = AI_QUESTIONS.map((q) => {
    const s = spec[q.id];
    if (!s) return { question: q.id, value: 'not_visible', support: 1, looks: 3, evidence: 'Not visible in the photos.', photo: 'none' };
    const [value, agree, evidence] = s;
    return { question: q.id, value, support: agree / 3, looks: 3, evidence, photo: 'downstream' };
  });
  return {
    model: 'demo (synthetic)',
    looks: 3,
    scene: { is_stream: true, quality: 'ok', note: '', support: 1 },
    findings,
    anomalies: anomalies.map((a) => ({ ...a, support: 1, photo: 'downstream' })),
    createdAt: '',
  };
}

function make(
  id: string,
  date: string,
  site: StreamCheck['site'],
  answers: Answers,
  overall: HealthRating,
  ai: AiReport,
  decisions: Partial<Record<QuestionId, ['kept' | 'changed' | 'accepted' | 'declined', string?]>> = {},
  anomalyDecisions: Partial<Record<AnomalyKind, 'confirmed' | 'rejected'>> = {},
  note?: string,
): StreamCheck {
  let final = { ...answers };
  const comparisons = compare(answers, ai).map((c) => {
    const d = decisions[c.question];
    if (!d) return c;
    const r = resolve(final, c, d[0], d[1]);
    final = r.answers;
    return r.comparison;
  });
  return {
    id,
    createdAt: date,
    site,
    photos: [],
    answers: final,
    overall,
    note,
    aiStatus: 'used',
    ai: { ...ai, createdAt: date },
    comparisons,
    rules: runRules({ answers: final, overall }).map((h) => ({ ...h, resolution: 'kept' as const })),
    anomalies: ai.anomalies.map((a) => ({ ...a, decision: anomalyDecisions[a.kind] ?? 'unanswered' })),
    synthetic: true,
  };
}

let cache: StreamCheck[] | null = null;

export function demoRecords(): StreamCheck[] {
  if (cache) return cache;
  cache = [
    make(
      'demo-coimbra-c1',
      '2026-09-20T09:40:00Z',
      { code: 'C1', name: 'Exploratório', city: 'Coimbra', lat: 40.19787, lon: -8.42865 },
      {
        channel_form: 'u_shape', bottom_type: 'natural', bank_type: 'natural', habitats: ['sand_banks', 'aquatic_vegetation'], natural_debris: ['fallen_branches'],
        water_flow: 'slow', water_aspect: 'clear', water_withdrawal: 'no', barriers: 'no', draining_pipes: 'no', sewage_discharge: 'no', construction: 'no',
        water_height: 0.3, impervious_left: 'no', impervious_right: 'yes', vegetation_left: 'yes', vegetation_type_left: 'trees', vegetation_right: 'yes', vegetation_type_right: 'herbs',
        invasive_species: 'not_sure', vegetation_cut: 'no',
      },
      'good',
      report(
        {
          bottom_type: [['natural'], 3, 'downstream photo: gravel bed visible through clear water'],
          bank_type: [['natural'], 3, 'downstream photo: earth banks with roots'],
          water_aspect: [['clear'], 3, 'downstream photo: stones on the bed are visible'],
          habitats: [['aquatic_vegetation', 'sand_banks'], 2, 'downstream photo, left edge: sand bank; plants in the water'],
          vegetation_left: [['yes'], 3, 'downstream photo, left side: dense trees along the bank'],
          vegetation_type_left: [['trees'], 3, 'downstream photo, left side: tall trees'],
          impervious_right: [['yes'], 3, 'downstream photo, right side: paved footpath and road'],
          draining_pipes: [['no'], 3, 'banks clearly visible, no pipes'],
          barriers: [['no'], 3, 'no weir or dam in view'],
        },
        [{ kind: 'wildlife', evidence: 'downstream photo, centre: a duck on the water' }],
      ),
      {},
      { wildlife: 'confirmed' },
    ),
    make(
      'demo-toulouse-t21',
      '2026-09-22T15:10:00Z',
      { code: 'T21', name: 'Toulouse site T21', city: 'Toulouse', lat: 43.59278, lon: 1.34767 },
      {
        channel_form: 'flat', bottom_type: 'natural', bank_type: 'natural', habitats: [], natural_debris: [], water_flow: 'slow', water_aspect: 'clear',
        water_withdrawal: 'no', barriers: 'no', draining_pipes: 'no', sewage_discharge: 'no', construction: 'no', impervious_left: 'yes', impervious_right: 'yes',
        vegetation_left: 'no', vegetation_right: 'yes', vegetation_type_right: 'herbs', invasive_species: 'no', vegetation_cut: 'yes',
      },
      'moderate',
      report(
        {
          bank_type: [['artificial'], 3, 'downstream photo, both banks: vertical concrete walls'],
          bottom_type: [['artificial'], 3, 'downstream photo: smooth concrete floor under shallow water'],
          water_aspect: [['turbid'], 2, 'downstream photo: brownish water'],
          draining_pipes: [['yes'], 3, 'downstream photo, right wall: pipe outlet with grey discharge'],
          vegetation_left: [['no'], 3, 'downstream photo, left: paved path to the wall edge'],
        },
        [{ kind: 'litter', evidence: 'downstream photo, bed: plastic bottles and bags' }],
      ),
      { bank_type: ['changed'], bottom_type: ['kept', 'I saw it in person'], draining_pipes: ['kept', 'The AI misread the photo'] },
      { litter: 'confirmed' },
      'The bed has gravel over concrete in places.',
    ),
    make(
      'demo-ghent-g2',
      '2026-09-24T11:25:00Z',
      { code: 'G2', name: 'Zottegem1 (Zo1)', city: 'Ghent', lat: 50.85943, lon: 3.79794 },
      {
        channel_form: 'u_shape', bottom_type: 'not_sure', bank_type: 'laid_stones', habitats: ['aquatic_vegetation'], natural_debris: ['leaf_deposits'],
        water_flow: 'stagnant', water_aspect: 'not_sure', water_withdrawal: 'no', barriers: 'yes', draining_pipes: 'no', sewage_discharge: 'no', construction: 'no',
        impervious_left: 'no', impervious_right: 'no', vegetation_left: 'yes', vegetation_type_left: 'shrubs', vegetation_right: 'yes', vegetation_type_right: 'shrubs',
        invasive_species: 'yes', vegetation_cut: 'no',
      },
      'moderate',
      report(
        {
          water_aspect: [['colored'], 3, 'downstream photo: green surface film across the pool'],
          bank_type: [['laid_stones'], 3, 'downstream photo: stones placed along both banks'],
          barriers: [['yes'], 3, 'downstream photo, far end: small weir across the channel'],
          vegetation_left: [['yes'], 3, 'downstream photo, left: shrubs to the water edge'],
        },
        [{ kind: 'algal_bloom', evidence: 'downstream photo: green scum on still water' }],
      ),
      { water_aspect: ['accepted'] },
      { algal_bloom: 'confirmed' },
    ),
    make(
      'demo-oslo-o17',
      '2026-09-25T08:05:00Z',
      { code: 'O17', name: 'Alna – Bryn stasjon', city: 'Oslo', lat: 59.9078, lon: 10.8128 },
      {
        channel_form: 'v_shape', bottom_type: 'natural', bank_type: 'natural', habitats: ['riffles', 'stone_deposits'], natural_debris: ['fallen_trees'],
        water_flow: 'fast', water_aspect: 'clear', water_withdrawal: 'no', barriers: 'no', draining_pipes: 'no', sewage_discharge: 'yes', construction: 'no',
        impervious_left: 'no', impervious_right: 'no', vegetation_left: 'yes', vegetation_type_left: 'trees', vegetation_right: 'yes', vegetation_type_right: 'trees',
        invasive_species: 'no', vegetation_cut: 'no',
      },
      'good',
      report(
        {
          water_flow: [['fast'], 3, 'downstream photo: white water over stones'],
          habitats: [['riffles', 'stone_deposits'], 3, 'downstream photo: riffles and stone piles'],
          water_aspect: [['clear'], 3, 'downstream photo: bed visible'],
          sewage_discharge: ['not_visible', 2, 'an outlet is visible on the right bank but what it carries cannot be judged'],
        },
      ),
      {},
      {},
      'Smelled of sewage near the outlet under the rail bridge.',
    ),
    // Shorter records, so the "what the second looks teach" panel has patterns to show.
    quick('demo-benevento-bn4', '2026-09-26T10:00:00Z', { code: 'BN4', name: 'Serretelle 4', city: 'Benevento', lat: 41.12414, lon: 14.74864 },
      { vegetation_type_left: 'herbs', barriers: 'no' }, 'good',
      { vegetation_type_left: [['shrubs'], 3, 'downstream photo, left: woody bushes about waist high'] },
      { vegetation_type_left: ['changed'] }),
    quick('demo-benevento-bn5', '2026-09-27T09:20:00Z', { code: 'BN5', name: 'Serretelle 5', city: 'Benevento', lat: 41.10429, lon: 14.74295 },
      { vegetation_type_right: 'herbs', barriers: 'no' }, 'moderate',
      {
        vegetation_type_right: [['shrubs'], 3, 'downstream photo, right: dense low bushes along the bank'],
        barriers: [['yes'], 3, 'downstream photo, centre: concrete structure across the channel'],
      },
      { vegetation_type_right: ['changed'], barriers: ['kept', 'I saw it in person'] }, 'The structure is a footbridge pier, not a weir.'),
    quick('demo-toulouse-t3', '2026-09-28T16:40:00Z', { code: 'T3', name: 'Ruisseau de Bonneval amont', city: 'Toulouse', lat: 43.52756, lon: 1.47439 },
      { vegetation_type_left: 'trees', barriers: 'no', bottom_type: 'artificial' }, 'moderate',
      {
        vegetation_type_left: [['shrubs'], 3, 'downstream photo, left: bushes under young trees'],
        barriers: [['yes'], 3, 'downstream photo, far end: horizontal line across the water'],
        bottom_type: [['natural'], 3, 'downstream photo: gravel visible on the bed'],
      },
      { vegetation_type_left: ['changed'], barriers: ['kept', 'The AI misread the photo'], bottom_type: ['changed'] }),
    quick('demo-ghent-g9', '2026-09-29T12:10:00Z', { code: 'G9', name: 'Zwalm5 (Zw5)', city: 'Ghent', lat: 50.87366, lon: 3.73125 },
      { barriers: 'no', water_aspect: 'turbid' }, 'moderate',
      {
        barriers: [['yes'], 3, 'downstream photo: dark line across the stream, possibly a sill'],
        water_aspect: [['colored'], 3, 'downstream photo: brownish-green tint'],
      },
      { barriers: ['kept', 'The photos don’t show it well'] }),
    quick('demo-oslo-o5', '2026-09-30T07:45:00Z', { code: 'O5', name: 'Hoffselva - Møllhausen', city: 'Oslo', lat: 59.9308, lon: 10.6769 },
      { vegetation_type_right: 'shrubs', bottom_type: 'natural' }, 'good',
      {
        vegetation_type_right: [['trees'], 3, 'downstream photo, right: tall birch trees'],
        bottom_type: [['artificial'], 3, 'downstream photo: smooth surface under the water'],
      },
      { vegetation_type_right: ['kept', 'I saw it in person'], bottom_type: ['kept', 'The photos don’t show it well'] }),
    bot(),
  ];
  return cache;
}

/** A check clicked through by automation software: kept, labelled, and not counted. */
function bot(): StreamCheck {
  const r = quick('demo-coimbra-c4-bot', '2026-10-01T03:12:00Z', { code: 'C4', name: 'Eiras', city: 'Coimbra', lat: 40.25289, lon: -8.43659 },
    { habitats: [], natural_debris: [], invasive_species: 'no' }, 'good',
    { barriers: [['yes'], 3, 'downstream photo: weir across the channel'] },
    { barriers: ['kept'] });
  const trace = { questionMs: 6400, automated: true };
  return { ...r, trace, integrity: integritySignals({ answers: r.answers, trace, photos: [] }) };
}

/** A natural, vegetated stretch with a few answers changed, for compact demo records. */
function quick(
  id: string,
  date: string,
  site: StreamCheck['site'],
  changes: Answers,
  overall: HealthRating,
  spec: AiSpec,
  decisions: Partial<Record<QuestionId, ['kept' | 'changed' | 'accepted' | 'declined', string?]>>,
  note?: string,
): StreamCheck {
  const base: Answers = {
    channel_form: 'u_shape', bottom_type: 'natural', bank_type: 'natural', habitats: ['sand_banks'], natural_debris: ['leaf_deposits'],
    water_flow: 'slow', water_aspect: 'clear', water_withdrawal: 'no', barriers: 'no', draining_pipes: 'no', sewage_discharge: 'no', construction: 'no',
    impervious_left: 'no', impervious_right: 'no', vegetation_left: 'yes', vegetation_type_left: 'trees', vegetation_right: 'yes', vegetation_type_right: 'trees',
    invasive_species: 'not_sure', vegetation_cut: 'no',
  };
  return make(id, date, site, { ...base, ...changes }, overall, report(spec), decisions, {}, note);
}
