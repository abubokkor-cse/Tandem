import { useMemo } from 'react';
import { LESSON_TEXT, lessons, type Lesson } from '../../core/learning';
import { question } from '../../core/protocol';
import type { StreamCheck } from '../../core/record';
import { MIN_TRACK_RECORD, mutedQuestions, trackRecord } from '../../core/trust';
import { Icon } from '../icons';

const CHIP: Record<Lesson, { cls: string; label: string }> = {
  citizens_revise: { cls: 'ai', label: 'Improve the guidance' },
  citizens_overrule: { cls: 'fair', label: 'Check the AI' },
  mixed: { cls: 'unknown', label: 'Mixed' },
  too_few: { cls: 'unknown', label: 'Too few yet' },
};

export function Lessons({ records }: { records: StreamCheck[] }) {
  const rows = useMemo(() => lessons(records), [records]);
  const muted = mutedQuestions();
  if (!rows.length) return null;

  return (
    <section className="card stack" aria-labelledby="lessons-title">
      <div className="stack-sm">
        <p className="eyebrow">Human in the loop, both ways</p>
        <h2 id="lessons-title">What the second looks teach</h2>
        <p className="small text-2">
          Every second look ends in a citizen’s decision. Where citizens usually change their answer, the question is hard and the guidance should improve.
          Where they usually keep it, the AI is probably misreading photos and should be checked. The citizen corrects the AI as much as the AI helps the citizen.
        </p>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Question</th>
              <th>AI asked</th>
              <th>Changed</th>
              <th>Kept</th>
              <th>Most given reason</th>
              <th>What it suggests</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const t = trackRecord(r.question);
              return (
                <tr key={r.question}>
                  <td>
                    <b>{question(r.question).title}</b>
                    {t && <span className="tiny muted" style={{ display: 'block' }}>Benchmark {Math.round(t.accuracy * 100)}% (n={t.n})</span>}
                  </td>
                  <td>{r.asked}{r.held > 0 && <span className="tiny muted" style={{ display: 'block' }}>+{r.held} held back</span>}</td>
                  <td>{r.changed}</td>
                  <td>{r.kept}</td>
                  <td className="small">{r.topReason ? `“${r.topReason}”` : '—'}</td>
                  <td className="small">
                    <span className={`chip ${CHIP[r.lesson].cls}`} title={LESSON_TEXT[r.lesson]}>{CHIP[r.lesson].label}</span>
                    {r.lesson !== 'too_few' && <span className="tiny muted" style={{ display: 'block', marginTop: 4 }}>{LESSON_TEXT[r.lesson]}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {muted.length > 0 && (
        <p className="small icon-note">
          <Icon name="eyeOff" size={16} />
          <span>
            <b>Muted by track record:</b>{' '}
            {muted.map((t) => `${question(t.question).title} (${Math.round(t.accuracy * 100)}% on ${t.n} test items)`).join(', ')}. Below{' '}
            {Math.round(MIN_TRACK_RECORD * 100)}% on the benchmark, the AI records what it saw but never interrupts a citizen. New labelled photos move questions in or out
            automatically.
          </span>
        </p>
      )}
    </section>
  );
}
