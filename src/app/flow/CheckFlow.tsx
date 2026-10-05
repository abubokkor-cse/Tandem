import { useEffect, useMemo, useRef, useState } from 'react';
import type { AiReport, AnomalyKind } from '../../core/ai';
import type { Answer, Answers, HealthRating, PhotoRole, QuestionId } from '../../core/protocol';
import { compare, resolve, type Comparison, type Resolution } from '../../core/reconcile';
import { previousCheck, type AiStatus, type StreamCheck } from '../../core/record';
import { integritySignals, type IntegritySignal } from '../../core/integrity';
import { runRules } from '../../core/rules';
import { aiAvailability, analyze } from '../api';
import { Icon } from '../icons';
import { processPhoto, type ProcessedPhoto } from '../photo';
import { go } from '../router';
import { loadRecords, newId, saveRecord } from '../storage';
import { demoRecords } from '../../data/demo';
import { Results } from '../results/Results';
import { PhotoStep, type Photos } from './PhotoStep';
import { QuestionPage, unansweredOn } from './QuestionPage';
import { RatingStep } from './RatingStep';
import { ReviewStep, type AiState } from './ReviewStep';
import { SiteStep } from './SiteStep';
import { FlowRail } from './FlowRail';

const STEPS = ['site', 'photos', 'q1', 'q2', 'q3', 'rating', 'review', 'results'] as const;
type Step = (typeof STEPS)[number];
const STEP_LABEL: Record<Step, string> = {
  site: 'Site',
  photos: 'Photos',
  q1: 'Channel & flow',
  q2: 'Water',
  q3: 'Margins',
  rating: 'Your rating',
  review: 'Second look',
  results: 'Results',
};

interface SampleSet {
  id: string;
  title: string;
  credit: string;
  photos: { role: PhotoRole; file: string }[];
  report?: AiReport;
}

