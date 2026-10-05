import { describe, expect, it } from 'vitest';
import { hammingHex, integritySignals, isQuarantined } from '../src/core/integrity';
import { lessons } from '../src/core/learning';
import { summarize, type StreamCheck } from '../src/core/record';

const answers = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`q${i}`, 'no']));
const ids = (s: ReturnType<typeof integritySignals>) => s.map((x) => x.id);

describe('integrity', () => {
  it('quarantines automated input', () => {
    const s = integritySignals({ answers, trace: { questionMs: 60000, automated: true }, photos: [] });
    expect(ids(s)).toEqual(['automated']);
    expect(isQuarantined(s)).toBe(true);
  });

  it('flags answers faster than they can be read, but not careful ones or short forms', () => {
    expect(ids(integritySignals({ answers, trace: { questionMs: 9000, automated: false }, photos: [] }))).toEqual(['too_fast']);
    expect(integritySignals({ answers, trace: { questionMs: 40000, automated: false }, photos: [] })).toEqual([]);
    expect(integritySignals({ answers: { barriers: 'no', construction: 'no' }, trace: { questionMs: 500, automated: false }, photos: [] })).toEqual([]);
  });

  it('spots the same photo twice and a photo reused from an earlier check', () => {
    const a = 'f0e1d2c3b4a59687';
    const nearA = 'f0e1d2c3b4a59686'; // one bit off: re-encoded copy
    const other = '0f1e2d3c4b5a6978';
    expect(hammingHex(a, nearA)).toBe(1);
    expect(ids(integritySignals({ answers: {}, photos: [{ role: 'upstream', hash: a }, { role: 'downstream', hash: nearA }] }))).toEqual(['same_photo']);
    expect(ids(integritySignals({ answers: {}, photos: [{ role: 'upstream', hash: other }], earlier: [a] }))).toEqual([]);
    expect(ids(integritySignals({ answers: {}, photos: [{ role: 'upstream', hash: a }], earlier: [nearA] }))).toEqual(['reused_photo']);
  });

  it('keeps quarantined records out of the stats label and out of the lessons', () => {
    const r: StreamCheck = {
      id: 'b', createdAt: '2026-10-01', site: { name: 'x' }, photos: [], answers, aiStatus: 'used', ai: null, rules: [], anomalies: [],
      comparisons: [{ question: 'barriers', status: 'second_look', resolution: 'kept' }, { question: 'bank_type', status: 'second_look', resolution: 'kept' }],
      integrity: integritySignals({ answers, trace: { questionMs: 1000, automated: true }, photos: [] }),
    };
    expect(summarize(r).label).toBe('quarantined');
    expect(lessons([r, r, r])).toEqual([]);
  });
});
