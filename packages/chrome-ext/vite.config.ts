import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';
import { build as esbuild } from 'esbuild';

// Copies manifest.json + icons, then bundles the content script as IIFE.
// Content scripts cannot use ES module syntax, so they must be bundled separately.
function chromeExtAssets() {
  return {
    name: 'chrome-ext-assets',
    async closeBundle() {
      copyFileSync('manifest.json', 'dist/manifest.json');
      mkdirSync('dist/icons', { recursive: true });
      for (const file of readdirSync('icons')) {
        copyFileSync(`icons/${file}`, `dist/icons/${file}`);
      }
      await esbuild({
        entryPoints: ['src/content/quota-bridge.ts'],
        bundle: true,
        outfile: 'dist/content.js',
        format: 'iife',
        platform: 'browser',
        target: 'es2022',
        minify: true,
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react({
      babel: { plugins: ['babel-plugin-react-compiler'] },
    }),
    chromeExtAssets(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        worker: resolve(__dirname, 'src/background/worker.ts'),
        popup: resolve(__dirname, 'src/popup/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
});
