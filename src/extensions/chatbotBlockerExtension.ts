import { WikiExtension } from '../types';
import { ChatbotBlockMode } from '../utils/chatbotSignatures';

export const EXTENSION_CHATBOT_BLOCKER_ENABLED = true;

export const DEFAULT_CHATBOT_BLOCK_MESSAGE =
  'Acesso bloqueado: este Wiki-site possui a extensão ChatbotBlocker ativa e não permite que nenhum chatbot, assistente de IA ou coletor automatizado abra ou leia seus links.';

/**
 * Extensão ChatbotBlocker (ext-chatbot-blocker)
 * Impede que qualquer chatbot, assistente de IA ou fetcher de LLM abra, leia ou indexe links deste Wiki-site,
 * operando em dupla camada (servidor HTTP/robots.txt/headers + guarda no navegador e metatags noai).
 */
export const chatbotBlockerExtension: WikiExtension = {
  id: 'ext-chatbot-blocker',
  name: 'ChatbotBlocker',
  namePt: 'Bloqueio de Chatbots & Assistentes de IA',
  version: '1.0.0',
  category: 'security',
  author: 'NotMediaWiki Security Guild & WazzimaGiygg Defense',
  description:
    'Impede que qualquer chatbot ou agente conversacional de IA (ChatGPT, Claude, Perplexity, Gemini, Copilot, Meta AI, Grok, DeepSeek, Poe e fetchers MCP/LLM) consiga abrir ou ler links deste Wiki-site, bloqueando requisições HTTP (403), referenciadores de chat, rastreadores utm_source e injetando diretivas noai/robots.txt.',
  enabled: true,
  type: 'extension',
  url: 'https://core.wazzimagiygg.com/#/burocratas',
  license: 'GPL-2.0-or-later',
  hooks: [
    {
      name: 'MediaWikiServices',
      handler: 'ChatbotBlockerHooks::onHttpRequestFilter',
      description:
        'Intercepta requisições HTTP no servidor Express e retorna 403 Forbidden para User-Agents, cabeçalhos e referenciadores de chatbots.',
    },
    {
      name: 'BeforeInitialize',
      handler: 'ChatbotBlockerHooks::onClientEnvironmentCheck',
      description:
        'Verifica no cliente User-Agent, Referer, ancestorOrigins e parâmetros de origem para bloquear renderização em ambientes de chatbot.',
    },
    {
      name: 'BeforePageDisplay',
      handler: 'ChatbotBlockerHooks::onInjectNoAiHeadersAndMeta',
      description:
        'Aplica metatags noai, noimageai, tdm-reservation e cabeçalhos X-Robots-Tag no documento HTML e no robots.txt.',
    },
  ],
  config: [
    {
      key: '$wgChatbotBlockerActive',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description:
        'Ativa ou pausa o bloqueio de abertura de links por qualquer chatbot ou assistente de IA.',
    },
    {
      key: '$wgChatbotBlockMode',
      type: 'string',
      value: 'block_all_chatbots',
      defaultValue: 'block_all_chatbots',
      description:
        'Política aplicada: "block_all_chatbots" (bloqueia todos os chatbots e fetchers de IA preservando buscadores tradicionais) ou "strict_zero_ai".',
    },
    {
      key: '$wgChatbotBlockResponseCode',
      type: 'number',
      value: 403,
      defaultValue: 403,
      description:
        'Código de status HTTP retornado pelo servidor quando um chatbot tentar abrir o link (padrão: 403).',
    },
    {
      key: '$wgChatbotBlockMessage',
      type: 'string',
      value: DEFAULT_CHATBOT_BLOCK_MESSAGE,
      defaultValue: DEFAULT_CHATBOT_BLOCK_MESSAGE,
      description:
        'Mensagem exibida ao tentar abrir o Wiki-site através de um chatbot ou crawler de IA.',
    },
    {
      key: '$wgChatbotInjectNoAiMeta',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description:
        'Injeta metatags noai/noimageai/GPTBot/tdm-reservation no <head> e cabeçalho X-Robots-Tag.',
    },
    {
      key: '$wgChatbotCustomBlockedAgents',
      type: 'string',
      value: '',
      defaultValue: '',
      description:
        'Lista opcional (separada por vírgulas) de identificadores extras de User-Agent ou domínios de chatbots a bloquear.',
    },
  ],
  manifestJson: {
    name: 'ChatbotBlocker',
    version: '1.0.0',
    type: 'security',
    license_name: 'GPL-2.0-or-later',
    blocks_chatbots: true,
  },
  lastUpdated: '2026-11-26',
};

export interface ChatbotBlockerConfig {
  extensionEnabled: boolean;
  isActive: boolean;
  blockMode: ChatbotBlockMode;
  responseCode: number;
  blockMessage: string;
  injectNoAiMeta: boolean;
  customBlockedAgents: string[];
}

