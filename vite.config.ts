import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// IMPORTANT for GitHub Pages: set base to '/<repo-name>/' unless using a
// custom domain or a <user>.github.io root repo. Wrong base => broken asset
// and service-worker paths. Override via DCM_BASE env in CI if needed.
const base = process.env.DCM_BASE ?? '/mobile-calc/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      // Precache the app shell + the RP data bundle so the calc works offline.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json}'],
        // RP json can be large; raise the precache size ceiling.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      manifest: {
        name: 'Dynamic Calc',
        short_name: 'DynCalc',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0b0f',
        theme_color: '#0b0b0f',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
})
