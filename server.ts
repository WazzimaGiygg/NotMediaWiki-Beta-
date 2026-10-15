import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { gatewayRouter } from './server/gateway';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json({ limit: '10mb' }));

  // Mount MediaWiki Microservices API Gateway
  app.use('/api/v1', gatewayRouter);

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', platform: 'MediaWiki-Node-Microservices', timestamp: new Date().toISOString() });
  });

  // Explicit JSON 404 for any unhandled /api/* routes so it NEVER falls through to HTML SPA
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MediaWiki-Micro] Node.js Microservices Server active on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
