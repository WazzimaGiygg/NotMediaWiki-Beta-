import { describe, it, expect, vi } from 'vitest';
import {
  isEmbeddedInIframe,
  isBlockedIframe,
  enforceFrameBusting,
  isAllowedIframeOrigin,
} from '../src/utils/frameGuard';
import { createExpressApp } from '../server/app';

describe('Iframe Policy (Google AI Studio Allowed + Third-Party Anti-Clickjacking)', () => {
  it('allows normal top-level window rendering', () => {
    const mockWin = {} as Window;
    Object.defineProperty(mockWin, 'self', { value: mockWin });
    Object.defineProperty(mockWin, 'top', { value: mockWin });

    expect(isEmbeddedInIframe(mockWin)).toBe(false);
    expect(isBlockedIframe(mockWin, undefined, false)).toBe(false);
    expect(enforceFrameBusting(mockWin, undefined, false)).toBe(false);
  });

  it('allows Google AI Studio iframe embedding in both dev and production via referrer and ancestorOrigins', () => {
    const mockWinWithAncestors = {
      location: {
        href: 'https://ais-pre-sample-123.us-east1.run.app/',
        origin: 'https://ais-pre-sample-123.us-east1.run.app',
        hostname: 'ais-pre-sample-123.us-east1.run.app',
        ancestorOrigins: ['https://aistudio.google.com'],
      },
    } as unknown as Window;
    Object.defineProperty(mockWinWithAncestors, 'self', { value: mockWinWithAncestors });
    Object.defineProperty(mockWinWithAncestors, 'top', {
      get() {
        throw new Error('Cross-origin top');
      },
    });

    expect(isEmbeddedInIframe(mockWinWithAncestors)).toBe(true);
    expect(isBlockedIframe(mockWinWithAncestors, undefined, false)).toBe(false);
    expect(enforceFrameBusting(mockWinWithAncestors, undefined, false)).toBe(false);

    const mockDocReferrer = { referrer: 'https://aistudio.google.com/' } as Document;
    const mockWinReferrerOnly = {
      location: {
        href: 'https://core.wazzimagiygg.com/',
        origin: 'https://core.wazzimagiygg.com',
        hostname: 'core.wazzimagiygg.com',
      },
    } as unknown as Window;
    Object.defineProperty(mockWinReferrerOnly, 'self', { value: mockWinReferrerOnly });
    Object.defineProperty(mockWinReferrerOnly, 'top', {
      get() {
        throw new Error('Cross-origin top');
      },
    });

    expect(isBlockedIframe(mockWinReferrerOnly, mockDocReferrer, false)).toBe(false);
    expect(isAllowedIframeOrigin('https://aistudio.google.com')).toBe(true);
    expect(isAllowedIframeOrigin('https://abc.usercontent.goog')).toBe(true);
  });

  it('allows AI Studio Cloud Run preview hosts even if referrer is stripped, unless an unauthorized ancestor is detected', () => {
    const mockAiStudioWin = {
      location: {
        href: 'https://ais-dev-vd5haarj3lq6be4nzfmmwp-842441289091.us-east1.run.app/',
        origin: 'https://ais-dev-vd5haarj3lq6be4nzfmmwp-842441289091.us-east1.run.app',
        hostname: 'ais-dev-vd5haarj3lq6be4nzfmmwp-842441289091.us-east1.run.app',
      },
    } as unknown as Window;
    Object.defineProperty(mockAiStudioWin, 'self', { value: mockAiStudioWin });
    Object.defineProperty(mockAiStudioWin, 'top', {
      get() {
        throw new Error('Cross-origin top');
      },
    });

    expect(isBlockedIframe(mockAiStudioWin, { referrer: '' } as Document, false)).toBe(false);
    expect(
      isBlockedIframe(mockAiStudioWin, { referrer: 'https://evil-phishing.example/' } as Document, false)
    ).toBe(true);
  });

  it('blocks rendering when embedded in an unauthorized third-party iframe in production', () => {
    const replaceSpy = vi.fn();
    const mockTop = { location: { replace: replaceSpy } } as unknown as Window;
    const mockWin = {
      location: {
        href: 'https://core.wazzimagiygg.com/',
        origin: 'https://core.wazzimagiygg.com',
        hostname: 'core.wazzimagiygg.com',
        ancestorOrigins: ['https://evil-site.example'],
      },
    } as unknown as Window;
    Object.defineProperty(mockWin, 'self', { value: mockWin });
    Object.defineProperty(mockWin, 'top', { value: mockTop });

    expect(isEmbeddedInIframe(mockWin)).toBe(true);
    expect(isBlockedIframe(mockWin, undefined, false)).toBe(true);
    expect(enforceFrameBusting(mockWin, undefined, false)).toBe(true);
    expect(replaceSpy).toHaveBeenCalledWith('https://core.wazzimagiygg.com/');
  });

  it('blocks rendering gracefully when cross-origin top access throws SecurityError on unauthorized host', () => {
    const mockWin = {
      location: {
        href: 'https://core.wazzimagiygg.com/',
        origin: 'https://core.wazzimagiygg.com',
        hostname: 'core.wazzimagiygg.com',
      },
    } as unknown as Window;
    Object.defineProperty(mockWin, 'self', { value: mockWin });
    Object.defineProperty(mockWin, 'top', {
      get() {
        throw new Error('Blocked a frame with origin from accessing a cross-origin frame.');
      },
    });

    expect(isEmbeddedInIframe(mockWin)).toBe(true);
    expect(enforceFrameBusting(mockWin, undefined, false)).toBe(true);
  });

  it('omits X-Frame-Options: DENY and configures CSP frame-ancestors for Google AI Studio on Express responses', async () => {
    const app = createExpressApp();
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
      expect(res.headers.get('x-frame-options')).toBeNull();
      const csp = res.headers.get('content-security-policy') || '';
      expect(csp).toContain("frame-ancestors 'self'");
      expect(csp).toContain('https://aistudio.google.com');
      expect(csp).toContain('https://*.google.com');
      expect(csp).not.toContain("frame-ancestors 'none'");
    } finally {
      server.close();
    }
  });
});
