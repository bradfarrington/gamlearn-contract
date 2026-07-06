// Minimal local dev server: serves the static contract page AND runs the
// /api/sign serverless function locally, so you can test the full submit +
// email flow without the Vercel CLI. Uses only Node built-ins + the `resend`
// dependency already in package.json.
//
//   node dev-server.mjs      → http://localhost:3000
//
// Reads env from .env.local (RESEND_API_KEY, FROM_EMAIL, NOTIFY_EMAIL).

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// ---- Load .env.local into process.env (simple parser, no dependency) ----
const envPath = path.join(__dirname, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
};

const server = http.createServer(async (req, res) => {
  // ---- API route: /api/sign ----
  if (req.url.split('?')[0] === '/api/sign') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      // Adapt Node req/res to the Vercel-style handler signature.
      try { req.body = body ? JSON.parse(body) : {}; } catch { req.body = {}; }
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (obj) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(obj));
        return res;
      };
      try {
        const { default: handler } = await import('./api/sign.js');
        await handler(req, res);
      } catch (err) {
        console.error('[dev] handler error:', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(err && err.message || err) }));
        }
      }
    });
    return;
  }

  // ---- Static files ----
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  // Prevent path traversal
  const filePath = path.join(__dirname, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(__dirname)) {
    res.statusCode = 403; res.end('Forbidden'); return;
  }
  try {
    const data = await readFile(filePath);
    res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  const key = process.env.RESEND_API_KEY;
  console.log(`\n  Contract dev server → http://localhost:${PORT}\n`);
  console.log(`  RESEND_API_KEY: ${key ? key.slice(0, 6) + '…' : 'MISSING — submit will 500'}`);
  console.log(`  FROM_EMAIL:     ${process.env.FROM_EMAIL || '(default)'}`);
  console.log(`  NOTIFY_EMAIL:   ${process.env.NOTIFY_EMAIL || '(default)'}\n`);
});
