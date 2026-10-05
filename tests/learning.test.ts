import { describe, expect, it } from 'vitest';
import { lessons } from '../src/core/learning';
import type { Comparison } from '../src/core/reconcile';
import { previousCheck, type StreamCheck } from '../src/core/record';

const rec = (id: string, createdAt: string, comparisons: Partial<Comparison>[], code = 'C1'): StreamCheck => ({
  id, createdAt, site: { code, name: code }, photos: [], answers: { bottom_type: id }, aiStatus: 'used', ai: null,
  comparisons: comparisons as Comparison[], rules: [], anomalies: [],
});

describe('lessons', () => {
  it('reads the pattern of citizen decisions per question', () => {
    const rs = [
      rec('a', '2026-09-01', [{ question: 'barriers', status: 'second_look', resolution: 'kept', reason: 'I saw it in person' }, { question: 'habitats', status: 'second_look', resolution: 'changed' }]),
      rec('b', '2026-09-02', [{ question: 'barriers', status: 'second_look', resolution: 'kept', reason: 'I saw it in person' }, { question: 'habitats', status: 'suggestion', resolution: 'accepted' }]),
      rec('c', '2026-09-03', [{ question: 'water_aspect', status: 'ai_unsure', held: true }, { question: 'bank_type', status: 'second_look', resolution: 'kept' }]),
    ];
    const by = Object.fromEntries(lessons(rs).map((l) => [l.question, l]));
    expect(by.barriers).toMatchObject({ asked: 2, kept: 2, lesson: 'citizens_overrule', topReason: 'I saw it in person' });
    expect(by.habitats).toMatchObject({ asked: 2, changed: 2, lesson: 'citizens_revise' });
    expect(by.bank_type.lesson).toBe('too_few');
    expect(by.water_aspect).toMatchObject({ asked: 0, held: 1 });
  });
});

describe('previousCheck', () => {
  it('finds the latest earlier check at the same site only', () => {
    const rs = [rec('old', '2026-09-01T00:00:00Z', []), rec('new', '2026-09-10T00:00:00Z', []), rec('other', '2026-09-12T00:00:00Z', [], 'G2')];
    expect(previousCheck(rs, 'C1', '2026-10-01T00:00:00Z')?.answers.bottom_type).toBe('new');
    expect(previousCheck(rs, 'C1', '2026-09-05T00:00:00Z')?.answers.bottom_type).toBe('old');
    expect(previousCheck(rs, 'O1')).toBeUndefined();
    expect(previousCheck(rs, undefined)).toBeUndefined();
  });
});
