import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 900, // three.js is one ~580 kB chunk; that's expected
  },
});
