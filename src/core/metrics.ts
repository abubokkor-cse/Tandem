// Agreement and calibration metrics for the evaluation harness (eval/).

export interface Pred {
  /** Item key, e.g. "photo12:water_aspect" or "photo12:habitats=riffles". */
  key: string;
  question: string;
  truth: string;
  /** null when the AI said it cannot tell. */
  predicted: string | null;
  /** Share of AI looks behind the prediction (0..1). */
  support: number;
}

export function accuracy(preds: Pred[]): number {
  const answered = preds.filter((p) => p.predicted !== null);
  if (!answered.length) return NaN;
  return answered.filter((p) => p.predicted === p.truth).length / answered.length;
}

export function coverage(preds: Pred[]): number {
  if (!preds.length) return NaN;
  return preds.filter((p) => p.predicted !== null).length / preds.length;
}

/** Cohen's kappa between truth and prediction, on answered items. Corrects accuracy for chance. */
export function cohenKappa(preds: Pred[]): number {
  const p = preds.filter((x) => x.predicted !== null);
  if (!p.length) return NaN;
  const labels = [...new Set(p.flatMap((x) => [x.truth, x.predicted as string]))];
  const n = p.length;
  const po = p.filter((x) => x.truth === x.predicted).length / n;
  let pe = 0;
  for (const l of labels) {
    const a = p.filter((x) => x.truth === l).length / n;
    const b = p.filter((x) => x.predicted === l).length / n;
    pe += a * b;
  }
  if (pe === 1) return po === 1 ? 1 : 0;
  return (po - pe) / (1 - pe);
}

export interface Bin {
  support: number;
  count: number;
  accuracy: number;
}

/**
 * Reliability table: accuracy for each level of look agreement. With 3 looks, support
 * is 1/3, 2/3 or 1, so we bin by exact value instead of fixed-width bins.
 */
export function reliability(preds: Pred[]): Bin[] {
  const answered = preds.filter((p) => p.predicted !== null);
  const groups = new Map<number, Pred[]>();
  for (const p of answered) {
    const s = Math.round(p.support * 100) / 100;
    groups.set(s, [...(groups.get(s) ?? []), p]);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([support, g]) => ({ support, count: g.length, accuracy: g.filter((p) => p.predicted === p.truth).length / g.length }));
}

/** Expected calibration error: how far look agreement is from actual accuracy, weighted by bin size. */
export function ece(preds: Pred[]): number {
  const bins = reliability(preds);
  const n = bins.reduce((s, b) => s + b.count, 0);
  if (!n) return NaN;
  return bins.reduce((s, b) => s + (b.count / n) * Math.abs(b.accuracy - b.support), 0);
}

/** Accuracy and coverage if the AI only speaks at or above a given agreement. */
export function selective(preds: Pred[], minSupport: number): { accuracy: number; coverage: number } {
  const gated = preds.map((p) => (p.predicted !== null && p.support >= minSupport ? p : { ...p, predicted: null }));
  return { accuracy: accuracy(gated), coverage: coverage(gated) };
}

/**
 * Simulated citizen errors. For each labelled item we make a citizen answer that is
 * wrong with probability errorRate, then ask: does the second-look rule catch it?
 * recall = share of wrong answers that got a second look.
 * falseAlarm = share of right answers that got one anyway (the cost to citizens).
 */
export function simulateSecondLook(
  preds: Pred[],
  options: Record<string, string[]>,
  errorRate: number,
  minSupport: number,
  seed = 7,
): { recall: number; falseAlarm: number; wrong: number; right: number } {
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  let wrong = 0, caught = 0, right = 0, alarms = 0;
  for (const p of preds) {
    const opts = options[p.question] ?? [];
    const others = opts.filter((o) => o !== p.truth);
    const makeWrong = others.length > 0 && rand() < errorRate;
    const citizen = makeWrong ? others[Math.floor(rand() * others.length)] : p.truth;
    const flagged = p.predicted !== null && p.support >= minSupport && p.predicted !== citizen;
    if (makeWrong) {
      wrong++;
      if (flagged) caught++;
    } else {
      right++;
      if (flagged) alarms++;
    }
  }
  return { recall: wrong ? caught / wrong : NaN, falseAlarm: right ? alarms / right : NaN, wrong, right };
}

/** Wilson score interval for k successes in n trials (95% by default). Honest on small samples. */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (!n) return [NaN, NaN];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}
