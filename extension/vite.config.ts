import { defineConfig, loadEnv } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const extensionRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: extensionRoot,
  plugins: [react(), {
    name: 'configured-api-permissions',
    closeBundle() {
      const env = { ...loadEnv('production', extensionRoot, ''), ...process.env };
      const path = resolve(extensionRoot, 'dist/manifest.json');
      const manifest = JSON.parse(readFileSync(path, 'utf8'));
      if (env.VITE_SUPABASE_URL) {
        const url = new URL(env.VITE_SUPABASE_URL);
        if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') throw new Error('Supabase must use HTTPS');
        manifest.host_permissions.push(`${url.origin}/*`);
      }
      writeFileSync(path, JSON.stringify(manifest, null, 2));
    },
  }],
  build: {
    outDir: resolve(extensionRoot, 'dist'),
    rollupOptions: { input: resolve(extensionRoot, 'popup.html') },
  },
});
