// Loads .env for the Node scripts (Node 20.12+ has loadEnvFile built in).
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

export function requireKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    console.error('GEMINI_API_KEY is empty. Paste your key into .env (see .env.example).');
    process.exit(1);
  }
  return key;
}
