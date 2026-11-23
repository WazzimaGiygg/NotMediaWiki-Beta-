import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { DEFAULT_EXTENSIONS, AVAILABLE_CATALOG_EXTENSIONS } from '../src/data/defaultExtensions';
import { WIKI_FEATURE_EXTENSIONS, MANAGED_FEATURE_EXTENSIONS, isRuntimeExtensionEnabled } from '../src/extensions';
import { clientParsoid } from '../src/services/parsoid';
import { getSiteTitleConfig } from '../src/extensions/siteTitleExtension';
import { getThemeAppearanceConfig } from '../src/extensions/themeAppearanceExtension';
import { getSupportTicketsConfig } from '../src/extensions/supportTicketsExtension';
import { getMaintenanceModeConfig } from '../src/extensions/maintenanceModeExtension';
import { getExternalRedirectConfig } from '../src/extensions/externalRedirectExtension';
import { getPortalsConfig } from '../src/extensions/portalsExtension';
import { useExtensions } from '../src/context/ExtensionsContext';
import { Header } from '../src/components/Header';
import { WikiFooter } from '../src/components/WikiFooter';
import { HomeScreen } from '../src/components/HomeScreen';
import { SpecialPagesHub } from '../src/components/SpecialPagesHub';
import { DevAdminDashboard } from '../src/components/DevAdminDashboard';

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

function mockExtensionsState(disabledNames: string[] = []) {
  const disabledSet = new Set(disabledNames.map(n => n.toLowerCase()));
  const overriddenExtensions = DEFAULT_EXTENSIONS.map(ext =>
    disabledSet.has(ext.id.toLowerCase()) || disabledSet.has(ext.name.toLowerCase())
      ? { ...ext, enabled: false }
      : { ...ext, enabled: true }
  );

  const themeCfg = getThemeAppearanceConfig(overriddenExtensions);
  mockedUseExtensions.mockReturnValue({
    extensions: overriddenExtensions,
    isLoadingExtensions: false,
    hasAttemptedInitialLoad: true,
    hasLoadedFromFirebase: true,
    extensionsLoadError: null,
    lastSyncAt: null,
    getExtension: vi.fn((idOrName: string) =>
      overriddenExtensions.find(
        e => e.id === idOrName || e.name.toLowerCase() === idOrName.toLowerCase()
      )
    ),
    isExtensionEnabled: vi.fn((idOrName: string, fallback = true) => {
      const ext = overriddenExtensions.find(
        e => e.id === idOrName || e.name.toLowerCase() === idOrName.toLowerCase()
      );
      return ext ? Boolean(ext.enabled) : fallback;
    }),
    getExtensionParam: vi.fn((idOrName: string, paramKey: string, fallback: unknown) => {
      const ext = overriddenExtensions.find(
        e => e.id === idOrName || e.name.toLowerCase() === idOrName.toLowerCase()
      );
      const param = ext?.config?.find(c => c.key === paramKey);
      return param && param.value !== undefined ? param.value : fallback;
    }),
    siteTitleConfig: getSiteTitleConfig(overriddenExtensions),
    themeAppearanceConfig: themeCfg,
    activeTheme: themeCfg.defaultTheme,
    setUserTheme: vi.fn(() => true),
    resetToDefaultTheme: vi.fn(),
    isThemeSelectorOpen: false,
    openThemeSelector: vi.fn(),
    closeThemeSelector: vi.fn(),
    maintenanceConfig: getMaintenanceModeConfig(overriddenExtensions),
    externalRedirectConfig: getExternalRedirectConfig(overriddenExtensions),
    supportTicketsConfig: getSupportTicketsConfig(overriddenExtensions),
    portalsConfig: getPortalsConfig(overriddenExtensions),
    saveExtension: vi.fn(),
    syncAllExtensions: vi.fn(),
    deleteExtension: vi.fn(),
    refreshExtensions: vi.fn(),
    retryLoadExtensions: vi.fn(),
    setLocalExtensions: vi.fn(),
  });
}

