// The AI may only interrupt on questions where it scored well in the evaluation.
// Read from eval/report.json, so new labels move questions in or out without code changes.

import report from '../../eval/report.json';
import type { QuestionId } from './protocol';

export const MIN_TRACK_RECORD = 0.8;
// Fewer labelled items than this: not measured yet, so not muted either.
export const MIN_TRACK_ITEMS = 5;

export interface TrackRecord {
  question: QuestionId;
  n: number;
  accuracy: number;
  ci: [number, number];
}

const RECORDS = new Map<string, TrackRecord>(
  (report.perQuestion as { question: string; n: number; accuracy: number; ci: number[] }[]).map((q) => [
    q.question,
    { question: q.question as QuestionId, n: q.n, accuracy: q.accuracy, ci: [q.ci[0], q.ci[1]] },
  ]),
);

export function trackRecord(q: QuestionId): TrackRecord | undefined {
  return RECORDS.get(q);
}

export function earnedTrust(q: QuestionId): boolean {
  const t = RECORDS.get(q);
  return !t || t.n < MIN_TRACK_ITEMS || t.accuracy >= MIN_TRACK_RECORD;
}

export function mutedQuestions(): TrackRecord[] {
  return [...RECORDS.values()].filter((t) => !earnedTrust(t.question)).sort((a, b) => a.accuracy - b.accuracy);
}
