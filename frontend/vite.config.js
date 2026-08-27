import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration with proxy for Spring Boot backend and WebSocket
export default defineConfig({
  plugins: [react()],
  define: {
    // SockJS client global polyfill for browser
    global: 'window',
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
