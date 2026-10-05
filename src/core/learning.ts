// Per question, across records: do citizens usually change their answer after a second
// look (the question is hard) or keep it (the AI is probably misreading photos)?

import type { QuestionId } from './protocol';
import { isQuarantined } from './integrity';
import type { StreamCheck } from './record';

export type Lesson = 'citizens_revise' | 'citizens_overrule' | 'mixed' | 'too_few';

export interface QuestionLesson {
  question: QuestionId;
  asked: number;
  changed: number;
  kept: number;
  held: number;
  topReason?: string;
  lesson: Lesson;
}

export const MIN_DECISIONS = 2;
const PATTERN = 0.6;

export const LESSON_TEXT: Record<Lesson, string> = {
  citizens_revise: 'Citizens usually change their answer here. The question or its help text may be hard: improve the guidance or training.',
  citizens_overrule: 'Citizens usually keep their answer here. The AI may be misreading photos: review its evidence, add labelled photos, or mute it.',
  mixed: 'No clear pattern yet: sometimes the citizen, sometimes the AI was right.',
  too_few: 'Too few decisions to see a pattern.',
};

export function lessons(records: StreamCheck[]): QuestionLesson[] {
  const by = new Map<QuestionId, { asked: number; changed: number; kept: number; held: number; reasons: Map<string, number> }>();
  const get = (q: QuestionId) => {
    let x = by.get(q);
    if (!x) by.set(q, (x = { asked: 0, changed: 0, kept: 0, held: 0, reasons: new Map() }));
    return x;
  };

  for (const r of records.filter((x) => !isQuarantined(x.integrity))) {
    for (const c of r.comparisons) {
      if (c.held) get(c.question).held++;
      if (c.status !== 'second_look' && c.status !== 'suggestion') continue;
      const x = get(c.question);
      x.asked++;
      if (c.resolution === 'changed' || c.resolution === 'accepted') x.changed++;
      else if (c.resolution === 'kept' || c.resolution === 'declined') x.kept++;
      if (c.reason) x.reasons.set(c.reason, (x.reasons.get(c.reason) ?? 0) + 1);
    }
  }

  return [...by.entries()]
    .map(([question, x]) => {
      const decided = x.changed + x.kept;
      const lesson: Lesson =
        decided < MIN_DECISIONS ? 'too_few' : x.changed / decided >= PATTERN ? 'citizens_revise' : x.kept / decided >= PATTERN ? 'citizens_overrule' : 'mixed';
      const topReason = [...x.reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      return { question, asked: x.asked, changed: x.changed, kept: x.kept, held: x.held, topReason, lesson };
    })
    .sort((a, b) => b.asked - a.asked || b.held - a.held);
}
