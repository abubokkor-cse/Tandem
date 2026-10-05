import { question, type QuestionId } from '../../core/protocol';
import { SECOND_LOOK_MIN_SUPPORT } from '../../core/reconcile';
import { RULES } from '../../core/rules';
import { MIN_TRACK_ITEMS, MIN_TRACK_RECORD, mutedQuestions } from '../../core/trust';
import { buildPrompt, PROMPT_VERSION } from '../../../server/prompt';
import { Icon } from '../icons';

interface EvalReport {
  generatedAt: string;
  model: string;
  promptVersion: string;
  looks: number;
  photos: number;
  labeller: string;
  abstention?: { cannotTell: number; aiAlsoAbstained: number; rate: number | null };
  reference?: { labeller: string; photos: number; overall: EvalReport['overall']; reliability: EvalReport['reliability'] } | null;
  labelCrossCheck?: { photos: number; items: number; agreement: number | null; kappa: number | null } | null;
  overall: { n: number; coverage: number; accuracy: number; kappa: number; accuracyAllAgree: number; coverageAllAgree: number; ece: number };
  perQuestion: { question: QuestionId; n: number; coverage: number; accuracy: number; kappa: number }[];
  reliability: { support: number; count: number; accuracy: number }[];
  simulation: { errorRate: number; recall: number; falseAlarm: number; wrong: number; right: number };
}

// Present only after `npm run eval:report` has been run.
const found = import.meta.glob('../../../eval/report.json', { eager: true, import: 'default' });
const report = Object.values(found)[0] as EvalReport | undefined;

const pct = (x: number) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '—');

