// Scores the AI's blind answers against two independent sets of reference labels:
//  - a person's labels (eval/labels.json, made in the app's #/label screen), for the photos they labelled;
//  - an independent AI reference (eval/labels-ai-reference.json, Claude), for every photo.
// Both labellers saw only the photo, never Gemini's answers.
// Writes eval/report.json (shown on the model card) and eval/REPORT.md.
// Usage: npm run eval:report
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { NOT_VISIBLE, type AiReport } from '../src/core/ai';
import { EVAL_QUESTIONS, type EvalItem, type LabelFile } from '../src/core/evalset';
import { accuracy, cohenKappa, coverage, ece, reliability, selective, simulateSecondLook, wilson, type Pred } from '../src/core/metrics';
import { NOT_SURE, isAsked, type Answers } from '../src/core/protocol';
import { PROMPT_VERSION } from '../server/prompt';
import { DEFAULT_MODEL } from '../server/gemini';

const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
const looks = Number(process.env.TANDEM_SAMPLES) || 3;
const { items } = JSON.parse(readFileSync('eval/manifest.json', 'utf8')) as { items: EvalItem[] };
const read = (p: string) => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as LabelFile) : null);
const human = read('eval/labels.json');
const reference = read('eval/labels-ai-reference.json');
const runDir = `eval/runs/${model}`;
const runs = new Map<string, AiReport>();
for (const f of existsSync(runDir) ? readdirSync(runDir) : []) runs.set(f.replace('.json', ''), JSON.parse(readFileSync(`${runDir}/${f}`, 'utf8')));

const round = (x: number, d = 3) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null);
const isComplete = (lab: Record<string, unknown>) => EVAL_QUESTIONS.filter((q) => isAsked(q, lab as Answers)).every((q) => lab[q.id] !== undefined);

function score(labels: LabelFile, kind: 'person' | 'ai') {
  const preds: Pred[] = [];
  const options: Record<string, string[]> = {};
  let cannotTell = 0, aiAlsoAbstained = 0, photos = 0, excluded = 0;
  for (const it of items) {
    const lab = labels.labels[it.id];
    const run = runs.get(it.id);
    if (!lab) continue;
    if (lab._excluded) {
      excluded++;
      continue;
    }
    // A person's partly labelled photo is left out until it is finished.
    if (!run || (kind === 'person' && !isComplete(lab))) continue;
    photos++;
    const answers = lab as unknown as Answers;
    for (const q of EVAL_QUESTIONS) {
      if (!isAsked(q, answers)) continue;
      const truth = lab[q.id];
      if (truth === undefined) continue;
      const f = run.findings.find((x) => x.question === q.id);
      const aiAbstains = !f || f.value === NOT_VISIBLE;
      if (truth === NOT_VISIBLE) {
        cannotTell++;
        if (aiAbstains) aiAlsoAbstained++;
        continue;
      }
      if (q.kind === 'multi') {
        const set = Array.isArray(truth) ? truth : [];
        for (const o of q.options) {
          const key = `${q.id}=${o.id}`;
          options[key] = ['present', 'absent'];
          const t = set.includes(o.id) ? 'present' : 'absent';
          if (aiAbstains) {
            preds.push({ key: `${it.id}:${key}`, question: key, truth: t, predicted: null, support: 0 });
            continue;
          }
          const s = f!.optionSupport?.[o.id] ?? 0;
          const present = (f!.value as string[]).includes(o.id);
          preds.push({ key: `${it.id}:${key}`, question: key, truth: t, predicted: present ? 'present' : 'absent', support: present ? s : 1 - s });
        }
      } else {
        options[q.id] = q.options.map((o) => o.id).filter((o) => o !== NOT_SURE);
        preds.push({ key: `${it.id}:${q.id}`, question: q.id, truth: String(truth), predicted: aiAbstains ? null : (f!.value as string[])[0], support: aiAbstains ? 0 : f!.support });
      }
    }
  }
  const answered = preds.filter((p) => p.predicted !== null);
  const correct = answered.filter((p) => p.predicted === p.truth).length;
  const sel = selective(preds, 1);
  const selN = preds.filter((p) => p.predicted !== null && p.support >= 1);
  const selCorrect = selN.filter((p) => p.predicted === p.truth).length;
  const sim = simulateSecondLook(preds, options, 0.2, 1);
  return {
    labeller: labels.labeller,
    kind,
    photos,
    excluded,
    overall: {
      n: preds.length,
      coverage: round(coverage(preds)),
      accuracy: round(accuracy(preds)),
      accuracyCi: wilson(correct, answered.length).map((x) => round(x)),
      kappa: round(cohenKappa(preds)),
      accuracyAllAgree: round(sel.accuracy),
      accuracyAllAgreeCi: wilson(selCorrect, selN.length).map((x) => round(x)),
      coverageAllAgree: round(sel.coverage),
      ece: round(ece(preds)),
    },
    abstention: { cannotTell, aiAlsoAbstained, rate: round(cannotTell ? aiAlsoAbstained / cannotTell : NaN) },
    perQuestion: EVAL_QUESTIONS.map((q) => {
      const ps = preds.filter((p) => p.question === q.id || p.question.startsWith(`${q.id}=`));
      const a = ps.filter((p) => p.predicted !== null);
      const k = a.filter((p) => p.predicted === p.truth).length;
      return { question: q.id, n: ps.length, coverage: round(coverage(ps)), accuracy: round(accuracy(ps)), ci: wilson(k, a.length).map((x) => round(x)), kappa: round(cohenKappa(ps)) };
    }).filter((x) => x.n > 0),
    reliability: reliability(preds).map((b) => ({ ...b, accuracy: round(b.accuracy) })),
    simulation: { errorRate: 0.2, recall: round(sim.recall), falseAlarm: round(sim.falseAlarm), wrong: sim.wrong, right: sim.right },
  };
}

