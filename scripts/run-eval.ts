// Runs the real AI pipeline (same prompt, same 3 looks) on every evaluation photo.
// Each photo is treated as a downstream photo, the same assumption the labeller is shown.
// Results are cached in eval/runs/<model>/<id>.json, so a rerun only does missing photos.
// Usage: npm run eval:run
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { EvalItem } from '../src/core/evalset';
import { AiError, analyzePhotos, DEFAULT_MODEL } from '../server/gemini';
import { requireKey } from './env';

const key = requireKey();
const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
const looks = Number(process.env.TANDEM_SAMPLES) || 3;
const { items } = JSON.parse(readFileSync('eval/manifest.json', 'utf8')) as { items: EvalItem[] };
const dir = `eval/runs/${model}`;
mkdirSync(dir, { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let done = 0;
for (const it of items) {
  const out = `${dir}/${it.id}.json`;
  if (existsSync(out)) {
    done++;
    continue;
  }
  const data = readFileSync(`eval/photos/${it.file}`).toString('base64');
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const t = Date.now();
      const report = await analyzePhotos([{ role: 'downstream', mimeType: 'image/jpeg', data }], { apiKey: key, model, looks });
      writeFileSync(out, JSON.stringify(report, null, 2));
      done++;
      console.log(`${it.id} ok in ${((Date.now() - t) / 1000).toFixed(0)} s (${done}/${items.length})`);
      break;
    } catch (e) {
      const wait = e instanceof AiError && e.code === 'quota' ? 60_000 : 10_000;
      console.log(`${it.id} attempt ${attempt} failed: ${(e as Error).message.slice(0, 120)}; retrying in ${wait / 1000} s`);
      await sleep(wait);
    }
  }
}
console.log(`Done: ${done}/${items.length} photos have AI results in ${dir}`);
