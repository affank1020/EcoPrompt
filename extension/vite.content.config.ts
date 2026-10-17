import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const extensionRoot = dirname(fileURLToPath(import.meta.url));

// Build the classic MV3 content script into the same directory as the popup.
// Keep the popup, manifest, and public assets from the first build pass.
export default defineConfig({
  root: extensionRoot,
  plugins: [react()],
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
