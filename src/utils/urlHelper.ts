/**
 * Utility to manage external domains and link prefixing policies.
 * Prefix default: "https://wazzimagiygg.com/rv/?uid="
 * Requirement: Permitir adicionar os domínios permitidos direto no Firebase, pelo Burocrata.
 * Domínios permitidos/confiáveis são sincronizados em tempo real do Cloud Firestore.
 */

export const EXTERNAL_LINK_PREFIX = 'https://wazzimagiygg.com/rv/?uid=';

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
 * Returns the URL with the prefix if it is an external link.
 * If the link is internal (hash route #, relative /, or mailto), returns unchanged.
 */
export function wrapExternalUrl(url: string, bypassAllowedDomains: boolean = false): string {
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

  // Already prefixed
  if (trimmed.startsWith(EXTERNAL_LINK_PREFIX)) {
    return trimmed;
  }

  // If it's an external HTTP/HTTPS URL
  if (/^https?:\/\//i.test(trimmed)) {
    return `${EXTERNAL_LINK_PREFIX}${trimmed}`;
  }

  // If it's a protocol-relative link (e.g. //example.com)
  if (trimmed.startsWith('//')) {
    return `${EXTERNAL_LINK_PREFIX}https:${trimmed}`;
  }

  // If it's a raw domain without protocol (e.g. wazzimagiygg.com)
  if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i.test(trimmed)) {
    return `${EXTERNAL_LINK_PREFIX}https://${trimmed}`;
  }

  return trimmed;
}

/**
 * Global helper to open an external link safely with the mandatory prefix
 */
export function openExternalUrl(url: string, target: string = '_blank'): void {
  const finalUrl = wrapExternalUrl(url);
  window.open(finalUrl, target, 'noopener,noreferrer');
}
