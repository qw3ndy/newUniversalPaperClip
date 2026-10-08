import { defineConfig } from 'vite';

// `base: './'` keeps the build working from any sub-path (GitHub Pages, itch.io...).
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});
