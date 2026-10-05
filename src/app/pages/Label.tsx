// Development tool: label the evaluation photos. The AI's answers are never shown here,
// so the labels stay independent. Labels are written to eval/labels.json by the dev server.
import { useEffect, useMemo, useState } from 'react';
import { EVAL_QUESTIONS, type EvalItem, type LabelFile } from '../../core/evalset';
import { isAsked, type Answers } from '../../core/protocol';
import { QuestionField } from '../flow/QuestionField';
import { Icon } from '../icons';

const found = import.meta.glob('../../../eval/manifest.json', { eager: true, import: 'default' });
const manifest = Object.values(found)[0] as { items: EvalItem[] } | undefined;

export function Label() {
  const items = manifest?.items ?? [];
  const [file, setFile] = useState<LabelFile>({ labeller: '', labels: {} });
  const [i, setI] = useState(0);
  const [status, setStatus] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/labels')
      .then((r) => (r.ok ? r.json() : null))
      .then((f: LabelFile | null) => {
        if (f) {
          setFile(f);
          const firstOpen = items.findIndex((it) => !f.labels[it.id]);
          if (firstOpen > 0) setI(firstOpen);
        }
      })
      .finally(() => setLoaded(true));
  }, [items]);

  const item = items[i];
  const current = (item && file.labels[item.id]) || {};
  const done = useMemo(() => items.filter((it) => file.labels[it.id]).length, [items, file]);

  const save = async (next: LabelFile) => {
    setFile(next);
    const r = await fetch('/api/labels', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) });
    setStatus(r.ok ? 'Saved to eval/labels.json' : 'Could not save: run with npm run dev');
  };

  const setLabel = (qid: string, v: unknown) => {
    const entry = { ...current } as Record<string, unknown>;
    if (v === undefined) delete entry[qid];
    else entry[qid] = v;
    // Audit trail: when this photo was first and last labelled.
    const now = new Date().toISOString();
    entry._first ??= now;
    entry._last = now;
    entry._edits = Number(entry._edits ?? 0) + 1;
    void save({ ...file, labels: { ...file.labels, [item.id]: entry as LabelFile['labels'][string] } });
  };

  if (!import.meta.env.DEV) return <p className="empty">The labelling tool runs in development only (npm run dev).</p>;
  if (!manifest) {
    return (
      <div className="card stack-sm">
        <h1>Label evaluation photos</h1>
        <p>No photos yet. Run <code>npm run eval:fetch</code> first, then reload this page.</p>
      </div>
    );
  }
  if (!loaded) return null;
  if (!file.labeller) {
    return (
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          const name = new FormData(e.currentTarget).get('name')?.toString().trim();
          if (name) void save({ ...file, labeller: name });
        }}
      >
        <h1>Label evaluation photos</h1>
        <p className="text-2">
          You will label {items.length} photos. Your labels are the ground truth the AI is scored against, so answer from the photo only, and choose
          “Cannot tell from this photo” whenever the photo does not show enough. The AI’s answers are never shown here.
        </p>
        <label className="q-title" htmlFor="name">Your name (recorded as the labeller)</label>
        <input id="name" name="name" className="input" required />
        <button className="btn btn-primary">Start labelling</button>
      </form>
    );
  }

  const answers = current as Answers;
  const asked = EVAL_QUESTIONS.filter((q) => isAsked(q, answers));
  const complete = asked.every((q) => current[q.id] !== undefined);

  return (
    <div className="stack">
      <div className="row between">
        <div>
          <p className="eyebrow">Evaluation · labeller: {file.labeller}</p>
          <h1 style={{ fontSize: '1.6rem' }}>Photo {i + 1} of {items.length}</h1>
        </div>
        <div className="stack-sm" style={{ minWidth: 220 }}>
          <div className="progress-meta"><span>{done} labelled</span><span>{Math.round((done / items.length) * 100)}%</span></div>
          <div className="progress-bar"><span style={{ width: `${(done / items.length) * 100}%` }} /></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }} className="label-grid">
        <div className="card stack-sm" style={{ position: 'sticky', top: 76 }}>
          <img src={`/eval/photos/${item.file}`} alt={item.title} style={{ borderRadius: 12, maxHeight: '62vh', objectFit: 'contain', width: '100%', background: 'var(--surface-2)' }} />
          <p className="tiny muted">
            {item.title} · {item.author} · {item.license} · <a href={item.sourceUrl} target="_blank" rel="noreferrer">source</a>
          </p>
          <div className="callout info small">
            <span className="c-icon"><Icon name="info" size={16} /></span>
            <span>Treat the photo as taken facing <b>downstream</b>: the left of the image is the left margin.</span>
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary btn-sm" disabled={i === 0} onClick={() => setI(i - 1)}><Icon name="arrowLeft" size={16} /> Previous</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setLabel('_excluded', current._excluded ? undefined : 'not a usable stream photo')}>
              {current._excluded ? 'Include this photo again' : 'Exclude: not a usable stream photo'}
            </button>
            <button className="btn btn-primary btn-sm" disabled={i === items.length - 1} onClick={() => setI(i + 1)}>
              Next <Icon name="arrowRight" size={16} />
            </button>
          </div>
          <p className="tiny muted" aria-live="polite">{status}{!complete && !current._excluded && ` · ${asked.filter((q) => current[q.id] === undefined).length} questions left on this photo`}</p>
        </div>

        <div className="stack" style={{ opacity: current._excluded ? 0.4 : 1 }}>
          {asked.map((q) => (
            <QuestionField key={`${item.id}-${q.id}`} q={q} value={answers[q.id]} onChange={(v) => setLabel(q.id, v)} hideAiHint labelMode />
          ))}
        </div>
      </div>
      <style>{`@media (max-width: 860px) { .label-grid { grid-template-columns: 1fr !important; } .label-grid > .card { position: static !important; } }`}</style>
    </div>
  );
}
