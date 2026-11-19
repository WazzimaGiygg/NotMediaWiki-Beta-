/**
 * Client-side Anti-Iframe / Frame-Busting Guard (Defense-in-Depth).
 *
 * Complements the server-side `X-Frame-Options: DENY` and
 * `Content-Security-Policy: frame-ancestors 'none'` HTTP headers.
 */

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
 * Allows only the local AI Studio development preview iframe when running in Vite DEV mode
 * so developers aren't locked out of the live preview; all production builds and external
 * origins are strictly blocked.
 */
export function isBlockedIframe(
  win: Window | undefined = typeof window !== 'undefined' ? window : undefined,
  doc: Document | undefined = typeof document !== 'undefined' ? document : undefined,
  isDev: boolean = Boolean(import.meta.env?.DEV)
): boolean {
  if (!isEmbeddedInIframe(win)) return false;

  if (isDev && doc?.referrer) {
    try {
      const refOrigin = new URL(doc.referrer).hostname.toLowerCase();
      if (refOrigin === 'aistudio.google.com' || refOrigin.endsWith('.google.com')) {
        return false;
      }
    } catch {
      // Malformed referrer — treat as blocked
    }
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
