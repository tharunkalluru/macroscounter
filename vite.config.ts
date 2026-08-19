/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * `/api/*.ts` (Vercel serverless functions) only run under `vercel dev` or a
 * real deployment — Vite's own dev/preview servers have no route for them,
 * so without this they fall through to the SPA's `index.html` fallback and
 * a `fetch('/api/...')` gets back HTML instead of a real 404. Better Auth's
 * client can't recover from that (a JSON parse failure on the session
 * check leaves `useSession()` stuck pending forever), which would hang the
 * sign-in screen on every `npm run dev`/`npm run preview` run. Answering
 * with a real 404 lets it fail fast instead.
 */
function apiNotFoundInDev(): Plugin {
  const respond: import('vite').Connect.SimpleHandleFunction = (_req, res) => {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: '/api routes only run on Vercel — see SETUP.md' }))
  }
  return {
    name: 'api-not-found-in-dev',
    configureServer(server) {
      server.middlewares.use('/api', respond)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api', respond)
    },
  }
}

export default defineConfig({
  plugins: [
    apiNotFoundInDev(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png', 'icons/apple-splash-*.png'],
      manifest: {
        name: 'MacroDesi',
        short_name: 'MacroDesi',
        description: 'Fat-loss focused calorie & macro tracker with an Indian food database',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        // window-controls-overlay is desktop-PWA-only (Chromium) and falls
        // back to the next entry automatically where it's not supported.
        display_override: ['window-controls-overlay', 'standalone'],
        start_url: '/',
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,png}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/domain/**'],
      thresholds: {
        lines: 80,
      },
    },
  },
})
