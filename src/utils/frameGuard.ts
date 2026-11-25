/**
 * Client-side Anti-Iframe / Frame-Busting Guard (Defense-in-Depth).
 *
 * Complements the server-side `Content-Security-Policy: frame-ancestors` header,
 * allowing embedding inside Google AI Studio (dev and shared/production previews)
 * while blocking unauthorized third-party framing.
 */

const AI_STUDIO_ALLOWED_HOSTS = [
  'aistudio.google.com',
  '.aistudio.google.com',
  '.google.com',
  '.googleusercontent.com',
  '.usercontent.goog',
  '.gstatic.com',
  '.withgoogle.com',
  '.run.app',
];

export function isAllowedIframeOrigin(
  rawOriginOrUrl: string,
  currentOrigin?: string
): boolean {
  if (!rawOriginOrUrl) return false;
  try {
    const parsed = new URL(rawOriginOrUrl);
    if (currentOrigin && parsed.origin === currentOrigin) {
      return true;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (parsed.protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return true;
    }
    return AI_STUDIO_ALLOWED_HOSTS.some(entry =>
      entry.startsWith('.') ? hostname.endsWith(entry) : hostname === entry
    );
  } catch {
    return false;
  }
}

export function isEmbeddedInIframe(win: Window | undefined = typeof window !== 'undefined' ? window : undefined): boolean {
  if (!win) return false;
  try {
    return win.self !== win.top;
  } catch {
    // Accessing win.top throws SecurityError when embedded cross-origin
    return true;
  }
}

/**
 * Checks whether the current iframe embedding should be blocked.
 * Allows embedding within Google AI Studio (both dev and production previews) and same-origin
 * frames; blocks unknown external third-party origins.
 */
export function isBlockedIframe(
  win: Window | undefined = typeof window !== 'undefined' ? window : undefined,
  doc: Document | undefined = typeof document !== 'undefined' ? document : undefined,
  isDev: boolean = Boolean(import.meta.env?.DEV)
): boolean {
  if (!isEmbeddedInIframe(win)) return false;

  let currentOrigin: string | undefined;
  let currentHostname = '';
  try {
    currentOrigin = win?.location?.origin;
    currentHostname = (win?.location?.hostname || '').toLowerCase();
  } catch {
    currentOrigin = undefined;
  }

  // Same-origin framing is allowed
  try {
    if (win?.top && currentOrigin && win.top.location?.origin === currentOrigin) {
      return false;
    }
  } catch {
    // Cross-origin top — evaluate ancestors/referrer below
  }

  // Chromium / Safari ancestorOrigins lists the full embedding chain
  const ancestors = win?.location?.ancestorOrigins;
  if (ancestors && ancestors.length > 0) {
    for (let i = 0; i < ancestors.length; i++) {
      if (!isAllowedIframeOrigin(ancestors[i], currentOrigin)) {
        return true;
      }
    }
    return false;
  }

  // Fallback to document.referrer when ancestorOrigins is unavailable
  if (doc?.referrer) {
    return !isAllowedIframeOrigin(doc.referrer, currentOrigin);
  }

  // When referrer is stripped by browser privacy headers on AI Studio preview URLs or localhost dev
  if (/^ais-(?:dev|pre)-[a-z0-9.-]+\.run\.app$/i.test(currentHostname)) {
    return false;
  }
  if (isDev && (currentHostname === 'localhost' || currentHostname === '127.0.0.1')) {
    return false;
  }

  return true;
}

/**
 * Attempts to break out of an unauthorized iframe by navigating top-level window.
 * Returns true if the page is still trapped inside a blocked iframe and should halt rendering.
 */
export function enforceFrameBusting(
  win: Window | undefined = typeof window !== 'undefined' ? window : undefined,
  doc: Document | undefined = typeof document !== 'undefined' ? document : undefined,
  isDev: boolean = Boolean(import.meta.env?.DEV)
): boolean {
  if (!isBlockedIframe(win, doc, isDev)) return false;

  try {
    if (win && win.top && win.top !== win.self) {
      win.top.location.replace(win.location.href);
    }
  } catch {
    // Cross-origin frame prevents top navigation — caller will render block screen
  }

  return true;
}
