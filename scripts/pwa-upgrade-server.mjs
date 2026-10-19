import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { pwaStaticAssets } from './pwa-build.mjs';

// Loopback-only public-shell canary. No Supabase client, credentials or proxy.
const releases = {};
for (const release of ['A','B']) {
  const emitted = {};
  await pwaStaticAssets().generateBundle.call({emitFile:file=>{emitted[file.fileName]=file.source;}}, {}, {
    'fixture.js':{type:'chunk',code:'CODEX-UJI-20261016 release '+release},
  });
  releases[release] = emitted['parent-push-sw.js'];
}
let current = 'A';
const files = new Map([
  ['/manifest.webmanifest','manifest.webmanifest'],['/favicon.svg','favicon.svg'],
  ['/logo-sekolah-loading.png','logo-sekolah-loading.png'],
  ['/pwa/icon-192.png','pwa/icon-192.png'],['/pwa/icon-512.png','pwa/icon-512.png'],
]);
const html = release => `<!doctype html><html lang="id"><meta charset="utf-8"><title>CODEX-UJI-20261016 PWA canary ${release}</title><body><h1>Rilis ${release}</h1><label>Draf uji<textarea id="draft"></textarea></label><p>Fixture shell publik; bukan akun atau jawaban nyata.</p><script>navigator.serviceWorker.register('/parent-push-sw.js');</script></body></html>`;
const server = http.createServer(async (request,response) => {
  const path = new URL(request.url,'http://127.0.0.1:5188').pathname;
  response.setHeader('Cache-Control','no-store');
  try {
    if (request.method==='POST'&&path==='/__qa/release-b') {current='B';response.end('B');return;}
    if (request.method==='POST'&&path==='/__qa/release-a') {current='A';response.end('A');return;}
    if (request.method!=='GET') {response.writeHead(405);response.end();return;}
    if (path==='/') {response.setHeader('Content-Type','text/html; charset=utf-8');response.end(html(current));return;}
    if (path==='/parent-push-sw.js') {response.setHeader('Content-Type','text/javascript');response.end(releases[current]);return;}
    if (path==='/pwa-assets.json') {response.setHeader('Content-Type','application/json');response.end('[]');return;}
    if (files.has(path)) {
      response.setHeader('Content-Type',path.endsWith('.png')?'image/png':path.endsWith('.svg')?'image/svg+xml':'application/manifest+json');
      response.end(await readFile(new URL('../public/'+files.get(path),import.meta.url)));return;
    }
    response.writeHead(404);response.end();
  } catch {response.writeHead(500);response.end('fixture error');}
});
server.listen(5188,'127.0.0.1',()=>console.log('CODEX-UJI-20261016 canary http://127.0.0.1:5188'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
