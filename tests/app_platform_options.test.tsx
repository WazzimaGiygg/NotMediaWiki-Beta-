import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  GoogleAuthProvider: vi.fn(function () {
    return { setCustomParameters: vi.fn() };
  }),
  signInWithPopup: vi.fn(),
  signInWithCredential: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(() => vi.fn()),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(async () => ({ forEach: () => {} })),
  getDoc: vi.fn(),
  getDocFromServer: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  query: vi.fn(),
  limit: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

import { AppInstallModal } from '../src/components/AppInstallModal';
import { MobileAppNavBar } from '../src/components/MobileAppNavBar';
import { WikiFooter } from '../src/components/WikiFooter';
import { DEFAULT_EXTENSIONS } from '../src/data/defaultExtensions';
import { getSiteTitleConfig } from '../src/extensions/siteTitleExtension';
import { getThemeAppearanceConfig } from '../src/extensions/themeAppearanceExtension';
import { getSupportTicketsConfig } from '../src/extensions/supportTicketsExtension';
import { getMaintenanceModeConfig } from '../src/extensions/maintenanceModeExtension';
import { getExternalRedirectConfig } from '../src/extensions/externalRedirectExtension';
import { getPortalsConfig } from '../src/extensions/portalsExtension';
import { useExtensions } from '../src/context/ExtensionsContext';

vi.mock('../src/context/ExtensionsContext', async () => {
  const actual = await vi.importActual<typeof import('../src/context/ExtensionsContext')>(
    '../src/context/ExtensionsContext'
  );
  return {
    ...actual,
    useExtensions: vi.fn(),
  };
});

const mockedUseExtensions = vi.mocked(useExtensions);

function mockDefaultExtensionsContext() {
  const themeCfg = getThemeAppearanceConfig(DEFAULT_EXTENSIONS);
  mockedUseExtensions.mockReturnValue({
    extensions: DEFAULT_EXTENSIONS,
    isLoadingExtensions: false,
    hasAttemptedInitialLoad: true,
    hasLoadedFromFirebase: true,
    extensionsLoadError: null,
    lastSyncAt: null,
    getExtension: vi.fn(),
    isExtensionEnabled: vi.fn(() => true),
    getExtensionParam: vi.fn(),
    siteTitleConfig: getSiteTitleConfig(DEFAULT_EXTENSIONS),
    themeAppearanceConfig: themeCfg,
    activeTheme: themeCfg.defaultTheme,
    setUserTheme: vi.fn(() => true),
    resetToDefaultTheme: vi.fn(),
    isThemeSelectorOpen: false,
    openThemeSelector: vi.fn(),
    closeThemeSelector: vi.fn(),
    maintenanceConfig: getMaintenanceModeConfig(DEFAULT_EXTENSIONS),
    externalRedirectConfig: getExternalRedirectConfig(DEFAULT_EXTENSIONS),
    supportTicketsConfig: getSupportTicketsConfig(DEFAULT_EXTENSIONS),
    portalsConfig: getPortalsConfig(DEFAULT_EXTENSIONS),
    saveExtension: vi.fn(),
    syncAllExtensions: vi.fn(),
    deleteExtension: vi.fn(),
    refreshExtensions: vi.fn(),
    retryLoadExtensions: vi.fn(),
    setLocalExtensions: vi.fn(),
  });
}

