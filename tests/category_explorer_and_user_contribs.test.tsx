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

import { DEFAULT_EXTENSIONS } from '../src/data/defaultExtensions';
import { getSiteTitleConfig } from '../src/extensions/siteTitleExtension';
import { getThemeAppearanceConfig } from '../src/extensions/themeAppearanceExtension';
import { getSupportTicketsConfig } from '../src/extensions/supportTicketsExtension';
import { getMaintenanceModeConfig } from '../src/extensions/maintenanceModeExtension';
import { getExternalRedirectConfig } from '../src/extensions/externalRedirectExtension';
import { getPortalsConfig } from '../src/extensions/portalsExtension';
import { useExtensions } from '../src/context/ExtensionsContext';
import { CategoryExplorer } from '../src/components/CategoryExplorer';
import { SpecialPagesHub } from '../src/components/SpecialPagesHub';
import { Header } from '../src/components/Header';
import { WikiFooter } from '../src/components/WikiFooter';
import { UserPageView } from '../src/components/UserPageView';
import { Article, UserSession } from '../src/types';

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
    isThemeSelectorOpen: false,
    openThemeSelector: vi.fn(),
    closeThemeSelector: vi.fn(),
    setUserTheme: vi.fn(() => true),
    resetToDefaultTheme: vi.fn(),
    supportTicketsConfig: getSupportTicketsConfig(overriddenExtensions),
    maintenanceConfig: getMaintenanceModeConfig(overriddenExtensions),
    externalRedirectConfig: getExternalRedirectConfig(overriddenExtensions),
    portalsConfig: getPortalsConfig(overriddenExtensions),
    refreshExtensions: vi.fn(),
    retryLoadExtensions: vi.fn(),
    saveExtension: vi.fn(),
    syncAllExtensions: vi.fn(),
    deleteExtension: vi.fn(),
    setLocalExtensions: vi.fn(),
  });
}

function makeArticle(overrides: Partial<Article>): Article {
  return {
    id: overrides.id || `id-${overrides.slug || 'art'}`,
    slug: overrides.slug || 'Artigo',
    title: overrides.title || 'Artigo',
    namespace: overrides.namespace ?? 0,
    wikitext: overrides.wikitext || '',
    summary: overrides.summary || 'Resumo do artigo.',
    latestRevisionId: overrides.latestRevisionId || 'rev-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
    categories: overrides.categories || [],
    views: overrides.views ?? 15,
    isProtected: false,
  };
}

const sampleUser: UserSession = {
  id: 'user-alice-1',
  username: 'AliceWiki',
  userTag: '#2026',
  role: 'editor',
  editCount: 12,
  avatar: 'AW',
  email: 'alice@example.org',
};

