import { PAGE_TITLES, QUESTIONS, isAsked, type Answers, type QuestionId } from '../../core/protocol';
import { QuestionField } from './QuestionField';
import { useLang } from '../lang';

export function QuestionPage({ page, answers, onAnswer }: { page: 1 | 2 | 3; answers: Answers; onAnswer: (id: QuestionId, v: Answers[QuestionId]) => void }) {
  const qs = QUESTIONS.filter((q) => q.page === page && isAsked(q, answers));
  const t = useLang();
  return (
    <div className="stack fade-in">
      <div className="stack-sm">
        <p className="eyebrow">Step {page + 2} · Questions {page} of 3</p>
        <h1>{t.pageTitle(page, PAGE_TITLES[page])}</h1>
        {page === 3 && <p className="text-2">Face downstream: your left hand points to the left margin.</p>}
        {page === 1 && <p className="text-2">Answer from what you see. “I’m not sure” is a good answer when you are not sure.</p>}
      </div>
      {qs.map((q) => (
        <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={(v) => onAnswer(q.id, v)} />
      ))}
    </div>
  );
}

export function unansweredOn(page: 1 | 2 | 3, answers: Answers): number {
  return QUESTIONS.filter((q) => q.page === page && q.kind !== 'number' && isAsked(q, answers) && answers[q.id] === undefined).length;
}
