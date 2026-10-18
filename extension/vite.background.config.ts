import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const extensionRoot = dirname(fileURLToPath(import.meta.url));

// Build the MV3 background service worker into the same directory as the popup.
// Runs after the popup build, so it must not empty dist/.
export default defineConfig({
  root: extensionRoot,
  publicDir: false,
  // Library mode leaves process.env.NODE_ENV untouched, but service workers run without `process`.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: resolve(extensionRoot, 'dist'),
    emptyOutDir: false,
    lib: {
      entry: resolve(extensionRoot, 'src/background.ts'),
      name: 'EcoPromptBackground',
      formats: ['iife'],
      fileName: () => 'background.js',
    },
  },
});
