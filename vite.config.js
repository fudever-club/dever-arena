import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
// DEVER_API_PORT: backend API cho proxy /api (mặc định 8787; E2E dùng port riêng để không đụng máy dev).
const apiPort = Number(process.env.DEVER_API_PORT || 8787);
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 5173,
    open: '/app.html',
    proxy: {
      '/api': `http://localhost:${apiPort}`
    }
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: 'app.html'
      },
      output: {
        advancedChunks: {
          groups: [
            { name: 'monaco', test: /@monaco-editor/ },
            { name: 'katex', test: /katex/ },
            { name: 'vendor', test: /node_modules\/(react|react-dom|react-router-dom)/ }
          ]
        }
      }
    }
  }
});
