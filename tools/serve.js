#!/usr/bin/env node
/**
 * A tiny static file server so `npm start` works with no dependencies to
 * install. ES modules can't be loaded over file://, so the game needs to be
 * served over http — but it doesn't need a build step or a bundler.
 *
 *   node tools/serve.js [port]
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.argv[2] || process.env.PORT || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

async function resolve(urlPath) {
  // Strip the query string and refuse anything that climbs out of the root.
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const relative = normalize(clean).replace(/^([/\\])+/, '');
  if (relative.split(sep).includes('..')) { return null; }

  const target = join(root, relative || 'index.html');
  if (!target.startsWith(root)) { return null; }

  try {
    const info = await stat(target);
    if (info.isDirectory()) {
      const index = join(target, 'index.html');
      await stat(index);
      return index;
    }
    return target;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const file = await resolve(req.url || '/');
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 — nothing out there');
    return;
  }

  res.writeHead(200, {
    'content-type': TYPES[extname(file)] || 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  createReadStream(file).pipe(res);
});

server.listen(port, () => {
  console.log(`\n  🏄  Surf's Up is running at http://localhost:${port}\n`);
});
