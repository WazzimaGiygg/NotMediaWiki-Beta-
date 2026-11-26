export type ChatbotBlockMode = 'block_all_chatbots' | 'allow_traditional_search_only' | 'strict_zero_ai';

export interface ChatbotSignatureEntry {
  id: string;
  label: string;
  vendor: string;
  userAgentPattern: RegExp;
  robotsToken?: string;
}

/**
 * Signatures of AI chatbots, LLM browsing agents, and AI crawlers
 * prevented from opening or reading links on this Wiki-site.
 */
export const CHATBOT_SIGNATURES: ChatbotSignatureEntry[] = [
  {
    id: 'chatgpt-user',
    label: 'ChatGPT-User',
    vendor: 'OpenAI',
    userAgentPattern: /\bChatGPT-User\b/i,
    robotsToken: 'ChatGPT-User',
  },
  {
    id: 'oai-searchbot',
    label: 'OAI-SearchBot',
    vendor: 'OpenAI',
    userAgentPattern: /\bOAI-SearchBot\b/i,
    robotsToken: 'OAI-SearchBot',
  },
  {
    id: 'gptbot',
    label: 'GPTBot',
    vendor: 'OpenAI',
    userAgentPattern: /\bGPTBot\b/i,
    robotsToken: 'GPTBot',
  },
  {
    id: 'openai-agent',
    label: 'OpenAI Fetcher',
    vendor: 'OpenAI',
    userAgentPattern: /\bOpenAI(?:-Agent|-Crawler|Bot)?\b|openai\.com\/bot/i,
  },
  {
    id: 'claudebot',
    label: 'ClaudeBot',
    vendor: 'Anthropic',
    userAgentPattern: /\bClaudeBot\b/i,
    robotsToken: 'ClaudeBot',
  },
  {
    id: 'claude-web',
    label: 'Claude-Web',
    vendor: 'Anthropic',
    userAgentPattern: /\bClaude-Web\b/i,
    robotsToken: 'Claude-Web',
  },
  {
    id: 'claude-user',
    label: 'Claude-User',
    vendor: 'Anthropic',
    userAgentPattern: /\bClaude-User\b/i,
    robotsToken: 'Claude-User',
  },
  {
    id: 'anthropic-ai',
    label: 'anthropic-ai',
    vendor: 'Anthropic',
    userAgentPattern: /\banthropic-ai\b/i,
    robotsToken: 'anthropic-ai',
  },
  {
    id: 'perplexitybot',
    label: 'PerplexityBot',
    vendor: 'Perplexity AI',
    userAgentPattern: /\bPerplexityBot\b/i,
    robotsToken: 'PerplexityBot',
  },
  {
    id: 'perplexity-user',
    label: 'Perplexity-User',
    vendor: 'Perplexity AI',
    userAgentPattern: /\bPerplexity-User\b/i,
    robotsToken: 'Perplexity-User',
  },
  {
    id: 'google-extended',
    label: 'Google-Extended',
    vendor: 'Google AI',
    userAgentPattern: /\bGoogle-Extended\b/i,
    robotsToken: 'Google-Extended',
  },
  {
    id: 'google-notebooklm',
    label: 'Google-NotebookLM',
    vendor: 'Google AI',
    userAgentPattern: /\bGoogle-NotebookLM\b|\bNotebookLM\b/i,
    robotsToken: 'Google-NotebookLM',
  },
  {
    id: 'google-gemini-agent',
    label: 'Gemini / Bard Agent',
    vendor: 'Google AI',
    userAgentPattern: /\bGemini(?:-Deep-Research|-Bot|Agent)?\b|\bGoogle-Bard\b|\bBardBot\b|\bVertexAI\b/i,
  },
  {
    id: 'googleother',
    label: 'GoogleOther',
    vendor: 'Google',
    userAgentPattern: /\bGoogleOther(?:-Image|-Video)?\b/i,
    robotsToken: 'GoogleOther',
  },
  {
    id: 'microsoft-copilot',
    label: 'Microsoft Copilot',
    vendor: 'Microsoft',
    userAgentPattern: /\bMicrosoft-Copilot\b|\bCopilotBot\b|\bCopilot\/[\d.]+/i,
    robotsToken: 'CopilotBot',
  },
  {
    id: 'meta-externalagent',
    label: 'Meta-ExternalAgent',
    vendor: 'Meta AI',
    userAgentPattern: /\bMeta-ExternalAgent\b/i,
    robotsToken: 'Meta-ExternalAgent',
  },
  {
    id: 'meta-externalfetcher',
    label: 'Meta-ExternalFetcher',
    vendor: 'Meta AI',
    userAgentPattern: /\bMeta-ExternalFetcher\b/i,
    robotsToken: 'Meta-ExternalFetcher',
  },
  {
    id: 'facebookbot',
    label: 'FacebookBot',
    vendor: 'Meta',
    userAgentPattern: /\bFacebookBot\b/i,
    robotsToken: 'FacebookBot',
  },
  {
    id: 'deepseekbot',
    label: 'DeepSeekBot',
    vendor: 'DeepSeek',
    userAgentPattern: /\bDeepSeekBot\b|\bDeepSeek(?:-Chat|-Agent)?\b/i,
    robotsToken: 'DeepSeekBot',
  },
  {
    id: 'grok-xai',
    label: 'Grok / xAI Bot',
    vendor: 'xAI',
    userAgentPattern: /\bGrokBot\b|\bxAI-Bot\b|\bGrok\/[\d.]+/i,
    robotsToken: 'GrokBot',
  },
  {
    id: 'mistralai-user',
    label: 'MistralAI-User',
    vendor: 'Mistral AI',
    userAgentPattern: /\bMistralAI-User\b|\bMistralBot\b/i,
    robotsToken: 'MistralAI-User',
  },
  {
    id: 'bytespider',
    label: 'Bytespider',
    vendor: 'ByteDance / Doubao',
    userAgentPattern: /\bBytespider\b/i,
    robotsToken: 'Bytespider',
  },
  {
    id: 'applebot-extended',
    label: 'Applebot-Extended',
    vendor: 'Apple Intelligence',
    userAgentPattern: /\bApplebot-Extended\b/i,
    robotsToken: 'Applebot-Extended',
  },
  {
    id: 'amazonbot',
    label: 'Amazonbot',
    vendor: 'Amazon / Alexa / Q',
    userAgentPattern: /\bAmazonbot\b/i,
    robotsToken: 'Amazonbot',
  },
  {
    id: 'cohere-ai',
    label: 'cohere-ai',
    vendor: 'Cohere',
    userAgentPattern: /\bcohere-ai\b|\bcohere-training-data-crawler\b/i,
    robotsToken: 'cohere-ai',
  },
  {
    id: 'duckassistbot',
    label: 'DuckAssistBot',
    vendor: 'DuckDuckGo AI',
    userAgentPattern: /\bDuckAssistBot\b/i,
    robotsToken: 'DuckAssistBot',
  },
  {
    id: 'youbot',
    label: 'YouBot',
    vendor: 'You.com AI',
    userAgentPattern: /\bYouBot\b/i,
    robotsToken: 'YouBot',
  },
  {
    id: 'phindbot',
    label: 'PhindBot',
    vendor: 'Phind',
    userAgentPattern: /\bPhindBot\b/i,
    robotsToken: 'PhindBot',
  },
  {
    id: 'poe-bot',
    label: 'Poe-Bot',
    vendor: 'Quora Poe',
    userAgentPattern: /\bPoe-Bot\b|\bQuora-Bot\b/i,
    robotsToken: 'Poe-Bot',
  },
  {
    id: 'characterai',
    label: 'CharacterAI',
    vendor: 'Character.AI',
    userAgentPattern: /\bCharacterAI\b|\bCharacter\.AI\b/i,
  },
  {
    id: 'ccbot',
    label: 'CCBot',
    vendor: 'Common Crawl',
    userAgentPattern: /\bCCBot\b/i,
    robotsToken: 'CCBot',
  },
  {
    id: 'omgilibot',
    label: 'Omgilibot',
    vendor: 'Webz.io',
    userAgentPattern: /\bOmgilibot\b|\bOmgili\b/i,
    robotsToken: 'Omgilibot',
  },
  {
    id: 'webzio-extended',
    label: 'Webzio-Extended',
    vendor: 'Webz.io',
    userAgentPattern: /\bWebzio-Extended\b/i,
    robotsToken: 'Webzio-Extended',
  },
  {
    id: 'diffbot',
    label: 'Diffbot',
    vendor: 'Diffbot',
    userAgentPattern: /\bDiffbot\b/i,
    robotsToken: 'Diffbot',
  },
  {
    id: 'ai2bot',
    label: 'AI2Bot',
    vendor: 'AllenAI',
    userAgentPattern: /\bAI2Bot(?:-Dolma)?\b/i,
    robotsToken: 'AI2Bot',
  },
  {
    id: 'timpibot',
    label: 'Timpibot',
    vendor: 'Timpi',
    userAgentPattern: /\bTimpibot\b/i,
    robotsToken: 'Timpibot',
  },
  {
    id: 'imagesiftbot',
    label: 'ImagesiftBot',
    vendor: 'ImageSift',
    userAgentPattern: /\bImagesiftBot\b/i,
    robotsToken: 'ImagesiftBot',
  },
  {
    id: 'pangubot',
    label: 'PanguBot',
    vendor: 'Huawei PanGu',
    userAgentPattern: /\bPanguBot\b/i,
    robotsToken: 'PanguBot',
  },
  {
    id: 'petalbot',
    label: 'PetalBot',
    vendor: 'Huawei AI',
    userAgentPattern: /\bPetalBot\b/i,
    robotsToken: 'PetalBot',
  },
  {
    id: 'kangaroo-bot',
    label: 'Kangaroo Bot',
    vendor: 'Kangaroo AI',
    userAgentPattern: /\bKangaroo Bot\b/i,
    robotsToken: 'Kangaroo Bot',
  },
  {
    id: 'linerbot',
    label: 'LinerBot',
    vendor: 'Liner AI',
    userAgentPattern: /\bLinerBot\b/i,
    robotsToken: 'LinerBot',
  },
  {
    id: 'firecrawl',
    label: 'FirecrawlAgent',
    vendor: 'Firecrawl',
    userAgentPattern: /\bFirecrawl(?:Agent|Bot)?\b/i,
    robotsToken: 'FirecrawlAgent',
  },
  {
    id: 'tavilybot',
    label: 'TavilyBot',
    vendor: 'Tavily AI',
    userAgentPattern: /\bTavilyBot\b/i,
    robotsToken: 'TavilyBot',
  },
  {
    id: 'jina-reader',
    label: 'Jina Reader',
    vendor: 'Jina AI',
    userAgentPattern: /\bJina(?:-AI|Bot|Reader)\b|r\.jina\.ai/i,
  },
  {
    id: 'agent-frameworks',
    label: 'LLM Agent Framework',
    vendor: 'LangChain / LlamaIndex / MCP',
    userAgentPattern: /\b(?:LangChain|LlamaIndex|CrewAI|AutoGPT|MCP-Fetch|OpenWebUI|LibreChat|AnythingLLM)\b/i,
  },
  {
    id: 'generic-chatbot',
    label: 'Generic Chatbot / AI Agent',
    vendor: 'Generic AI',
    userAgentPattern: /\b(?:chatbot|ai-assistant|llm-crawler|llm-fetcher|ai-crawler)\b/i,
  },
];

