import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
    proxy: {
      // Forward serverless API calls to the local Vercel dev server (vercel dev, port 3000)
      '/api': process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
