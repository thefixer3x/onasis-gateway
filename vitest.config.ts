import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{js,ts}'],
    exclude: ['**/node_modules/**', '**/.git/**'],
    globals: true,
    environment: 'node',
  },
});
