import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',
  plugins: [react()],
  server: { port: 5173 },
  build: {
    assetsInlineLimit: 0, // Don't inline SVG icons; keep them as separate files
  },
});
