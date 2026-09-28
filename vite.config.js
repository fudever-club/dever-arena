import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
// DEVER_API_PORT: backend API cho proxy /api (mặc định 8787; E2E dùng port riêng để không đụng máy dev).
const apiPort = Number(process.env.DEVER_API_PORT || 8787);

// SPA entry là app.html (không phải index.html): đưa / về /app.html cho dev + preview.
function rootRedirectPlugin() {
  const redirect = (req, res, next) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(302, { Location: '/app.html' });
      return res.end();
    }
    next();
  };
  return {
    name: 'dever-root-redirect',
    configureServer(server) { server.middlewares.use(redirect); },
    configurePreviewServer(server) { server.middlewares.use(redirect); },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    rootRedirectPlugin(),
  ],
  server: {
    // Specific (specific dev/deploy) cấp port qua env PORT; giữ 5173 cho chạy thủ công.
    port: Number(process.env.PORT || 5173),
    open: '/app.html',
    proxy: {
      '/api': `http://localhost:${apiPort}`
    }
  },
  // Phục vụ bản build production (dist/) — port theo PORT khi chạy trên Specific.
  preview: {
    port: Number(process.env.PORT || 4173),
    host: true,
    // Chấp nhận domain *.spcf.app mà Specific cấp (mặc định Vite chặn host lạ).
    allowedHosts: ['.spcf.app'],
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
