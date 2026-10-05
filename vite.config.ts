import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// In development, serve /api/analyze from the same handler the Vercel function uses.
function devApi(): Plugin {
  return {
    name: 'tandem-dev-api',
    configureServer(server) {
      if (existsSync('.env')) process.loadEnvFile('.env');
      // Labelling tool (development only): read and write eval/labels.json.
      server.middlewares.use('/api/labels', async (req, res) => {
        const path = 'eval/labels.json';
        res.setHeader('content-type', 'application/json');
        if (req.method === 'POST') {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          writeFileSync(path, JSON.stringify(body, null, 2) + '\n');
          res.end('{"ok":true}');
          return;
        }
        if (!existsSync(path)) {
          res.statusCode = 404;
          res.end('null');
          return;
        }
        res.end(readFileSync(path, 'utf8'));
      });
      server.middlewares.use('/api/analyze', async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const { handleAnalyze } = await server.ssrLoadModule('/server/handler.ts');
        const request = new Request(`http://localhost${req.url ?? ''}`, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
        });
        const response: Response = await handleAnalyze(request, process.env);
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await response.arrayBuffer()));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
