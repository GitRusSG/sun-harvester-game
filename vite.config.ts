/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Base path:
  // - Netlify/Vercel/Cloudflare serve from root → set DEPLOY_TARGET=root (or use Netlify's default)
  // - GitHub Pages serves under /<repo-name>/
  // - Dev server always serves from root
  base:
    command === 'build' && process.env.DEPLOY_TARGET !== 'root'
      ? '/sun-harvester-game/'
      : '/',
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.property.test.ts'],
  },
  resolve: {
    alias: {
      '@game': '/src/game',
    },
  },
}));
