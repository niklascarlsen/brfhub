import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // The manifest is a real file in public/, written by npm run generate.
      manifest: false,
      // Registered in src/lib/serviceWorker.ts instead, so the update check
      // for /push-sw.js can bypass the HTTP cache.
      injectRegister: false,
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,woff2,png,webmanifest}'],
        // Push handlers live in public/push-sw.js and are imported by the
        // generated worker instead of being precached.
        globIgnores: ['push-sw.js'],
        importScripts: ['/push-sw.js'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    // Leading slash is the project root, not the filesystem.
    alias: {'@': '/src'},
  },
});
