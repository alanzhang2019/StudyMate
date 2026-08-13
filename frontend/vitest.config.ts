import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'lib/**/*.test.ts', 'app/**/*.test.ts', 'components/**/*.test.ts'],
    setupFiles: ['tests/setup-env.ts'],
  },
});
