// POST /api/analyze: photos in, AiReport out. Shared by the Vercel function and the Vite dev server.
import { AiError, analyzePhotos, DEFAULT_MODEL, type PhotoInput } from './gemini';

const ROLES = new Set(['upstream', 'downstream', 'context', 'biodiversity']);
const MAX_PHOTO_BYTES = 1_500_000; // base64 length of one resized photo
const WINDOW_MS = 60_000;
const PER_WINDOW = 6; // assessments per IP per minute (each uses several model calls)
const hits = new Map<string, number[]>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > PER_WINDOW;
}

export async function handleAnalyze(request: Request, env: Record<string, string | undefined> = process.env): Promise<Response> {
  if (request.method === 'GET') {
    // Lets the app say up front whether the AI is available.
    return json({ available: !!env.GEMINI_API_KEY, model: env.GEMINI_MODEL || DEFAULT_MODEL });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.GEMINI_API_KEY) return json({ error: 'The AI is not configured on this server.', code: 'unavailable' }, 503);

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  if (limited(ip)) return json({ error: 'Too many checks from this device. Wait a minute.', code: 'quota' }, 429);

  let photos: PhotoInput[];
  try {
    const body = (await request.json()) as { photos?: PhotoInput[] };
    photos = (body.photos ?? []).filter((p) => ROLES.has(p.role) && typeof p.data === 'string' && p.data.length <= MAX_PHOTO_BYTES);
    photos = photos.filter((p) => p.mimeType === 'image/jpeg' || p.mimeType === 'image/png' || p.mimeType === 'image/webp');
  } catch {
    return json({ error: 'Invalid request body.', code: 'bad_request' }, 400);
  }
  if (!photos.length || photos.length > 4) return json({ error: 'Send between 1 and 4 photos.', code: 'bad_request' }, 400);

  try {
    const report = await analyzePhotos(photos, {
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
      looks: Number(env.TANDEM_SAMPLES) || 3,
      signal: AbortSignal.timeout(110_000),
    });
    return json(report);
  } catch (e) {
    if (e instanceof AiError) return json({ error: e.message, code: e.code }, e.status);
    return json({ error: 'The AI did not answer in time.', code: 'upstream' }, 504);
  }
}
