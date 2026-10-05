import { ANOMALY_LABELS, NOT_VISIBLE } from '../../core/ai';
import { toCsv, toJson, download } from '../../core/export';
import { CATEGORIES, aiConfidence, categoryStatuses, healthProfile, ratingLabel, type CategoryId, type Tone } from '../../core/health';
import { toFhirBundle } from '../../core/fhir';
import { oneHealthNotes } from '../../core/onehealth';
import { optionLabel, question, type Answer, type QuestionId } from '../../core/protocol';
import type { Comparison } from '../../core/reconcile';
import { summarize, TRUST_TEXT, type StreamCheck } from '../../core/record';
import { trackRecord } from '../../core/trust';
import { Icon, type IconName } from '../icons';
import { HumanAiPanel } from './HumanAi';

const CAT_ICON: Record<CategoryId, IconName> = {
  water: 'drop',
  pollution: 'trash',
  biodiversity: 'fish',
  vegetation: 'leaf',
  channel: 'waves',
  surroundings: 'building',
  anomalies: 'alert',
};
const TILE_ICON: Record<string, IconName> = { water: 'drop', pollution: 'trash', biodiversity: 'fish', habitat: 'leaf' };
const TONE_COLOR: Record<Tone, string> = { good: 'var(--good)', fair: 'var(--fair)', bad: 'var(--bad)', unknown: 'var(--unknown)' };

const fmt = (id: QuestionId, v: Answer | string[] | undefined) =>
  v === undefined ? 'Not answered' : Array.isArray(v) ? (v.length ? v.map((x) => optionLabel(id, x)).join(', ') : 'None') : optionLabel(id, String(v));

function provenance(c: Comparison | undefined): { text: string; tone: 'good' | 'ai' | 'you' | 'muted' } {
  if (!c) return { text: '', tone: 'muted' };
  const ai = c.ai;
  const k = ai ? `${Math.round(ai.support * ai.looks)}/${ai.looks}` : '';
  const aiSaid = ai && ai.value !== NOT_VISIBLE ? fmt(c.question, ai.value) : '';
  switch (c.status) {
    case 'corroborated':
      return { text: `Confirmed by the AI (${k} looks)`, tone: 'good' };
    case 'second_look':
      if (c.resolution === 'changed') return { text: `Changed after a second look. First answer: ${fmt(c.question, c.original)}`, tone: 'ai' };
      return { text: `Kept after a second look. The AI saw: ${aiSaid}${c.reason ? `. Reason: ${c.reason}` : ''}`, tone: 'you' };
    case 'suggestion':
      return c.resolution === 'accepted'
        ? { text: `You were not sure; you accepted the AI’s answer (${k} looks)`, tone: 'ai' }
        : { text: `You were not sure; the AI suggested ${aiSaid}`, tone: 'you' };
    case 'ai_unsure':
      if (c.held) {
        const t = trackRecord(c.question);
        return { text: `The AI saw ${aiSaid} (${k} looks), but held back: it matched the reference only ${t ? Math.round(t.accuracy * 100) : '?'}% of the time on this question in testing`, tone: 'muted' };
      }
      return { text: `The AI was unsure${aiSaid ? ` (${k} looks saw ${aiSaid})` : ''}, so it did not ask`, tone: 'muted' };
    case 'citizen_only':
      return { text: question(c.question).visibility === 'field' ? 'Only someone on site can judge this' : 'The AI could not tell from the photos', tone: 'muted' };
    default:
      return { text: '', tone: 'muted' };
  }
}

