import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY || 'http://localhost:5000';
  const proxy = {
    '/api': { target: apiTarget, changeOrigin: true },
    '/uploads': { target: apiTarget, changeOrigin: true },
  };

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'robots.txt'],
        manifest: {
          id: '/',
          name: 'Kavach — BIT Sindri Campus Safety',
          short_name: 'Kavach',
          description: 'One-tap SOS, campus problem reporting, fundraisers and a campus assistant for BIT Sindri students.',
          start_url: '/app',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0D1628',
          theme_color: '#13213C',
          categories: ['education', 'utilities', 'lifestyle'],
          icons: [
            { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          shortcuts: [
            { name: 'SOS', short_name: 'SOS', url: '/app/sos', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
            { name: 'Community', url: '/app/community', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          globIgnores: ['**/*-vietnamese-*', '**/*-greek-*', '**/*-cyrillic-*'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              // Read-only API data stays available offline (profile, contacts, feed, fundraisers…)
              urlPattern: ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/') && !url.pathname.includes('/proofs/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'kavach-api',
                networkTimeoutSeconds: 6,
                expiration: { maxEntries: 300, maxAgeSeconds: 7 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/uploads/public/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'kavach-uploads',
                expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ url }) => url.hostname.endsWith('tile.openstreetmap.org'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'kavach-map-tiles',
                expiration: { maxEntries: 400, maxAgeSeconds: 14 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    server: { port: 5173, strictPort: true, host: true, proxy },
    preview: { port: 4173, strictPort: true, host: true, proxy },
    build: { sourcemap: false, chunkSizeWarningLimit: 900 },
  };
});