export function CheckFlow() {
  const [step, setStep] = useState<Step>('site');
  const [site, setSite] = useState<StreamCheck['site'] | null>(null);
  const [photos, setPhotos] = useState<Photos>({});
  const [useAi, setUseAi] = useState(true);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [ai, setAi] = useState<AiState>({ status: 'off' });
  const [answers, setAnswers] = useState<Answers>({});
  const [overall, setOverall] = useState<HealthRating>();
  const [note, setNote] = useState('');
  const [comparisons, setComparisons] = useState<Comparison[] | null>(null);
  const [ruleRes, setRuleRes] = useState<Record<string, 'kept' | 'changed'>>({});
  const [anomalyDec, setAnomalyDec] = useState<Partial<Record<AnomalyKind, 'confirmed' | 'rejected'>>>({});
  const [record, setRecord] = useState<StreamCheck | null>(null);
  const [sample, setSample] = useState<SampleSet | null>(null);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const [skipped, setSkipped] = useState(false);

  const abort = useRef<AbortController | null>(null);
  const sentKey = useRef('');

  const questionMs = useRef(0);
  const [integrity, setIntegrity] = useState<IntegritySignal[]>([]);
  useEffect(() => {
    if (step !== 'q1' && step !== 'q2' && step !== 'q3') return;
    const t0 = performance.now();
    return () => {
      questionMs.current += performance.now() - t0;
    };
  }, [step]);
  const trace = () => ({ questionMs: Math.round(questionMs.current), automated: navigator.webdriver === true });

  const previous = useMemo(() => previousCheck([...loadRecords(), ...demoRecords()], site?.code), [site?.code]);

  useEffect(() => {
    aiAvailability().then((a) => setAiAvailable(a.available));
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // Warn before leaving a check half-way.
  useEffect(() => {
    if (step === 'site' || step === 'results') return;
    const on = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, [step]);

  const streamPhotos = useMemo(() => Object.values(photos).filter((p): p is ProcessedPhoto => !!p), [photos]);
  const hasStreamPhoto = !!(photos.upstream || photos.downstream);

  /** Start the AI in the background. Its answers stay hidden until the review step. */
  const startAi = () => {
    if (!useAi || aiAvailable === false || !hasStreamPhoto) {
      abort.current?.abort();
      setAi({ status: 'off' });
      return;
    }
    const key = streamPhotos.map((p) => p.meta.role + p.data.length + p.data.slice(-32)).join('|');
    if (key === sentKey.current && ai.status !== 'error') return;
    sentKey.current = key;
    setComparisons(null);
    if (sample?.report && streamPhotos.every((p) => sample.photos.some((s) => s.role === p.meta.role))) {
      setAi({ status: 'done', report: { ...sample.report, cached: true } });
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setAi({ status: 'working', startedAt: Date.now() });
    analyze(streamPhotos.map((p) => ({ role: p.meta.role, data: p.data })), ctrl.signal)
      .then((report) => !ctrl.signal.aborted && setAi({ status: 'done', report }))
      .catch((e: Error) => !ctrl.signal.aborted && setAi({ status: 'error', error: e.message }));
  };

  useEffect(() => {
    if (step !== 'review') return;
    // Sample photos are a demo, not a reused observation.
    const earlier = sample ? [] : loadRecords().flatMap((r) => r.photos.map((p) => p.hash ?? '')).filter(Boolean);
    setIntegrity(integritySignals({ answers, trace: trace(), photos: streamPhotos.map((p) => p.meta), earlier }));
  }, [step]);

  // Compare once the citizen reaches the review and the AI has finished (or is off).
  useEffect(() => {
    if (step !== 'review' || comparisons || ai.status === 'working') return;
    setComparisons(compare(answers, ai.status === 'done' ? ai.report : null));
  }, [step, comparisons, ai, answers]);

  const loadSamples = async () => {
    setSamplesLoading(true);
    try {
      const m = (await (await fetch('/samples/manifest.json')).json()) as { sets: SampleSet[] };
      const set = m.sets[Math.floor(Math.random() * m.sets.length)];
      const next: Photos = {};
      for (const ph of set.photos) {
        const blob = await (await fetch(`/samples/${ph.file}`)).blob();
        next[ph.role] = await processPhoto(blob, ph.role);
      }
      setPhotos(next);
      setSample(set);
    } catch {
      alert('Sample photos could not be loaded.');
    } finally {
      setSamplesLoading(false);
    }
  };

  const setAnswer = (id: QuestionId, v: Answer | undefined) =>
    setAnswers((a) => {
      const n = { ...a };
      if (v === undefined) delete n[id];
      else n[id] = v;
      // A dependent question disappears when its condition goes away.
      if (id === 'vegetation_left' && v !== 'yes') delete n.vegetation_type_left;
      if (id === 'vegetation_right' && v !== 'yes') delete n.vegetation_type_right;
      return n;
    });

  const onResolve = (c: Comparison, d: Resolution, reason?: string) => {
    const r = resolve(answers, c, d, reason);
    setAnswers(r.answers);
    setComparisons((all) => (all ?? []).map((x) => (x.question === c.question ? r.comparison : x)));
  };

  const finish = () => {
    const report = ai.status === 'done' ? ai.report : null;
    const aiStatus: AiStatus = !useAi || skipped ? 'declined' : aiAvailable === false ? 'unavailable' : ai.status === 'error' ? 'failed' : report ? 'used' : 'declined';
    const rules = runRules({ answers, overall, previous }).map((h) => ({ ...h, resolution: ruleRes[h.id] ? ('kept' as const) : undefined }));
    const rec: StreamCheck = {
      id: newId(),
      createdAt: new Date().toISOString(),
      site: site!,
      photos: streamPhotos.map((p) => p.meta),
      answers,
      overall,
      note: note.trim() || undefined,
      aiStatus,
      ai: report,
      comparisons: comparisons ?? compare(answers, report),
      rules,
      anomalies: (report?.anomalies ?? []).map((a) => ({ ...a, decision: anomalyDec[a.kind] ?? 'unanswered' })),
      trace: trace(),
      integrity,
    };
    saveRecord(rec);
    setRecord(rec);
    setStep('results');
  };

  const idx = STEPS.indexOf(step);
  const canNext =
    (step === 'site' && !!site) ||
    (step === 'photos' && hasStreamPhoto) ||
    step === 'q1' || step === 'q2' || step === 'q3' ||
    (step === 'rating' && !!overall);

  const next = () => {
    if (step === 'photos') startAi();
    if (step === 'rating') setComparisons(null);
    setStep(STEPS[idx + 1]);
  };
  const back = () => setStep(STEPS[Math.max(0, idx - 1)]);

  const photoSrc = (role: string) => photos[role as PhotoRole]?.preview;
  const unanswered = step === 'q1' ? unansweredOn(1, answers) : step === 'q2' ? unansweredOn(2, answers) : step === 'q3' ? unansweredOn(3, answers) : 0;
  const showAiPill = ['q1', 'q2', 'q3', 'rating'].includes(step) && ai.status !== 'off';

  if (step === 'results' && record) {
    return (
      <div className="stack-lg">
        <Results record={record} photoSrc={photoSrc} />
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => { window.location.hash = '#/check'; window.location.reload(); }}>
            <Icon name="camera" size={18} /> Start another check
          </button>
          <button className="btn btn-secondary" onClick={() => go('/records')}>
            <Icon name="list" size={18} /> All records
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flow-layout">
    <div className="flow-main">
      <div className="progress" aria-label={`Step ${idx + 1} of ${STEPS.length - 1}: ${STEP_LABEL[step]}`}>
        <div className="progress-meta">
          <span>{STEP_LABEL[step]}</span>
          <span>{idx + 1} / {STEPS.length - 1}</span>
        </div>
        <div className="progress-bar"><span style={{ width: `${((idx + 1) / (STEPS.length - 1)) * 100}%` }} /></div>
        {showAiPill && (
          <div aria-live="polite">
            {ai.status === 'working' && <span className="ai-status working"><span className="dot" /> The AI is looking at your photos · hidden until you finish</span>}
            {ai.status === 'done' && <span className="ai-status"><Icon name="eyeOff" size={14} /> The AI’s look is ready · hidden until you finish</span>}
            {ai.status === 'error' && <span className="ai-status off"><span className="dot" /> AI unavailable · your check continues</span>}
          </div>
        )}
      </div>

      {step === 'site' && <SiteStep value={site} onChange={setSite} />}
      {step === 'photos' && (
        <PhotoStep
          photos={photos}
          onPhoto={(role, p) => {
            setPhotos((ph) => ({ ...ph, [role]: p ?? undefined }));
            setSample(null);
          }}
          useAi={useAi}
          onUseAi={setUseAi}
          aiAvailable={aiAvailable}
          onSamples={loadSamples}
          samplesLoading={samplesLoading}
          sampleCredit={sample?.credit}
        />
      )}
      {step === 'q1' && <QuestionPage page={1} answers={answers} onAnswer={setAnswer} />}
      {step === 'q2' && <QuestionPage page={2} answers={answers} onAnswer={setAnswer} />}
      {step === 'q3' && <QuestionPage page={3} answers={answers} onAnswer={setAnswer} />}
      {step === 'rating' && <RatingStep value={overall} onChange={setOverall} note={note} onNote={setNote} />}
      {step === 'review' && (
        <ReviewStep
          ai={skipped ? { status: 'off' } : ai}
          comparisons={comparisons}
          answers={answers}
          overall={overall}
          previous={previous}
          integrity={integrity}
          anomalyDecisions={anomalyDec}
          ruleResolutions={ruleRes}
          photoSrc={photoSrc}
          onSkipAi={() => {
            abort.current?.abort();
            setSkipped(true);
            setAi({ status: 'off' });
            setComparisons(compare(answers, null));
          }}
          onResolve={onResolve}
          onAnswer={setAnswer}
          onOverall={setOverall}
          onRule={(id, r) => setRuleRes((x) => ({ ...x, [id]: r }))}
          onAnomaly={(k, d) => setAnomalyDec((x) => ({ ...x, [k]: d }))}
          onFinish={finish}
        />
      )}

      {step !== 'review' && (
        <div className="sticky-actions">
          {unanswered > 0 && <p className="small muted" style={{ marginBottom: 8 }}>{unanswered} question{unanswered > 1 ? 's' : ''} left blank. You can still continue.</p>}
          <div className="btn-row">
            {idx > 0 && (
              <button className="btn btn-secondary" onClick={back} style={{ flex: '0 1 140px' }}>
                <Icon name="arrowLeft" size={18} /> Back
              </button>
            )}
            <button className="btn btn-primary" onClick={next} disabled={!canNext}>
              {step === 'rating' ? (ai.status === 'off' ? 'Check my answers' : 'Compare with the AI') : 'Continue'} <Icon name="arrowRight" size={18} />
            </button>
          </div>
          {step === 'photos' && !hasStreamPhoto && <p className="small muted" style={{ marginTop: 8 }}>Add an upstream or downstream photo to continue.</p>}
        </div>
      )}
    </div>
    <FlowRail
      steps={STEPS.slice(0, -1).map((id) => ({ id, label: STEP_LABEL[id] }))}
      current={idx}
      site={site}
      photos={photos}
      ai={skipped ? { status: 'off' } : ai}
      useAi={useAi}
      aiAvailable={aiAvailable}
      answered={Object.keys(answers).length}
    />
    </div>
  );
}
