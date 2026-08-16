import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './src/core'),
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@data': path.resolve(__dirname, './src/data'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
