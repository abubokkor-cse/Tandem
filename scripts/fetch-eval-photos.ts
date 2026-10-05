// Builds the evaluation photo set from openly licensed Wikimedia Commons photos.
// Writes eval/manifest.json (author, licence, source for every photo) and eval/photos/*.jpg.
// Usage: npm run eval:fetch [-- 30]
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import type { EvalItem } from '../src/core/evalset';

const TARGET = Number(process.argv[2]) || 30;
// Optional: --keep p02,p03 keeps those photos from an earlier run and fetches more with --queries "a|b".
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const UA = 'TandemHackathon/0.1 (OneAquaHealth IEEE hackathon student project; evaluation set)';
const OPEN = /^(CC0|Public domain|CC BY(-SA)? [0-9.]+)$/i;

// Spread across what the questions cover: natural and artificial channels, barriers, pipes, litter, vegetation.
const QUERIES = arg('queries')?.split('|') ?? [
  'urban stream concrete channel',
  'canalised brook town',
  'stream culvert outfall',
  'weir small river town',
  'brook riparian vegetation',
  'stream in park',
  'creek litter rubbish',
  'drainage ditch water',
  'urban river embankment wall',
  'small stream woodland',
];

interface Page {
  title: string;
  imageinfo?: { thumburl?: string; descriptionurl: string; mime: string; extmetadata?: Record<string, { value: string }> }[];
}

const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function search(q: string): Promise<Page[]> {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20' +
    `&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=1280`;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  const body = (await res.json()) as { query?: { pages?: Record<string, Page> } };
  return Object.values(body.query?.pages ?? {});
}

mkdirSync('eval/photos', { recursive: true });
const keep = new Set(arg('keep')?.split(',') ?? []);
const previous: EvalItem[] = keep.size && existsSync('eval/manifest.json') ? JSON.parse(readFileSync('eval/manifest.json', 'utf8')).items : [];
const items: EvalItem[] = previous.filter((it) => keep.has(it.id));
for (const it of previous) if (!keep.has(it.id) && existsSync(`eval/photos/${it.file}`)) unlinkSync(`eval/photos/${it.file}`);
const seen = new Set<string>(previous.map((it) => `File:${it.title}`));
let next = Math.max(0, ...previous.map((it) => Number(it.id.slice(1)))) + 1;
const perQuery = Math.ceil((TARGET - items.length) / QUERIES.length) + 1;

for (const q of QUERIES) {
  let taken = 0;
  for (const p of await search(q)) {
    if (items.length >= TARGET || taken >= perQuery) break;
    const ii = p.imageinfo?.[0];
    const meta = ii?.extmetadata ?? {};
    const license = strip(meta.LicenseShortName?.value);
    if (!ii?.thumburl || ii.mime !== 'image/jpeg' || !OPEN.test(license) || seen.has(p.title)) continue;
    const id = `p${String(next).padStart(2, '0')}`;
    const img = await fetch(ii.thumburl, { headers: { 'user-agent': UA } });
    if (!img.ok || !img.headers.get('content-type')?.includes('image/jpeg')) continue;
    const file = `${id}.jpg`;
    if (!existsSync(`eval/photos/${file}`)) writeFileSync(`eval/photos/${file}`, Buffer.from(await img.arrayBuffer()));
    seen.add(p.title);
    taken++;
    next++;
    items.push({
      id,
      file,
      title: p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
      author: strip(meta.Artist?.value) || 'unknown',
      license,
      licenseUrl: meta.LicenseUrl?.value,
      sourceUrl: ii.descriptionurl,
    });
    console.log(`${id}  ${license.padEnd(14)} ${p.title.slice(5, 80)}`);
  }
}

writeFileSync('eval/manifest.json', JSON.stringify({ source: 'Wikimedia Commons', fetched: new Date().toISOString(), items }, null, 2) + '\n');
console.log(`\n${items.length} photos in eval/photos, manifest in eval/manifest.json`);
