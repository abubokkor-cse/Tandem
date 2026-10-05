import { describe, expect, it } from 'vitest';
import type { AiFinding, AiReport } from '../src/core/ai';
import { AI_QUESTIONS } from '../src/core/protocol';
import { compare, needsReview, resolve } from '../src/core/reconcile';

function report(f: Record<string, [string[] | 'not_visible', number, Record<string, number>?]>): AiReport {
  const findings: AiFinding[] = AI_QUESTIONS.map((q) => {
    const x = f[q.id];
    return x
      ? { question: q.id, value: x[0], support: x[1], optionSupport: x[2], looks: 3, evidence: 'e', photo: 'downstream' }
      : { question: q.id, value: 'not_visible', support: 1, looks: 3, evidence: '', photo: 'none' };
  });
  return { model: 't', looks: 3, scene: { is_stream: true, quality: 'ok', note: '', support: 1 }, findings, anomalies: [], createdAt: '' };
}

const status = (cs: ReturnType<typeof compare>, q: string) => cs.find((c) => c.question === q)?.status;

describe('compare', () => {
  const ai = report({
    bank_type: [['artificial'], 1],
    bottom_type: [['artificial'], 2 / 3],
    water_aspect: [['clear'], 1],
    barriers: [['yes'], 1],
  });

  it('asks for a second look only when all looks agree', () => {
    const cs = compare({ bank_type: 'natural', bottom_type: 'natural', water_aspect: 'clear', barriers: 'not_sure' }, ai);
    expect(status(cs, 'bank_type')).toBe('second_look');
    expect(status(cs, 'bottom_type')).toBe('ai_unsure'); // 2 of 3: stays quiet
    expect(status(cs, 'water_aspect')).toBe('corroborated');
    expect(status(cs, 'barriers')).toBe('suggestion'); // citizen not sure, AI unanimous
    expect(needsReview(cs).map((c) => c.question).sort()).toEqual(['bank_type', 'barriers']);
  });

  it('never involves the AI in questions only a person on site can answer', () => {
    const cs = compare({ water_height: 0.4, invasive_species: 'yes' }, ai);
    expect(status(cs, 'water_height')).toBe('citizen_only');
    expect(status(cs, 'invasive_species')).toBe('citizen_only');
  });

  it('without AI, every answer is the citizen’s', () => {
    const cs = compare({ bank_type: 'natural' }, null);
    expect(status(cs, 'bank_type')).toBe('citizen_only');
  });

  it('skips questions that were not asked', () => {
    const cs = compare({ vegetation_left: 'no' }, ai);
    expect(cs.find((c) => c.question === 'vegetation_type_left')).toBeUndefined();
  });

  it('flags only the multi-select options the AI is unanimous about', () => {
    const r = report({ habitats: [['riffles'], 2 / 3, { riffles: 1, sand_banks: 1 / 3, stone_deposits: 0, sand_islands: 0, aquatic_vegetation: 0 }] });
    const cs = compare({ habitats: ['sand_banks', 'stone_deposits'] }, r);
    const c = cs.find((x) => x.question === 'habitats')!;
    expect(c.status).toBe('second_look');
    // riffles: all looks saw it, citizen did not. stone_deposits: no look saw it, citizen ticked it.
    // sand_banks: 1 of 3 looks, not unanimous either way: not disputed.
    expect(c.disputedOptions!.sort()).toEqual(['riffles', 'stone_deposits']);
  });
});

describe('resolve', () => {
  it('keeping leaves the answer and records the reason', () => {
    const cs = compare({ bank_type: 'natural' }, report({ bank_type: [['artificial'], 1] }));
    const c = cs.find((x) => x.question === 'bank_type')!;
    const r = resolve({ bank_type: 'natural' }, c, 'kept', 'I saw it in person');
    expect(r.answers.bank_type).toBe('natural');
    expect(r.comparison).toMatchObject({ resolution: 'kept', reason: 'I saw it in person' });
  });

  it('changing adopts the AI answer and keeps the original for the audit trail', () => {
    const cs = compare({ bank_type: 'natural' }, report({ bank_type: [['artificial'], 1] }));
    const r = resolve({ bank_type: 'natural' }, cs.find((x) => x.question === 'bank_type')!, 'changed');
    expect(r.answers.bank_type).toBe('artificial');
    expect(r.comparison.original).toBe('natural');
  });

  it('changing a multi-select flips only the disputed options', () => {
    const r0 = report({ habitats: [['riffles'], 2 / 3, { riffles: 1, sand_banks: 1 / 3, stone_deposits: 0, sand_islands: 0, aquatic_vegetation: 0 }] });
    const answers = { habitats: ['sand_banks', 'stone_deposits'] };
    const c = compare(answers, r0).find((x) => x.question === 'habitats')!;
    const r = resolve(answers, c, 'changed');
    expect(r.answers.habitats).toEqual(['sand_banks', 'riffles']);
  });
});

describe('earned trust', () => {
  const ai = report({ water_aspect: [['clear'], 1], bank_type: [['artificial'], 1] });

  it('holds back a unanimous AI on a question with a weak track record', () => {
    // water_aspect is below the benchmark threshold in eval/report.json
    const cs = compare({ water_aspect: 'turbid', bank_type: 'natural' }, ai);
    expect(cs.find((c) => c.question === 'water_aspect')).toMatchObject({ status: 'ai_unsure', held: true });
    expect(cs.find((c) => c.question === 'bank_type')).toMatchObject({ status: 'second_look' });
    expect(needsReview(cs).map((c) => c.question)).toEqual(['bank_type']);
  });

  it('also holds back suggestions, and follows an injected trust table', () => {
    const cs = compare({ water_aspect: 'not_sure' }, ai);
    expect(cs.find((c) => c.question === 'water_aspect')).toMatchObject({ status: 'ai_unsure', held: true });
    const all = compare({ water_aspect: 'turbid' }, ai, 1, () => true);
    expect(all.find((c) => c.question === 'water_aspect')?.status).toBe('second_look');
  });

  it('never marks a merely unsure AI as held back', () => {
    const cs = compare({ water_aspect: 'turbid' }, report({ water_aspect: [['clear'], 2 / 3] }), 1, () => false);
    expect(cs.find((c) => c.question === 'water_aspect')).toMatchObject({ status: 'ai_unsure' });
    expect(cs.find((c) => c.question === 'water_aspect')?.held).toBeUndefined();
  });
});
