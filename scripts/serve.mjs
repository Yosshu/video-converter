// A small static server for checking the built site locally.
//
// It serves dist/ under a sub-path (default /video-converter/) the same way
// GitHub Pages serves a project site, so a URL that wrongly points at the
// domain root fails here as well. Like GitHub Pages, it sends no COOP/COEP
// headers.
//
//   node scripts/serve.mjs [--port 8080] [--base /video-converter/]

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: process.env.PORT ?? '8080' },
    base: { type: 'string', default: process.env.BASE_PATH ?? '/video-converter/' },
  },
});
const port = Number(values.port);
const base = `/${values.base.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  if (path === base.slice(0, -1) || (base !== '/' && path === '/')) {
    res.writeHead(301, { Location: base });
    res.end();
    return;
  }
  if (!path.startsWith(base)) {
    res.writeHead(404, { 'Content-Type': types['.txt'] });
    res.end(`Not found (only ${base} is served)\n`);
    return;
  }
  path = path.slice(base.length);
  if (path === '' || path.endsWith('/')) path += 'index.html';
  const file = normalize(join(dist, path));
  if (!file.startsWith(dist + sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    res.writeHead(200, {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      // GitHub Pages sends max-age=600 as well.
      'Cache-Control': 'max-age=600',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': types['.txt'] });
    res.end('Not found\n');
  }
});

server.listen(port, () => {
  console.log(`Serving dist/ at http://localhost:${port}${base}`);
});
