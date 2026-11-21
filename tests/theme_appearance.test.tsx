import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetDocs,
  mockSetDoc,
  mockDeleteDoc,
  mockOnSnapshot,
  mockCollection,
  mockDoc,
  mockGetAuth,
} = vi.hoisted(() => {
  const authState = { currentUser: null };
  return {
    mockGetDocs: vi.fn(async () => ({ forEach: () => {} })),
    mockSetDoc: vi.fn(),
    mockDeleteDoc: vi.fn(),
    mockOnSnapshot: vi.fn(() => vi.fn()),
    mockCollection: vi.fn((_db: unknown, col: string) => ({ col })),
    mockDoc: vi.fn((_db: unknown, col: string, id: string) => ({ path: `${col}/${id}` })),
    mockGetAuth: vi.fn(() => authState),
  };
});

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: mockGetAuth,
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
  collection: mockCollection,
  doc: mockDoc,
  setDoc: mockSetDoc,
  deleteDoc: mockDeleteDoc,
  getDocs: mockGetDocs,
  getDoc: vi.fn(),
  getDocFromServer: vi.fn(),
  onSnapshot: mockOnSnapshot,
  query: vi.fn(),
  limit: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

import { DEFAULT_EXTENSIONS } from '../src/data/defaultExtensions';
import { mergeExtensionsWithDefaults } from '../src/firebase';
import {
  WIKI_THEMES_REGISTRY,
  getAvailableWikiThemes,
  resolveWikiTheme,
} from '../src/themes/themeRegistry';
import {
  getThemeAppearanceConfig,
  themeAppearanceExtension,
} from '../src/extensions/themeAppearanceExtension';
import { ThemeSelectorModal } from '../src/components/ThemeSelectorModal';
import { WikidiotaParodyBanner } from '../src/components/WikidiotaParodyBanner';
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

