import { getExternalRedirectConfig } from '../extensions/externalRedirectExtension';

/**
 * Utility to manage external domains and link prefixing policies.
 * 3.05.3.c - Transformado em extensão (ExternalLinkRedirector)
 * Permite desativar o redirecionador ou alterar o link do UID redirecionador (padrão: https://wazzimagiygg.com/rv/?uid=)
 */

export const DEFAULT_EXTERNAL_LINK_PREFIX = 'https://wazzimagiygg.com/rv/?uid=';
export const EXTERNAL_LINK_PREFIX = DEFAULT_EXTERNAL_LINK_PREFIX;

const ALLOWED_DOMAINS_STORAGE_KEY = 'notmediawiki_allowed_domains';

// Default trusted domains
const DEFAULT_ALLOWED_DOMAINS = [
  'wazzimagiygg.com',
  'wikipedia.org',
  'mediawiki.org',
  'wikimedia.org',
  'github.com',
];

/**
 * Returns current set of allowed domains (from memory/cache or fallback)
 */
export function getCachedAllowedDomains(): string[] {
  try {
    const raw = localStorage.getItem(ALLOWED_DOMAINS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((d: any) => (typeof d === 'string' ? d : d.domain).toLowerCase().trim());
      }
    }
  } catch {}
  return DEFAULT_ALLOWED_DOMAINS;
}

/**
 * Sets current set of allowed domains in local cache
 */
export function setCachedAllowedDomains(domains: string[]): void {
  try {
    localStorage.setItem(ALLOWED_DOMAINS_STORAGE_KEY, JSON.stringify(domains));
  } catch {}
}

/**
 * Extracts normalized hostname without protocol or www
 */
export function extractDomainFromUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].split(':')[0].toLowerCase();
  }
}

/**
 * Checks if a given domain or URL is in the allowed domains whitelist from Firebase
 */
export function isDomainAllowed(urlOrDomain: string, customAllowedList?: string[]): boolean {
  if (!urlOrDomain) return false;
  const domain = extractDomainFromUrl(urlOrDomain);
  const allowed = customAllowedList || getCachedAllowedDomains();

  return allowed.some(allowedDomain => {
    const cleanAllowed = allowedDomain.toLowerCase().trim().replace(/^www\./, '');
    return domain === cleanAllowed || domain.endsWith(`.${cleanAllowed}`);
  });
}

/**
 * Returns the URL with the prefix if external redirection is enabled by the extension.
 * If the extension is disabled or $wgEnableExternalRedirect === false, returns the original URL.
 * If the link is internal (hash route #, relative /, or mailto), returns unchanged.
 */
export function wrapExternalUrl(url: string, forceBypassAllowedDomains: boolean = false): string {
  if (!url) return url;
  const trimmed = url.trim();

  // Keep internal router hashes, relative paths, anchors untouched
  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('javascript:')
  ) {
    return trimmed;
  }

  // Check extension configuration dynamically
  const redirectConfig = getExternalRedirectConfig();

  // If the extension is disabled or redirect is turned off, open directly
  if (!redirectConfig.extensionEnabled || !redirectConfig.redirectActive) {
    return trimmed;
  }

  const prefix = redirectConfig.prefix || DEFAULT_EXTERNAL_LINK_PREFIX;

  // Already prefixed
  if (trimmed.startsWith(prefix) || trimmed.startsWith(DEFAULT_EXTERNAL_LINK_PREFIX)) {
    return trimmed;
  }

  // Bypass if domain is allowed and config permits bypass
  if ((redirectConfig.bypassAllowedDomains || forceBypassAllowedDomains) && isDomainAllowed(trimmed)) {
    return trimmed;
  }

  // If it's an external HTTP/HTTPS URL
  if (/^https?:\/\//i.test(trimmed)) {
    return `${prefix}${trimmed}`;
  }

  // If it's a protocol-relative link (e.g. //example.com)
  if (trimmed.startsWith('//')) {
    return `${prefix}https:${trimmed}`;
  }

  // If it's a raw domain without protocol (e.g. wazzimagiygg.com)
  if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i.test(trimmed)) {
    return `${prefix}https://${trimmed}`;
  }

  return trimmed;
}

/**
 * Global helper to open an external link safely respecting the extension policy
 */
export function openExternalUrl(url: string, target: string = '_blank'): void {
  const finalUrl = wrapExternalUrl(url);
  window.open(finalUrl, target, 'noopener,noreferrer');
}
