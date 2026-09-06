import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Leading slash is the project root, not the filesystem.
    alias: {'@': '/src'},
  },
});
