import { describe, it, expect, vi } from 'vitest';
import { isEmbeddedInIframe, isBlockedIframe, enforceFrameBusting } from '../src/utils/frameGuard';
import { createExpressApp } from '../server/app';

describe('Anti-Iframe Protection (X-Frame-Options, CSP frame-ancestors, FrameGuard)', () => {
  it('allows normal top-level window rendering', () => {
    const mockWin = {} as Window;
    Object.defineProperty(mockWin, 'self', { value: mockWin });
    Object.defineProperty(mockWin, 'top', { value: mockWin });

    expect(isEmbeddedInIframe(mockWin)).toBe(false);
    expect(isBlockedIframe(mockWin, undefined, false)).toBe(false);
    expect(enforceFrameBusting(mockWin, undefined, false)).toBe(false);
  });

  it('blocks rendering when embedded in an iframe in production', () => {
    const replaceSpy = vi.fn();
    const mockTop = { location: { replace: replaceSpy } } as unknown as Window;
    const mockWin = {
      location: { href: 'https://core.wazzimagiygg.com/' },
    } as unknown as Window;
    Object.defineProperty(mockWin, 'self', { value: mockWin });
    Object.defineProperty(mockWin, 'top', { value: mockTop });

    expect(isEmbeddedInIframe(mockWin)).toBe(true);
    expect(isBlockedIframe(mockWin, undefined, false)).toBe(true);
    expect(enforceFrameBusting(mockWin, undefined, false)).toBe(true);
    expect(replaceSpy).toHaveBeenCalledWith('https://core.wazzimagiygg.com/');
  });

  it('blocks rendering gracefully when cross-origin top access throws SecurityError', () => {
    const mockWin = {
      location: { href: 'https://core.wazzimagiygg.com/' },
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

  it('sets X-Frame-Options: DENY and CSP frame-ancestors none on Express responses', async () => {
    const app = createExpressApp();
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    } finally {
      server.close();
    }
  });
});