/**
 * Chatbot web interface hostnames whose referrals, origins, iframe ancestors,
 * or utm_source link trackers are blocked from opening links on this Wiki-site.
 * Explicitly excludes Google AI Studio (`aistudio.google.com`) and platform hosts.
 */
export const CHATBOT_HOSTNAMES: string[] = [
  'chatgpt.com',
  'chat.openai.com',
  'claude.ai',
  'perplexity.ai',
  'labs.perplexity.ai',
  'gemini.google.com',
  'bard.google.com',
  'notebooklm.google.com',
  'copilot.microsoft.com',
  'poe.com',
  'you.com',
  'character.ai',
  'beta.character.ai',
  'chat.deepseek.com',
  'grok.com',
  'meta.ai',
  'chat.mistral.ai',
  'pi.ai',
  'phind.com',
  'r.jina.ai',
  'chat.qwen.ai',
  'kimi.moonshot.cn',
  'manus.im',
  'openwebui.com',
];

/**
 * Platform and primary Wiki hosts that must NEVER be blocked by referer/origin checks.
 */
export const TRUSTED_NON_CHATBOT_HOSTS: string[] = [
  'aistudio.google.com',
  '.aistudio.google.com',
  '.googleusercontent.com',
  '.usercontent.goog',
  '.run.app',
  'core.wazzimagiygg.com',
  'wazzimagiygg.com',
  '.wazzimagiygg.com',
  'localhost',
  '127.0.0.1',
];

