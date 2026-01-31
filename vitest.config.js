const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8',
      reports: ['text', 'lcov', 'html'],
      include: [
        'src/adapters/supabase-edge-functions-adapter.js',
        'unified_gateway.js'
      ]
    }
  }
});
