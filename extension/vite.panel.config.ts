import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const extensionRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: extensionRoot,
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  publicDir: false,
  build: {
    outDir: resolve(extensionRoot, "dist"),
    emptyOutDir: false,
    lib: {
      entry: resolve(extensionRoot, "src/panel.tsx"),
      name: "EcoPromptPanel",
      formats: ["iife"],
      fileName: () => "panel.js",
    },
  },
});
