// Was this check made by a person looking at a stream? Nothing here deletes a record:
// automated input is kept but not counted, everything else is flagged for a researcher.

import type { Answers } from './protocol';

export const MIN_SECONDS_PER_ANSWER = 1.5;
export const MIN_ANSWERS_FOR_SPEED = 8;
// Differing dHash bits allowed for two photos to count as the same picture.
export const SAME_PHOTO_BITS = 6;

export interface EffortTrace {
  questionMs: number;
  automated: boolean; // navigator.webdriver
}

export type IntegrityId = 'automated' | 'too_fast' | 'same_photo' | 'reused_photo';

export interface IntegritySignal {
  id: IntegrityId;
  level: 'quarantine' | 'review';
  title: string;
  message: string;
}

export interface IntegrityInput {
  answers: Answers;
  trace?: EffortTrace;
  photos: { role: string; hash?: string }[];
  earlier?: string[]; // photo hashes from earlier checks on this device
}

export function hammingHex(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d + Math.abs(a.length - b.length) * 4;
}

const similar = (a?: string, b?: string) => !!a && !!b && hammingHex(a, b) <= SAME_PHOTO_BITS;

export function integritySignals({ answers, trace, photos, earlier = [] }: IntegrityInput): IntegritySignal[] {
  const out: IntegritySignal[] = [];

  if (trace?.automated) {
    out.push({
      id: 'automated',
      level: 'quarantine',
      title: 'Automated input',
      message: 'This browser reports that it is controlled by automation software, not a person. The record is kept for transparency, but it is not counted and the AI does not learn from it.',
    });
  }

  const n = Object.keys(answers).length;
  if (trace && n >= MIN_ANSWERS_FOR_SPEED) {
    const perAnswer = trace.questionMs / 1000 / n;
    if (perAnswer < MIN_SECONDS_PER_ANSWER) {
      out.push({
        id: 'too_fast',
        level: 'review',
        title: 'Answered very quickly',
        message: `${n} answers in ${Math.round(trace.questionMs / 1000)} s, under ${MIN_SECONDS_PER_ANSWER} s each: faster than the questions can be read. If you know the site well, that is fine; a researcher will take a closer look.`,
      });
    }
  }

  const withHash = photos.filter((p) => p.hash);
  const pair = withHash.flatMap((a, i) => withHash.slice(i + 1).filter((b) => similar(a.hash, b.hash)).map((b) => [a.role, b.role]))[0];
  if (pair) {
    out.push({
      id: 'same_photo',
      level: 'review',
      title: 'The same photo twice',
      message: `The ${pair[0]} and ${pair[1]} photos look like the same picture. Upstream and downstream views help the AI and researchers see both directions.`,
    });
  }

  if (withHash.some((p) => earlier.some((h) => similar(p.hash, h)))) {
    out.push({
      id: 'reused_photo',
      level: 'review',
      title: 'Photo used in an earlier check',
      message: 'A photo matches one from an earlier check on this device. Each check should show the stream as it is today.',
    });
  }

  return out;
}

export const isQuarantined = (signals: IntegritySignal[] | undefined) => !!signals?.some((s) => s.level === 'quarantine');
