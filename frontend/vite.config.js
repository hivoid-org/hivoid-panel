import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import fs from 'node:fs';
import path from 'node:path';

const version = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../version.json'), 'utf-8')).version;

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
