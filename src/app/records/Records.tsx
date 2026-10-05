import { useMemo, useState } from 'react';
import { download, toCsv, toJson } from '../../core/export';
import { ratingLabel } from '../../core/health';
import { summarize, TRUST_TEXT, type StreamCheck, type TrustLabel } from '../../core/record';
import { demoRecords } from '../../data/demo';
import { Icon } from '../icons';
import { loadRecords } from '../storage';
import { Lessons } from './Lessons';

type Filter = 'all' | TrustLabel;

export function Records() {
  const [filter, setFilter] = useState<Filter>('all');
  const [showDemo, setShowDemo] = useState(true);
  const mine = useMemo(() => loadRecords(), []);
  const all = useMemo(() => [...mine, ...(showDemo ? demoRecords() : [])], [mine, showDemo]);

  const rows = useMemo(
    () =>
      all
        .map((r) => ({ r, t: summarize(r) }))
        .filter((x) => filter === 'all' || x.t.label === filter)
        .sort((a, b) => Number(a.t.label === 'quarantined') - Number(b.t.label === 'quarantined') || b.t.priority - a.t.priority || b.r.createdAt.localeCompare(a.r.createdAt)),
    [all, filter],
  );

  const count = (l: TrustLabel) => all.filter((r) => summarize(r).label === l).length;
  const kept = all.reduce((s, r) => s + summarize(r).keptAfterSecondLook, 0);
  const changed = all.reduce((s, r) => s + summarize(r).changedAfterSecondLook, 0);

  return (
    <div className="stack-lg fade-in">
      <div className="row between">
        <div className="stack-sm">
          <p className="eyebrow">For researchers</p>
          <h1>Stream check records</h1>
          <p className="text-2">Sorted so the checks where the citizen and the AI disagreed come first. That is where an expert learns the most.</p>
        </div>
        <a className="btn btn-primary" href="#/check"><Icon name="camera" size={18} /> New check</a>
      </div>

      <div className="tiles">
        <div className="tile"><span className="t-head">Records</span><span className="t-word">{all.length}</span></div>
        <div className="tile good"><span className="t-head">Corroborated</span><span className="t-word">{count('corroborated')}</span></div>
        <div className="tile fair"><span className="t-head">Worth a closer look</span><span className="t-word">{count('closer_look')}</span></div>
        <div className="tile ai-tile">
          <span className="t-head">Second looks</span>
          <span className="t-word">{changed + kept}</span>
          <span className="t-why">{changed} changed · {kept} kept by the citizen</span>
        </div>
      </div>

      <div className="row between">
        <div className="segmented" role="group" aria-label="Filter records">
          {(['all', 'closer_look', 'corroborated', 'citizen_reported', ...(count('quarantined') ? ['quarantined'] : [])] as Filter[]).map((f) => (
            <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : TRUST_TEXT[f].title}
            </button>
          ))}
        </div>
        <div className="row">
          <label className="row small" style={{ gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={showDemo} onChange={(e) => setShowDemo(e.target.checked)} /> Show demo records
          </label>
          <button className="btn btn-secondary btn-sm" onClick={() => download('tandem-records.csv', toCsv(all), 'text/csv')}><Icon name="download" size={16} /> CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={() => download('tandem-records.json', toJson(all), 'application/json')}><Icon name="download" size={16} /> JSON</button>
        </div>
      </div>

      {rows.length ? (
        <div className="stack-sm" role="list">
          {rows.map(({ r, t }) => (
            <RecordCard key={r.id} r={r} label={t.label} reasons={t.reasons} corroborated={t.corroborated} comparable={t.comparable} />
          ))}
        </div>
      ) : (
        <div className="empty card">
          <p>No records here yet.</p>
          <a className="btn btn-primary" href="#/check" style={{ marginTop: 16 }}>Start a stream check</a>
        </div>
      )}

      <Lessons records={all} />
    </div>
  );
}

function RecordCard({ r, label, reasons, corroborated, comparable }: { r: StreamCheck; label: TrustLabel; reasons: string[]; corroborated: number; comparable: number }) {
  const thumb = r.photos.find((p) => p.thumb)?.thumb;
  return (
    <a className="record-card" href={`#/records/${encodeURIComponent(r.id)}`} role="listitem">
      {thumb ? <img src={thumb} alt="" /> : <span className="ph" />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8 }}>
          <b>{r.site.name}</b>
          {r.site.code && <span className="chip">{r.site.code}</span>}
          {r.synthetic && <span className="chip unknown">Demo</span>}
        </div>
        <p className="small muted">
          {r.site.city ? `${r.site.city} · ` : ''}
          {new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          {comparable > 0 && ` · ${corroborated}/${comparable} answers confirmed by the AI`}
          {r.aiStatus !== 'used' && ' · no AI'}
        </p>
        {reasons.length > 0 && <p className="small" style={{ color: 'var(--fair)' }}>{reasons.join(' · ')}</p>}
      </div>
      <div className="stack-sm" style={{ alignItems: 'flex-end' }}>
        <span className={`chip ${label === 'corroborated' ? 'good' : label === 'closer_look' ? 'fair' : label === 'quarantined' ? 'bad' : 'unknown'}`}>{TRUST_TEXT[label].title}</span>
        {r.overall && <span className="small muted">Rated {ratingLabel(r.overall).replace(' quality', '')}</span>}
      </div>
    </a>
  );
}