type Score = ReturnType<typeof score>;
const ref = reference ? score(reference, 'ai') : null;
const person = human ? score(human, 'person') : null;
const main = person && person.photos > 0 ? person : ref;
if (!main) throw new Error('No labels found: label photos at #/label or add eval/labels-ai-reference.json');

// How often do the two labellers agree with each other, on photos both finished?
let crossCheck: { photos: number; items: number; agreement: number | null; kappa: number | null } | null = null;
if (human && reference) {
  const pairs: Pred[] = [];
  const both = new Set<string>();
  for (const it of items) {
    const a = human.labels[it.id];
    const b = reference.labels[it.id];
    if (!a || !b || a._excluded || b._excluded || !isComplete(a)) continue;
    both.add(it.id);
    for (const q of EVAL_QUESTIONS) {
      const x = a[q.id], y = b[q.id];
      if (x === undefined || y === undefined || x === NOT_VISIBLE || y === NOT_VISIBLE) continue;
      if (q.kind === 'multi') {
        for (const o of q.options) {
          const px = Array.isArray(x) && x.includes(o.id) ? 'present' : 'absent';
          const py = Array.isArray(y) && y.includes(o.id) ? 'present' : 'absent';
          pairs.push({ key: `${it.id}:${q.id}=${o.id}`, question: q.id, truth: px, predicted: py, support: 1 });
        }
      } else pairs.push({ key: `${it.id}:${q.id}`, question: q.id, truth: String(x), predicted: String(y), support: 1 });
    }
  }
  crossCheck = { photos: both.size, items: pairs.length, agreement: round(accuracy(pairs)), kappa: round(cohenKappa(pairs)) };
}

// Labelling pace from the audit trail (first and last edit per photo), for the person's labels.
let pace: { photos: number; medianSeconds: number | null; spanMinutes: number | null } | null = null;
if (human) {
  const times = Object.values(human.labels)
    .map((l) => l as Record<string, unknown>)
    .filter((l) => typeof l._first === 'string' && typeof l._last === 'string' && !l._excluded)
    .map((l) => ({ a: Date.parse(l._first as string), b: Date.parse(l._last as string) }));
  if (times.length) {
    const per = times.map((t) => (t.b - t.a) / 1000).sort((x, y) => x - y);
    const span = (Math.max(...times.map((t) => t.b)) - Math.min(...times.map((t) => t.a))) / 60000;
    pace = { photos: times.length, medianSeconds: Math.round(per[Math.floor(per.length / 2)]), spanMinutes: Math.round(span) };
  }
}

