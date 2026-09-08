import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
  // Vitest resolves assets through Vite's transform pipeline, so this is not dead build-only config.
  // Without it, SVGs are inlined as data URIs and Icon.test.tsx's path assertions fail.
  // vite.config.ts carries the same option separately for the real build.
  build: {
    assetsInlineLimit: 0,
  },
});
