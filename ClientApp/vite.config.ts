import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
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