export function getChatbotBlockerConfig(extensions?: WikiExtension[]): ChatbotBlockerConfig {
  let ext: WikiExtension | undefined = chatbotBlockerExtension;

  if (extensions && extensions.length > 0) {
    const found = extensions.find(
      e => e.id === chatbotBlockerExtension.id || e.name.toLowerCase() === 'chatbotblocker'
    );
    if (found) ext = found;
  } else if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem('notmediawiki_extensions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const found = parsed.find(
            (e: any) =>
              e?.id === chatbotBlockerExtension.id ||
              String(e?.name || '').toLowerCase() === 'chatbotblocker'
          );
          if (found) ext = found;
        }
      }
    } catch {
      // Ignore storage access errors
    }
  }

  const extensionEnabled = Boolean(ext?.enabled ?? true);

  const findConfig = <T,>(key: string, fallback: T): T => {
    const param = ext?.config?.find(c => c.key === key);
    if (param && param.value !== undefined && param.value !== null) {
      return param.value as T;
    }
    return fallback;
  };

  const activeFlag = Boolean(findConfig<boolean>('$wgChatbotBlockerActive', true));
  const rawMode = String(findConfig<string>('$wgChatbotBlockMode', 'block_all_chatbots'));
  const blockMode: ChatbotBlockMode =
    rawMode === 'strict_zero_ai' || rawMode === 'allow_traditional_search_only'
      ? rawMode
      : 'block_all_chatbots';

  const rawCode = Number(findConfig<number>('$wgChatbotBlockResponseCode', 403));
  const responseCode =
    Number.isFinite(rawCode) && rawCode >= 400 && rawCode <= 599 ? Math.floor(rawCode) : 403;

  const rawMsg = String(
    findConfig<string>('$wgChatbotBlockMessage', DEFAULT_CHATBOT_BLOCK_MESSAGE)
  ).trim();
  const blockMessage = rawMsg || DEFAULT_CHATBOT_BLOCK_MESSAGE;

  const injectNoAiMeta = Boolean(findConfig<boolean>('$wgChatbotInjectNoAiMeta', true));

  const rawCustom = String(findConfig<string>('$wgChatbotCustomBlockedAgents', ''));
  const customBlockedAgents = rawCustom
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length >= 2);

  return {
    extensionEnabled,
    isActive: extensionEnabled && activeFlag,
    blockMode,
    responseCode,
    blockMessage,
    injectNoAiMeta,
    customBlockedAgents,
  };
}

/**
 * Synchronizes anti-AI/anti-chatbot meta directives in document.head when running in a browser.
 */
export function applyChatbotMetaProtection(config: ChatbotBlockerConfig): void {
  if (typeof document === 'undefined' || !document.head) return;

  const robotsMeta = document.head.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
  const shouldProtect = config.isActive && config.injectNoAiMeta;

  if (robotsMeta) {
    const baseContent = robotsMeta.getAttribute('content') || 'index, follow';
    const tokens = baseContent
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
      .filter(t => t.toLowerCase() !== 'noai' && t.toLowerCase() !== 'noimageai');
    if (shouldProtect) {
      tokens.push('noai', 'noimageai');
    }
    robotsMeta.setAttribute('content', tokens.join(', '));
  }

  const upsertNamedMeta = (name: string, content: string | null) => {
    const existing = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
    if (content === null) {
      if (existing) existing.remove();
      return;
    }
    const el = existing || document.createElement('meta');
    el.setAttribute('name', name);
    el.setAttribute('content', content);
    if (!existing) document.head.appendChild(el);
  };

  if (shouldProtect) {
    upsertNamedMeta('GPTBot', 'noindex, nofollow, noarchive, noai');
    upsertNamedMeta('CCBot', 'nofollow');
    upsertNamedMeta('tdm-reservation', '1');
  } else {
    upsertNamedMeta('GPTBot', null);
    upsertNamedMeta('CCBot', null);
    upsertNamedMeta('tdm-reservation', null);
  }
}

/**
 * Pushes bureaucrat-configured ChatbotBlocker policy to the Express backend (if reachable).
 */
export async function syncChatbotBlockerPolicyToServer(
  config: ChatbotBlockerConfig,
  idToken?: string | null
): Promise<void> {
  if (typeof fetch !== 'function' || !idToken) return;
  try {
    await fetch('/api/v1/security/chatbot-blocker', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        enabled: config.isActive,
        blockMode: config.blockMode,
        statusCode: config.responseCode,
        blockMessage: config.blockMessage,
        injectNoAiMeta: config.injectNoAiMeta,
        customBlockedAgents: config.customBlockedAgents,
      }),
    });
  } catch {
    // Ignore when server route is unavailable in offline/static previews
  }
}
