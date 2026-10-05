import { NOT_VISIBLE } from '../../core/ai';
import { optionLabel, question, type Answer, type QuestionId } from '../../core/protocol';
import type { StreamCheck } from '../../core/record';
import { demoRecords } from '../../data/demo';
import { Icon } from '../icons';
import { Results } from '../results/Results';
import { go } from '../router';
import { deleteRecord, loadRecords } from '../storage';

const fmt = (id: QuestionId, v: Answer | string[] | undefined) =>
  v === undefined ? '—' : Array.isArray(v) ? (v.length ? v.map((x) => optionLabel(id, x)).join(', ') : 'None') : optionLabel(id, String(v));

const DECISION: Record<string, string> = {
  corroborated: 'Agreed',
  second_look: 'Second look',
  suggestion: 'AI suggestion',
  ai_unsure: 'AI unsure: no prompt',
  citizen_only: 'Citizen only',
  unanswered: 'Not answered',
};

export function RecordDetail({ id }: { id: string }) {
  const record: StreamCheck | undefined = [...loadRecords(), ...demoRecords()].find((r) => r.id === id);
  if (!record) {
    return (
      <div className="empty card">
        <p>This record is not on this device.</p>
        <a className="btn btn-secondary" href="#/records" style={{ marginTop: 16 }}>Back to records</a>
      </div>
    );
  }
  const photoSrc = (role: string) => record.photos.find((p) => p.role === role)?.thumb;

  return (
    <div className="stack-lg">
      <div className="row between">
        <a className="btn btn-ghost btn-sm" href="#/records"><Icon name="arrowLeft" size={16} /> All records</a>
        {record.synthetic ? (
          <span className="chip unknown" style={{ whiteSpace: 'normal' }}>Demo record: synthetic data for illustration</span>
        ) : (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (confirm('Delete this record from this device?')) {
                deleteRecord(record.id);
                go('/records');
              }
            }}
          >
            <Icon name="trash" size={16} /> Delete
          </button>
        )}
      </div>

      <div>
        <Results record={record} photoSrc={photoSrc} />
      </div>

      <section className="stack" aria-labelledby="audit-title">
        <div>
          <h2 id="audit-title">Audit trail</h2>
          <p className="small muted">
            What the citizen answered first, what the AI saw on its own ({record.ai ? `${record.ai.looks} looks, ${record.ai.model}${record.ai.cached ? ', stored sample run' : ''}` : 'not used'}), and the final answer.
          </p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Citizen first</th>
                <th>AI (looks agreeing)</th>
                <th>Final</th>
                <th>How decided</th>
              </tr>
            </thead>
            <tbody>
              {record.comparisons.map((c) => (
                <tr key={c.question}>
                  <td>{question(c.question).title}</td>
                  <td>{fmt(c.question, c.original ?? c.citizen)}</td>
                  <td style={{ color: 'var(--ai)' }}>
                    {c.ai ? (c.ai.value === NOT_VISIBLE ? 'Cannot tell' : `${fmt(c.question, c.ai.value)} (${Math.round(c.ai.support * c.ai.looks)}/${c.ai.looks})`) : '—'}
                  </td>
                  <td><b>{fmt(c.question, record.answers[c.question])}</b></td>
                  <td>
                    {c.held ? 'AI held back: low track record' : DECISION[c.status]}
                    {c.resolution && ` · ${c.resolution}`}
                    {c.reason && <span className="muted"> · “{c.reason}”</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {record.rules.length > 0 && (
          <div className="stack-sm">
            <h3>Consistency checks</h3>
            {record.rules.map((h) => (
              <div key={h.id} className={`callout ${h.severity === 'safety' ? 'danger' : h.severity === 'check' ? 'warn' : 'info'} small`}>
                <span className="c-icon"><Icon name={h.severity === 'info' ? 'info' : 'alert'} size={16} /></span>
                <span><b>{h.title}.</b> {h.message} <span className="muted">{h.resolution === 'kept' ? '(reviewed, kept as answered)' : ''}</span></span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
