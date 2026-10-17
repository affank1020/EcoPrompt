import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Build the content script as one classic JS file for Chrome MV3.
// The popup build runs first, so its dist/ and manifest are preserved.
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content.tsx'),
      name: 'EcoPromptContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
});
