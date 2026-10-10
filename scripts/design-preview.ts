import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory = resolve(import.meta.dirname, '../docs/design');
const server = createServer(async (request, response) => {
  if (request.method !== 'GET') {
    response.writeHead(405).end();
    return;
  }
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  const name = path === '/' ? 'navigation-options.html' : path.slice(1);
  if (!['navigation-options.html'].includes(name)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const content = await readFile(resolve(directory, name));
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    });
    response.end(content);
  } catch {
    response.writeHead(404).end();
  }
});
server.listen(4317, '127.0.0.1', () =>
  process.stdout.write('Local design preview: http://localhost:4317\n'),
);
