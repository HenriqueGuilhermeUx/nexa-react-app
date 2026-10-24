import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    target: 'es2022',
    sourcemap: false,
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(process.cwd(), 'qa-entry.html'),
    },
  },
});
