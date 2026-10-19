import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pwaStaticAssets } from './pwa-build.mjs';

async function build(code = 'fixture release one', html = '<html>fixture</html>') {
  const files = {};
  await pwaStaticAssets().generateBundle.call({emitFile:file=>{files[file.fileName]=file.source;}}, {}, {
    'assets/app.js':{type:'chunk',code},
    'assets/app.css':{type:'asset',source:'body{color:green}'},
    'index.html':{type:'asset',source:html},
  });
  return files;
}

test('PWA revision follows actual bundle and HTML content without timestamps', async () => {
  const a = await build(), same = await build(), b = await build('fixture release two');
  assert.equal(a['parent-push-sw.js'], same['parent-push-sw.js']);
  assert.notEqual(a['parent-push-sw.js'], b['parent-push-sw.js']);
  assert.notEqual(a['parent-push-sw.js'], (await build(undefined,'<html>changed shell</html>'))['parent-push-sw.js']);
  assert.deepEqual(JSON.parse(a['pwa-assets.json']), ['assets/app.css','assets/app.js']);
  assert.match(a['parent-push-sw.js'], /const VERSION = "mutabaah-pwa-[0-9a-f]{20}";/);
});

test('Build versioning preserves draft-safe activation and private cache exclusions', async () => {
  const source = (await build())['parent-push-sw.js'];
  assert.doesNotMatch(source, /self\.skipWaiting\s*\(/);
  assert.doesNotMatch(source, /\.reload\s*\(/);
  assert.match(source, /url\.origin !== self\.location\.origin/);
  assert.match(source, /request\.method !== "GET"/);
  assert.match(source, /node_modules/);
  assert.match(source, /mutabaah-pwa-/);
});
