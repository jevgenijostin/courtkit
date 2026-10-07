import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';

// Use the actual build output, including Vite's hashed CSS/JS filenames.
const dist = new URL('../dist/', import.meta.url);
const files = (await readdir(dist, { recursive: true }))
  .filter(file => /\.(html|css|js)$/.test(file) && file !== 'sw.js')
  .map(file => file.replaceAll('\\', '/')).sort();
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(await readFile(new URL(file, dist)));
const version = hash.digest('hex').slice(0, 16);

await writeFile(new URL('sw.js', dist), `
const ROOT = new URL('./', self.location.href);
const PREFIX = 'courtkit-shell-' + ROOT.pathname + '-';
const CACHE = PREFIX + '${version}';
const SHELL = ${JSON.stringify(files)}.map(file => new URL(file, ROOT).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(
    SHELL.map(url => new Request(url, { cache: 'reload' }))
  )));
  // Updates wait until existing tabs close, keeping each session on one build.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== ROOT.origin) return;
  const isHome = url.pathname === ROOT.pathname || url.pathname === ROOT.pathname + 'index.html';
  const key = isHome && event.request.mode === 'navigate'
    ? new URL('index.html', ROOT).href : url.href;
  if (!SHELL.includes(key)) return;
  event.respondWith(caches.open(CACHE).then(async cache =>
    (await cache.match(key)) || fetch(event.request)
  ));
});
`);
