import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react({
      babel: { plugins: ['babel-plugin-react-compiler'] },
    }),
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
