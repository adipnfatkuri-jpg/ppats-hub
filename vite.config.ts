import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  const buildDate = new Date();
  const buildTimestamp = buildDate.getTime().toString();
  const buildIso = buildDate.toISOString();

  return {
    define: {
      __APP_BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
      __APP_BUILD_ISO__: JSON.stringify(buildIso),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifestFilename: 'manifest.json',
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
          'bg-grandline.jpg',
          'luffy-chibi.png',
          'nami-chibi.png',
          'zoro-chibi.png',
          'sanji-chibi.png',
          'chopper-chibi.png',
        ],
        manifest: {
          id: '/',
          name: 'SIM-PPATS — Sistem Informasi Manajemen Kantor PPATS',
          short_name: 'SIM-PPATS',
          description:
            'Sistem operasional kantor PPATS & layanan pertanahan terpadu: ekstraksi dokumen cerdas, generator bundel akta Word, buku register repertorium, dan pelaporan BPN & Bapenda.',
          lang: 'id',
          theme_color: '#0B1F3A',
          background_color: '#0B1F3A',
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone'],
          orientation: 'any',
          categories: ['business', 'productivity'],
          start_url: `/?source=pwa&v=${buildTimestamp}`,
          scope: '/',
          // Custom build timestamp metadata to force browsers & desktop shortcuts to detect new deployments
          ...({
            version: buildTimestamp,
            build_timestamp: buildIso,
          } as Record<string, unknown>),
          icons: [
            {
              src: `/pwa-192x192.png?v=${buildTimestamp}`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `/pwa-512x512.png?v=${buildTimestamp}`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `/pwa-maskable-512x512.png?v=${buildTimestamp}`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: 'Buat Berkas Baru',
              short_name: 'Berkas Baru',
              description: 'Buka Wizard 4 Langkah untuk membuat akta atau berkas non-akta baru.',
              url: `/?section=wizard&v=${buildTimestamp}`,
              icons: [
                {
                  src: `/pwa-192x192.png?v=${buildTimestamp}`,
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
            {
              name: 'Perhitungan Pajak',
              short_name: 'Pajak BPHTB',
              description: 'Hitung BPHTB & PPh Final untuk berkas pertanahan.',
              url: `/?section=tax&v=${buildTimestamp}`,
              icons: [
                {
                  src: `/pwa-192x192.png?v=${buildTimestamp}`,
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
            {
              name: 'Buku Register Akta',
              short_name: 'Repertorium',
              description: 'Lihat Buku Register Akta & Berkas kronologis.',
              url: `/?section=register&v=${buildTimestamp}`,
              icons: [
                {
                  src: `/pwa-192x192.png?v=${buildTimestamp}`,
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
            {
              name: 'Laporan Bulanan PPATS',
              short_name: 'Laporan',
              description: 'Cetak dan ekspor Laporan Bulanan PPATS ke BPN & Bapenda.',
              url: `/?section=report&v=${buildTimestamp}`,
              icons: [
                {
                  src: `/pwa-192x192.png?v=${buildTimestamp}`,
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
          ],
        },
        workbox: {
          cacheId: `sim-ppats-${buildTimestamp}`,
          globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,webp,svg,woff,woff2}'],
          globIgnores: ['assets/aistudio/**'],
          ignoreURLParametersMatching: [/^v$/, /^source$/, /^section$/, /^shortcut$/, /^utm_/],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/__\//],
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ url }) =>
                url.pathname === '/manifest.json' || url.pathname === '/manifest.webmanifest',
              handler: 'NetworkFirst',
              options: {
                cacheName: `sim-ppats-manifest-${buildTimestamp}`,
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 4,
                  maxAgeSeconds: 60 * 5,
                },
              },
            },
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: `sim-ppats-pages-${buildTimestamp}`,
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24,
                },
              },
            },
            {
              urlPattern: ({ url, request }) =>
                url.origin === self.location.origin &&
                request.destination === 'image' &&
                !url.pathname.startsWith('/assets/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: `sim-ppats-public-images-${buildTimestamp}`,
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
          suppressWarnings: true,
        },
      }),
      // Appends build timestamp query param to manifest & icon links in index.html
      // so browsers, Vercel CDN, and desktop shortcuts always fetch the latest manifest & assets.
      {
        name: 'bust-pwa-manifest-and-icons',
        enforce: 'post',
        transformIndexHtml: {
          order: 'post',
          handler(html: string): string {
            return html
              .replace(
                /href="\/manifest\.json(?:\?[^"]*)?"/g,
                `href="/manifest.json?v=${buildTimestamp}"`
              )
              .replace(
                /href="\/(apple-touch-icon\.png|icon\.svg|pwa-192x192\.png)(?:\?[^"]*)?"/g,
                `href="/$1?v=${buildTimestamp}"`
              )
              .replace(
                /<\/head>/i,
                `    <meta name="app-build-timestamp" content="${buildTimestamp}" />\n  </head>`
              );
          },
        },
      },
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(import.meta.dirname, 'dist');
          const srcAssets = path.resolve(import.meta.dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/firebase/') || id.includes('/@firebase/')) {
              return 'vendor-firebase';
            }
            if (
              id.includes('/docx/') ||
              id.includes('/docxtemplater/') ||
              id.includes('/pizzip/') ||
              id.includes('/jszip/') ||
              id.includes('/file-saver/')
            ) {
              return 'vendor-docx';
            }
            if (id.includes('/xlsx/')) {
              return 'vendor-xlsx';
            }
            if (id.includes('/lucide-react/')) {
              return 'vendor-icons';
            }
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor-react';
            }
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
