import { describe, expect, it } from 'vitest';
import { categoryStatuses, healthProfile } from '../src/core/health';
import { accuracy, cohenKappa, coverage, ece, reliability, selective, simulateSecondLook, type Pred } from '../src/core/metrics';
import { oneHealthNotes } from '../src/core/onehealth';
import { runRules } from '../src/core/rules';

const ids = (h: ReturnType<typeof runRules>) => h.map((x) => x.id);

describe('rules', () => {
  it('flags a Good rating with sewage, per the official definition', () => {
    expect(ids(runRules({ answers: { sewage_discharge: 'yes' }, overall: 'good' }))).toContain('good-with-sewage');
    expect(ids(runRules({ answers: { sewage_discharge: 'yes' }, overall: 'poor' }))).not.toContain('good-with-sewage');
  });

  it('flags physically inconsistent answers', () => {
    expect(ids(runRules({ answers: { water_flow: 'dry', water_aspect: 'clear' } }))).toContain('dry-but-water-described');
    expect(ids(runRules({ answers: { habitats: ['riffles'], water_flow: 'stagnant' } }))).toContain('riffles-in-still-water');
    expect(ids(runRules({ answers: { water_height: 12 } }))).toContain('water-height-range');
  });

  it('adds a safety note for foam next to a discharge', () => {
    const h = runRules({ answers: { water_aspect: 'foam', draining_pipes: 'yes' } });
    expect(h.find((x) => x.id === 'foam-or-colour-near-discharge')?.severity).toBe('safety');
  });

  it('stays quiet on a consistent check', () => {
    const h = runRules({
      answers: { bottom_type: 'natural', bank_type: 'natural', water_aspect: 'clear', water_flow: 'slow', vegetation_left: 'yes', vegetation_right: 'yes', sewage_discharge: 'no', draining_pipes: 'no' },
      overall: 'good',
    });
    expect(h).toEqual([]);
  });
});

describe('health profile', () => {
  const natural = { bottom_type: 'natural', bank_type: 'natural', vegetation_left: 'yes', vegetation_right: 'yes', water_aspect: 'clear', habitats: ['riffles', 'sand_banks'] };

  it('points to Good for a natural, vegetated, clear stream', () => {
    expect(healthProfile(natural).indicated).toBe('good');
  });

  it('rules out Good when polluted inflow is reported', () => {
    const p = healthProfile({ ...natural, sewage_discharge: 'yes' });
    expect(p.indicated).not.toBe('good');
  });

  it('points to Poor for a concrete, bare, polluted channel', () => {
    const p = healthProfile({ bottom_type: 'artificial', bank_type: 'artificial', vegetation_left: 'no', vegetation_right: 'no', water_aspect: 'foam', draining_pipes: 'yes', habitats: [] });
    expect(p.indicated).toBe('poor');
  });

  it('says so when there are too few answers', () => {
    expect(healthProfile({ water_aspect: 'clear' }).indicated).toBeNull();
  });

  it('reports the gap to the citizen’s rating', () => {
    expect(healthProfile(natural, [], 'poor').gap).toBe(2);
  });

  it('turns confirmed anomalies into pollution words', () => {
    const p = healthProfile(natural);
    const s = categoryStatuses(p, { ...natural, sewage_discharge: 'no', draining_pipes: 'no' }, [{ kind: 'litter', support: 1, photo: 'downstream', evidence: '' }]);
    expect(s.find((x) => x.id === 'pollution')!.word).toBe('Medium');
  });
});

describe('one health notes', () => {
  it('warns people and animals about foam next to sewage', () => {
    const n = oneHealthNotes({ water_aspect: 'foam', sewage_discharge: 'yes' });
    expect(n.some((x) => x.for === 'people' && x.tone === 'caution')).toBe(true);
    expect(n.some((x) => x.for === 'animals')).toBe(true);
  });
});

describe('metrics', () => {
  const p = (truth: string, predicted: string | null, support = 1): Pred => ({ key: Math.random().toString(), question: 'q', truth, predicted, support });

  it('computes accuracy and coverage on answered items only', () => {
    const preds = [p('a', 'a'), p('a', 'b'), p('b', null)];
    expect(accuracy(preds)).toBeCloseTo(0.5);
    expect(coverage(preds)).toBeCloseTo(2 / 3);
  });

  it('gives kappa 1 for perfect agreement and about 0 for chance', () => {
    expect(cohenKappa([p('a', 'a'), p('b', 'b'), p('a', 'a')])).toBe(1);
    expect(cohenKappa([p('a', 'a'), p('a', 'b'), p('b', 'a'), p('b', 'b')])).toBeCloseTo(0);
  });

  it('bins reliability by look agreement and measures calibration error', () => {
    const preds = [p('a', 'a', 1), p('a', 'a', 1), p('a', 'b', 2 / 3), p('a', 'a', 2 / 3)];
    const bins = reliability(preds);
    expect(bins).toEqual([
      { support: 0.67, count: 2, accuracy: 0.5 },
      { support: 1, count: 2, accuracy: 1 },
    ]);
    expect(ece(preds)).toBeCloseTo(0.085, 2);
  });

  it('trades coverage for accuracy when only unanimous answers count', () => {
    const preds = [p('a', 'a', 1), p('a', 'b', 2 / 3)];
    expect(selective(preds, 1)).toEqual({ accuracy: 1, coverage: 0.5 });
  });

  it('simulated citizen errors: a perfect, unanimous AI catches every error with no false alarms', () => {
    const preds = Array.from({ length: 400 }, () => p('a', 'a', 1));
    const s = simulateSecondLook(preds, { q: ['a', 'b', 'c'] }, 0.2, 1);
    expect(s.recall).toBe(1);
    expect(s.falseAlarm).toBe(0);
    expect(s.wrong).toBeGreaterThan(40);
  });
});

describe('wilson', () => {
  it('matches the textbook interval for 68 of 80', async () => {
    const { wilson } = await import('../src/core/metrics');
    const [lo, hi] = wilson(68, 80);
    expect(lo).toBeCloseTo(0.756, 2);
    expect(hi).toBeCloseTo(0.912, 2);
  });
});

describe('site memory', () => {
  const previous = { date: '2026-09-20T09:40:00Z', answers: { bottom_type: 'natural', bank_type: 'natural', channel_form: 'u_shape' } };

  it('flags stable features that differ from the last check at the site', () => {
    const h = runRules({ answers: { bottom_type: 'artificial', bank_type: 'natural' }, previous });
    const hit = h.find((x) => x.id === 'changed-since-last-check');
    expect(hit?.message).toContain('bottom type: Natural');
    expect(hit?.message).not.toContain('bank type');
  });

  it('stays quiet without history, on matching answers, or when either side was not sure', () => {
    expect(ids(runRules({ answers: { bottom_type: 'artificial' } }))).not.toContain('changed-since-last-check');
    expect(ids(runRules({ answers: { bottom_type: 'natural' }, previous }))).not.toContain('changed-since-last-check');
    expect(ids(runRules({ answers: { bottom_type: 'not_sure' }, previous }))).not.toContain('changed-since-last-check');
  });
});
