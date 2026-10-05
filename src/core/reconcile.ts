// Compare the citizen's answers with the AI's independent answers.
//
// Principles:
// - The citizen answered first and never saw the AI. Their answer is the record.
// - The AI may only ask for a second look when all of its looks agree
//   (SECOND_LOOK_MIN_SUPPORT). When it is unsure, it stays quiet.
// - It must also have earned trust on that question (trust.ts).
// - Keeping an answer is always one tap, as easy as changing it.
// - The AI never suggests the overall Good / Moderate / Poor rating.

import { NOT_VISIBLE, type AiFinding, type AiReport } from './ai';
import { NOT_SURE, QUESTIONS, isAsked, type Answer, type Answers, type QuestionId } from './protocol';
import { earnedTrust } from './trust';

/** Minimum share of agreeing AI looks before the AI may question an answer. Tuned in eval/. */
export const SECOND_LOOK_MIN_SUPPORT = 1;

export type Status =
  | 'corroborated' // citizen and AI agree
  | 'second_look' // AI disagrees and all its looks agree: ask the citizen to look again
  | 'suggestion' // citizen was not sure and the AI is confident: offer its answer
  | 'ai_unsure' // AI disagrees but its looks do not agree: no prompt
  | 'citizen_only' // AI cannot tell from photos, or the question needs being there
  | 'unanswered';

export type Resolution = 'kept' | 'changed' | 'accepted' | 'declined';

export interface Comparison {
  question: QuestionId;
  status: Status;
  citizen?: Answer;
  ai?: AiFinding;
  /** For multi questions: the options the AI confidently disagrees on. */
  disputedOptions?: string[];
  resolution?: Resolution;
  reason?: string;
  /** The citizen's answer before a second look changed it. */
  original?: Answer;
  /** The AI was confident but held back: weak track record on this question. */
  held?: boolean;
}

function sameAnswer(citizen: Answer, ai: string[]): boolean {
  if (Array.isArray(citizen)) return [...citizen].sort().join('|') === [...ai].sort().join('|');
  return ai.length === 1 && ai[0] === String(citizen);
}

export function compare(
  answers: Answers,
  report: AiReport | null,
  minSupport = SECOND_LOOK_MIN_SUPPORT,
  trusted: (q: QuestionId) => boolean = earnedTrust,
): Comparison[] {
  const out: Comparison[] = [];
  const speak = (q: QuestionId, status: 'second_look' | 'suggestion'): Pick<Comparison, 'status' | 'held'> =>
    trusted(q) ? { status } : { status: 'ai_unsure', held: true };
  for (const q of QUESTIONS) {
    if (!isAsked(q, answers)) continue;
    const citizen = answers[q.id];
    const ai = report?.findings.find((f) => f.question === q.id);

    if (citizen === undefined || citizen === '') {
      out.push({ question: q.id, status: 'unanswered', ai });
      continue;
    }
    if (!ai || ai.value === NOT_VISIBLE || q.visibility === 'field') {
      out.push({ question: q.id, status: 'citizen_only', citizen, ai });
      continue;
    }
    if (citizen === NOT_SURE) {
      out.push({ question: q.id, ...(ai.support >= minSupport ? speak(q.id, 'suggestion') : { status: 'ai_unsure' }), citizen, ai });
      continue;
    }
    if (sameAnswer(citizen, ai.value)) {
      out.push({ question: q.id, status: 'corroborated', citizen, ai });
      continue;
    }

    if (q.kind === 'multi' && Array.isArray(citizen) && ai.optionSupport) {
      // Per option: the AI is confident when its looks unanimously ticked or left it.
      const disputed = q.options
        .map((o) => o.id)
        .filter((id) => {
          const s = ai.optionSupport![id] ?? 0;
          const aiTicked = s >= minSupport;
          const aiLeft = 1 - s >= minSupport;
          const ticked = citizen.includes(id);
          return (aiTicked && !ticked) || (aiLeft && ticked);
        });
      out.push({
        question: q.id,
        ...(disputed.length ? speak(q.id, 'second_look') : { status: 'ai_unsure' }),
        citizen,
        ai,
        disputedOptions: disputed.length ? disputed : undefined,
      });
      continue;
    }

    out.push({ question: q.id, ...(ai.support >= minSupport ? speak(q.id, 'second_look') : { status: 'ai_unsure' }), citizen, ai });
  }
  return out;
}

/** The questions that need the citizen's attention, in form order. */
export function needsReview(comparisons: Comparison[]): Comparison[] {
  return comparisons.filter((c) => (c.status === 'second_look' || c.status === 'suggestion') && !c.resolution);
}

/** Apply the citizen's decision. Returns new answers and the updated comparison. */
export function resolve(
  answers: Answers,
  c: Comparison,
  decision: Resolution,
  reason?: string,
): { answers: Answers; comparison: Comparison } {
  const next = { ...answers };
  const updated: Comparison = { ...c, resolution: decision, reason: reason?.trim() || undefined };
  if ((decision === 'changed' || decision === 'accepted') && c.ai && c.ai.value !== NOT_VISIBLE) {
    const q = QUESTIONS.find((x) => x.id === c.question)!;
    updated.original = c.citizen;
    if (q.kind === 'multi') {
      // Only flip the options the AI was confident about; keep the rest as the citizen had them.
      const set = new Set(Array.isArray(c.citizen) ? c.citizen : []);
      for (const id of c.disputedOptions ?? []) {
        if (set.has(id)) set.delete(id);
        else set.add(id);
      }
      next[c.question] = q.options.map((o) => o.id).filter((id) => set.has(id));
    } else {
      next[c.question] = c.ai.value[0];
    }
    updated.citizen = next[c.question];
  }
  return { answers: next, comparison: updated };
}
