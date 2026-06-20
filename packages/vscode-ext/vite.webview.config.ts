import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/** Builds the React webview bundle that VS Code extension host serves in a WebviewPanel. */
export default defineConfig({
  root: '.',
  // Vite resolves the webview tsconfig for type info during the build
  resolve: { conditions: ['browser'] },
  plugins: [
    react({
      babel: { plugins: ['babel-plugin-react-compiler'] },
    }),
  ],
  build: {
    outDir: 'dist/webview',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/webview/index.html'),
      output: {
        entryFileNames: 'index.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
});