describe('ThemeAppearance Extension ($wgDefaultTheme & Incremental Themes Registry)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers ThemeAppearance (ext-theme-appearance) in DEFAULT_EXTENSIONS as a skin UI extension', () => {
    const ext = DEFAULT_EXTENSIONS.find(e => e.id === 'ext-theme-appearance');
    expect(ext).toBeDefined();
    expect(ext?.name).toBe('ThemeAppearance');
    expect(ext?.type).toBe('skin');
    expect(ext?.category).toBe('ui');
    expect(ext?.enabled).toBe(true);
    expect(ext?.config.map(c => c.key)).toEqual([
      '$wgDefaultTheme',
      '$wgAllowUserThemeSwitch',
      '$wgShowThemePickerInHeader',
      '$wgExtraThemesJson',
    ]);
  });

  it('exposes built-in themes and supports incremental themes via $wgExtraThemesJson while ignoring malformed JSON', () => {
    const builtIn = getAvailableWikiThemes();
    expect(builtIn.length).toBe(WIKI_THEMES_REGISTRY.length);
    expect(builtIn.map(t => t.id)).toEqual([
      'vector-light',
      'vector-dark',
      'archival-sepia',
      'monobook-classic',
      'high-contrast-dark',
      'wikidiota',
      'windows-31',
    ]);

    const extraJson = JSON.stringify([
      {
        id: 'cyber-forest',
        name: 'Floresta Digital',
        shortLabel: 'Floresta',
        description: 'Tema incremental futuro adicionado conforme o Wiki evolui.',
        colorScheme: 'dark',
        addedInVersion: '2.0.0',
        preview: {
          canvas: '#041f15',
          surface: '#062c1e',
          text: '#ecfdf5',
          accent: '#10b981',
          border: '#047857',
        },
      },
    ]);

    const expanded = getAvailableWikiThemes(extraJson);
    expect(expanded.length).toBe(WIKI_THEMES_REGISTRY.length + 1);
    const customTheme = resolveWikiTheme('cyber-forest', expanded);
    expect(customTheme.id).toBe('cyber-forest');
    expect(customTheme.name).toBe('Floresta Digital');
    expect(customTheme.colorScheme).toBe('dark');

    // Malformed JSON falls back gracefully to built-in registry
    expect(getAvailableWikiThemes('{not-valid-json').length).toBe(WIKI_THEMES_REGISTRY.length);
  });

  it('resolves bureaucrat Firebase overrides for $wgDefaultTheme, $wgAllowUserThemeSwitch, and disabled extension fallback', () => {
    const defaultCfg = getThemeAppearanceConfig(DEFAULT_EXTENSIONS);
    expect(defaultCfg.extensionEnabled).toBe(true);
    expect(defaultCfg.defaultThemeId).toBe('vector-light');
    expect(defaultCfg.allowUserThemeSwitch).toBe(true);

    const bureaucratOverride = {
      ...themeAppearanceExtension,
      config: themeAppearanceExtension.config.map(c => {
        if (c.key === '$wgDefaultTheme') return { ...c, value: 'archival-sepia' };
        if (c.key === '$wgAllowUserThemeSwitch') return { ...c, value: false };
        return c;
      }),
    };

    const merged = mergeExtensionsWithDefaults([bureaucratOverride], DEFAULT_EXTENSIONS);
    const resolvedCfg = getThemeAppearanceConfig(merged);

    expect(resolvedCfg.extensionEnabled).toBe(true);
    expect(resolvedCfg.defaultThemeId).toBe('archival-sepia');
    expect(resolvedCfg.defaultTheme.name).toContain('Pergaminho Editorial');
    expect(resolvedCfg.allowUserThemeSwitch).toBe(false);

    const disabledMerged = mergeExtensionsWithDefaults(
      [{ ...bureaucratOverride, enabled: false }],
      DEFAULT_EXTENSIONS
    );
    const disabledCfg = getThemeAppearanceConfig(disabledMerged);
    expect(disabledCfg.extensionEnabled).toBe(false);
    expect(disabledCfg.defaultThemeId).toBe('vector-light');
    expect(disabledCfg.showThemePickerInHeader).toBe(false);
  });

  it('renders ThemeSelectorModal with all available themes, active state, and bureaucrat lock notice when locked', () => {
    const unlockedCfg = getThemeAppearanceConfig(DEFAULT_EXTENSIONS);

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
      siteTitleConfig: {
        extensionEnabled: true,
        siteTitle: 'NotMediaWiki',
        siteSubtitle: 'WazzimaGiygg',
        projectBadge: 'Projeto WazzimaGiygg',
        fullBrandName: 'NotMediaWiki | WazzimaGiygg',
      },
      themeAppearanceConfig: {
        ...unlockedCfg,
        allowUserThemeSwitch: false,
        defaultThemeId: 'monobook-classic',
        defaultTheme: resolveWikiTheme('monobook-classic', unlockedCfg.availableThemes),
      },
      activeTheme: resolveWikiTheme('monobook-classic', unlockedCfg.availableThemes),
      setUserTheme: vi.fn(() => false),
      resetToDefaultTheme: vi.fn(),
      isThemeSelectorOpen: true,
      openThemeSelector: vi.fn(),
      closeThemeSelector: vi.fn(),
      maintenanceConfig: {} as any,
      externalRedirectConfig: {} as any,
      supportTicketsConfig: {} as any,
      portalsConfig: {} as any,
      saveExtension: vi.fn(),
      syncAllExtensions: vi.fn(),
      deleteExtension: vi.fn(),
      refreshExtensions: vi.fn(),
      retryLoadExtensions: vi.fn(),
      setLocalExtensions: vi.fn(),
    });

    const html = renderToStaticMarkup(<ThemeSelectorModal />);
    expect(html).toContain('Aparência &amp; Temas do NotMediaWiki');
    expect(html).toContain('Catálogo evolutivo de temas do Wiki-site');
    expect(html).toContain('Novos temas e skins são adicionados gradualmente');
    expect(html).toContain('Tema fixado pela administração (Burocrata)');
    expect(html).toContain('Vector Claro (Padrão)');
    expect(html).toContain('Vector Noturno (Escuro)');
    expect(html).toContain('Pergaminho Editorial (Sépia)');
    expect(html).toContain('Monobook Clássico');
    expect(html).toContain('Alto Contraste (OLED)');
    expect(html).toContain('Wikidiota (Edição Paródia)');
    expect(html).toContain('Windows 3.1 (Program Manager)');
    expect(html).toContain('Padrão do Wiki');

    const win31 = resolveWikiTheme('windows-31', unlockedCfg.availableThemes);
    expect(win31.id).toBe('windows-31');
    expect(win31.preview.canvas).toBe('#008080');
    expect(win31.preview.accent).toBe('#000080');
  });

  it('renders Wikidiota parody theme banner with satirical foundation and regime chronicles only when active', () => {
    const cfg = getThemeAppearanceConfig(DEFAULT_EXTENSIONS);
    const baseMock = {
      extensions: DEFAULT_EXTENSIONS,
      isLoadingExtensions: false,
      hasAttemptedInitialLoad: true,
      hasLoadedFromFirebase: true,
      extensionsLoadError: null,
      lastSyncAt: null,
      getExtension: vi.fn(),
      isExtensionEnabled: vi.fn(() => true),
      getExtensionParam: vi.fn(),
      siteTitleConfig: {
        extensionEnabled: true,
        siteTitle: 'NotMediaWiki',
        siteSubtitle: 'WazzimaGiygg',
        projectBadge: 'Projeto WazzimaGiygg',
        fullBrandName: 'NotMediaWiki | WazzimaGiygg',
      },
      themeAppearanceConfig: cfg,
      setUserTheme: vi.fn(() => true),
      resetToDefaultTheme: vi.fn(),
      isThemeSelectorOpen: false,
      openThemeSelector: vi.fn(),
      closeThemeSelector: vi.fn(),
      maintenanceConfig: {} as any,
      externalRedirectConfig: {} as any,
      supportTicketsConfig: {} as any,
      portalsConfig: {} as any,
      saveExtension: vi.fn(),
      syncAllExtensions: vi.fn(),
      deleteExtension: vi.fn(),
      refreshExtensions: vi.fn(),
      retryLoadExtensions: vi.fn(),
      setLocalExtensions: vi.fn(),
    };

    mockedUseExtensions.mockReturnValue({
      ...baseMock,
      activeTheme: resolveWikiTheme('vector-light', cfg.availableThemes),
    });
    expect(renderToStaticMarkup(<WikidiotaParodyBanner />)).toBe('');

    const wikidiotaTheme = resolveWikiTheme('wikidiota', cfg.availableThemes);
    expect(wikidiotaTheme.id).toBe('wikidiota');

    mockedUseExtensions.mockReturnValue({
      ...baseMock,
      activeTheme: wikidiotaTheme,
    });

    const bannerHtml = renderToStaticMarkup(<WikidiotaParodyBanner />);
    expect(bannerHtml).toContain('Wikiomite Foundation');
    expect(bannerHtml).toContain('Wikidiota');
    expect(bannerHtml).toContain('Feudo de LittleSunshine');
    expect(bannerHtml).toContain('Ditadura de Conde Edmond Dantès');
    expect(bannerHtml).toContain('Corrupção de Johannnes89');
    expect(bannerHtml).toContain('Reinado do Chronus');
  });
});
