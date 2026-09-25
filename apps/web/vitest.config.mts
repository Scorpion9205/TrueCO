import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // React 17+ JSX transform, so test files need no `import React`
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // Form tests type key by key like a user; under a full parallel run (and on CI) that can
    // take longer than the 5s default without anything being wrong
    testTimeout: 20_000,
  },
});
