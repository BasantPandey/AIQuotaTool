import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/** Builds the React webview bundles that VS Code extension host serves in WebviewPanels. */
export default defineConfig({
  root: '.',
  resolve: { conditions: ['browser'] },
  plugins: [
    react({
      babel: { plugins: ['babel-plugin-react-compiler'] },
    }),
  ],
  build: {
    outDir: 'dist/webview',
    emptyOutDir: true,
    // One stylesheet, at a fixed name the extension host links.
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/webview/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (asset) => (asset.names.some((n) => n.endsWith('.css')) ? 'webview.css' : '[name][extname]'),
      },
    },
  },
});
