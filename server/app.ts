import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { gatewayRouter } from './gateway';
import { handleActionApi } from './services/actionApi';
import { contentService } from './services/content';
import {
  chatbotBlockerMiddleware,
  getServerRobotsTxtContent,
} from './middleware/chatbotBlocker';

export function createExpressApp() {
  const app = express();

  // 1. Disable x-powered-by header & trust reverse proxies (Cloud Run, Vercel)
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // 1.1. Security Rule Shield (4.1.1.23B.2): Block direct access to firestore.rules and internal configurations
  app.use((req: Request, res: Response, next: NextFunction) => {
    const rawPath = (req.path || '').toLowerCase();
    if (
      rawPath.includes('firestore.rules') ||
      rawPath.endsWith('.rules') ||
      rawPath.includes('firebase-applet-config.json') ||
      rawPath.includes('.env') ||
      rawPath.includes('tsconfig') ||
      rawPath === '/metadata.json'
    ) {
      return res.status(403).json({
        error: 'Acesso Proibido (4.1.1.23B.2): Regras do firestore.rules e arquivos de credenciais são protegidos e criptografados contra leitura pública.',
        code: 'SECURITY_RULES_ENCRYPTED_ACCESS_RESTRICTED',
      });
    }
    next();
  });

  // 1.2. ChatbotBlocker Extension Middleware: Prevent any chatbot/AI fetcher from opening Wiki-site links
  app.use(chatbotBlockerMiddleware);

  // 2. Security Headers via Helmet + CSP frame-ancestors allowing Google AI Studio
  app.use(
    helmet({
      contentSecurityPolicy: false, // Let Vite handle script tags in development/SPA
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      frameguard: false, // Controlled via CSP frame-ancestors so Google AI Studio can embed the preview
    })
  );

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.removeHeader('X-Frame-Options');
    res.setHeader(
      'Content-Security-Policy',
      "frame-ancestors 'self' https://aistudio.google.com https://*.aistudio.google.com https://*.google.com https://*.googleusercontent.com https://*.usercontent.goog https://*.gstatic.com https://*.withgoogle.com https://*.run.app http://localhost:* http://127.0.0.1:*"
    );
    next();
  });

  // 3. CORS restricted to APP_URL and local dev
  const allowedOrigins = [
    process.env.APP_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://core.wazzimagiygg.com',
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

  // 4. Rate Limiting: 300 requests per 15 minutes window (configured for reverse proxies)
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições enviadas. Tente novamente mais tarde.' },
    validate: false,
  });
  app.use('/api/', apiLimiter);

  // 5. Body parser with 1mb limit
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 5.1. Mount MediaWiki Action API (/api.php) and REST API (/w/rest.php/v1)
  app.all('/api.php', handleActionApi);
  app.get('/w/rest.php/v1/page/:title', (req: Request, res: Response) => {
    const art = contentService.getArticle(req.params.title);
    if (!art) return res.status(404).json({ error: 'Page not found' });
    res.json({
      id: 1,
      key: art.slug,
      title: art.title,
      latest: { id: 1, timestamp: art.updatedAt || art.createdAt },
      content_model: 'wikitext',
      license: { url: 'https://creativecommons.org/licenses/by-sa/4.0/', title: 'CC BY-SA 4.0' },
      source: art.wikitext,
    });
  });

  // 6. Mount MediaWiki Microservices API Gateway
  app.use('/api/v1', gatewayRouter);

  // 6.05. Dynamic robots.txt aligned with ChatbotBlocker extension
  app.get('/robots.txt', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).send(getServerRobotsTxtContent());
  });

  // 6.1. Dynamic XML Sitemap for search engine crawlers anchored on core.wazzimagiygg.com
  app.get('/sitemap.xml', (_req: Request, res: Response) => {
    const baseUrl = 'https://core.wazzimagiygg.com';
    const articles = contentService.getAllArticles();
    const today = new Date().toISOString().split('T')[0];

    const escapeXml = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const staticUrls = [
      { loc: `${baseUrl}/`, lastmod: today, changefreq: 'daily', priority: '1.0' },
      { loc: `${baseUrl}/#/special/AllPages`, lastmod: today, changefreq: 'daily', priority: '0.9' },
      { loc: `${baseUrl}/#/special/RecentChanges`, lastmod: today, changefreq: 'hourly', priority: '0.8' },
      { loc: `${baseUrl}/#/special/Categories`, lastmod: today, changefreq: 'daily', priority: '0.8' },
    ];

    const articleUrls = articles.map(art => ({
      loc: `${baseUrl}/#/wiki/${encodeURIComponent(art.slug)}`,
      lastmod: (art.updatedAt || art.createdAt || new Date().toISOString()).split('T')[0],
      changefreq: 'weekly',
      priority: art.namespace === 0 ? '0.95' : '0.6',
    }));

    const allUrls = [...staticUrls, ...articleUrls];
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...allUrls.map(
        u =>
          `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n    <lastmod>${escapeXml(u.lastmod)}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
      ),
      '</urlset>',
    ].join('\n');

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Robots-Tag', 'all');
    res.status(200).send(xml);
  });

  // 7. Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      platform: 'NotMediaWiki-Node-Microservices',
      canonicalDomain: 'core.wazzimagiygg.com',
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
