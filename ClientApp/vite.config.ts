import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:59212';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 8080,
    proxy: {
      '^/WebService\\.asmx(/.*)?$': {
        target: BACKEND,
        changeOrigin: false,
        secure: false,
        cookieDomainRewrite: '',
      },
      '^/assets/.*': {
        target: BACKEND,
        changeOrigin: false,
        secure: false,
      },
    },
  },
});
