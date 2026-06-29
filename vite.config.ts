/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages deploys under /<repo-name>/ path.
  base: '/sun-harvester-game/',
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.property.test.ts'],
  },
  resolve: {
    alias: {
      '@game': '/src/game',
    },
  },
});