describe('CategoryExplorer, RecentChanges links, and User Contributions', () => {
  beforeEach(() => {
    mockExtensionsState([]);
  });

  it('renders CategoryExplorer listing all categories and showing associated articles for selected category', () => {
    const articles: Article[] = [
      makeArticle({
        slug: 'Software_Livre',
        title: 'Software Livre',
        wikitext: '[[Categoria:Tecnologia]][[Categoria:Software]]',
        categories: ['Tecnologia', 'Software'],
      }),
      makeArticle({
        slug: 'Linux',
        title: 'Linux',
        summary: 'Núcleo de sistema operacional livre.',
        wikitext: '[[Categoria:Software]][[Categoria:Sistemas Operacionais]]',
        categories: ['Software', 'Sistemas Operacionais'],
      }),
      makeArticle({
        slug: 'Machado_de_Assis',
        title: 'Machado de Assis',
        summary: 'Escritor brasileiro fundador da ABL.',
        wikitext: '[[Categoria:Literatura]]',
        categories: ['Literatura'],
      }),
    ];

    const html = renderToStaticMarkup(
      <CategoryExplorer
        articles={articles}
        initialCategory="Software"
        onNavigateArticle={vi.fn()}
        onOpenHistory={vi.fn()}
      />
    );

    expect(html).toContain('Explorador de Categorias (CategoryExplorer)');
    expect(html).toContain('Literatura');
    expect(html).toContain('Software');
    expect(html).toContain('Tecnologia');
    expect(html).toContain('Categoria: Software');
    expect(html).toContain('Software Livre');
    expect(html).toContain('Linux');
    expect(html).toContain('Núcleo de sistema operacional livre.');
    expect(html).toContain('2 artigos');
  });

  it('integrates CategoryExplorer into SpecialPagesHub and supports Portuguese aliases', () => {
    const hubIndexHtml = renderToStaticMarkup(
      <SpecialPagesHub
        initialSpecialPage="SpecialPages"
        onNavigateArticle={vi.fn()}
        onOpenEdit={vi.fn()}
        onOpenHistory={vi.fn()}
      />
    );
    expect(hubIndexHtml).toContain('Explorador de Categorias');
    expect(hubIndexHtml).toContain('Especial:ExploradorDeCategorias (CategoryExplorer)');

    const explorerHtml = renderToStaticMarkup(
      <SpecialPagesHub
        initialSpecialPage="ExploradorDeCategorias"
        onNavigateArticle={vi.fn()}
        onOpenEdit={vi.fn()}
        onOpenHistory={vi.fn()}
      />
    );
    expect(explorerHtml).toContain('data-testid="category-explorer"');

    const recentChangesHtml = renderToStaticMarkup(
      <SpecialPagesHub
        initialSpecialPage="MudançasRecentes"
        onNavigateArticle={vi.fn()}
        onOpenEdit={vi.fn()}
        onOpenHistory={vi.fn()}
      />
    );
    expect(recentChangesHtml).toContain('Especial:MudançasRecentes (Special:RecentChanges)');

    const contribPrefilledHtml = renderToStaticMarkup(
      <SpecialPagesHub
        initialSpecialPage="Contributions:AliceWiki"
        onNavigateArticle={vi.fn()}
        onOpenEdit={vi.fn()}
        onOpenHistory={vi.fn()}
      />
    );
    expect(contribPrefilledHtml).toContain('Especial:Contribuições (Special:Contributions)');
    expect(contribPrefilledHtml).toContain('value="AliceWiki"');
  });

  it('renders Mudanças Recentes link in Header (unless EventStreams disabled) and WikiFooter', () => {
    const headerHtml = renderToStaticMarkup(
      <Header
        currentView="special"
        activeSpecialPage="RecentChanges"
        onSelectView={vi.fn()}
        currentUser={sampleUser}
        onUserChanged={vi.fn()}
        onNavigateArticle={vi.fn()}
        onOpenSearch={vi.fn()}
        onOpenNewArticle={vi.fn()}
        activeArticleSlug="MediaWiki"
      />
    );
    expect(headerHtml).toContain('data-testid="nav-item-recent_changes"');
    expect(headerHtml).toContain('Mudanças Recentes');

    mockExtensionsState(['EventStreams']);
    const headerNoRcHtml = renderToStaticMarkup(
      <Header
        currentView="home"
        onSelectView={vi.fn()}
        currentUser={sampleUser}
        onUserChanged={vi.fn()}
        onNavigateArticle={vi.fn()}
        onOpenSearch={vi.fn()}
        onOpenNewArticle={vi.fn()}
        activeArticleSlug="MediaWiki"
      />
    );
    expect(headerNoRcHtml).not.toContain('data-testid="nav-item-recent_changes"');

    mockExtensionsState([]);
    const footerHtml = renderToStaticMarkup(
      <WikiFooter onNavigateHome={vi.fn()} onNavigateLgpd={vi.fn()} />
    );
    expect(footerHtml).toContain('href="#/special/RecentChanges"');
    expect(footerHtml).toContain('Mudanças Recentes');
    expect(footerHtml).toContain('Explorador de Categorias');
  });

  it('renders Mudanças Recentes link and User Contributions section/tab inside UserPageView', () => {
    const profileHtml = renderToStaticMarkup(
      <UserPageView
        targetUser={sampleUser}
        currentUser={sampleUser}
        onBack={vi.fn()}
        onStartChat={vi.fn()}
      />
    );
    expect(profileHtml).toContain('data-testid="userpage-recent-changes-link"');
    expect(profileHtml).toContain('Mudanças Recentes');
    expect(profileHtml).toContain('data-testid="userpage-tab-contribuicoes"');
    expect(profileHtml).toContain('data-testid="userpage-contributions-summary"');
    expect(profileHtml).toContain('Últimas Contribuições de AliceWiki');

    const contribsTabHtml = renderToStaticMarkup(
      <UserPageView
        targetUser={sampleUser}
        currentUser={sampleUser}
        initialTab="contribuicoes"
        onBack={vi.fn()}
        onStartChat={vi.fn()}
      />
    );
    expect(contribsTabHtml).toContain('data-testid="userpage-contributions-panel"');
    expect(contribsTabHtml).toContain('Contribuições de AliceWiki');
    expect(contribsTabHtml).toContain('Especial:Contribuições');
    expect(contribsTabHtml).toContain('Revisões Registradas');
  });
});
