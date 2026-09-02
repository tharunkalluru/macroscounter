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
        name: 'Bitewise',
        short_name: 'Bitewise',
        description: 'Fat-loss focused calorie & macro tracker with an Indian food database',
        theme_color: '#161826',
        background_color: '#161826',
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
        // Without this, workbox's NavigationRoute has no path restriction and
        // intercepts EVERY navigation-mode request -- including the OAuth
        // callback redirect Google sends the browser to
        // (/api/auth/callback/google) -- serving the cached SPA shell
        // instead of letting it reach the serverless function. React Router
        // has no route for that path, so nothing renders: a blank screen,
        // with the callback never actually completing sign-in. Confirmed via
        // a live Google sign-in through a real account: the callback request
        // never reached Vercel (no runtime log entry) even though the tab
        // showed a 200 for it -- the service worker answered it locally.
        navigateFallbackDenylist: [/^\/api\//],
        // Phase F.0: Inter (Google Fonts) and Phosphor Icons (unpkg) are
        // loaded from index.html to match the source design exactly.
        // Neither is covered by globPatterns' precache (cross-origin), so
        // without an explicit runtime-caching rule every repeat visit would
        // re-fetch them over the network -- costing both the offline
        // guarantee and the <1.5s repeat-load budget nativeFeel.spec.ts
        // enforces. CacheFirst + a long expiration means only the very
        // first-ever visit pays the network cost; everything after is
        // served from cache, same as the rest of the app shell.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/unpkg\.com\/@phosphor-icons\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'phosphor-icons',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
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
