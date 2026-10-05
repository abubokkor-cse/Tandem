import { useRef, useState } from 'react';
import { PHOTO_ROLES, type PhotoRole } from '../../core/protocol';
import { Icon } from '../icons';
import { processPhoto, type ProcessedPhoto } from '../photo';

export type Photos = Partial<Record<PhotoRole, ProcessedPhoto>>;

interface Props {
  photos: Photos;
  onPhoto: (role: PhotoRole, p: ProcessedPhoto | null) => void;
  useAi: boolean;
  onUseAi: (v: boolean) => void;
  aiAvailable: boolean | null;
  onSamples: () => void;
  samplesLoading: boolean;
  sampleCredit?: string;
}

export function PhotoStep({ photos, onPhoto, useAi, onUseAi, aiAvailable, onSamples, samplesLoading, sampleCredit }: Props) {
  return (
    <div className="stack fade-in">
      <div className="stack-sm">
        <p className="eyebrow">Step 2 · Photos</p>
        <h1>Photograph the stream</h1>
        <p className="text-2">
          Stand on the bank. Take one photo looking <b>upstream</b> (where the water comes from) and one looking <b>downstream</b> (where it goes).
        </p>
      </div>

      <div className="photo-grid">
        {PHOTO_ROLES.map((r) => (
          <PhotoSlot key={r.id} role={r.id} label={r.label} hint={r.hint} recommended={r.required} photo={photos[r.id]} onPhoto={(p) => onPhoto(r.id, p)} />
        ))}
      </div>

      {sampleCredit ? (
        <div className="callout info small">
          <span className="c-icon"><Icon name="image" size={18} /></span>
          <span>Sample photos: {sampleCredit}</span>
        </div>
      ) : (
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onSamples} disabled={samplesLoading}>
          <Icon name="image" size={16} /> {samplesLoading ? 'Loading samples…' : 'Not at a stream? Try with sample photos'}
        </button>
      )}

      <div className={`card ${useAi && aiAvailable ? 'ai' : ''}`}>
        <div className="toggle-row">
          <div className="card-title">
            <Icon name="sparkles" size={20} />
            <div>
              <h3>Ask the AI for an independent look</h3>
              <p className="small muted">{aiAvailable === false ? 'The AI is not available right now. Your check works fully without it.' : 'Recommended. It stays hidden until you have answered.'}</p>
            </div>
          </div>
          <label className="switch">
            <span className="sr-only">Use the AI</span>
            <input type="checkbox" checked={useAi && aiAvailable !== false} disabled={aiAvailable === false} onChange={(e) => onUseAi(e.target.checked)} />
            <span className="track" />
          </label>
        </div>
        {useAi && aiAvailable !== false && (
          <ul className="small text-2" style={{ margin: '14px 0 0', paddingLeft: 20, display: 'grid', gap: 4 }}>
            <li>The AI starts looking at your photos now, while you answer. <b>You will not see what it thinks until you are done.</b></li>
            <li>Photos are resized on your phone and their location data is removed before they are sent to Google Gemini.</li>
            <li>The AI never decides for you, and never rates the stream’s health.</li>
          </ul>
        )}
      </div>
    </div>
  );
}

function PhotoSlot({ role, label, hint, recommended, photo, onPhoto }: { role: PhotoRole; label: string; hint: string; recommended: boolean; photo?: ProcessedPhoto; onPhoto: (p: ProcessedPhoto | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      onPhoto(await processPhoto(file, role));
    } catch {
      setError('Could not read this image. Try another photo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`photo-slot ${photo ? 'filled' : ''}`}>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} aria-label={`${label} file`} />
      {photo ? (
        <>
          <img src={photo.preview} alt={`${label} you added`} />
          <div className="meta">
            <div className="row between">
              <b className="small">{label}</b>
              <button className="btn btn-ghost btn-sm" onClick={() => input.current?.click()}>
                <Icon name="refresh" size={14} /> Retake
              </button>
            </div>
            {photo.meta.issues.length ? (
              photo.meta.issues.map((i) => (
                <span key={i} className="photo-issue"><Icon name="alert" size={14} /> {i}</span>
              ))
            ) : (
              <span className="photo-issue" style={{ color: 'var(--good)' }}><Icon name="check" size={14} /> Sharp and well lit</span>
            )}
          </div>
        </>
      ) : (
        <button className="drop" onClick={() => input.current?.click()} disabled={busy} style={{ border: 0, background: 'transparent' }}>
          {recommended && <span className="chip you req">Recommended</span>}
          <span className="icon-circle"><Icon name="camera" size={22} /></span>
          <b>{busy ? 'Processing…' : label}</b>
          <span className="small muted">{hint}</span>
          {error && <span className="small" style={{ color: 'var(--bad)' }}>{error}</span>}
        </button>
      )}
    </div>
  );
}
