import { useMemo, useState } from 'react';
import type { StreamCheck } from '../../core/record';
import { Icon } from '../icons';
import { CITIES, SITES, withDistance, type Site } from '../sites';

type SiteValue = StreamCheck['site'] | null;

export function SiteStep({ value, onChange }: { value: SiteValue; onChange: (s: SiteValue) => void }) {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState<string>('all');
  const [located, setLocated] = useState<Site[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const [custom, setCustom] = useState(!!value && !value.code);
  const [customName, setCustomName] = useState(value && !value.code ? value.name : '');

  const list = useMemo(() => {
    const base = located ?? SITES;
    const q = query.trim().toLowerCase();
    return base.filter(
      (s) => (city === 'all' || s.city === city) && (!q || `${s.name} ${s.code} ${s.city}`.toLowerCase().includes(q)),
    );
  }, [located, query, city]);

  const locate = () => {
    if (!navigator.geolocation) return setLocError('Location is not available on this device.');
    setLocating(true);
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocated(withDistance(p.coords.latitude, p.coords.longitude));
        setCity('all');
        setLocating(false);
      },
      () => {
        setLocError('Could not get your location. You can still pick from the list.');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  return (
    <div className="stack fade-in">
      <div className="stack-sm">
        <p className="eyebrow">Step 1 · Site</p>
        <h1>Which stream are you at?</h1>
        <p className="text-2">Choose one of the 106 OneAquaHealth research sites, or add your own spot.</p>
      </div>

      <div className="segmented" role="group" aria-label="Site type">
        <button aria-pressed={!custom} onClick={() => setCustom(false)}>OneAquaHealth site</button>
        <button aria-pressed={custom} onClick={() => { setCustom(true); onChange(customName ? { name: customName } : null); }}>My own site</button>
      </div>

      {custom ? (
        <div className="card stack-sm">
          <label htmlFor="site-name" className="q-title">Site name</label>
          <input
            id="site-name"
            className="input"
            placeholder="e.g. Brook behind the library"
            value={customName}
            onChange={(e) => {
              setCustomName(e.target.value);
              onChange(e.target.value.trim() ? { name: e.target.value.trim() } : null);
            }}
          />
          <p className="small muted">Your exact location is not recorded. Researchers see the name you give.</p>
        </div>
      ) : (
        <div className="card stack">
          <div className="row">
            <button className="btn btn-secondary btn-sm" onClick={locate} disabled={locating}>
              <Icon name="locate" size={16} /> {locating ? 'Finding you…' : located ? 'Nearest first ✓' : 'Sort by distance'}
            </button>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <label htmlFor="site-search" className="sr-only">Search sites</label>
              <input id="site-search" className="input" placeholder="Search by name or code" value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingLeft: 40, minHeight: 40 }} />
              <span style={{ position: 'absolute', left: 12, top: 10, color: 'var(--muted)' }}><Icon name="search" size={18} /></span>
            </div>
          </div>
          {locError && <p className="small" style={{ color: 'var(--fair)' }}>{locError}</p>}
          <div className="reason-chips" role="group" aria-label="Filter by city">
            {['all', ...CITIES].map((c) => (
              <button key={c} className="chip" aria-pressed={city === c} onClick={() => setCity(c)}>
                {c === 'all' ? 'All cities' : c}
              </button>
            ))}
          </div>
          <div className="site-list" role="list">
            {list.map((s) => (
              <button
                key={s.code}
                role="listitem"
                className="site"
                aria-pressed={value?.code === s.code}
                onClick={() => onChange({ code: s.code, name: s.name, city: s.city, lat: s.lat, lon: s.lon })}
              >
                <span className="code">{s.code}</span>
                <span>
                  <b>{s.name}</b>
                  <span className="small muted" style={{ display: 'block' }}>{s.city}</span>
                </span>
                {s.distanceKm !== undefined && <span className="dist">{s.distanceKm < 10 ? s.distanceKm.toFixed(1) : Math.round(s.distanceKm)} km</span>}
              </button>
            ))}
            {!list.length && <p className="empty">No site matches “{query}”.</p>}
          </div>
          <p className="tiny muted">Sites: OneAquaHealth public API (api.enora-oah.eu), retrieved 27 Sep 2026.</p>
        </div>
      )}
    </div>
  );
}
