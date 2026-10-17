import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const extensionRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: extensionRoot,
  plugins: [react()],
  build: {
    outDir: resolve(extensionRoot, 'dist'),
    rollupOptions: { input: resolve(extensionRoot, 'popup.html') },
  },
});
