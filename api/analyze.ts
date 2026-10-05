// Vercel serverless function. The Gemini key lives in the project's environment variables.
import { handleAnalyze } from '../server/handler';

export const config = { maxDuration: 120 };

export function GET(request: Request) {
  return handleAnalyze(request);
}

export function POST(request: Request) {
  return handleAnalyze(request);
}
