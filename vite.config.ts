import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vitest/config';

// GitHub Pages project site: https://coder-r2.github.io/cubebuddy/ (D-029)
const BASE = '/cubebuddy/';

// GitHub Pages has no SPA rewrites; serving index.html as 404.html makes deep links load the app.
function spaFallback404(): Plugin {
  let outDir = 'dist';
  return {
    name: 'cubebuddy:spa-fallback-404',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await copyFile(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [react(), tailwindcss(), spaFallback404()],
  worker: { format: 'es' },
  // cubing.js spawns its own module workers via import.meta.url; pre-bundling breaks those URLs.
  optimizeDeps: { exclude: ['cubing'] },
  build: {
    target: 'es2023',
    // cubing.js starts its search worker from a runtime URL, so Vite bundles the worker entry as a
    // normal chunk. The module-preload helper Vite would wrap around its dynamic imports touches
    // `document` (and lives in the app chunk), which crashes the worker (D-054). With preloading off
    // and a single global stylesheet, chunks have no preload deps and nothing gets wrapped.
    modulePreload: false,
    cssCodeSplit: false,
    rolldownOptions: {
      output: {
        // Keep Vite's tiny preload helper out of the app entry chunk so the worker doesn't import the app.
        codeSplitting: { groups: [{ name: 'vite-preload-helper', test: /preload-helper/ }] },
      },
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
});
