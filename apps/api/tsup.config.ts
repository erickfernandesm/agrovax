import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // O pacote compartilhado e distribuido como fonte TypeScript; entra no bundle.
  noExternal: ['@agrovax/shared'],
});
