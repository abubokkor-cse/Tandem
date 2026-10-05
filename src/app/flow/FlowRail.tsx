// Desktop side panel for the check: where you are, what you added, and what the AI is doing (never what it thinks).
import type { StreamCheck } from '../../core/record';
import { Icon } from '../icons';
import type { Photos } from './PhotoStep';
import type { AiState } from './ReviewStep';

interface Props {
  steps: { id: string; label: string }[];
  current: number;
  site: StreamCheck['site'] | null;
  photos: Photos;
  ai: AiState;
  useAi: boolean;
  aiAvailable: boolean | null;
  answered: number;
}

export function FlowRail({ steps, current, site, photos, ai, useAi, aiAvailable, answered }: Props) {
  const thumbs = Object.values(photos).filter(Boolean);
  const aiLine =
    !useAi
      ? { cls: 'off', text: 'Switched off: rule checks only' }
      : aiAvailable === false
        ? { cls: 'off', text: 'Unavailable: rule checks only' }
        : ai.status === 'off' && current <= 1
          ? { cls: 'idle', text: 'Starts once your photos are in' }
          : ai.status === 'off'
            ? { cls: 'off', text: 'Not used for this check' }
      : ai.status === 'working'
        ? { cls: 'working', text: 'Looking at your photos' }
        : ai.status === 'done'
          ? { cls: 'ready', text: 'Its look is ready, sealed' }
          : { cls: 'off', text: 'Unavailable: rule checks only' };

  return (
    <aside className="rail" aria-label="Check overview">
      <div className="rail-card">
        <p className="rail-label">Progress</p>
        <ol className="rail-steps">
          {steps.map((s, i) => (
            <li key={s.id} className={i < current ? 'done' : i === current ? 'now' : ''} aria-current={i === current ? 'step' : undefined}>
              <span className="rail-dot">{i < current ? <Icon name="check" size={12} /> : i + 1}</span>
              {s.label}
            </li>
          ))}
        </ol>
      </div>

      {(site || thumbs.length > 0) && (
        <div className="rail-card">
          <p className="rail-label">Your check</p>
          {site && (
            <p className="rail-site">
              {site.code && <span className="code">{site.code}</span>}
              <b>{site.name}</b>
              {site.city && <span className="muted small">{site.city}</span>}
            </p>
          )}
          {thumbs.length > 0 && (
            <div className="rail-thumbs">
              {thumbs.map((p) => p && <img key={p.meta.role} src={p.preview} alt={`${p.meta.role} photo`} title={p.meta.role} />)}
            </div>
          )}
          {answered > 0 && <p className="small muted">{answered} answers so far</p>}
        </div>
      )}

      <div className="rail-card ai">
        <p className="rail-label"><Icon name="sparkles" size={14} /> AI second look</p>
        <p className={`rail-ai ${aiLine.cls}`}><span className="dot" /> {aiLine.text}</p>
        <ul className="rail-guard">
          <li><Icon name="eyeOff" size={14} /> Never sees your answers</li>
          <li><Icon name="refresh" size={14} /> 3 independent looks</li>
          <li><Icon name="scale" size={14} /> Speaks only when all 3 agree</li>
          <li><Icon name="user" size={14} /> You decide every answer</li>
        </ul>
      </div>
    </aside>
  );
}
