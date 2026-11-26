import { ChatbotBlockerConfig, getChatbotBlockerConfig } from '../extensions/chatbotBlockerExtension';
import {
  ChatbotDetectionResult,
  detectChatbotAccess,
} from './chatbotSignatures';

/**
 * Client-side guard complementing the server-side ChatbotBlocker middleware.
 * Inspects browser User-Agent, Referer, ancestorOrigins, and link tracking parameters
 * to prevent chatbots or AI browsing agents from opening or embedding the Wiki-site.
 */
export function detectChatbotClientAccess(
  config: ChatbotBlockerConfig = getChatbotBlockerConfig(),
  win: Window | undefined = typeof window !== 'undefined' ? window : undefined,
  doc: Document | undefined = typeof document !== 'undefined' ? document : undefined
): ChatbotDetectionResult {
  if (!config.isActive) {
    return { blocked: false };
  }

  let userAgent = '';
  let url = '';
  let ancestors: string[] = [];
  let referer = '';

  try {
    userAgent = win?.navigator?.userAgent || '';
  } catch {
    userAgent = '';
  }

  try {
    url = win?.location?.href || '';
  } catch {
    url = '';
  }

  try {
    const rawAncestors = win?.location?.ancestorOrigins;
    if (rawAncestors && rawAncestors.length > 0) {
      ancestors = Array.from(rawAncestors);
    }
  } catch {
    ancestors = [];
  }

  try {
    referer = doc?.referrer || '';
  } catch {
    referer = '';
  }

  return detectChatbotAccess(
    {
      userAgent,
      referer,
      ancestors,
      url,
    },
    {
      enabled: config.isActive,
      blockMode: config.blockMode,
      customBlockedAgents: config.customBlockedAgents,
    }
  );
}
