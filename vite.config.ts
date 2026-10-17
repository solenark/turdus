/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** `npm run dev` only: receives the app's test recordings and stores them in recordings/ for fine-tuning. */
function debugRecordings(): Plugin {
  const dir = resolve(__dirname, 'recordings');
  return {
    name: 'turdus-debug-recordings',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/recordings', (req, res) => {
        const url = new URL(req.url ?? '', 'http://x');
        const id = url.searchParams.get('id') ?? '';
        const ext = url.searchParams.get('ext');
        if (req.method !== 'POST' || !/^[\w-]+$/.test(id) || (ext !== 'wav' && ext !== 'json')) {
          res.statusCode = 400;
          return res.end();
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          mkdirSync(dir, { recursive: true });
          writeFileSync(resolve(dir, `${id}.${ext}`), Buffer.concat(chunks));
          server.config.logger.info(`recording saved: recordings/${id}.${ext}`);
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    debugRecordings(),
    // The microphone only works over HTTPS (or localhost); the local certificate allows testing on a phone.
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Turdus — do canto ao MIDI',
        short_name: 'Turdus',
        description: 'Grave um canto, veja as notas e exporte em MIDI.',
        theme_color: '#1d1b2f',
        background_color: '#1d1b2f',
        display: 'standalone',
        orientation: 'portrait',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  server: {
    // Any `proxy` value makes Vite serve HTTPS over HTTP/1.1 instead of HTTP/2. Under HTTP/2, a request the
    // browser aborts mid-response (e.g. reloading during HMR) crashes the dev server (ERR_HTTP2_INVALID_STREAM).
    proxy: {},
    // Test recordings must not reload the page.
    watch: { ignored: ['**/recordings/**'] },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