export interface ChatbotDetectionInput {
  userAgent?: string | null;
  referer?: string | null;
  origin?: string | null;
  ancestors?: string[] | null;
  url?: string | null;
  headers?: Record<string, string | string[] | undefined> | null;
}

export interface ChatbotDetectionOptions {
  enabled?: boolean;
  blockMode?: ChatbotBlockMode;
  customBlockedAgents?: string[];
}

export interface ChatbotDetectionResult {
  blocked: boolean;
  source?: 'user-agent' | 'referer' | 'origin' | 'ancestor' | 'utm-source' | 'header' | 'custom';
  matchedAgent?: string;
  reason?: string;
}

function normalizeHost(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return '';
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProto);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return trimmed
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split(':')[0];
  }
}

export function isTrustedNonChatbotHost(rawUrlOrHost: string): boolean {
  const host = normalizeHost(rawUrlOrHost);
  if (!host) return false;
  return TRUSTED_NON_CHATBOT_HOSTS.some(entry =>
    entry.startsWith('.') ? host.endsWith(entry) : host === entry
  );
}

export function matchChatbotHostname(rawUrlOrHost: string): string | null {
  const trimmed = rawUrlOrHost.trim();
  if (!trimmed) return null;
  if (isTrustedNonChatbotHost(trimmed)) return null;

  const host = normalizeHost(trimmed);
  if (!host) return null;

  for (const botHost of CHATBOT_HOSTNAMES) {
    if (host === botHost || host.endsWith(`.${botHost}`)) {
      return botHost;
    }
  }

  // Handle special path-based chatbot hosts such as huggingface.co/chat or x.com/i/grok or kagi.com/assistant
  const lower = trimmed.toLowerCase();
  if (
    lower.includes('huggingface.co/chat') ||
    lower.includes('x.com/i/grok') ||
    lower.includes('kagi.com/assistant')
  ) {
    return host;
  }

  return null;
}

