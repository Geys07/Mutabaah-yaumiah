import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'
import { pwaStaticAssets } from './scripts/pwa-build.mjs'

// Persiapkan aset juga saat Cloudflare atau CLI menjalankan `vite build`
// secara langsung, bukan hanya lewat `npm run build`.
execFileSync(process.execPath, [resolve(process.cwd(), 'scripts/prepare-empty-state-assets.mjs')], {
  cwd: process.cwd(),
  stdio: 'inherit',
})

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: { groups: [
          { name: 'react-vendor', test: /node_modules[\\/]((react|react-dom|scheduler)[\\/])/, priority: 20 },
          { name: 'supabase-vendor', test: /node_modules[\\/]@supabase[\\/]/, priority: 20 },
          { name: 'verse-bank', test: /islamicQuotes.generated.json$/, priority: 20 },
        ] },
      },
    },
  },
  plugins: [react(), pwaStaticAssets()],
})
