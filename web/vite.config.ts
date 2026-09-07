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
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,webmanifest}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    // Leading slash is the project root, not the filesystem.
    alias: {'@': '/src'},
  },
});