export function About() {
  return (
    <div className="stack-lg fade-in" style={{ maxWidth: 1040 }}>
      <div className="stack-sm">
        <p className="eyebrow">Model card</p>
        <h1>How the AI works, and how well</h1>
        <p className="text-2">Everything a citizen, a researcher or a judge needs to decide how much to trust it.</p>
      </div>

      <section className="grid-2">
        <div className="card stack-sm">
          <h3 style={{ color: 'var(--good)' }}><Icon name="check" size={18} /> What the AI does</h3>
          <ul className="small text-2" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            <li>Answers the official questions a photo can show, from the photos only.</li>
            <li>Looks three separate times; agreement between looks is its confidence.</li>
            <li>Says “cannot tell” when the photos do not show enough.</li>
            <li>Explains each answer: which photo, and where in it.</li>
            <li>Notices things the form does not ask (litter, oil, blooms, wildlife). You confirm them.</li>
          </ul>
        </div>
        <div className="card stack-sm">
          <h3 style={{ color: 'var(--bad)' }}><Icon name="x" size={18} /> What it never does</h3>
          <ul className="small text-2" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            <li>See your answers before giving its own.</li>
            <li>Change an answer without you.</li>
            <li>Rate the stream’s overall health.</li>
            <li>Answer what a photo cannot show: water depth, smells, invasive species.</li>
            <li>Name species, or give medical or safety verdicts.</li>
          </ul>
        </div>
      </section>

      <section className="card stack">
        <h2>The rule that decides when it speaks</h2>
        <p className="text-2">
          The AI asks for a second look only when <b>{SECOND_LOOK_MIN_SUPPORT === 1 ? 'all' : `${Math.round(SECOND_LOOK_MIN_SUPPORT * 100)}% of`}</b> of its independent looks agree on an answer
          different from yours. When the looks disagree, the AI is unsure, so it stays quiet and your answer stands. This threshold is chosen from the
          measurements below, to keep false alarms low: every unnecessary prompt costs a volunteer’s time and trust.
        </p>
        <p className="text-2">
          <b>It must also earn trust, one question at a time.</b> Unanimous looks can still be unanimously wrong. So the AI may only interrupt on questions where it
          matched the independent reference at least {Math.round(MIN_TRACK_RECORD * 100)}% of the time in the evaluation (with at least {MIN_TRACK_ITEMS} labelled items).
          On the others it still records what it saw, for researchers, but it does not ask the citizen to look again. Each second look shows the AI’s track record on that question.
        </p>
        {mutedQuestions().length > 0 && (
          <p className="small">
            <b>Muted right now:</b> {mutedQuestions().map((t) => `${question(t.question).title} (${Math.round(t.accuracy * 100)}% on ${t.n} items)`).join(', ')}.
          </p>
        )}
      </section>

      <section className="card stack" aria-labelledby="prompt-title">
        <div className="row between">
          <h2 id="prompt-title">The exact prompt</h2>
          <span className="chip ai">{PROMPT_VERSION}</span>
        </div>
        <p className="text-2">
          Nothing hidden: this is the text sent to the vision model with the photos, three times, at a temperature that lets the looks differ.
          The model never receives the citizen’s answers. Its reply must follow a strict JSON schema, with the evidence written before the answer.
        </p>
        <details className="fhir">
          <summary><Icon name="sparkles" size={16} /> Show the prompt</summary>
          <pre><code>{buildPrompt(['upstream', 'downstream'])}</code></pre>
        </details>
      </section>

      <section className="card stack" aria-labelledby="rules-title">
        <h2 id="rules-title">Validation checks without AI ({RULES.length})</h2>
        <p className="text-2">These run on every check, with or without the AI. Each says which answers it used and why. None of them blocks a record.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Check</th><th>Kind</th><th>Based on</th></tr></thead>
            <tbody>
              {RULES.map((r) => (
                <tr key={r.id}><td>{r.title}</td><td>{r.severity === 'check' ? 'Consistency' : r.severity === 'safety' ? 'Safety note' : 'Info'}</td><td className="small text-2">{r.basis.split(':')[0]}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack">
        <h2>Measured performance</h2>
        {report ? (
          <>
            <p className="small muted">
              {report.photos} openly licensed stream photos, labelled by {report.labeller} before seeing any AI output. Model {report.model}, {report.looks} looks, prompt {report.promptVersion}.
              Generated {new Date(report.generatedAt).toLocaleDateString()}.
            </p>
            {/\bAI\b/.test(report.labeller) ? (
              <div className="callout warn small">
                <span className="c-icon"><Icon name="info" size={18} /></span>
                <span>
                  The reference labels come from a different AI model (Claude), made without seeing Gemini’s answers. Two AI systems can share
                  mistakes, so these figures are agreement with an independent reference and likely overstate real-world accuracy. Human and
                  expert labels, through the built-in blind labelling screen, are the next step.
                </span>
              </div>
            ) : (
              <p className="small text-2">
                Labelled by hand in the blind labelling screen, without seeing the AI’s answers.
                {report.reference && ' A second, independent set of labels from a different AI model (Claude) is shown below as a cross-check.'}
              </p>
            )}
            <div className="tiles">
              <div className="tile ai-tile"><span className="t-head">Agreement when all 3 looks agree</span><span className="t-word">{pct(report.overall.accuracyAllAgree)}</span><span className="t-why">answers {pct(report.overall.coverageAllAgree)} of the time</span></div>
              <div className="tile"><span className="t-head">Agreement, any answer</span><span className="t-word">{pct(report.overall.accuracy)}</span><span className="t-why">Cohen’s κ {report.overall.kappa.toFixed(2)}</span></div>
              <div className="tile good"><span className="t-head">Citizen errors caught</span><span className="t-word">{pct(report.simulation.recall)}</span><span className="t-why">simulated, {pct(report.simulation.errorRate)} error rate</span></div>
              <div className="tile fair"><span className="t-head">False alarms</span><span className="t-word">{pct(report.simulation.falseAlarm)}</span><span className="t-why">correct answers questioned</span></div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Question</th><th>Labelled</th><th>AI answers</th><th>Agreement</th><th>κ</th></tr>
                </thead>
                <tbody>
                  {report.perQuestion.map((q) => (
                    <tr key={q.question}>
                      <td>{question(q.question).title}</td>
                      <td>{q.n}</td>
                      <td>{pct(q.coverage)}</td>
                      <td>{pct(q.accuracy)}</td>
                      <td>{Number.isFinite(q.kappa) ? q.kappa.toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.labelCrossCheck && (
              <p className="small text-2">
                The person and the AI reference agree with each other on {pct(report.labelCrossCheck.agreement ?? NaN)} of {report.labelCrossCheck.items} labels
                (κ {report.labelCrossCheck.kappa}), on the {report.labelCrossCheck.photos} photos both labelled.
              </p>
            )}
            <div className="card stack-sm">
              <h3>Does look agreement predict being right?</h3>
              <p className="small muted">It should, if agreement is a good confidence signal. This is why the AI only speaks when all three looks agree.</p>
              {report.reliability.map((b) => (
                <div key={b.support} className="stack-sm">
                  <div className="row between small"><span>{Math.round(b.support * report.looks)} of {report.looks} looks agree · {b.count} answers</span><b>{pct(b.accuracy)} agree with the reference</b></div>
                  <div className="dim-bar"><span style={{ width: `${b.accuracy * 100}%`, background: 'var(--ai)' }} /></div>
                </div>
              ))}
            </div>
            {report.reference && (
              <div className="card stack-sm">
                <h3>Cross-check: an independent AI reference</h3>
                <p className="small muted">
                  The same {report.reference.photos} photos labelled by a different AI model (Claude), also blind to Gemini’s answers. Two AI systems can
                  share mistakes, so this is likely an overestimate, but it shows the same pattern.
                </p>
                <div className="tiles">
                  <div className="tile ai-tile"><span className="t-head">All 3 looks agree</span><span className="t-word">{pct(report.reference.overall.accuracyAllAgree)}</span></div>
                  {report.reference.reliability.filter((b) => b.support < 1).map((b) => (
                    <div key={b.support} className="tile"><span className="t-head">{Math.round(b.support * report.looks)} of {report.looks} looks agree</span><span className="t-word">{pct(b.accuracy)}</span></div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="callout warn">
            <span className="c-icon"><Icon name="info" size={18} /></span>
            <span>
              Not measured yet on a labelled benchmark. The metrics are built and unit-tested (src/core/metrics.ts: accuracy, Cohen’s κ,
              calibration, selective accuracy and a simulated error-catch rate), and the labelling screen is ready. Until results are published here,
              treat the AI as an unmeasured second opinion: that is why it only speaks when all three looks agree.
            </span>
          </div>
        )}
      </section>

      <section className="card stack-sm">
        <h2>Privacy</h2>
        <ul className="small text-2" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
          <li>Photos are resized on your device. Re-encoding removes EXIF data, including GPS location.</li>
          <li>Only the photos go to the AI (Google Gemini API). Your answers never leave your device.</li>
          <li>On Google’s free tier, Google may use submitted content to improve its products. Avoid photographing people or number plates.</li>
          <li>Records are stored in this browser only. Export them as JSON or CSV to share with researchers.</li>
          <li>You can switch the AI off at the photo step. Every other feature works without it.</li>
        </ul>
      </section>

      <section className="card stack-sm">
        <h2>Limits</h2>
        <ul className="small text-2" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
          <li>A photo shows less than a person on the bank sees. When you and the AI disagree, you may well be right.</li>
          <li>Still photos cannot reliably separate slow from stagnant water, or show what a pipe carries.</li>
          <li>The health view is decision support built from the official definitions, not a validated ecological index or a lab result.</li>
          <li>The evaluation set is small and from open photo collections, not yet from the OneAquaHealth app itself.</li>
        </ul>
      </section>

      <section className="card tinted stack-sm small text-2">
        <h3>Sources and credits</h3>
        <p>Questions: OneAquaHealth Citizen Science App (apps.oneaquahealth.eu). Sites: OneAquaHealth public API. Field protocols: Calapez, Feio et al., Zenodo 10.5281/zenodo.20344421 (CC BY 4.0).</p>
        <p>Built for the OneAquaHealth IEEE Global Hackathon 2026, Track 3: AI-Supported Assessment.</p>
      </section>
    </div>
  );
}
