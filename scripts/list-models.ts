// Lists the Gemini models your key can call with images: npm run models
import { requireKey } from './env';

const key = requireKey();
const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
  headers: { 'x-goog-api-key': key },
});
if (!res.ok) {
  console.error(`Could not list models (${res.status}): ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
const { models = [] } = (await res.json()) as {
  models?: { name: string; displayName?: string; supportedGenerationMethods?: string[]; inputTokenLimit?: number }[];
};
const usable = models.filter((m) => m.supportedGenerationMethods?.includes('generateContent'));
console.log(`Models that support generateContent (${usable.length}):\n`);
for (const m of usable) console.log(`  ${m.name.replace('models/', '').padEnd(42)} ${m.displayName ?? ''}`);
console.log(`\nCurrently configured: GEMINI_MODEL=${process.env.GEMINI_MODEL || '(default) gemini-flash-latest'}`);
