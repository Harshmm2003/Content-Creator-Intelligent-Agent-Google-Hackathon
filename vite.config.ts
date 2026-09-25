import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom Vite plugin to embed our Express REST API directly into Vite dev server
function expressApiPlugin(): Plugin {
  return {
    name: 'express-api-plugin',
    async configureServer(server) {
      const { initRepositories } = await import('./server/repositories/index.ts');
      const { createApp } = await import('./server/app.ts');
      initRepositories();
      const app = createApp();
      // Mount the Express app for /api requests
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/api')) {
          app(req as any, res as any, next);
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), expressApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
