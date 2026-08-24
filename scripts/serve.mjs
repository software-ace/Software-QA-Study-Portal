#!/usr/bin/env node
/**
 * serve.mjs — Zero-dependency static server for local development.
 *
 * A server is genuinely required, not a convenience: browsers refuse to load ES
 * modules and fetch JSON from `file://` origins. This keeps the project runnable
 * with no install step and no dependencies.
 *
 * Usage: node scripts/serve.mjs [--port 8080] [--host 127.0.0.1]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, resolve, sep } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const argOf = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const PORT = Number(argOf('--port', process.env.PORT ?? 8080));
const HOST = argOf('--host', process.env.HOST ?? '127.0.0.1');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    // Contain every request inside the project root.
    const target = normalize(join(ROOT, pathname));
    if (!target.startsWith(ROOT + sep) && target !== ROOT) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let filePath = target;
    try {
      const info = await stat(filePath);
      if (info.isDirectory()) filePath = join(filePath, 'index.html');
    } catch {
      // Allow extensionless routes to resolve to .html
      if (!extname(filePath)) filePath += '.html';
    }

    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 — not found</h1><p><a href="/">Back to the portal</a></p>');
    } else {
      res.writeHead(500).end(`Server error: ${err.message}`);
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Study portal serving ${ROOT}`);
  console.log(`  →  http://${HOST}:${PORT}/\n`);
});
