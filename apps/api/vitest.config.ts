import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/support/globalSetup.ts'],
    // Os arquivos compartilham um banco de teste; rodam em sequencia.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      // Segredo usado somente nos testes automatizados.
      JWT_ACCESS_SECRET: 'segredo-exclusivo-dos-testes-automatizados-0001',
    },
  },
});
