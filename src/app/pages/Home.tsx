import { QUESTIONS } from '../../core/protocol';
import { RULES } from '../../core/rules';
import report from '../../../eval/report.json';
import { trackRecord } from '../../core/trust';
import { Icon } from '../icons';
import { SITES, CITIES } from '../sites';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const twoOfThree = report.reliability.find((r) => r.support < 1)?.accuracy ?? 0;
const bank = trackRecord('bank_type');

export function Home() {
  return (
    <div className="stack-lg fade-in">
      <section className="hero hero-grid">
        <div className="stack">
          <div className="badge-row">
            <span className="chip mono">OneAquaHealth citizen science</span>
            <span className="chip ai mono">Track 3 · AI-supported assessment</span>
          </div>
          <h1 className="hero-title">
            You observe.<br />
            <span className="t-ai">The AI looks.</span><br />
            <span className="t-you">You decide.</span>
          </h1>
          <p className="lead">
            Check an urban stream with the official OneAquaHealth questions. An AI then takes three independent looks at your photos, without
            ever seeing your answers. Where you agree, the data gets stronger. Where you don’t, you take a second look, and the final word is yours.
          </p>
          <div className="btn-row" style={{ maxWidth: 520 }}>
            <a className="btn btn-primary" href="#/check">
              <Icon name="camera" size={18} /> Start a stream check
            </a>
            <a className="btn btn-secondary" href="#/about">Read the model card</a>
          </div>
          <div className="hero-stats">
            <div><b className="t-ai">{pct(report.overall.accuracyAllAgree)}</b><span>agreement when all 3 AI looks agree</span></div>
            <div><b>{pct(twoOfThree)}</b><span>at 2 of 3, so the AI stays quiet</span></div>
            <div><b className="t-you">0</b><span>errors in the official FHIR validator</span></div>
          </div>
        </div>

        <div className="demo-card" aria-label="Example of one answer being checked">
          <div className="demo-bar"><span>Second look · Bank type</span><span>C1 · Coimbra</span></div>
          <div className="demo-body">
            <div className="track you"><i /><div><span className="k">You · answered first</span><b>Natural (A)</b></div></div>
            <div className="track ai">
              <i />
              <div>
                <span className="k">AI · photos only, never your answers</span>
                <b>Artificial (B)</b>
                <span className="dots"><em /><em /><em /> all 3 independent looks agree</span>
              </div>
            </div>
            <div className="demo-evidence">
              <img src="/samples/canal-downstream.jpg" alt="The downstream photo: a concrete canal" />
              <span>“Downstream photo, both banks: sloping concrete walls.”</span>
            </div>
            <div className="meter-row"><span>AI track record on this question</span><b>{bank ? `${pct(bank.accuracy)} · ${bank.n} test items` : 'not measured yet'}</b></div>
            <div className="meter"><span style={{ width: pct(bank?.accuracy ?? 0) }} /></div>
            <div className="demo-actions" aria-hidden>
              <span className="you">Keep my answer</span>
              <span>Change to Artificial</span>
            </div>
          </div>
        </div>
      </section>

      <section className="band" aria-labelledby="band-title">
        <div className="stack-sm" style={{ maxWidth: 720 }}>
          <p className="eyebrow">How a check works</p>
          <h2 id="band-title">Two independent looks. One human decision.</h2>
        </div>
        <svg className="band-lines" viewBox="0 0 1192 70" aria-hidden>
          <path d="M0 20 C 300 20, 600 20, 860 20 S 1040 35, 1100 35" className="l-you" />
          <path d="M0 50 C 300 50, 600 50, 860 50 S 1040 35, 1100 35" className="l-ai" />
          <circle cx="1110" cy="35" r="12" className="c-out" />
          <circle cx="1110" cy="35" r="5" className="c-in" />
        </svg>
        <ol className="band-steps">
          <li><span className="k you">01 · You</span><h3>You observe</h3><p>Photos and the official questions, word for word, with plain-language help. The AI starts, sealed.</p></li>
          <li><span className="k ai">02 · AI</span><h3>The AI looks, blind</h3><p>Three independent looks at the photos only. It says “cannot tell” when a photo doesn’t show enough.</p></li>
          <li><span className="k">03 · Compare</span><h3>It speaks only when sure</h3><p>All 3 looks must agree, on a question where it has earned trust in testing. Otherwise it stays quiet.</p></li>
          <li><span className="k">04 · You</span><h3>You decide</h3><p>Keep or change in one tap. The overall rating is always yours, and every step is in the audit trail.</p></li>
        </ol>
      </section>

      <section className="stack" aria-labelledby="t3-title">
        <div className="stack-sm">
          <p className="eyebrow">Track 3 · AI-supported assessment</p>
          <h2 id="t3-title" style={{ fontSize: 'clamp(1.5rem, 1.1rem + 1.4vw, 2.2rem)' }}>What the track asks for, and how Tandem delivers it</h2>
          <p className="text-2" style={{ maxWidth: 760 }}>
            The challenge: use AI responsibly to support stream assessment without replacing human judgment, because citizen observations can be
            inconsistent and error-prone.
          </p>
        </div>
        <div className="t3-grid">
          {[
            {
              icon: 'sparkles' as const,
              ask: 'AI prompts',
              title: 'An abstain-first prompt',
              points: ['The official questions, with a rule for each on when to say “cannot tell”', 'Knows that left and right flip between upstream and downstream photos', 'Strict JSON schema; the evidence is written before the answer'],
              link: { href: '#/about', label: 'Read the exact prompt' },
            },
            {
              icon: 'scale' as const,
              ask: 'Validation checks',
              title: 'Checks before trust',
              points: [`${RULES.length} consistency rules, e.g. “rated Good but reported sewage”`, 'Bots quarantined; too-fast answers and reused photos flagged', 'Site memory: flags a bed or bank that differs from the last check at the same site'],
            },
            {
              icon: 'eye' as const,
              ask: 'Explainable AI',
              title: 'Evidence you can check',
              points: ['Every AI answer names the photo and the spot it used', 'Confidence shown as “3 of 3 looks agree”, not a magic number', 'Its measured track record shown on every question it asks about'],
              link: { href: '#/about', label: 'Open the model card' },
            },
            {
              icon: 'user' as const,
              ask: 'Human-in-the-loop',
              title: 'Blind first, human final',
              points: ['You answer before the AI says anything: no copying', 'It speaks only when all 3 looks agree, on questions where it has earned trust', 'Keep or change in one tap; the overall rating is always yours'],
            },
          ].map((c) => (
            <article key={c.ask} className="t3-card">
              <span className="t3-ask"><Icon name={c.icon} size={15} /> {c.ask}</span>
              <h3>{c.title}</h3>
              <ul>
                {c.points.map((p) => (
                  <li key={p}><Icon name="check" size={14} /> {p}</li>
                ))}
              </ul>
              {c.link && <a href={c.link.href} className="small">{c.link.label} →</a>}
            </article>
          ))}
        </div>
        <div className="t3-strip">
          <span><Icon name="globe" size={16} /> FHIR R4 export following the OneAquaHealth Implementation Guide</span>
          <span><Icon name="pin" size={16} /> 106 real OneAquaHealth research sites</span>
          <span><Icon name="list" size={16} /> Researchers see what citizens’ decisions teach</span>
          <span><Icon name="shield" size={16} /> Photos stripped of location on the device</span>
        </div>
      </section>

      <section className="card ai pad-lg stack">
        <div className="card-title">
          <Icon name="eyeOff" size={22} />
          <h2>Why the AI answers second</h2>
        </div>
        <p className="text-2">
          When people see an AI’s answer first, they tend to go along with it, even when it is wrong. This is called <b>automation bias</b>.
          So Tandem keeps the AI’s view hidden until you have given yours. That keeps your observation independent, and makes every
          agreement between you and the AI real evidence.
        </p>
      </section>

      <section className="grid-2">
        {[
          { icon: 'user' as const, title: 'Your answer is the record', text: 'The AI never overwrites anything. Keeping your answer is one tap, just like changing it.' },
          { icon: 'sparkles' as const, title: 'The AI speaks only when sure', text: 'It asks for a second look only when all three of its looks agree. Otherwise it stays quiet.' },
          { icon: 'scale' as const, title: 'You rate the stream’s health', text: 'The overall Good / Moderate / Poor rating is yours. The AI never suggests it.' },
          { icon: 'shield' as const, title: 'Private by design', text: 'Photos are resized and stripped of location data on your phone. Records stay on your device.' },
        ].map((x) => (
          <div key={x.title} className="card flat stack-sm">
            <span style={{ color: 'var(--primary)' }}><Icon name={x.icon} size={22} /></span>
            <h3>{x.title}</h3>
            <p className="small text-2">{x.text}</p>
          </div>
        ))}
      </section>

      <section className="card tinted">
        <div className="tiles">
          <div className="stat"><b>{SITES.length}</b><span className="small muted">OneAquaHealth research sites</span></div>
          <div className="stat"><b>{CITIES.length}</b><span className="small muted">cities: {CITIES.join(', ')}</span></div>
          <div className="stat"><b>{QUESTIONS.length}</b><span className="small muted">official questions, word for word</span></div>
          <div className="stat"><b>3</b><span className="small muted">independent AI looks per check</span></div>
        </div>
      </section>
    </div>
  );
}
