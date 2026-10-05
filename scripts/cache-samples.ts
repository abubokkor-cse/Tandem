// Stores a real AI result for each sample photo set in public/samples/manifest.json, so the
// "Try with sample photos" demo shows the full flow even when the free AI quota is used up.
// The stored result is marked cached in the app. Usage: npm run samples:cache
import { readFileSync, writeFileSync } from 'node:fs';
import { analyzePhotos } from '../server/gemini';
import { requireKey } from './env';

const path = 'public/samples/manifest.json';
const manifest = JSON.parse(readFileSync(path, 'utf8')) as { sets: { id: string; photos: { role: string; file: string }[]; report?: unknown }[] };
for (const set of manifest.sets) {
  const photos = set.photos.map((p) => ({ role: p.role, mimeType: 'image/jpeg', data: readFileSync(`public/samples/${p.file}`).toString('base64') }));
  set.report = await analyzePhotos(photos, { apiKey: requireKey(), model: process.env.GEMINI_MODEL, looks: Number(process.env.TANDEM_SAMPLES) || 3 });
  console.log(`${set.id}: stored a ${(set.report as { looks: number }).looks}-look AI result`);
}
writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
