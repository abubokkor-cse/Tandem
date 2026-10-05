import { HEALTH_RATINGS, type HealthRating } from '../../core/protocol';
import { Icon } from '../icons';
import { useLang } from '../lang';

export function RatingStep({ value, onChange, note, onNote }: { value?: HealthRating; onChange: (r: HealthRating) => void; note: string; onNote: (s: string) => void }) {
  const t = useLang();
  return (
    <div className="stack fade-in">
      <div className="stack-sm">
        <p className="eyebrow">Step 6 · Your overall view</p>
        <h1>How healthy is this stream ecosystem?</h1>
        <p className="text-2">Choose the description that fits best. This is your judgement: the AI will never suggest it.</p>
      </div>

      <fieldset className="q" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sr-only">Overall assessment of the stream ecosystem health</legend>
        <div className="rating-options">
          {HEALTH_RATINGS.map((r) => (
            <label key={r.id} className={`rating ${r.id}`}>
              <input type="radio" name="overall" checked={value === r.id} onChange={() => onChange(r.id)} />
              <span className="swatch" />
              <span>
                <b>{t.health(r.id).label}</b>
                <span className="small text-2" style={{ display: 'block', marginTop: 2 }}>{t.health(r.id).description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="card stack-sm">
        <label htmlFor="note" className="q-title">Anything else researchers should know? <span className="muted small">(optional)</span></label>
        <textarea id="note" className="input" placeholder="e.g. strong smell near the bridge, lots of ducks, water higher than usual…" value={note} onChange={(e) => onNote(e.target.value)} maxLength={600} />
      </div>

      <div className="callout ai small">
        <span className="c-icon"><Icon name="eyeOff" size={18} /></span>
        <span>Next, you will see where the AI’s independent look matches yours, and where it saw something different.</span>
      </div>
    </div>
  );
}
