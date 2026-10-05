import { describe, expect, it } from 'vitest';
import { aggregate, sanitizeSample, type Sample } from '../src/core/ai';
import { aiConfidence } from '../src/core/health';

const sample = (answers: Record<string, string[] | 'nv'>, extra: Partial<Sample> = {}): Sample => ({
  scene: { is_stream: true, quality: 'ok', note: '' },
  answers: Object.entries(answers).map(([q, v]) => ({
    question: q as Sample['answers'][number]['question'],
    not_visible: v === 'nv',
    value: v === 'nv' ? [] : v,
    photo: 'downstream',
    evidence: `evidence for ${q}`,
  })),
  anomalies: [],
  ...extra,
});

describe('sanitizeSample', () => {
  it('drops unknown questions, invalid values and duplicates', () => {
    const s = sanitizeSample({
      scene: { is_stream: true, quality: 'ok', note: '' },
      answers: [
        { question: 'bank_type', not_visible: false, value: ['artificial'], photo: 'downstream', evidence: 'wall' },
        { question: 'bank_type', not_visible: false, value: ['natural'], photo: 'downstream', evidence: 'dup' },
        { question: 'made_up', not_visible: false, value: ['x'], photo: 'downstream', evidence: '' },
        { question: 'water_aspect', not_visible: false, value: ['purple'], photo: 'downstream', evidence: '' },
      ],
      anomalies: [{ kind: 'litter', photo: 'upstream', evidence: 'bottles' }, { kind: 'aliens', photo: 'x', evidence: '' }],
    })!;
    expect(s.answers).toHaveLength(2);
    expect(s.answers[0]).toMatchObject({ question: 'bank_type', value: ['artificial'] });
    // An invalid value on a single-answer question becomes "cannot tell", never a guess.
    expect(s.answers[1]).toMatchObject({ question: 'water_aspect', not_visible: true, value: [] });
    expect(s.anomalies).toEqual([{ kind: 'litter', photo: 'upstream', evidence: 'bottles' }]);
  });

  it('never lets the AI answer the "not sure" option or field-only questions', () => {
    const s = sanitizeSample({
      answers: [
        { question: 'bank_type', not_visible: false, value: ['not_sure'], photo: 'none', evidence: '' },
        { question: 'water_height', not_visible: false, value: ['1'], photo: 'none', evidence: '' },
        { question: 'invasive_species', not_visible: false, value: ['yes'], photo: 'none', evidence: '' },
      ],
    })!;
    expect(s.answers.map((a) => a.question)).toEqual(['bank_type']);
    expect(s.answers[0].not_visible).toBe(true);
  });
});

describe('aggregate (self-consistency)', () => {
  it('reports the majority answer with its share of looks', () => {
    const r = aggregate(
      [sample({ bank_type: ['artificial'] }), sample({ bank_type: ['artificial'] }), sample({ bank_type: ['laid_stones'] })],
      'test',
    );
    const f = r.findings.find((x) => x.question === 'bank_type')!;
    expect(f.value).toEqual(['artificial']);
    expect(f.support).toBeCloseTo(2 / 3);
  });

  it('treats ties and abstention majorities as "cannot tell"', () => {
    const tie = aggregate([sample({ water_aspect: ['clear'] }), sample({ water_aspect: ['turbid'] })], 'test');
    expect(tie.findings.find((x) => x.question === 'water_aspect')!.value).toBe('not_visible');
    const abstain = aggregate([sample({ water_flow: 'nv' }), sample({ water_flow: 'nv' }), sample({ water_flow: ['slow'] })], 'test');
    expect(abstain.findings.find((x) => x.question === 'water_flow')!.value).toBe('not_visible');
  });

  it('keeps per-option support for multi-select questions', () => {
    const r = aggregate(
      [sample({ habitats: ['riffles', 'sand_banks'] }), sample({ habitats: ['riffles'] }), sample({ habitats: ['riffles'] })],
      'test',
    );
    const f = r.findings.find((x) => x.question === 'habitats')!;
    expect(f.value).toEqual(['riffles']);
    expect(f.optionSupport!.riffles).toBe(1);
    expect(f.optionSupport!.sand_banks).toBeCloseTo(1 / 3);
  });

  it('reports an anomaly only when most looks saw it', () => {
    const lit = { anomalies: [{ kind: 'litter' as const, photo: 'downstream', evidence: 'bags' }] };
    const r = aggregate([sample({}, lit), sample({}, lit), sample({})], 'test');
    expect(r.anomalies.map((a) => a.kind)).toEqual(['litter']);
    const r2 = aggregate([sample({}, lit), sample({}), sample({})], 'test');
    expect(r2.anomalies).toEqual([]);
  });
});

describe('aiConfidence', () => {
  it('drops to Low when the photo is poor, whatever the agreement', () => {
    const r = aggregate([sample({ bank_type: ['natural'] }), sample({ bank_type: ['natural'] })], 'test');
    expect(aiConfidence(r).word).toBe('High');
    expect(aiConfidence({ ...r, scene: { ...r.scene, quality: 'too_dark' } }).word).toBe('Low');
    expect(aiConfidence(null).word).toBe('No AI');
  });
});
