import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const extensionRoot = dirname(fileURLToPath(import.meta.url));

// Build the classic MV3 ChatGPT launcher into the extension output directory.
// Keep the panel, fallback page, manifest, and public assets from other passes.
export default defineConfig({
  root: extensionRoot,
  plugins: [react()],
  // Vite's library build preserves process.env.NODE_ENV by default.
  // Classic Chrome content scripts have no Node.js `process` global.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  publicDir: false,
  build: {
    outDir: resolve(extensionRoot, 'dist'),
    emptyOutDir: false,
    lib: {
      entry: resolve(extensionRoot, 'src/content.tsx'),
      name: 'EcoPromptContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
});
