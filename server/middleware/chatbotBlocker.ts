import { Request, Response, NextFunction } from 'express';
import {
  buildAntiChatbotRobotsTxt,
  ChatbotBlockMode,
  detectChatbotAccess,
} from '../../src/utils/chatbotSignatures';
import { DEFAULT_CHATBOT_BLOCK_MESSAGE } from '../../src/extensions/chatbotBlockerExtension';

export interface ServerChatbotBlockerPolicy {
  enabled: boolean;
  blockMode: ChatbotBlockMode;
  statusCode: number;
  blockMessage: string;
  injectNoAiMeta: boolean;
  customBlockedAgents: string[];
}

export interface BlockedChatbotAttemptLog {
  timestamp: string;
  source: string;
  matchedAgent: string;
  path: string;
}

const DEFAULT_POLICY: ServerChatbotBlockerPolicy = {
  enabled: true,
  blockMode: 'block_all_chatbots',
  statusCode: 403,
  blockMessage: DEFAULT_CHATBOT_BLOCK_MESSAGE,
  injectNoAiMeta: true,
  customBlockedAgents: [],
};

let currentPolicy: ServerChatbotBlockerPolicy = { ...DEFAULT_POLICY };
let totalBlockedAttempts = 0;
const recentBlockedAttempts: BlockedChatbotAttemptLog[] = [];
const MAX_RECENT_LOGS = 50;

export function getChatbotBlockerPolicy(): ServerChatbotBlockerPolicy {
  return { ...currentPolicy, customBlockedAgents: [...currentPolicy.customBlockedAgents] };
}

export function updateChatbotBlockerPolicy(
  patch: Partial<ServerChatbotBlockerPolicy>
): ServerChatbotBlockerPolicy {
  const nextStatus =
    typeof patch.statusCode === 'number' && patch.statusCode >= 400 && patch.statusCode <= 599
      ? Math.floor(patch.statusCode)
      : currentPolicy.statusCode;

  const nextMode: ChatbotBlockMode =
    patch.blockMode === 'strict_zero_ai' ||
    patch.blockMode === 'allow_traditional_search_only' ||
    patch.blockMode === 'block_all_chatbots'
      ? patch.blockMode
      : currentPolicy.blockMode;

  currentPolicy = {
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : currentPolicy.enabled,
    blockMode: nextMode,
    statusCode: nextStatus,
    blockMessage:
      typeof patch.blockMessage === 'string' && patch.blockMessage.trim().length > 0
        ? patch.blockMessage.trim().slice(0, 600)
        : currentPolicy.blockMessage,
    injectNoAiMeta:
      typeof patch.injectNoAiMeta === 'boolean'
        ? patch.injectNoAiMeta
        : currentPolicy.injectNoAiMeta,
    customBlockedAgents: Array.isArray(patch.customBlockedAgents)
      ? patch.customBlockedAgents
          .map(s => String(s).trim())
          .filter(s => s.length >= 2)
          .slice(0, 50)
      : currentPolicy.customBlockedAgents,
  };

  return getChatbotBlockerPolicy();
}

export function resetChatbotBlockerPolicyForTests(): void {
  currentPolicy = { ...DEFAULT_POLICY };
  totalBlockedAttempts = 0;
  recentBlockedAttempts.length = 0;
}

export function getChatbotBlockerStatus(includeLogs: boolean = false) {
  return {
    extensionId: 'ext-chatbot-blocker',
    enabled: currentPolicy.enabled,
    blockMode: currentPolicy.blockMode,
    statusCode: currentPolicy.statusCode,
    injectNoAiMeta: currentPolicy.injectNoAiMeta,
    totalBlockedAttempts,
    ...(includeLogs ? { recentBlockedAttempts: [...recentBlockedAttempts] } : {}),
  };
}

export function getServerRobotsTxtContent(): string {
  return buildAntiChatbotRobotsTxt(currentPolicy.enabled);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildBlockedHtmlResponse(message: string, matchedAgent: string): string {
  const safeMessage = escapeHtml(message);
  const safeAgent = escapeHtml(matchedAgent);
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex, nofollow, noarchive, noai, noimageai" />
  <meta name="tdm-reservation" content="1" />
  <title>Acesso bloqueado para chatbots — NotMediaWiki</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    main { max-width: 520px; width: 100%; background: #1e293b; border: 1px solid #9f1239; border-radius: 12px; padding: 24px; box-sizing: border-box; }
    h1 { font-size: 1.25rem; margin: 0 0 12px; color: #ffffff; }
    p { font-size: 0.92rem; line-height: 1.55; color: #cbd5e1; margin: 0 0 14px; }
    .meta { font-family: monospace; font-size: 0.8rem; color: #fda4af; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 10px 12px; }
  </style>
</head>
<body>
  <main>
    <h1>Acesso bloqueado para chatbots (ext-chatbot-blocker)</h1>
    <p>${safeMessage}</p>
    <div class="meta">Agente/Origem bloqueada: ${safeAgent}</div>
  </main>
</body>
</html>`;
}

/**
 * Express middleware enforcing ChatbotBlocker across HTTP requests.
 */
export function chatbotBlockerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const path = (req.path || '').toLowerCase();

  // Keep /robots.txt and /health accessible so bots read Disallow: / and probes succeed
  if (path === '/robots.txt' || path === '/health') {
    return next();
  }

  if (!currentPolicy.enabled) {
    return next();
  }

  const userAgent = req.get('user-agent') || '';
  const referer = req.get('referer') || req.get('referrer') || '';
  const origin = req.get('origin') || '';

  const detection = detectChatbotAccess(
    {
      userAgent,
      referer,
      origin,
      url: req.originalUrl || req.url || '/',
      headers: req.headers,
    },
    {
      enabled: currentPolicy.enabled,
      blockMode: currentPolicy.blockMode,
      customBlockedAgents: currentPolicy.customBlockedAgents,
    }
  );

  if (detection.blocked) {
    totalBlockedAttempts += 1;
    const matchedAgent = detection.matchedAgent || 'Chatbot/AI-Agent';
    recentBlockedAttempts.unshift({
      timestamp: new Date().toISOString(),
      source: detection.source || 'user-agent',
      matchedAgent,
      path: (req.originalUrl || req.path || '/').slice(0, 200),
    });
    if (recentBlockedAttempts.length > MAX_RECENT_LOGS) {
      recentBlockedAttempts.pop();
    }

    res.setHeader('X-Robots-Tag', 'noai, noimageai, noindex, nofollow');
    res.setHeader('X-Chatbot-Blocker', 'blocked');
    res.setHeader('Cache-Control', 'no-store');

    const wantsJson =
      path.startsWith('/api') ||
      path.startsWith('/w/') ||
      (req.get('accept') || '').toLowerCase().includes('application/json');

    if (wantsJson) {
      res.status(currentPolicy.statusCode).json({
        error: currentPolicy.blockMessage,
        code: 'CHATBOT_ACCESS_BLOCKED',
        extension: 'ext-chatbot-blocker',
        matchedAgent,
      });
      return;
    }

    res
      .status(currentPolicy.statusCode)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .send(buildBlockedHtmlResponse(currentPolicy.blockMessage, matchedAgent));
    return;
  }

  // Inject noai directive on normal non-sitemap responses when active
  if (currentPolicy.injectNoAiMeta && path !== '/sitemap.xml') {
    res.setHeader('X-Robots-Tag', 'noai, noimageai');
  }

  next();
}
