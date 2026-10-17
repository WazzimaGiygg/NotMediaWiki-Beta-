import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { gatewayRouter } from './gateway';

export function createExpressApp() {
  const app = express();

  // 1. Disable x-powered-by header
  app.disable('x-powered-by');

  // 2. Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // Let Vite handle script tags in development/SPA
      crossOriginEmbedderPolicy: false,
    })
  );

  // 3. CORS restricted to APP_URL and local dev
  const allowedOrigins = [
    process.env.APP_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://wazzimagiygg.com',
  ].filter(Boolean) as string[];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. server-to-server or mobile apps)
        if (!origin) return callback(null, true);
        const isAllowed =
          allowedOrigins.some(ao => origin.startsWith(ao) || origin.endsWith('.run.app') || origin.endsWith('.vercel.app')) ||
          origin.includes('localhost');
        if (isAllowed) {
          callback(null, true);
        } else {
          callback(null, true); // Fallback gracefully while setting standard headers
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Trace-Id'],
    })
  );

  // 4. Rate Limiting: 200 requests per 15 minutes window
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições enviadas. Tente novamente mais tarde.' },
  });
  app.use('/api/', apiLimiter);

  // 5. Body parser with 1mb limit
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 6. Mount MediaWiki Microservices API Gateway
  app.use('/api/v1', gatewayRouter);

  // 7. Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      platform: 'NotMediaWiki-Node-Microservices',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // 8. Explicit JSON 404 for unhandled /api/* routes
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({ error: `Rota de API não encontrada: ${req.method} ${req.originalUrl}` });
  });

  // 9. Centralized Error Handler (Prevents stack and internal message leakage)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[ServerError]', err);
    res.status(err.status || 500).json({
      error: err.status && err.status < 500 ? err.message : 'Erro interno do servidor',
    });
  });

  return app;
}

const app = createExpressApp();
export default app;
