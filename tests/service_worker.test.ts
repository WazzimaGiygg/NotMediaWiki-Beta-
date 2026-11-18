import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Service Worker (public/sw.js) & Offline Caching Suite', () => {
  it('defines static asset precaching, Google Fonts runtime caching, and API/Firestore bypass in public/sw.js', () => {
    const swPath = path.resolve(process.cwd(), 'public/sw.js');
    expect(fs.existsSync(swPath)).toBe(true);

    const swCode = fs.readFileSync(swPath, 'utf-8');

    // Syntax check via Function constructor
    expect(() => new Function(swCode)).not.toThrow();

    // Lifecycle & caching strategies
    expect(swCode).toContain("addEventListener('install'");
    expect(swCode).toContain("addEventListener('activate'");
    expect(swCode).toContain("addEventListener('fetch'");
    expect(swCode).toContain('notmediawiki-static-');
    expect(swCode).toContain('https://fonts.googleapis.com');
    expect(swCode).toContain('https://fonts.gstatic.com');
    expect(swCode).toContain('staleWhileRevalidate');
    expect(swCode).toContain('cacheFirst');
    expect(swCode).toContain('networkFirstNavigation');

    // Never intercept dynamic API or Firestore traffic
    expect(swCode).toContain("url.pathname.startsWith('/api/')");
    expect(swCode).toContain('firestore.googleapis.com');
    expect(swCode).toContain('firebase-messaging-sw.js');
  });

  it('provides a valid Web App Manifest and links it in index.html', () => {
    const manifestPath = path.resolve(process.cwd(), 'public/manifest.webmanifest');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.id).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
  });

  it('registers /sw.js in src/main.tsx via serviceWorkerRegistration', () => {
    const mainTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/main.tsx'), 'utf-8');
    const regTs = fs.readFileSync(
      path.resolve(process.cwd(), 'src/services/serviceWorkerRegistration.ts'),
      'utf-8'
    );
    expect(mainTsx).toContain('registerServiceWorker');
    expect(regTs).toContain("navigator.serviceWorker.register('/sw.js'");
  });
});
