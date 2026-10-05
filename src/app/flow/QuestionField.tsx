import { NOT_SURE, type Answer, type Question } from '../../core/protocol';
import { Icon } from '../icons';
import { useLang } from '../lang';

interface Props {
  q: Question;
  value: Answer | undefined;
  onChange: (v: Answer | undefined) => void;
  /** Hide the "AI will also look" chip (e.g. in the labelling tool). */
  hideAiHint?: boolean;
  /** Offer "cannot tell from the photo" instead of "not sure" (labelling tool). */
  labelMode?: boolean;
}

export function QuestionField({ q, value, onChange, hideAiHint, labelMode }: Props) {
  const name = `q-${q.id}`;
  const t = useLang();
  return (
    <fieldset className="q q-card">
      <div className="q-head">
        <legend className="q-title">{t.title(q)}{!t.isEnglish && <span className="q-en">{q.title}</span>}</legend>
        {!hideAiHint &&
          (q.visibility === 'field' ? (
            <span className="chip you" title="The AI does not answer this: it needs someone on site.">
              <Icon name="user" size={14} /> Only you can tell
            </span>
          ) : (
            <span className="chip ai" title="After you finish, the AI will independently check this from your photos.">
              <Icon name="sparkles" size={14} /> AI also looks
            </span>
          ))}
      </div>
      <p className="q-text">{t.text(q)}</p>
      {q.help && (
        <p className="q-help">
          <Icon name="info" size={16} /> {q.help}
        </p>
      )}

      {q.kind === 'number' ? (
        <div className="row" style={{ marginTop: 14 }}>
          <label className="sr-only" htmlFor={name}>
            {q.title} in metres
          </label>
          <input
            id={name}
            className="input"
            style={{ maxWidth: 180 }}
            type="number"
            inputMode="decimal"
            step="0.05"
            min="0"
            placeholder="e.g. 0.3"
            value={typeof value === 'number' ? value : ''}
            onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          />
          <span className="muted">metres (optional)</span>
        </div>
      ) : q.kind === 'multi' ? (
        <MultiOptions optionLabel={(id) => t.option(q, id)} q={q} value={Array.isArray(value) ? value : undefined} cannotTell={value === 'not_visible'} onChange={onChange} labelMode={labelMode} />
      ) : (
        <div className={`options ${q.kind === 'yesno' ? 'two' : ''}`}>
          {q.options
            .filter((o) => !(labelMode && o.id === NOT_SURE))
            .map((o) => (
              <label key={o.id} className={`opt ${o.id === NOT_SURE ? 'unsure' : ''}`}>
                <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
                <span className="mark">
                  <Icon name="check" size={14} />
                </span>
                <span>
                  <span className="label">{t.option(q, o.id)}</span>
                  {o.plain && <span className="plain">{o.plain}</span>}
                </span>
              </label>
            ))}
          {labelMode && <CannotTell name={name} checked={value === 'not_visible'} onChange={() => onChange('not_visible')} />}
        </div>
      )}
    </fieldset>
  );
}

function CannotTell({ name, checked, onChange }: { name: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="opt unsure">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span className="mark">
        <Icon name="check" size={14} />
      </span>
      <span className="label">Cannot tell from this photo</span>
    </label>
  );
}

function MultiOptions({ q, value, cannotTell, onChange, labelMode, optionLabel }: { optionLabel: (id: string) => string; q: Question; value: string[] | undefined; cannotTell: boolean; onChange: (v: Answer | undefined) => void; labelMode?: boolean }) {
  const toggle = (id: string) => {
    const set = new Set(value ?? []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange(q.options.map((o) => o.id).filter((x) => set.has(x)));
  };
  return (
    <div className="options">
      {q.options.map((o) => (
        <label key={o.id} className="opt multi">
          <input type="checkbox" checked={!!value?.includes(o.id)} onChange={() => toggle(o.id)} />
          <span className="mark">
            <Icon name="check" size={14} />
          </span>
          <span>
            <span className="label">{optionLabel(o.id)}</span>
            {o.plain && <span className="plain">{o.plain}</span>}
          </span>
        </label>
      ))}
      <label className="opt multi unsure">
        <input type="checkbox" checked={Array.isArray(value) && value.length === 0} onChange={() => onChange(Array.isArray(value) && value.length === 0 ? undefined : [])} />
        <span className="mark">
          <Icon name="check" size={14} />
        </span>
        <span className="label">None of these</span>
      </label>
      {labelMode && (
        <label className="opt multi unsure">
          <input type="checkbox" checked={cannotTell} onChange={() => onChange(cannotTell ? undefined : 'not_visible')} />
          <span className="mark">
            <Icon name="check" size={14} />
          </span>
          <span className="label">Cannot tell from this photo</span>
        </label>
      )}
    </div>
  );
}
