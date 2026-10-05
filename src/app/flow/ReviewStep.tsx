import { useEffect, useMemo, useState } from 'react';
import { ANOMALY_LABELS, NOT_VISIBLE, type AiAnomaly, type AiReport, type AnomalyKind } from '../../core/ai';
import { HEALTH_RATINGS, optionLabel, question, type Answer, type Answers, type HealthRating, type QuestionId } from '../../core/protocol';
import type { Comparison, Resolution } from '../../core/reconcile';
import { runRules, type RuleHit, type PreviousCheck } from '../../core/rules';
import { trackRecord } from '../../core/trust';
import type { IntegritySignal } from '../../core/integrity';
import { Icon } from '../icons';
import { QuestionField } from './QuestionField';

export type AiState =
  | { status: 'off' }
  | { status: 'working'; startedAt: number }
  | { status: 'done'; report: AiReport }
  | { status: 'error'; error: string };

interface Props {
  ai: AiState;
  comparisons: Comparison[] | null;
  answers: Answers;
  overall?: HealthRating;
  /** The last check at this site, for the site memory check. */
  previous?: PreviousCheck;
  integrity?: IntegritySignal[];
  anomalyDecisions: Partial<Record<AnomalyKind, 'confirmed' | 'rejected'>>;
  ruleResolutions: Record<string, 'kept' | 'changed'>;
  photoSrc: (role: string) => string | undefined;
  onSkipAi: () => void;
  onResolve: (c: Comparison, d: Resolution, reason?: string) => void;
  onAnswer: (id: QuestionId, v: Answer | undefined) => void;
  onOverall: (r: HealthRating) => void;
  onRule: (id: string, r: 'kept' | 'changed') => void;
  onAnomaly: (k: AnomalyKind, d: 'confirmed' | 'rejected') => void;
  onFinish: () => void;
}

const fmt = (id: QuestionId, v: Answer | string[] | undefined) =>
  v === undefined ? '—' : Array.isArray(v) ? (v.length ? v.map((x) => optionLabel(id, x)).join(', ') : 'None') : optionLabel(id, String(v));

export function ReviewStep(p: Props) {
  if (p.ai.status === 'working') return <Waiting startedAt={p.ai.startedAt} onSkip={p.onSkipAi} />;
  // Mount the review only once the comparison exists, so its queue is built from it.
  if (!p.comparisons) return null;
  return <Review {...p} />;
}

function Waiting({ startedAt, onSkip }: { startedAt: number; onSkip: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((now - startedAt) / 1000));
  return (
    <div className="card ai pad-lg stack fade-in" style={{ alignItems: 'center', textAlign: 'center' }} aria-live="polite">
      <div className="spinner" aria-hidden />
      <h2>The AI is finishing its independent look</h2>
      <p className="text-2" style={{ maxWidth: 440 }}>
        It is looking at your photos three separate times, without seeing your answers. Where all three looks agree, it is more likely to be right.
      </p>
      <p className="small muted">{s} s · usually 30–60 s</p>
      <button className="btn btn-ghost btn-sm" onClick={onSkip}>Continue without the AI</button>
    </div>
  );
}

type Phase = 'ai' | 'rules' | 'anomalies' | 'done';