describe('Mobile & Desktop App Options (PWA & Platform Mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDefaultExtensionsContext();
  });

  it('configures manifest.webmanifest for both mobile and desktop standalone app installation', () => {
    const manifestPath = path.resolve(process.cwd(), 'public/manifest.webmanifest');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    expect(manifest.id).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.display_override).toEqual(['window-controls-overlay', 'standalone']);
    expect(manifest.categories).toEqual(['education', 'reference', 'books']);
    expect(Array.isArray(manifest.shortcuts)).toBe(true);
    expect(manifest.shortcuts.length).toBeGreaterThanOrEqual(2);
    expect(manifest.shortcuts.map((s: { url: string }) => s.url)).toEqual([
      '/#/home',
      '/#/random',
    ]);
  });

  it('renders AppInstallModal with Mobile and Desktop platform options', () => {
    const mobileHtml = renderToStaticMarkup(
      <AppInstallModal
        isOpen={true}
        onClose={vi.fn()}
        deviceMode="mobile"
        onChangeDeviceMode={vi.fn()}
      />
    );

    expect(mobileHtml).toContain('data-testid="app-install-modal"');
    expect(mobileHtml).toContain('Aplicativo Mobile');
    expect(mobileHtml).toContain('Aplicativo para Computador');
    expect(mobileHtml).toContain('data-testid="panel-mobile-app-option"');
    expect(mobileHtml).toContain('Android (Chrome / Edge)');
    expect(mobileHtml).toContain('iPhone &amp; iPad (Safari)');
    expect(mobileHtml).toContain('Modo Aplicativo Mobile Ativo');

    const desktopHtml = renderToStaticMarkup(
      <AppInstallModal
        isOpen={true}
        onClose={vi.fn()}
        deviceMode="desktop"
        onChangeDeviceMode={vi.fn()}
      />
    );

    expect(desktopHtml).toContain('data-testid="panel-desktop-app-option"');
    expect(desktopHtml).toContain('Windows &amp; Linux (Chrome / Edge)');
    expect(desktopHtml).toContain('macOS (Chrome / Safari / Edge)');
    expect(desktopHtml).toContain('Modo Computador Ativo');
  });

  it('renders standalone installed status banner when running in installed display-mode', () => {
    const originalWindow = globalThis.window;
    (globalThis as unknown as { window: Record<string, unknown> }).window = {
      matchMedia: vi.fn((query: string) => ({
        matches: query === '(display-mode: standalone)',
      })),
      navigator: { standalone: true },
    };

    try {
      const html = renderToStaticMarkup(
        <AppInstallModal
          isOpen={true}
          onClose={vi.fn()}
          deviceMode="desktop"
          onChangeDeviceMode={vi.fn()}
        />
      );
      expect(html).toContain('data-testid="app-already-installed-banner"');
      expect(html).toContain('como aplicativo instalado em janela dedicada');
    } finally {
      (globalThis as unknown as { window: typeof originalWindow }).window = originalWindow;
    }
  });

  it('renders MobileAppNavBar according to deviceMode (visible on mobile, hidden on desktop, null on tv)', () => {
    const mobileNavHtml = renderToStaticMarkup(
      <MobileAppNavBar
        currentView="home"
        deviceMode="mobile"
        onSelectHome={vi.fn()}
        onSelectReader={vi.fn()}
        onRandomArticle={vi.fn()}
        onOpenAppOptions={vi.fn()}
      />
    );

    expect(mobileNavHtml).toContain('data-testid="mobile-app-bottom-nav"');
    expect(mobileNavHtml).toContain('class="flex ');
    expect(mobileNavHtml).toContain('Início');
    expect(mobileNavHtml).toContain('Artigo');
    expect(mobileNavHtml).toContain('Aleatória');
    expect(mobileNavHtml).toContain('App');

    const desktopNavHtml = renderToStaticMarkup(
      <MobileAppNavBar
        currentView="home"
        deviceMode="desktop"
        onSelectHome={vi.fn()}
        onSelectReader={vi.fn()}
        onRandomArticle={vi.fn()}
        onOpenAppOptions={vi.fn()}
      />
    );

    expect(desktopNavHtml).toContain('class="hidden ');

    const tvNavHtml = renderToStaticMarkup(
      <MobileAppNavBar
        currentView="home"
        deviceMode="tv"
        onSelectHome={vi.fn()}
        onSelectReader={vi.fn()}
        onRandomArticle={vi.fn()}
        onOpenAppOptions={vi.fn()}
      />
    );

    expect(tvNavHtml).toBe('');
  });

  it('renders Mobile, Desktop, Smart TV, and App install controls inside WikiFooter', () => {
    const footerHtml = renderToStaticMarkup(
      <WikiFooter
        onNavigateHome={vi.fn()}
        onNavigateLgpd={vi.fn()}
        deviceMode="desktop"
        onChangeDeviceMode={vi.fn()}
        onOpenAppOptions={vi.fn()}
      />
    );

    expect(footerHtml).toContain('id="btn-footer-mobile-view"');
    expect(footerHtml).toContain('Versão móvel');
    expect(footerHtml).toContain('id="btn-footer-desktop-view"');
    expect(footerHtml).toContain('Versão para computador');
    expect(footerHtml).toContain('id="btn-footer-tv-view"');
    expect(footerHtml).toContain('Modo Smart TV');
    expect(footerHtml).toContain('id="btn-footer-install-app"');
    expect(footerHtml).toContain('App Mobile / Computador');
  });
});