export function Results({ record, photoSrc }: { record: StreamCheck; photoSrc: (role: string) => string | undefined }) {
  const confirmed = record.anomalies.filter((a) => a.decision === 'confirmed');
  const profile = healthProfile(record.answers, confirmed, record.overall);
  const statuses = categoryStatuses(profile, record.answers, confirmed);
  const conf = aiConfidence(record.ai);
  const notes = oneHealthNotes(record.answers, confirmed);
  const trust = summarize(record);
  const cmp = (id: QuestionId) => record.comparisons.find((c) => c.question === id);
  const badgeClass = record.overall ?? 'none';

  return (
    <div className="stack-lg fade-in">
      {record.integrity?.map((s) => (
        <div key={s.id} className={`callout ${s.level === 'quarantine' ? 'danger' : 'warn'} small`}>
          <span className="c-icon"><Icon name="alert" size={18} /></span>
          <span><b>{s.title}.</b> {s.message}</span>
        </div>
      ))}
      <div className="results-cols">
      <div className="stack-lg">
      {/* Overall */}
      <section className="card pad-lg stack" aria-labelledby="overall-title">
        <p className="eyebrow">Overall stream ecosystem health</p>
        <div className="health-hero">
          <div className={`health-badge ${badgeClass}`}>{record.overall ? ratingLabel(record.overall).replace(' quality', '') : 'Not rated'}</div>
          <div className="stack-sm">
            <h1 id="overall-title" style={{ fontSize: '1.6rem' }}>{record.site.name}</h1>
            <p className="text-2 small">
              {record.site.city ? `${record.site.city} · ` : ''}
              {record.site.code ? `Site ${record.site.code} · ` : ''}
              {new Date(record.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
            <p className="small">
              <span className="chip you"><Icon name="user" size={13} /> Your rating is the record</span>
            </p>
            {profile.indicated && (
              <p className="small text-2">
                Your verified answers point to <b>{ratingLabel(profile.indicated)}</b>
                {profile.gap === 0 && ': the same as your rating.'}
                {profile.gap === 1 && ', one step from your rating. That is normal: you saw more than the form asks.'}
                {profile.gap === 2 && '. That is quite different from your rating; a note on why would help researchers.'}
                {profile.capped && <span className="muted"> {profile.capped}</span>}
              </p>
            )}
          </div>
        </div>
      </section>

      {record.ai && <HumanAiPanel comparisons={record.comparisons} looks={record.ai.looks} />}

      {/* Category words */}
      <section className="stack" aria-labelledby="cat-title">
        <h2 id="cat-title">At a glance</h2>
        <div className="tiles">
          {statuses.map((s) => (
            <div key={s.id} className={`tile ${s.tone}`}>
              <span className="t-head"><Icon name={TILE_ICON[s.id]} size={16} /> {s.title}</span>
              <span className="t-word">{s.word}</span>
              {s.because.length > 0 && <span className="t-why">{s.because.slice(0, 3).join(' · ')}</span>}
            </div>
          ))}
          <div className="tile ai-tile span-all">
            <span className="t-head"><Icon name="sparkles" size={16} /> AI confidence</span>
            <span className="t-word">{conf.value === null ? 'No AI' : `${conf.word} · ${conf.unanimous} of ${conf.answered}`}</span>
            <span className="t-why">{conf.explanation}</span>
          </div>
        </div>
      </section>

      </div>
      <div className="stack-lg">
      {/* Dimensions */}
      <section className="card stack" aria-labelledby="dim-title">
        <div>
          <h2 id="dim-title">The four signs of a healthy stream</h2>
          <p className="small muted">From the official OneAquaHealth definition of “Good quality”. Built from your final answers, not by the AI.</p>
        </div>
        {profile.dimensions.map((d) => {
          const tone: Tone = d.score === null ? 'unknown' : d.score >= 0.7 ? 'good' : d.score >= 0.4 ? 'fair' : 'bad';
          return (
            <div key={d.id} className="stack-sm">
              <div className="row between">
                <b>{d.title}</b>
                <span className="small" style={{ color: TONE_COLOR[tone], fontWeight: 650 }}>
                  {d.score === null ? 'Not enough answers' : tone === 'good' ? 'Good' : tone === 'fair' ? 'Moderate' : 'Poor'}
                </span>
              </div>
              <div className="dim-bar" role="img" aria-label={`${d.title}: ${d.score === null ? 'unknown' : Math.round(d.score * 100) + ' out of 100'}`}>
                <span style={{ width: `${d.score === null ? 0 : Math.max(4, d.score * 100)}%`, background: TONE_COLOR[tone] }} />
              </div>
              {d.because.length > 0 && <span className="small muted">{d.because.join(' · ')}</span>}
            </div>
          );
        })}
      </section>

      {/* One Health */}
      {notes.length > 0 && (
        <section className="stack" aria-labelledby="oh-title">
          <div>
            <h2 id="oh-title">What it means: One Health</h2>
            <p className="small muted">Stream, animal and human health are connected. These notes come from what was observed, not from lab tests.</p>
          </div>
          <div className="notes">
            {notes.map((n, i) => (
              <div key={i} className={`note ${n.tone}`}>
                <Icon name={n.for === 'people' ? 'heart' : n.for === 'animals' ? 'paw' : 'globe'} size={20} />
                <div>
                  <span className="n-for">{n.for === 'people' ? 'People' : n.for === 'animals' ? 'Animals' : 'Ecosystem'}</span>
                  <p className="small">{n.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      </div>
      </div>
      {/* Detail by category */}
      <section className="stack" aria-labelledby="detail-title">
        <div className="row between">
          <h2 id="detail-title">Every answer, and how it was decided</h2>
          <span className={`chip ${trust.label === 'corroborated' ? 'good' : trust.label === 'closer_look' ? 'fair' : 'unknown'}`}>{TRUST_TEXT[trust.label].title}</span>
        </div>
        <p className="small muted">{TRUST_TEXT[trust.label].body}{trust.reasons.length ? ` (${trust.reasons.join('; ')})` : ''}</p>
        <div className="cat-grid">
        {CATEGORIES.map((cat) => {
          const qs = cat.questions.filter((id) => cmp(id));
          const an = record.anomalies.filter((a) => cat.anomalies.includes(a.kind));
          if (!qs.length && !an.length) return null;
          return (
            <details key={cat.id} className="cat" open={cat.id === 'water' || cat.id === 'pollution'}>
              <summary>
                <span className="cat-icon"><Icon name={CAT_ICON[cat.id]} size={18} /></span>
                {cat.title}
                <Icon name="chevronDown" size={18} className="chev" />
              </summary>
              <div className="cat-body">
                {qs.map((id) => {
                  const pv = provenance(cmp(id));
                  return (
                    <div key={id} className="answer-row">
                      <span className="a-q">{question(id).title}</span>
                      <span className="a-v">{fmt(id, record.answers[id])}</span>
                      {pv.text && (
                        <span className="a-prov" style={{ color: pv.tone === 'good' ? 'var(--good)' : pv.tone === 'ai' ? 'var(--ai)' : pv.tone === 'you' ? 'var(--primary)' : undefined }}>
                          {pv.text}
                        </span>
                      )}
                    </div>
                  );
                })}
                {an.map((a) => (
                  <div key={a.kind} className="answer-row">
                    <span className="a-q">Noticed by the AI</span>
                    <span className="a-v">{ANOMALY_LABELS[a.kind]}</span>
                    <span className="a-prov" style={{ color: a.decision === 'confirmed' ? 'var(--good)' : undefined }}>
                      {a.decision === 'confirmed' ? 'Confirmed by you' : a.decision === 'rejected' ? 'You said it was not there' : 'Not checked'} · “{a.evidence}”
                    </span>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
        </div>
      </section>

      {record.note && (
        <section className="card stack-sm">
          <h3>Your note</h3>
          <p className="text-2">{record.note}</p>
        </section>
      )}

      {record.photos.some((ph) => photoSrc(ph.role)) && (
        <section className="stack" aria-labelledby="photos-title">
          <h2 id="photos-title">Photos</h2>
          <div className="photo-grid">
            {record.photos.map((ph) => {
              const src = photoSrc(ph.role);
              return src ? (
                <figure key={ph.role} className="card flat" style={{ padding: 0, margin: 0, overflow: 'hidden' }}>
                  <img src={src} alt={`${ph.role} photo`} style={{ width: '100%', height: 180, objectFit: 'cover' }} />
                  <figcaption className="small text-2" style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{ph.role}</figcaption>
                </figure>
              ) : null;
            })}
          </div>
        </section>
      )}

      <section className="card stack-sm">
        <h3>Export for researchers</h3>
        <p className="small muted">The full audit trail: your first answers, what the AI saw, and what you decided.</p>
        <div className="btn-row">
          <button className="btn btn-secondary btn-sm" onClick={() => download(`tandem-${record.id}.json`, toJson([record]), 'application/json')}>
            <Icon name="download" size={16} /> JSON
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => download(`tandem-${record.id}.csv`, toCsv([record]), 'text/csv')}>
            <Icon name="download" size={16} /> CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => download(`tandem-${record.id}.fhir.json`, JSON.stringify(toFhirBundle(record), null, 2), 'application/fhir+json')}>
            <Icon name="download" size={16} /> FHIR R4
          </button>
        </div>
        <details className="fhir">
          <summary>
            <Icon name="globe" size={16} /> View the FHIR R4 Bundle
            <span className="chip">OneAquaHealth IG · LocationOah + ObservationIndicatorsOah</span>
            <span className="chip good">HL7 validator: 0 errors, 0 warnings</span>
          </summary>
          <p className="small muted">
            Each answer is an Observation with its OneAquaHealth indicator code (e.g. morphology, hydrology, riparian vegetation). How it was
            decided is kept in the note and in a Provenance resource: the citizen is the author, the AI an informant.
          </p>
          <pre><code>{JSON.stringify(toFhirBundle(record), null, 2)}</code></pre>
        </details>
      </section>
    </div>
  );
}
