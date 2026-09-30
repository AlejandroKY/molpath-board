/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: funciona igual en GitHub Pages (/repo/), Nginx (/) y vite preview.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    fs: { allow: ['..'] }, // el dataset demo vive en /demo-data (fuente única compartida con el backend)
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