// report.json keeps the main (full-set) result at the top level for the model card, plus the person's result.
const report = {
  generatedAt: new Date().toISOString(),
  model,
  promptVersion: PROMPT_VERSION,
  looks,
  ...main,
  reference: main !== ref ? ref : null,
  labelCrossCheck: crossCheck,
  labellingPace: pace,
};
writeFileSync('eval/report.json', JSON.stringify(report, null, 2) + '\n');

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);
const ci = (c: (number | null)[]) => (c[0] === null ? '' : ` (95% CI ${pct(c[0])}–${pct(c[1])})`);
const section = (s: Score, title: string, note: string) => `## ${title}

${note}

| | Result |
|---|---|
| Agreement when **all ${looks} looks agree** (the only time the app interrupts a citizen) | **${pct(s.overall.accuracyAllAgree)}**${ci(s.overall.accuracyAllAgreeCi)}, on ${pct(s.overall.coverageAllAgree)} of labelled answers |
| Agreement on every answer the AI gave | ${pct(s.overall.accuracy)}${ci(s.overall.accuracyCi)}, Cohen's κ ${s.overall.kappa ?? '—'}, answering ${pct(s.overall.coverage)} |
| Labeller said "cannot tell from this photo" and the AI also held back | ${pct(s.abstention.rate)} (${s.abstention.aiAlsoAbstained} of ${s.abstention.cannotTell}) |
| Simulated citizen errors (20% of answers made wrong) caught by a second look | ${pct(s.simulation.recall)} |
| Correct citizen answers questioned anyway (false alarms) | ${pct(s.simulation.falseAlarm)} |

| Looks agreeing | Answers | Agreement |
|---|---|---|
${s.reliability.map((b) => `| ${Math.round(b.support * looks)} of ${looks} | ${b.count} | ${pct(b.accuracy)} |`).join('\n')}

<details><summary>By question</summary>

| Question | Labelled items | AI answered | Agreement (95% CI) | κ |
|---|---|---|---|---|
${s.perQuestion.map((q) => `| ${q.question} | ${q.n} | ${pct(q.coverage)} | ${pct(q.accuracy)}${q.ci[0] === null ? '' : ` (${pct(q.ci[0])}–${pct(q.ci[1])})`} | ${q.kappa ?? '—'} |`).join('\n')}

</details>
`;

const md = `# Evaluation report

Generated ${report.generatedAt.slice(0, 16).replace('T', ' ')} UTC · model \`${model}\` · prompt \`${PROMPT_VERSION}\` · ${looks} independent looks per photo.

**Photos:** ${items.length} openly licensed stream photos from Wikimedia Commons (authors and licences in \`eval/manifest.json\`). The AI saw each one as a downstream photo, with the same prompt the app uses. Every labeller answered only from the photo, treated as facing downstream, and **never saw the AI's answers**. Multi-select questions are scored per option (present or absent).

${person && person.photos > 0 ? section(person, `Against a person's labels (${person.labeller}, ${person.photos} photos)`, `Labelled by hand in the app's blind labelling screen (\`#/label\`). The human ground truth; a smaller set, so the intervals are wider.`) : ''}
${ref ? section(ref, `Against an independent AI reference (${ref.photos} photos)`, `Labelled by a different AI model (Claude), blind to Gemini's answers. Two AI systems can share mistakes, so treat this as agreement with an independent reference, likely an overestimate of real-world accuracy.`) : ''}
${pace ? `**Labelling audit trail:** every label is time-stamped as it is made. The person labelled ${pace.photos} photos over ${pace.spanMinutes} minutes, a median of ${pace.medianSeconds} s per photo (see \`_first\`, \`_last\` and \`_edits\` in \`eval/labels.json\`).

` : ''}${crossCheck ? `## Do the two labellers agree?

On the ${crossCheck.photos} photos both labelled, the person and the AI reference agree on **${pct(crossCheck.agreement)}** of ${crossCheck.items} items where both gave an answer (Cohen's κ ${crossCheck.kappa ?? '—'}).
` : ''}
## Weak spots

${main.perQuestion.filter((q) => q.accuracy !== null && q.accuracy < 0.85).map((q) => `- **${q.question}**: ${pct(q.accuracy)} agreement on ${q.n} items.`).join('\n') || '- None below 85% on this set.'}
- When the labeller said "cannot tell from this photo", the AI held back only ${pct(main.abstention.rate)} of the time: it is more willing to answer than it should be. The ${looks}-of-${looks} rule is what keeps this from reaching citizens.

## Limits

- Small sets, so the intervals are wide; no expert panel yet.
- Photos come from open collections, not yet from the OneAquaHealth app; single photos, not the app's upstream + downstream pairs.
- The simulation flips answers at random; real citizen errors are not random.
`;
writeFileSync('eval/REPORT.md', md);
console.log(md);
