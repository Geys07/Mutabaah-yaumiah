import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// The worker's bytes must change with the public app build. Otherwise a new
// HTML/chunk release cannot reliably install a new offline shell.
export function pwaStaticAssets() {
  return {
    name: 'pwa-static-assets',
    enforce: 'post',
    async generateBundle(_options, bundle) {
      const worker = await readFile(new URL('../public/parent-push-sw.js', import.meta.url), 'utf8');
      const marker = /^const VERSION = "[^"\r\n]+";$/m;
      if (!marker.test(worker)) throw new Error('Service Worker version marker is missing.');
      const hash = createHash('sha256').update(worker);
      for (const [name, entry] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) {
        hash.update(name).update('\0');
        hash.update(entry.type === 'chunk' ? entry.code : entry.source);
        hash.update('\0');
      }
      const revision = hash.digest('hex').slice(0, 20);
      const assets = Object.keys(bundle).filter(name => /\.(?:js|css)$/.test(name)).sort();
      this.emitFile({type:'asset',fileName:'pwa-assets.json',source:JSON.stringify(assets)});
      this.emitFile({
        type:'asset',fileName:'parent-push-sw.js',
        source:worker.replace(marker, `const VERSION = "mutabaah-pwa-${revision}";`),
      });
    },
  };
}
