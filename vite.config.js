import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { pwaStaticAssets } from './scripts/pwa-build.mjs'

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
