import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY || 'http://localhost:5000';
  const proxy = {
    '/api': { target: apiTarget, changeOrigin: true },
    '/uploads': { target: apiTarget, changeOrigin: true },
  };
  return {
    plugins: [react()],
    server: { port: 5174, strictPort: true, host: true, proxy },
    preview: { port: 4174, strictPort: true, host: true, proxy },
    build: { sourcemap: false, chunkSizeWarningLimit: 900 },
  };
});
