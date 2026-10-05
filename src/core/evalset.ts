// Which questions the evaluation labels. Questions a photo usually shows, plus bottom
// type and flow, where we want to see the AI say "cannot tell" when it should.
import { QUESTIONS, type Question } from './protocol';

export const EVAL_QUESTIONS: Question[] = QUESTIONS.filter(
  (q) => q.visibility === 'photo' || q.id === 'bottom_type' || q.id === 'water_flow',
);

export interface EvalItem {
  id: string;
  file: string; // path under eval/photos/
  title: string;
  author: string;
  license: string;
  licenseUrl?: string;
  sourceUrl: string;
}

/** A label is an option id, a list (multi), or "not_visible". "excluded" drops the photo. */
export type Label = string | string[];
export interface LabelFile {
  labeller: string;
  labels: Record<string, Record<string, Label> & { _excluded?: string }>;
}