describe('All Wiki features as toggleable extensions (all enabled by default)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExtensionsState([]);
  });

  it('enables 100% of DEFAULT_EXTENSIONS, AVAILABLE_CATALOG_EXTENSIONS, and WIKI_FEATURE_EXTENSIONS by default with unique IDs and valid Firestore schema', () => {
    const allowedCategories = new Set(['parser', 'ui', 'search', 'security', 'infra', 'media', 'engagement']);
    const allowedTypes = new Set(['extension', 'skin', 'service']);
    const allowedKeys = new Set([
      'id', 'name', 'namePt', 'version', 'category', 'author', 'description',
      'enabled', 'type', 'url', 'license', 'hooks', 'config', 'manifestJson',
      'lastUpdated', 'updatedBy', 'updatedByRole', 'updatedAt',
    ]);

    expect(DEFAULT_EXTENSIONS.length).toBeGreaterThanOrEqual(40);
    expect(WIKI_FEATURE_EXTENSIONS.length).toBe(19);
    expect(MANAGED_FEATURE_EXTENSIONS.length).toBeGreaterThanOrEqual(30);

    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    for (const ext of DEFAULT_EXTENSIONS) {
      expect(ext.enabled).toBe(true);
      expect(seenIds.has(ext.id)).toBe(false);
      expect(seenNames.has(ext.name)).toBe(false);
      seenIds.add(ext.id);
      seenNames.add(ext.name);

      expect(typeof ext.id).toBe('string');
      expect(ext.id.length).toBeGreaterThan(0);
      expect(ext.id.length).toBeLessThanOrEqual(128);
      expect(typeof ext.name).toBe('string');
      expect(ext.name.length).toBeGreaterThan(0);
      expect(allowedCategories.has(ext.category)).toBe(true);
      if (ext.type !== undefined) {
        expect(allowedTypes.has(ext.type)).toBe(true);
      }
      for (const key of Object.keys(ext)) {
        expect(allowedKeys.has(key)).toBe(true);
      }
    }

    for (const ext of AVAILABLE_CATALOG_EXTENSIONS) {
      expect(ext.enabled).toBe(true);
    }

    // Critical invariant: WikiMaintenanceMode extension is enabled as a module,
    // while maintenance lockdown switch ($wgMaintenanceModeActive) defaults to false.
    const maintenance = getMaintenanceModeConfig(DEFAULT_EXTENSIONS);
    expect(maintenance.extensionEnabled).toBe(true);
    expect(maintenance.isMaintenanceActive).toBe(false);
  });

  it('resolves isRuntimeExtensionEnabled cleanly against explicit extension arrays', () => {
    const customList = [
      { id: 'ext-templates', name: 'MediaWikiTemplates', enabled: false },
      { id: 'ext-cite', name: 'Cite', enabled: true },
    ];
    expect(isRuntimeExtensionEnabled('MediaWikiTemplates', customList, true)).toBe(false);
    expect(isRuntimeExtensionEnabled('ext-templates', customList, true)).toBe(false);
    expect(isRuntimeExtensionEnabled('Cite', customList, false)).toBe(true);
    expect(isRuntimeExtensionEnabled('NonExistentExt', customList, true)).toBe(true);
  });

  it('gates ParsoidCompiler, MediaWikiTemplates, Cite, and InfoboxBuilder cleanly in clientParsoid.parse', () => {
    const sampleWikitext = `
{{Aviso|titulo=Alerta Teste|texto=Conteúdo da predefinição}}

{{Infobox software
| nome = WikiEngine
| licenca = MIT
}}

== Seção ==
Texto com nota de rodapé.<ref>Referência de teste</ref>

<references />
`;

    // All enabled
    const enabledRes = clientParsoid.parse(sampleWikitext, 'Teste', {
      parsoidEnabled: true,
      templatesEnabled: true,
      citeEnabled: true,
      infoboxEnabled: true,
    });
    expect(enabledRes.html).toContain('data-template="Aviso"');
    expect(enabledRes.html).toContain('Alerta Teste');
    expect(enabledRes.html).toContain('WikiEngine');
    expect(enabledRes.references.length).toBe(1);
    expect(enabledRes.html).toContain('cite_ref-1');

    // MediaWikiTemplates disabled
    const noTemplatesRes = clientParsoid.parse(sampleWikitext, 'Teste', {
      parsoidEnabled: true,
      templatesEnabled: false,
      citeEnabled: true,
      infoboxEnabled: true,
    });
    expect(noTemplatesRes.html).not.toContain('data-template="Aviso"');
    expect(noTemplatesRes.html).not.toContain('wiki-template-ambox');
    expect(noTemplatesRes.html).toContain('WikiEngine');

    // InfoboxBuilder disabled
    const noInfoboxRes = clientParsoid.parse(sampleWikitext, 'Teste', {
      parsoidEnabled: true,
      templatesEnabled: true,
      citeEnabled: true,
      infoboxEnabled: false,
    });
    expect(noInfoboxRes.html).not.toContain('class="wiki-infobox');

    // Cite disabled
    const noCiteRes = clientParsoid.parse(sampleWikitext, 'Teste', {
      parsoidEnabled: true,
      templatesEnabled: true,
      citeEnabled: false,
      infoboxEnabled: true,
    });
    expect(noCiteRes.references.length).toBe(0);
    expect(noCiteRes.html).not.toContain('cite_ref-1');

    // ParsoidCompiler disabled -> safe raw fallback without breaking reader
    const noParsoidRes = clientParsoid.parse(sampleWikitext, 'Teste', {
      parsoidEnabled: false,
    });
    expect(noParsoidRes.html).toContain('ParsoidCompiler</strong> desativada');
    expect(noParsoidRes.html).toContain('== Seção ==');
  });

  it('hides and restores Header controls when extensions are toggled while keeping core navigation & Google Login', () => {
    const baseProps = {
      currentView: 'home',
      onSelectView: vi.fn(),
      currentUser: null,
      onUserChanged: vi.fn(),
      onNavigateArticle: vi.fn(),
      onOpenSearch: vi.fn(),
      onOpenNewArticle: vi.fn(),
      activeArticleSlug: 'MediaWiki',
      readingProgress: 42,
      onOpenChat: vi.fn(),
      onOpenDirectory: vi.fn(),
      onOpenMyUserPage: vi.fn(),
      onOpenChecklist: vi.fn(),
      onRandomArticle: vi.fn(),
      onOpenAppOptions: vi.fn(),
    };

    mockExtensionsState([]);
    const enabledHtml = renderToStaticMarkup(<Header {...baseProps} />);
    expect(enabledHtml).toContain('Pesquisar artigos no');
    expect(enabledHtml).toContain('Aleatória');
    expect(enabledHtml).toContain('Páginas Especiais');
    expect(enabledHtml).toContain('Usuários');
    expect(enabledHtml).toContain('Vídeo Comercial');
    expect(enabledHtml).toContain('Burocratas');
    expect(enabledHtml).toContain('Login Google');

    mockExtensionsState([
      'CirrusSearch',
      'RandomArticle',
      'SpecialPagesHub',
      'UserDirectoryProfiles',
      'PromoVideoStudio',
      'CommunityChat',
      'PwaMobileDesktopApp',
      'FocusReadingMode',
    ]);
    const disabledHtml = renderToStaticMarkup(<Header {...baseProps} />);
    expect(disabledHtml).not.toContain('Pesquisar artigos no');
    expect(disabledHtml).not.toContain('Páginas Especiais');
    expect(disabledHtml).not.toContain('Vídeo Comercial');
    expect(disabledHtml).not.toContain('Abrir aplicativo Mobile ou Computador');
    // Core invariants stay available:
    expect(disabledHtml).toContain('Burocratas');
    expect(disabledHtml).toContain('Login Google');
  });

  it('hides and restores WikiFooter controls according to MobileFrontend, PwaMobileDesktopApp, ThemeAppearance, and GovernanceAndCompliance', () => {
    const footerProps = {
      onNavigateHome: vi.fn(),
      onNavigateLgpd: vi.fn(),
      deviceMode: 'auto' as const,
      onChangeDeviceMode: vi.fn(),
      onOpenAppOptions: vi.fn(),
    };

    mockExtensionsState([]);
    const enabledFooter = renderToStaticMarkup(<WikiFooter {...footerProps} />);
    expect(enabledFooter).toContain('Modo de Exibição:');
    expect(enabledFooter).toContain('Aparência &amp; Temas');
    expect(enabledFooter).toContain('App Mobile / Computador');
    expect(enabledFooter).toContain('LGPD &amp; MCI');

    mockExtensionsState([
      'MobileFrontend',
      'PwaMobileDesktopApp',
      'ThemeAppearance',
      'GovernanceAndCompliance',
    ]);
    const disabledFooter = renderToStaticMarkup(<WikiFooter {...footerProps} />);
    expect(disabledFooter).not.toContain('Modo de Exibição:');
    expect(disabledFooter).not.toContain('Aparência &amp; Temas');
    expect(disabledFooter).not.toContain('App Mobile / Computador');
    expect(disabledFooter).not.toContain('LGPD &amp; MCI');
  });

  it('gates HomeScreen sections cleanly when GovernanceAndCompliance, RandomArticle, and MediaWikiTemplates are disabled', () => {
    const homeProps = {
      currentUser: null,
      onNavigateArticle: vi.fn(),
      onEditArticle: vi.fn(),
      onOpenNewArticle: vi.fn(),
      onRandomArticle: vi.fn(),
    };

    mockExtensionsState([]);
    const enabledHome = renderToStaticMarkup(<HomeScreen {...homeProps} />);
    expect(enabledHome).toContain('Artigo Aleatório');
    expect(enabledHome).toContain('Exemplo: Pré-definições');
    expect(enabledHome).toContain('Ler Dossiê Completo no Wiki');

    mockExtensionsState(['GovernanceAndCompliance', 'RandomArticle', 'MediaWikiTemplates']);
    const disabledHome = renderToStaticMarkup(<HomeScreen {...homeProps} />);
    expect(disabledHome).not.toContain('Artigo Aleatório');
    expect(disabledHome).not.toContain('Exemplo: Pré-definições');
    expect(disabledHome).not.toContain('Ler Dossiê Completo no Wiki');
  });

  it('gates SpecialPagesHub tabs and shows disabled notice when accessing a disabled special page directly', () => {
    const specialProps = {
      initialSpecialPage: 'Templates',
      onNavigateArticle: vi.fn(),
      onOpenEdit: vi.fn(),
      onOpenHistory: vi.fn(),
      currentUser: null,
      onRandomArticle: vi.fn(),
    };

    mockExtensionsState([]);
    const enabledSpecial = renderToStaticMarkup(<SpecialPagesHub {...specialProps} />);
    expect(enabledSpecial).toContain('data-testid="special-templates-view"');

    mockExtensionsState(['MediaWikiTemplates', 'CategoryTree', 'Cargo', 'EventStreams']);
    const disabledSpecial = renderToStaticMarkup(<SpecialPagesHub {...specialProps} />);
    expect(disabledSpecial).toContain('data-testid="disabled-special-MediaWikiTemplates"');
    expect(disabledSpecial).toContain('Extensão Desativada');
    expect(disabledSpecial).not.toContain('Predefinições (Templates)');
  });

  it('gates DevAdminDashboard governance, checklist, and history tabs while preserving Extensões do Sistema', () => {
    const adminProps = {
      activeArticleSlug: 'MediaWiki',
      currentUser: null,
      onNavigateArticle: vi.fn(),
      onBackToReader: vi.fn(),
      initialTab: 'lgpd_rules',
    };

    mockExtensionsState(['GovernanceAndCompliance', 'DailyChecklist', 'DiffLedger']);
    const disabledAdmin = renderToStaticMarkup(<DevAdminDashboard {...adminProps} />);
    expect(disabledAdmin).toContain('Recurso Desabilitado');
    expect(disabledAdmin).toContain('GovernanceAndCompliance');
    expect(disabledAdmin).toContain('Extensões do Sistema');
  });
});