function Review(p: Props) {
  const report = p.ai.status === 'done' ? p.ai.report : null;
  const aiItems = useMemo(() => (p.comparisons ?? []).filter((c) => c.status === 'second_look' || c.status === 'suggestion'), [p.comparisons]);
  const anomalies = report?.anomalies ?? [];

  const [phase, setPhase] = useState<Phase>(aiItems.length ? 'ai' : 'rules');
  const [i, setI] = useState(0);
  const [rules, setRules] = useState<RuleHit[] | null>(null);
  const [r, setR] = useState(0);

  // Rules are checked after the AI items, on the answers as they are then.
  useEffect(() => {
    if (phase !== 'rules' || rules) return;
    const hits = runRules({ answers: p.answers, overall: p.overall, previous: p.previous }).filter((h) => h.severity === 'check');
    setRules(hits);
    if (!hits.length) setPhase(anomalies.length ? 'anomalies' : 'done');
  }, [phase, rules, p.answers, p.overall, p.previous, anomalies.length]);

  const nextAi = () => {
    if (i + 1 < aiItems.length) setI(i + 1);
    else setPhase('rules');
  };
  const nextRule = () => {
    if (rules && r + 1 < rules.length) setR(r + 1);
    else setPhase(anomalies.length ? 'anomalies' : 'done');
  };

  const counts = useMemo(() => {
    const c = p.comparisons ?? [];
    return {
      agree: c.filter((x) => x.status === 'corroborated').length,
      review: aiItems.length,
      onlyYou: c.filter((x) => x.status === 'citizen_only').length,
      unsure: c.filter((x) => x.status === 'ai_unsure').length,
      held: c.filter((x) => x.held),
    };
  }, [p.comparisons, aiItems.length]);

  return (
    <div className="stack fade-in">
      <div className="stack-sm">
        <p className="eyebrow">Step 7 · Second look</p>
        <h1>{report ? 'You and the AI' : 'Quick consistency check'}</h1>
      </div>

      {p.integrity?.map((s) => (
        <div key={s.id} className={`callout ${s.level === 'quarantine' ? 'danger' : 'warn'} small`} role="status">
          <span className="c-icon"><Icon name="alert" size={18} /></span>
          <span><b>{s.title}.</b> {s.message}</span>
        </div>
      ))}

      {p.ai.status === 'error' && (
        <div className="callout warn small">
          <span className="c-icon"><Icon name="alert" size={18} /></span>
          <span>The AI could not look this time: {p.ai.error} Your check is complete without it.</span>
        </div>
      )}

      {report && (
        <div className="card stack">
          {!report.scene.is_stream && (
            <div className="callout danger small">
              <span className="c-icon"><Icon name="alert" size={18} /></span>
              <span>The AI did not see a stream in these photos. If that is wrong, keep going: your answers are the record. Researchers will see this note.</span>
            </div>
          )}
          <div className="tiles three">
            <Stat n={counts.agree} label="confirmed by the AI" tone="good" />
            <Stat n={counts.review} label="to look at again" tone={counts.review ? 'ai' : 'unknown'} />
            <Stat n={counts.onlyYou + counts.unsure} label="only you could judge" tone="unknown" />
          </div>
          <p className="small muted">
            The AI only asks for a second look when all {report.looks} of its looks agree, on questions where it has a good track record. When it is unsure, it stays quiet and your answer stands.
          </p>
          {counts.held.length > 0 && (
            <p className="small icon-note">
              <Icon name="eyeOff" size={16} />
              <span>
                The AI also saw something different for <b>{counts.held.map((x) => question(x.question).title.toLowerCase()).join(', ')}</b>, but held back:
                in testing it is not reliable enough on {counts.held.length > 1 ? 'these questions' : 'this question'} yet. Its answer is kept in the record for researchers.
              </span>
            </p>
          )}
        </div>
      )}

      {phase === 'ai' && aiItems[i] && (
        <SecondLook
          key={aiItems[i].question}
          c={(p.comparisons ?? []).find((x) => x.question === aiItems[i].question)!}
          index={i}
          total={aiItems.length}
          photoSrc={p.photoSrc}
          onDecide={(d, reason) => {
            p.onResolve(aiItems[i], d, reason);
            nextAi();
          }}
        />
      )}

      {phase === 'rules' && rules && rules[r] && (
        <RuleCard
          key={rules[r].id}
          hit={rules[r]}
          index={r}
          total={rules.length}
          answers={p.answers}
          overall={p.overall}
          onAnswer={p.onAnswer}
          onOverall={p.onOverall}
          onDone={(res) => {
            p.onRule(rules[r].id, res);
            nextRule();
          }}
        />
      )}

      {phase === 'anomalies' && (
        <Anomalies items={anomalies} decisions={p.anomalyDecisions} photoSrc={p.photoSrc} looks={report?.looks ?? 3} onDecide={p.onAnomaly} onDone={() => setPhase('done')} />
      )}

      {phase === 'done' && (
        <div className="card pad-lg stack fade-in" style={{ textAlign: 'center', alignItems: 'center' }}>
          <span className="icon-circle" style={{ width: 56, height: 56, borderRadius: 999, background: 'var(--good-soft)', color: 'var(--good)', display: 'grid', placeItems: 'center' }}>
            <Icon name="check" size={28} />
          </span>
          <h2>All set</h2>
          <p className="text-2">Your answers are final. See what they say about the stream.</p>
          <button className="btn btn-primary" onClick={p.onFinish}>
            See the results <Icon name="arrowRight" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: 'good' | 'ai' | 'unknown' }) {
  return (
    <div className={`tile ${tone === 'ai' ? 'ai-tile' : tone}`}>
      <span className="t-word" style={{ fontSize: '1.7rem' }}>{n}</span>
      <span className="small text-2">{label}</span>
    </div>
  );
}

export function Looks({ support, looks }: { support: number; looks: number }) {
  const k = Math.round(support * looks);
  return (
    <span className="looks" title={`${k} of ${looks} independent AI looks agree`}>
      {Array.from({ length: looks }, (_, j) => <i key={j} className={j < k ? '' : 'off'} />)}
      <span className="small" style={{ marginLeft: 4 }}>{k === looks ? `all ${looks} looks agree` : `${k} of ${looks} looks agree`}</span>
    </span>
  );
}

function TrackLine({ id }: { id: QuestionId }) {
  const t = trackRecord(id);
  return (
    <div className="track-record">
      <div className="meter-row">
        <span>AI track record on this question</span>
        <b>{t ? `${Math.round(t.accuracy * 100)}% · ${t.n} test items` : 'not measured yet'}</b>
      </div>
      <div className="meter" aria-hidden><span style={{ width: `${Math.round((t?.accuracy ?? 0) * 100)}%` }} /></div>
      <span className="tiny muted">
        {t ? 'How often it matched an independent reference in testing.' : 'This question is not in the benchmark yet.'} It can still be wrong; you were there.
      </span>
    </div>
  );
}

const KEEP_REASONS = ['I saw it in person', 'The photos don’t show it well', 'The AI misread the photo'];

function SecondLook({ c, index, total, photoSrc, onDecide }: { c: Comparison; index: number; total: number; photoSrc: (r: string) => string | undefined; onDecide: (d: Resolution, reason?: string) => void }) {
  const q = question(c.question);
  const ai = c.ai!;
  const aiValue = ai.value === NOT_VISIBLE ? [] : ai.value;
  const [reason, setReason] = useState('');
  const suggestion = c.status === 'suggestion';
  const img = photoSrc(ai.photo);

  // For multi questions, describe only the options in dispute.
  const disputed = c.disputedOptions ?? [];
  const citizenList = Array.isArray(c.citizen) ? c.citizen : [];
  const aiSaw = disputed.filter((o) => !citizenList.includes(o));
  const aiDidNotSee = disputed.filter((o) => citizenList.includes(o));
  const plainFor = aiValue.map((v) => q.options.find((o) => o.id === v)).find((o) => o?.plain);

  return (
    <section className="card stack fade-in" aria-labelledby="sl-title">
      <div className="row between">
        <span className="review-count">{suggestion ? 'Suggestion' : 'Second look'} · {index + 1} of {total}</span>
        <span className="chip ai"><Icon name="sparkles" size={14} /> AI</span>
      </div>
      <div>
        <h2 id="sl-title">{q.title}</h2>
        <p className="text-2 small">{q.text}</p>
      </div>

      <div className="compare">
        <div className="side you">
          <div className="who"><Icon name="user" size={14} /> You said</div>
          <div className="answer">{suggestion ? 'I’m not sure' : fmt(q.id, c.citizen)}</div>
        </div>
        <div className="side ai">
          <div className="who"><Icon name="sparkles" size={14} /> The AI saw</div>
          <div className="answer">
            {q.kind === 'multi' && disputed.length ? (
              <>
                {aiSaw.length > 0 && <span style={{ display: 'block' }}>{aiSaw.map((o) => optionLabel(q.id, o)).join(', ')}</span>}
                {aiDidNotSee.length > 0 && <span style={{ display: 'block' }} className="small">No sign of: {aiDidNotSee.map((o) => optionLabel(q.id, o)).join(', ')}</span>}
              </>
            ) : (
              fmt(q.id, aiValue)
            )}
          </div>
          <div style={{ marginTop: 8, color: 'var(--ai)' }}><Looks support={ai.support} looks={ai.looks} /></div>
        </div>
      </div>

      <TrackLine id={q.id} />

      {ai.evidence && (
        <div className="evidence">
          {img && <img src={img} alt={`The ${ai.photo} photo`} />}
          <div>
            <p className="small muted" style={{ fontWeight: 600 }}>What the AI based this on</p>
            <p>“{ai.evidence}”</p>
          </div>
        </div>
      )}

      {plainFor?.plain && (
        <p className="q-help"><Icon name="info" size={16} /> <span><b>{plainFor.label}</b> means: {plainFor.plain.toLowerCase()}.</span></p>
      )}

      <hr className="divider" />
      <p className="q-title">{suggestion ? 'Does the AI’s answer look right to you?' : 'Take another look. Which is right?'}</p>

      {!suggestion && (
        <div className="stack-sm">
          <span className="small muted">If you keep your answer, you can say why (optional):</span>
          <div className="reason-chips" role="group" aria-label="Reason for keeping">
            {KEEP_REASONS.map((r) => (
              <button key={r} className="chip" aria-pressed={reason === r} onClick={() => setReason(reason === r ? '' : r)}>{r}</button>
            ))}
          </div>
        </div>
      )}

      <div className="btn-row">
        {suggestion ? (
          <>
            <button className="btn btn-secondary" onClick={() => onDecide('declined')}>Stay “not sure”</button>
            <button className="btn btn-ai" onClick={() => onDecide('accepted')}>Use “{fmt(q.id, aiValue)}”</button>
          </>
        ) : (
          <>
            <button className="btn btn-primary" onClick={() => onDecide('kept', reason)}>
              <Icon name="user" size={16} /> Keep my answer
            </button>
            <button className="btn btn-secondary" onClick={() => onDecide('changed')}>
              {q.kind === 'multi' ? 'Update to match the AI' : `Change to “${fmt(q.id, aiValue)}”`}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function RuleCard({ hit, index, total, answers, overall, onAnswer, onOverall, onDone }: {
  hit: RuleHit; index: number; total: number; answers: Answers; overall?: HealthRating;
  onAnswer: (id: QuestionId, v: Answer | undefined) => void; onOverall: (r: HealthRating) => void; onDone: (r: 'kept' | 'changed') => void;
}) {
  const [editing, setEditing] = useState(false);
  const [initial] = useState(() => JSON.stringify({ answers, overall }));
  const changed = JSON.stringify({ answers, overall }) !== initial;
  const qs = hit.uses.filter((u): u is QuestionId => u !== 'overall');

  return (
    <section className="card stack fade-in" aria-labelledby="rule-title">
      <div className="row between">
        <span className="review-count">Consistency check · {index + 1} of {total}</span>
        <span className="chip fair"><Icon name="scale" size={14} /> Rule, no AI</span>
      </div>
      <h2 id="rule-title">{hit.title}</h2>
      <p>{hit.message}</p>
      <p className="tiny muted">Based on: {hit.basis}</p>

      {editing && (
        <div className="stack">
          {hit.uses.includes('overall') && (
            <fieldset className="q q-card">
              <legend className="q-title">Your overall rating</legend>
              <div className="options two">
                {HEALTH_RATINGS.map((r) => (
                  <label key={r.id} className="opt">
                    <input type="radio" name="overall-edit" checked={overall === r.id} onChange={() => onOverall(r.id)} />
                    <span className="mark"><Icon name="check" size={14} /></span>
                    <span className="label">{r.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {qs.map((id) => (
            <QuestionField key={id} q={question(id)} value={answers[id]} onChange={(v) => onAnswer(id, v)} hideAiHint />
          ))}
        </div>
      )}

      <div className="btn-row">
        {editing ? (
          <button className="btn btn-primary" onClick={() => onDone(changed ? 'changed' : 'kept')}>
            {changed ? 'Save and continue' : 'Continue'}
          </button>
        ) : (
          <>
            <button className="btn btn-primary" onClick={() => onDone('kept')}>Keep as answered</button>
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit these answers</button>
          </>
        )}
      </div>
    </section>
  );
}

function Anomalies({ items, decisions, photoSrc, looks, onDecide, onDone }: {
  items: AiAnomaly[]; decisions: Props['anomalyDecisions']; photoSrc: (r: string) => string | undefined; looks: number;
  onDecide: (k: AnomalyKind, d: 'confirmed' | 'rejected') => void; onDone: () => void;
}) {
  return (
    <section className="card stack fade-in" aria-labelledby="an-title">
      <div className="row between">
        <span className="review-count">Beyond the form</span>
        <span className="chip ai"><Icon name="sparkles" size={14} /> AI</span>
      </div>
      <h2 id="an-title">The AI also noticed</h2>
      <p className="text-2 small">The official questions don’t ask about these. Only confirmed items go into the record.</p>
      {items.map((a) => {
        const img = photoSrc(a.photo);
        const d = decisions[a.kind];
        return (
          <div key={a.kind} className="q-card stack-sm">
            <div className="row between">
              <b>{ANOMALY_LABELS[a.kind]}</b>
              <span style={{ color: 'var(--ai)' }}><Looks support={a.support} looks={looks} /></span>
            </div>
            <div className="evidence">
              {img && <img src={img} alt={`The ${a.photo} photo`} />}
              <p className="small">“{a.evidence}”</p>
            </div>
            <div className="btn-row">
              <button className={`btn btn-sm ${d === 'confirmed' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={d === 'confirmed'} onClick={() => onDecide(a.kind, 'confirmed')}>
                <Icon name="check" size={14} /> I saw it too
              </button>
              <button className={`btn btn-sm ${d === 'rejected' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={d === 'rejected'} onClick={() => onDecide(a.kind, 'rejected')}>
                <Icon name="x" size={14} /> Not there
              </button>
            </div>
          </div>
        );
      })}
      <button className="btn btn-primary" onClick={onDone}>Continue <Icon name="arrowRight" size={18} /></button>
    </section>
  );
}
