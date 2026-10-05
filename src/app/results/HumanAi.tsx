// "You and the AI": who said what, where they agreed, and who made the final call.
import { NOT_VISIBLE } from '../../core/ai';
import type { Comparison } from '../../core/reconcile';
import { Icon } from '../icons';

export function HumanAiPanel({ comparisons, looks }: { comparisons: Comparison[]; looks?: number }) {
  const answered = comparisons.filter((c) => c.status !== 'unanswered');
  const aiJudged = answered.filter((c) => c.ai && c.ai.value !== NOT_VISIBLE).length;
  const agreed = answered.filter((c) => c.status === 'corroborated').length;
  const changed = answered.filter((c) => (c.status === 'second_look' && c.resolution === 'changed') || (c.status === 'suggestion' && c.resolution === 'accepted')).length;
  const kept = answered.filter((c) => (c.status === 'second_look' && c.resolution !== 'changed') || (c.status === 'suggestion' && c.resolution !== 'accepted')).length;
  const unsure = answered.filter((c) => c.status === 'ai_unsure' && !c.held).length;
  const held = answered.filter((c) => c.held).length;
  const onlyYou = answered.filter((c) => c.status === 'citizen_only').length;
  const total = answered.length || 1;

  const segments = [
    { key: 'agreed', n: agreed, label: 'Agreed', color: 'var(--good)' },
    { key: 'changed', n: changed, label: 'You changed after a second look', color: 'var(--ai)' },
    { key: 'kept', n: kept, label: 'You kept after a second look', color: 'var(--primary)' },
    { key: 'unsure', n: unsure, label: 'AI unsure, stayed quiet', color: 'var(--border-strong)' },
    { key: 'held', n: held, label: 'AI held back: not reliable enough on this question yet', color: 'color-mix(in srgb, var(--ai) 30%, var(--surface-3))' },
    { key: 'only', n: onlyYou, label: 'Only you could judge', color: 'color-mix(in srgb, var(--primary) 35%, var(--surface-3))' },
  ].filter((s) => s.n > 0);

  return (
    <section className="card hai stack" aria-labelledby="hai-title">
      <div className="row between">
        <h2 id="hai-title">You and the AI</h2>
        <span className="chip you"><Icon name="check" size={13} /> Every final answer is yours</span>
      </div>

      <div className="hai-sides">
        <div className="hai-side you">
          <span className="hai-who"><Icon name="user" size={16} /> You</span>
          <b>{answered.length}</b>
          <span>answers from what you saw on site</span>
        </div>
        <div className="hai-link" aria-hidden>
          <span>{agreed}</span>
          <small>agree</small>
        </div>
        <div className="hai-side ai">
          <span className="hai-who"><Icon name="sparkles" size={16} /> AI</span>
          <b>{aiJudged}</b>
          <span>judged from photos only{looks ? `, ${looks} independent looks each` : ''}</span>
        </div>
      </div>

      <div className="hai-bar" role="img" aria-label={segments.map((s) => `${s.label}: ${s.n}`).join(', ')}>
        {segments.map((s) => (
          <span key={s.key} style={{ flexGrow: s.n, background: s.color }} title={`${s.label}: ${s.n}`} />
        ))}
      </div>
      <ul className="hai-legend">
        {segments.map((s) => (
          <li key={s.key}>
            <i style={{ background: s.color }} />
            <span>
              <b>{s.n}</b> {s.label} <span className="muted">· {Math.round((s.n / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
