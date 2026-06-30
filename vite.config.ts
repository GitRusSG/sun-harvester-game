/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // GitHub Pages deploys under /<repo-name>/ path, but the dev server
  // serves from root so localhost:5173/ works directly.
  base: command === 'build' ? '/sun-harvester-game/' : '/',
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.property.test.ts'],
  },
  resolve: {
    alias: {
      '@game': '/src/game',
    },
  },
}));
