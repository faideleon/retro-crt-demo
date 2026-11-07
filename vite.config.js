import { defineConfig } from 'vite';

// GitHub Pages serves the site from /<repo-name>/, so builds use that base path.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/retro-crt-demo/' : '/',
}));