function getHeaderString(
  headers: Record<string, string | string[] | undefined> | null | undefined,
  key: string
): string {
  if (!headers) return '';
  const target = key.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) {
      if (Array.isArray(v)) return v.join(', ');
      return typeof v === 'string' ? v : '';
    }
  }
  return '';
}

export function detectChatbotAccess(
  input: ChatbotDetectionInput,
  options: ChatbotDetectionOptions = {}
): ChatbotDetectionResult {
  const enabled = options.enabled ?? true;
  if (!enabled) {
    return { blocked: false };
  }

  const ua = (input.userAgent || '').trim();
  const customAgents = (options.customBlockedAgents || [])
    .map(s => s.trim())
    .filter(s => s.length >= 2);

  // 1. Check custom bureaucrat-configured agents first
  if (ua && customAgents.length > 0) {
    const lowerUa = ua.toLowerCase();
    for (const custom of customAgents) {
      if (lowerUa.includes(custom.toLowerCase())) {
        return {
          blocked: true,
          source: 'custom',
          matchedAgent: custom,
          reason: `User-Agent corresponde à assinatura bloqueada "${custom}".`,
        };
      }
    }
  }

  // 2. Check known AI chatbot / LLM fetcher User-Agents
  if (ua) {
    for (const sig of CHATBOT_SIGNATURES) {
      if (sig.userAgentPattern.test(ua)) {
        return {
          blocked: true,
          source: 'user-agent',
          matchedAgent: `${sig.label} (${sig.vendor})`,
          reason: `Chatbot ou agente de IA identificado pelo User-Agent: ${sig.label}.`,
        };
      }
    }
  }

  // 3. Check AI-specific request headers (OpenAI, Anthropic, Perplexity, Signature-Agent)
  if (input.headers) {
    const signatureAgent = getHeaderString(input.headers, 'signature-agent');
    if (signatureAgent) {
      const matchedSigHost = matchChatbotHostname(signatureAgent);
      if (matchedSigHost || /chatgpt|openai|claude|anthropic|perplexity|gemini|copilot/i.test(signatureAgent)) {
        return {
          blocked: true,
          source: 'header',
          matchedAgent: matchedSigHost || signatureAgent.slice(0, 64),
          reason: 'Cabeçalho Signature-Agent de chatbot/agente de IA detectado.',
        };
      }
    }

    const aiHeaderKeys = Object.keys(input.headers).filter(k =>
      /^(x-openai-|x-anthropic-|x-perplexity-|x-chatbot-|x-chatgpt-|x-claude-)/i.test(k)
    );
    if (aiHeaderKeys.length > 0) {
      return {
        blocked: true,
        source: 'header',
        matchedAgent: aiHeaderKeys[0],
        reason: `Cabeçalho específico de chatbot detectado (${aiHeaderKeys[0]}).`,
      };
    }

    const fromHeader = getHeaderString(input.headers, 'from');
    if (fromHeader && /(openai|anthropic|perplexity|gptbot|claudebot|chatgpt|copilot|deepseek)/i.test(fromHeader)) {
      return {
        blocked: true,
        source: 'header',
        matchedAgent: fromHeader.slice(0, 64),
        reason: 'Cabeçalho From identificado como crawler/chatbot de IA.',
      };
    }
  }

  // 4. Check Referer (when link is opened directly from a chatbot interface)
  if (input.referer) {
    const matchedRef = matchChatbotHostname(input.referer);
    if (matchedRef) {
      return {
        blocked: true,
        source: 'referer',
        matchedAgent: matchedRef,
        reason: `Abertura do link originada de interface de chatbot (${matchedRef}).`,
      };
    }
    if (customAgents.length > 0) {
      const lowerRef = input.referer.toLowerCase();
      for (const custom of customAgents) {
        if (lowerRef.includes(custom.toLowerCase())) {
          return {
            blocked: true,
            source: 'custom',
            matchedAgent: custom,
            reason: `Referer corresponde ao filtro customizado "${custom}".`,
          };
        }
      }
    }
  }

  // 5. Check Origin header
  if (input.origin) {
    const matchedOrigin = matchChatbotHostname(input.origin);
    if (matchedOrigin) {
      return {
        blocked: true,
        source: 'origin',
        matchedAgent: matchedOrigin,
        reason: `Origem da requisição identificada como plataforma de chatbot (${matchedOrigin}).`,
      };
    }
  }

  // 6. Check iframe ancestorOrigins
  if (input.ancestors && input.ancestors.length > 0) {
    for (const anc of input.ancestors) {
      const matchedAnc = matchChatbotHostname(anc);
      if (matchedAnc) {
        return {
          blocked: true,
          source: 'ancestor',
          matchedAgent: matchedAnc,
          reason: `Incorporação em iframe originada de chatbot (${matchedAnc}).`,
        };
      }
    }
  }

  // 7. Check URL query markers added when links are opened from chatbots (e.g., ?utm_source=chatgpt.com)
  if (input.url) {
    try {
      const parsedUrl = new URL(input.url, 'https://core.wazzimagiygg.com');
      const utmSource =
        parsedUrl.searchParams.get('utm_source') ||
        parsedUrl.searchParams.get('ref') ||
        '';
      if (utmSource) {
        const matchedUtm = matchChatbotHostname(utmSource);
        if (matchedUtm) {
          return {
            blocked: true,
            source: 'utm-source',
            matchedAgent: matchedUtm,
            reason: `Link aberto via rastreamento de chatbot (${matchedUtm}).`,
          };
        }
      }
    } catch {
      // Ignore malformed URLs
    }
  }

  return { blocked: false };
}

/**
 * Generates robots.txt directives blocking all known AI chatbots & LLM fetchers
 * while keeping traditional search indexers and canonical sitemap intact.
 */
export function buildAntiChatbotRobotsTxt(enabled: boolean = true): string {
  const uniqueTokens = Array.from(
    new Set(
      CHATBOT_SIGNATURES.map(s => s.robotsToken).filter((t): t is string => Boolean(t))
    )
  );

  const lines: string[] = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /api.php',
    '',
    'User-agent: Googlebot',
    'Allow: /',
    'Disallow: /api/',
    '',
    'User-agent: Bingbot',
    'Allow: /',
    'Disallow: /api/',
    '',
  ];

  if (enabled) {
    lines.push('# Extensão ChatbotBlocker (ext-chatbot-blocker): Bloqueio estrito para chatbots e crawlers de IA');
    for (const token of uniqueTokens) {
      lines.push(`User-agent: ${token}`);
      lines.push('Disallow: /');
      lines.push('');
    }
  }

  lines.push('Host: core.wazzimagiygg.com');
  lines.push('Sitemap: https://core.wazzimagiygg.com/sitemap.xml');

  return lines.join('\n') + '\n';
}
