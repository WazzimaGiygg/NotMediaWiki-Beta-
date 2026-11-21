import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HomeScreen } from './components/HomeScreen';
import { WikiReader } from './components/WikiReader';
import { WikiEditor } from './components/WikiEditor';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DevAdminDashboard } from './components/DevAdminDashboard';
import { ArticleHistory } from './components/ArticleHistory';
import { SearchResults } from './components/SearchResults';
import { NewArticleModal } from './components/NewArticleModal';
import { UserDirectory } from './components/UserDirectory';
import { UserPageView } from './components/UserPageView';
import { ChatDrawer } from './components/ChatDrawer';
import { DailyChecklistModal } from './components/DailyChecklistModal';
import { SpecialPagesHub } from './components/SpecialPagesHub';
import { GoogleOneTapPopup } from './components/GoogleOneTapPopup';
import { PromoVideoStudio } from './components/PromoVideoStudio';
import { OfflineIndicator } from './components/OfflineIndicator';
import { MessageSquare } from 'lucide-react';
import { UserSession } from './types';
import { api } from './api';
import { wrapExternalUrl } from './utils/urlHelper';
import { fetchUsersFromFirestore, auth, onAuthStateChanged } from './firebase';
import { applyDefaultSiteSeo, applyDynamicSeoMeta, PRIMARY_CANONICAL_ORIGIN, SITE_BRAND_NAME } from './utils/seoManager';
import { LgpdRequestsProvider } from './context/LgpdRequestsContext';
import { ExtensionsProvider, useExtensions } from './context/ExtensionsContext';
import { BureaucratPage } from './components/BureaucratPage';
import { PortalView } from './components/PortalView';
import { MaintenanceScreen } from './components/MaintenanceScreen';
import { ExtensionsLoadFailureScreen } from './components/ExtensionsLoadFailureScreen';
import { hasBureaucratPrivileges } from './firebase';
import { enforceFrameBusting } from './utils/frameGuard';
import { WikiFooter } from './components/WikiFooter';
import { LGPD_INVESTIGATION_SLUG } from './data/lgpdInvestigationArticle';

interface WikiAppShellProps {
  currentUser: UserSession | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<UserSession | null>>;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);

  // Listen to Google Firebase Authentication state
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (fbUser: any) => {
      if (fbUser) {
        try {
          const user = await api.getCurrentUser();
          setCurrentUser(user);
        } catch {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => unsubAuth();
  }, []);

  return (
    <LgpdRequestsProvider currentUser={currentUser}>
      <ExtensionsProvider currentUser={currentUser}>
        <WikiAppShell currentUser={currentUser} setCurrentUser={setCurrentUser} />
      </ExtensionsProvider>
    </LgpdRequestsProvider>
  );
}

const WikiAppShell: React.FC<WikiAppShellProps> = ({ currentUser, setCurrentUser }) => {
  const [isIframeBlocked] = useState<boolean>(() => enforceFrameBusting());
  const [currentView, setCurrentView] = useState<string>('home');
  const [activeArticleSlug, setActiveArticleSlug] = useState<string>('MediaWiki');
  const [specialPageName, setSpecialPageName] = useState<string>('SpecialPages');
  const [activePortal, setActivePortal] = useState<'livros' | 'universitario' | 'jornal'>('livros');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isNewArticleModalOpen, setIsNewArticleModalOpen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);

  const {
    extensions,
    isLoadingExtensions,
    hasAttemptedInitialLoad,
    hasLoadedFromFirebase,
    extensionsLoadError,
    siteTitleConfig,
    maintenanceConfig,
    saveExtension,
    retryLoadExtensions,
  } = useExtensions();

  // Reset Zen Mode whenever navigating away from the article reader
  useEffect(() => {
    if (currentView !== 'reader' && isZenMode) {
      setIsZenMode(false);
    }
  }, [currentView, isZenMode]);
  const [adminSubTab, setAdminSubTab] = useState<string>('users');
  const [readingProgress, setReadingProgress] = useState<number>(0);

  // Real-time Chat & User Pages & Daily Checklist State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [chatTargetUser, setChatTargetUser] = useState<UserSession | null>(null);
  const [selectedUserForPage, setSelectedUserForPage] = useState<UserSession | null>(null);

  // Keep canonical & SEO metadata synchronized for non-article views using configured site title
  useEffect(() => {
    if (currentView === 'reader') return;
    const siteTitle = siteTitleConfig.siteTitle;
    const brandName = siteTitleConfig.fullBrandName || SITE_BRAND_NAME;

    if (currentView === 'search' && searchQuery.trim()) {
      applyDynamicSeoMeta({
        title: `Busca: ${searchQuery.trim()} — ${brandName}`,
        siteName: brandName,
        description: `Resultados oficiais de busca para "${searchQuery.trim()}" na enciclopédia ${siteTitle} (core.wazzimagiygg.com).`,
        canonicalUrl: `${PRIMARY_CANONICAL_ORIGIN}/`,
        ogType: 'website',
        jsonLd: null,
      });
    } else if (currentView === 'bureaucrats') {
      applyDynamicSeoMeta({
        title: `Página dos Burocratas & Extensões — ${brandName}`,
        siteName: brandName,
        description: `Painel oficial dos burocratas e gerenciamento de extensões do ${siteTitle} sincronizado via Firebase.`,
        canonicalUrl: `${PRIMARY_CANONICAL_ORIGIN}/#/burocratas`,
        ogType: 'website',
        jsonLd: null,
      });
    } else if (currentView === 'special') {
      applyDynamicSeoMeta({
        title: `Especial:${specialPageName} — ${brandName}`,
        siteName: brandName,
        description: `Página especial ${specialPageName} do ${siteTitle} oficial (core.wazzimagiygg.com) — Projetos WazzimaGiygg.`,
        canonicalUrl: `${PRIMARY_CANONICAL_ORIGIN}/#/special/${encodeURIComponent(specialPageName)}`,
        ogType: 'website',
        jsonLd: null,
      });
    } else {
      applyDefaultSiteSeo(siteTitleConfig.siteTitle, siteTitleConfig.siteSubtitle);
    }
  }, [currentView, searchQuery, specialPageName, siteTitleConfig]);

  useEffect(() => {
    // Sincronização de domínios permitidos com o Firebase Firestore ao iniciar
    api.getAllowedDomains().then(doms => {
      console.log(`[Firebase Cloud] ${doms.length} domínios permitidos carregados do Firestore.`);
      try {
        localStorage.setItem('notmediawiki_allowed_domains', JSON.stringify(doms.map(d => d.domain)));
      } catch {}
    }).catch(err => {
      console.warn('Notice: Allowed domains Firestore initialization:', err);
    });

    // Assinatura em tempo real para novos domínios adicionados direto no Firebase pelo burocrata
    const unsubDomains = api.subscribeAllowedDomains(cloudDomains => {
      if (cloudDomains && cloudDomains.length > 0) {
        try {
          localStorage.setItem('notmediawiki_allowed_domains', JSON.stringify(cloudDomains.map(d => d.domain)));
        } catch {}
      }
    });

    // Load available articles from Firestore to select initial active article
    api.getArticles().then(arts => {
      if (arts && arts.length > 0) {
        const defaultArt = arts.find(a => a.slug === 'MediaWiki') || arts[0];
        if (defaultArt) {
          setActiveArticleSlug(defaultArt.slug);
        }
      }
    }).catch(console.error);

    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === '' || hash === '#' || hash === '#/' || hash === '#/home') {
        setCurrentView('home');
      } else if (hash === '#/random' || hash === '#/aleatorio' || hash === '#/aleatoria') {
        handleRandomArticle();
      } else if (hash.startsWith('#/wiki/Special:') || hash.startsWith('#/wiki/Especial:')) {
        const rawSpecial = decodeURIComponent(hash.replace('#/wiki/', ''));
        const colonIdx = rawSpecial.indexOf(':');
        const spName = colonIdx >= 0 ? rawSpecial.substring(colonIdx + 1) : 'SpecialPages';
        const normalized = spName.toLowerCase().replace(/_/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (['random', 'paginaaleatoria', 'aleatoria', 'aleatorio'].includes(normalized)) {
          handleRandomArticle();
        } else if (['burocratas', 'bureaucrats', 'burocrata'].includes(normalized)) {
          setCurrentView('bureaucrats');
        } else {
          setSpecialPageName(spName);
          setCurrentView('special');
        }
      } else if (hash === '#/special' || hash === '#/especial' || hash.startsWith('#/special/') || hash.startsWith('#/especial/')) {
        const parts = hash.split('/');
        const spName = parts[2] ? decodeURIComponent(parts[2]) : 'SpecialPages';
        const normalized = spName.toLowerCase().replace(/_/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (['random', 'paginaaleatoria', 'aleatoria', 'aleatorio'].includes(normalized)) {
          handleRandomArticle();
        } else if (['burocratas', 'bureaucrats', 'burocrata'].includes(normalized)) {
          setCurrentView('bureaucrats');
        } else {
          setSpecialPageName(spName);
          setCurrentView('special');
        }
      } else if (hash.startsWith('#/wiki/')) {
        const slug = decodeURIComponent(hash.replace('#/wiki/', ''));
        if (slug.startsWith('Special:') || slug.startsWith('Especial:')) {
          const colonIdx = slug.indexOf(':');
          const spName = colonIdx >= 0 ? slug.substring(colonIdx + 1) : 'SpecialPages';
          const normalized = spName.toLowerCase().replace(/_/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (['random', 'paginaaleatoria', 'aleatoria', 'aleatorio'].includes(normalized)) {
            handleRandomArticle();
          } else if (['burocratas', 'bureaucrats', 'burocrata'].includes(normalized)) {
            setCurrentView('bureaucrats');
          } else {
            setSpecialPageName(spName);
            setCurrentView('special');
          }
        } else {
          setActiveArticleSlug(slug);
          setCurrentView('reader');
        }
      } else if (hash.startsWith('#/edit/')) {
        const slug = decodeURIComponent(hash.replace('#/edit/', ''));
        setActiveArticleSlug(slug);
        setCurrentView('editor');
      } else if (hash.startsWith('#/history/')) {
        const slug = decodeURIComponent(hash.replace('#/history/', ''));
        setActiveArticleSlug(slug);
        setCurrentView('history');
      } else if (hash === '#/arbitration' || hash === '#/conselho-arbitragem') {
        setAdminSubTab('arbitration');
        setCurrentView('dev_admin');
      } else if (hash === '#/checkuser' || hash === '#/fantoches') {
        setAdminSubTab('checkuser');
        setCurrentView('dev_admin');
      } else if (hash === '#/unblock' || hash === '#/desbloqueio') {
        setAdminSubTab('unblock');
        setCurrentView('dev_admin');
      } else if (
        hash === '#/data-removal' ||
        hash === '#/remocao-dados' ||
        hash === '#/solicitacao-exclusao' ||
        hash === '#/admin/admintools/solicitacaodeexlusao' ||
        hash === '#/admin/admintools/solicitacaodeexclusao'
      ) {
        setAdminSubTab('data_removal');
        setCurrentView('dev_admin');
      } else if (hash === '#/emergency' || hash === '#/emergencia') {
        setAdminSubTab('emergency');
        setCurrentView('dev_admin');
      } else if (hash === '#/lgpd' || hash === '#/marco-civil' || hash === '#/lgpd_rules') {
        setAdminSubTab('lgpd_rules');
        setCurrentView('dev_admin');
      } else if (hash === '#/users') {
        setAdminSubTab('users');
        setCurrentView('dev_admin');
      } else if (hash === '#/domains' || hash === '#/allowed_domains') {
        setAdminSubTab('domains');
        setCurrentView('dev_admin');
      } else if (hash === '#/extensions') {
        setAdminSubTab('extensions');
        setCurrentView('dev_admin');
      } else if (hash === '#/logs') {
        setAdminSubTab('logs');
        setCurrentView('dev_admin');
      } else if (hash === '#/mesh') {
        setAdminSubTab('mesh');
        setCurrentView('dev_admin');
      } else if (hash === '#/firebase') {
        setAdminSubTab('firebase');
        setCurrentView('dev_admin');
      } else if (hash === '#/events') {
        setAdminSubTab('events');
        setCurrentView('dev_admin');
      } else if (hash === '#/migration') {
        setAdminSubTab('migration');
        setCurrentView('dev_admin');
      } else if (hash === '#/workbench') {
        setAdminSubTab('workbench');
        setCurrentView('dev_admin');
      } else if (hash === '#/usuarios' || hash === '#/directory') {
        setCurrentView('directory');
      } else if (hash === '#/minha-pagina') {
        setCurrentView('user_page');
      } else if (hash.startsWith('#/usuario/')) {
        const usernameQuery = decodeURIComponent(hash.replace('#/usuario/', ''));
        fetchUsersFromFirestore().then(allUsers => {
          const match = allUsers.find(
            u =>
              u.username.toLowerCase() === usernameQuery.toLowerCase() ||
              `${u.username}${u.userTag}`.toLowerCase() === usernameQuery.toLowerCase() ||
              u.userPageSlug?.toLowerCase() === `usuário:${usernameQuery}`.toLowerCase()
          );
          if (match) setSelectedUserForPage(match);
        });
        setCurrentView('user_page');
      } else if (hash === '#/vpn' || hash === '#/vpn_checker' || hash === '#/vpn-checker') {
        setAdminSubTab('vpn_checker');
        setCurrentView('dev_admin');
      } else if (hash === '#/blp' || hash === '#/etica' || hash === '#/blp_ethics') {
        setAdminSubTab('blp_ethics');
        setCurrentView('dev_admin');
      } else if (hash === '#/chat') {
        setIsChatOpen(true);
      } else if (hash === '#/checklist' || hash === '#/pontos' || hash === '#/missoes') {
        setIsChecklistOpen(true);
      } else if (hash === '#/video-comercial' || hash === '#/promo-video' || hash === '#/comercial') {
        setCurrentView('promo_video');
      } else if (hash === '#/burocratas' || hash === '#/bureaucrats' || hash === '#/burocrata') {
        setCurrentView('bureaucrats');
      } else if (hash === '#/portal/livros') {
        setActivePortal('livros');
        setCurrentView('portal');
      } else if (hash === '#/portal/universitario') {
        setActivePortal('universitario');
        setCurrentView('portal');
      } else if (hash === '#/portal/jornal') {
        setActivePortal('jornal');
        setCurrentView('portal');
      } else if (hash === '#/admin' || hash === '#/dev_admin') {
        setAdminSubTab('users');
        setCurrentView('dev_admin');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);

    // Global interceptor: Any external link anywhere in the document is prefixed with the mandatory redirect URL
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;

      const isExternal =
        (/^https?:\/\//i.test(href) || href.startsWith('//')) &&
        !href.startsWith(window.location.origin) &&
        !href.startsWith('#');

      if (isExternal && !href.startsWith('https://wazzimagiygg.com/rv/?uid=')) {
        e.preventDefault();
        e.stopPropagation();
        const safeUrl = wrapExternalUrl(href);
        window.open(safeUrl, anchor.target || '_blank', 'noopener,noreferrer');
      }
    };

    document.addEventListener('click', handleGlobalClick, true);

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const payload = event?.data;
      if (payload?.type === 'NAVIGATE_ARTICLE' && typeof payload.articleSlug === 'string' && payload.articleSlug.trim()) {
        const cleanSlug = payload.articleSlug.trim();
        setActiveArticleSlug(cleanSlug);
        setCurrentView('reader');
        setReadingProgress(0);
        window.location.hash = `#/wiki/${encodeURIComponent(cleanSlug)}`;
      }
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      unsubDomains();
      window.removeEventListener('hashchange', handleHash);
      document.removeEventListener('click', handleGlobalClick, true);
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, []);

  const handleRandomArticle = async () => {
    try {
      const article = await api.getRandomArticle(activeArticleSlug);
      if (article && article.slug) {
        handleNavigateArticle(article.slug);
      } else {
        handleNavigateArticle('MediaWiki');
      }
    } catch (err) {
      console.warn('Erro ao sortear artigo aleatório:', err);
      handleNavigateArticle('MediaWiki');
    }
  };

  const handleNavigateArticle = (slug: string) => {
    if (slug.startsWith('Special:') || slug.startsWith('Especial:')) {
      const colonIdx = slug.indexOf(':');
      const spName = colonIdx >= 0 ? slug.substring(colonIdx + 1) : 'SpecialPages';
      const normalized = spName.toLowerCase().replace(/_/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (['random', 'paginaaleatoria', 'aleatoria', 'aleatorio'].includes(normalized)) {
        handleRandomArticle();
        return;
      }
      if (['burocratas', 'bureaucrats', 'burocrata'].includes(normalized)) {
        setCurrentView('bureaucrats');
        window.location.hash = '#/burocratas';
        return;
      }
      setSpecialPageName(spName);
      setCurrentView('special');
      window.location.hash = `#/special/${encodeURIComponent(spName)}`;
      return;
    }
    setActiveArticleSlug(slug);
    setCurrentView('reader');
    setReadingProgress(0);
    window.location.hash = `#/wiki/${encodeURIComponent(slug)}`;
  };

  const handleOpenEdit = (slug: string) => {
    setActiveArticleSlug(slug);
    setCurrentView('editor');
    window.location.hash = `#/edit/${encodeURIComponent(slug)}`;
  };

  const handleOpenHistory = (slug: string) => {
    setActiveArticleSlug(slug);
    setCurrentView('history');
    window.location.hash = `#/history/${encodeURIComponent(slug)}`;
  };

  const handleOpenSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentView('search');
    window.location.hash = `#/search?q=${encodeURIComponent(query)}`;
  };

  if (isIframeBlocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-rose-800/60 rounded-xl p-6 text-center space-y-4 shadow-xl">
          <div className="text-xs font-mono uppercase tracking-wider text-rose-400">
            Proteção Anti-Clickjacking (X-Frame-Options: DENY)
          </div>
          <h1 className="text-xl font-serif font-bold text-white">
            Exibição em iframe não permitida
          </h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            Por motivos de segurança, o <strong>{siteTitleConfig.siteTitle}</strong> não permite ser incorporado ou exibido dentro de iframes de terceiros.
          </p>
          <a
            href={typeof window !== 'undefined' ? window.location.href : PRIMARY_CANONICAL_ORIGIN}
            target="_top"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Abrir {siteTitleConfig.siteTitle} diretamente
          </a>
        </div>
      </div>
    );
  }

  const isBureaucratUser =
    hasBureaucratPrivileges(currentUser, auth.currentUser?.email) &&
    Boolean(auth.currentUser || currentUser?.role === 'bureaucrat' || currentUser?.role === 'sysop');

  const signedInEmail = auth.currentUser?.email || currentUser?.email || null;
  const isExtensionsStartupBlocked =
    !isBureaucratUser && (!hasLoadedFromFirebase || Boolean(extensionsLoadError));

  if (isExtensionsStartupBlocked) {
    const gateMode: 'loading' | 'failed' =
      isLoadingExtensions && !hasAttemptedInitialLoad && !extensionsLoadError ? 'loading' : 'failed';
    return (
      <ExtensionsLoadFailureScreen
        mode={gateMode}
        errorMessage={extensionsLoadError}
        googleUserEmail={signedInEmail}
        isNonBureaucratSignedIn={Boolean(signedInEmail && !isBureaucratUser)}
        siteTitle={siteTitleConfig.siteTitle}
        onRetryLoad={async () => {
          await retryLoadExtensions();
        }}
      />
    );
  }

  const handleDisableMaintenance = async () => {
    const ext = extensions.find(e => e.id === 'ext-maintenance-mode');
    if (!ext) return;
    await saveExtension({
      ...ext,
      config: ext.config.map(c =>
        c.key === '$wgMaintenanceModeActive' ? { ...c, value: false } : c
      ),
    });
  };

  if (maintenanceConfig.isMaintenanceActive && !isBureaucratUser) {
    return (
      <MaintenanceScreen
        currentUser={currentUser}
        googleUserEmail={signedInEmail}
        isBureaucrat={isBureaucratUser}
        onBypassToAdmin={() => {
          setCurrentView('bureaucrats');
          window.location.hash = '#/burocratas';
        }}
        onDisableMaintenance={handleDisableMaintenance}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Bureaucrat override banner when startup extension loading from Firebase failed */}
      {extensionsLoadError && isBureaucratUser && (
        <div
          data-testid="bureaucrat-extensions-error-banner"
          className="bg-rose-700 text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2"
        >
          <span>
            <strong>Falha ao carregar extensões na abertura do Wiki:</strong> {extensionsLoadError} — Acesso liberado exclusivamente pelo login de Burocrata.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                retryLoadExtensions();
              }}
              className="px-2.5 py-1 bg-rose-900 hover:bg-rose-950 text-white rounded font-semibold transition-colors cursor-pointer"
            >
              Tentar Recarregar
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentView('bureaucrats');
                window.location.hash = '#/burocratas';
              }}
              className="px-2.5 py-1 bg-white text-rose-800 rounded font-semibold hover:bg-rose-50 transition-colors cursor-pointer"
            >
              Página dos Burocratas
            </button>
          </div>
        </div>
      )}

      {/* Bureaucrat indicator when maintenance mode is active */}
      {maintenanceConfig.isMaintenanceActive && isBureaucratUser && (
        <div className="bg-amber-600 text-white px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong>Modo de Manutenção Ativo:</strong> Visitantes gerais estão bloqueados conforme configuração do Firebase. Você possui acesso livre como Burocrata.
          </span>
          <button
            type="button"
            onClick={() => {
              setCurrentView('bureaucrats');
              window.location.hash = '#/burocratas';
            }}
            className="px-2.5 py-0.5 bg-white text-amber-800 rounded font-semibold hover:bg-amber-50 transition-colors cursor-pointer"
          >
            Gerenciar Extensão na Página dos Burocratas
          </button>
        </div>
      )}

      {/* Global Header */}
      {!(isZenMode && currentView === 'reader') && (
        <Header
          currentView={currentView}
          onSelectView={view => {
            setCurrentView(view);
            if (view === 'home') {
              window.location.hash = '#/home';
            } else if (view === 'reader') {
              window.location.hash = `#/wiki/${encodeURIComponent(activeArticleSlug)}`;
            } else if (view === 'special') {
              setSpecialPageName('SpecialPages');
              window.location.hash = '#/special/SpecialPages';
            } else if (view === 'directory') {
              window.location.hash = '#/usuarios';
            } else if (view === 'bureaucrats') {
              window.location.hash = '#/burocratas';
            } else if (view === 'promo_video') {
              window.location.hash = '#/video-comercial';
            } else if (view === 'dev_admin') {
              window.location.hash = `#/admin`;
            }
          }}
          currentUser={currentUser}
          onUserChanged={setCurrentUser}
          onNavigateArticle={handleNavigateArticle}
          onOpenSearch={handleOpenSearch}
          onOpenNewArticle={() => setIsNewArticleModalOpen(true)}
          activeArticleSlug={activeArticleSlug}
          readingProgress={readingProgress}
          onOpenChat={() => setIsChatOpen(true)}
          onOpenDirectory={() => {
            setCurrentView('directory');
            window.location.hash = '#/usuarios';
          }}
          onOpenMyUserPage={() => {
            if (currentUser) {
              setSelectedUserForPage(currentUser);
              setCurrentView('user_page');
              window.location.hash = '#/minha-pagina';
            }
          }}
          onOpenChecklist={() => setIsChecklistOpen(true)}
          onRandomArticle={handleRandomArticle}
        />
      )}

      {/* Floating Google Quick Login Popup (Top Right Corner) */}
      {!(isZenMode && currentView === 'reader') && (
        <GoogleOneTapPopup
          currentUser={currentUser}
          onUserChanged={setCurrentUser}
        />
      )}

      {/* Main View Container */}
      <main className="flex-1">
        {currentView === 'home' && (
          <HomeScreen
            currentUser={currentUser}
            onNavigateArticle={handleNavigateArticle}
            onEditArticle={handleOpenEdit}
            onOpenNewArticle={() => setIsNewArticleModalOpen(true)}
            onRandomArticle={handleRandomArticle}
          />
        )}

        {currentView === 'reader' && (
          <ErrorBoundary
            fallbackTitle="Erro ao renderizar o artigo"
            onReset={() => {
              setCurrentView('home');
              window.location.hash = '#/home';
            }}
          >
            <WikiReader
              key={activeArticleSlug}
              slug={activeArticleSlug}
              currentUser={currentUser}
              onNavigate={handleNavigateArticle}
              onEdit={handleOpenEdit}
              onHistory={handleOpenHistory}
              onNewArticle={() => setIsNewArticleModalOpen(true)}
              onProgressChange={setReadingProgress}
              onOpenChecklist={() => setIsChecklistOpen(true)}
              onRandomArticle={handleRandomArticle}
              onSearch={handleOpenSearch}
              isZenMode={isZenMode}
              onZenModeChange={setIsZenMode}
            />
          </ErrorBoundary>
        )}

        {currentView === 'directory' && (
          <UserDirectory
            currentUser={currentUser}
            onOpenUserPage={user => {
              setSelectedUserForPage(user);
              setCurrentView('user_page');
              window.location.hash = `#/usuario/${encodeURIComponent(user.username + (user.userTag || ''))}`;
            }}
            onStartChatWithUser={user => {
              setChatTargetUser(user);
              setIsChatOpen(true);
            }}
          />
        )}

        {currentView === 'user_page' && (
          <UserPageView
            targetUser={selectedUserForPage || currentUser || {
              id: 'mafersao1100',
              username: 'Mafersao',
              userTag: '#1100',
              role: 'bureaucrat',
              editCount: 5,
              avatar: 'MA',
              email: 'mafersao1100@gmail.com',
            }}
            currentUser={currentUser}
            onBack={() => {
              setCurrentView('reader');
              window.location.hash = `#/wiki/${encodeURIComponent(activeArticleSlug)}`;
            }}
            onStartChat={user => {
              setChatTargetUser(user);
              setIsChatOpen(true);
            }}
          />
        )}

        {currentView === 'editor' && (
          <WikiEditor
            slug={activeArticleSlug}
            currentUser={currentUser}
            onSaved={slug => {
              setActiveArticleSlug(slug);
              setCurrentView('reader');
              window.location.hash = `#/wiki/${encodeURIComponent(slug)}`;
            }}
            onCancel={() => {
              setCurrentView('reader');
              window.location.hash = `#/wiki/${encodeURIComponent(activeArticleSlug)}`;
            }}
          />
        )}

        {currentView === 'history' && (
          <ArticleHistory
            slug={activeArticleSlug}
            currentUser={currentUser}
            onNavigateArticle={handleNavigateArticle}
            onBackToReader={() => handleNavigateArticle(activeArticleSlug)}
            onEditArticle={handleOpenEdit}
          />
        )}

        {currentView === 'bureaucrats' && (
          <BureaucratPage
            currentUser={currentUser}
            onUserChanged={setCurrentUser}
            onBackToWiki={() => {
              setCurrentView('home');
              window.location.hash = '#/home';
            }}
            onOpenAdminConsole={tab => {
              if (tab) setAdminSubTab(tab);
              setCurrentView('dev_admin');
              window.location.hash = '#/admin';
            }}
            onOpenUserPage={user => {
              setSelectedUserForPage(user);
              setCurrentView('user_page');
              window.location.hash = `#/usuario/${encodeURIComponent(user.username + (user.userTag || ''))}`;
            }}
            onStartChatWithUser={user => {
              setChatTargetUser(user);
              setIsChatOpen(true);
            }}
          />
        )}

        {currentView === 'portal' && (
          <PortalView
            portalType={activePortal}
            currentUser={currentUser}
            onNavigateHome={() => {
              setCurrentView('home');
              window.location.hash = '#/home';
            }}
            onNavigateArticle={handleNavigateArticle}
            onOpenExtensionsManager={() => {
              setCurrentView('bureaucrats');
              window.location.hash = '#/burocratas';
            }}
          />
        )}

        {currentView === 'dev_admin' && (
          <DevAdminDashboard
            activeArticleSlug={activeArticleSlug}
            currentUser={currentUser}
            onUserChanged={setCurrentUser}
            onNavigateArticle={handleNavigateArticle}
            onBackToReader={() => {
              setCurrentView('reader');
              window.location.hash = `#/wiki/${encodeURIComponent(activeArticleSlug)}`;
            }}
            initialTab={adminSubTab}
          />
        )}

        {currentView === 'special' && (
          <SpecialPagesHub
            initialSpecialPage={specialPageName}
            currentUser={currentUser}
            onNavigateArticle={handleNavigateArticle}
            onOpenEdit={handleOpenEdit}
            onOpenHistory={handleOpenHistory}
            onRandomArticle={handleRandomArticle}
          />
        )}

        {currentView === 'search' && (
          <SearchResults
            initialQuery={searchQuery}
            onNavigateArticle={handleNavigateArticle}
            onRandomArticle={handleRandomArticle}
          />
        )}

        {currentView === 'promo_video' && (
          <PromoVideoStudio
            onBack={() => {
              setCurrentView('home');
              window.location.hash = '#/home';
            }}
          />
        )}
      </main>

      {/* Global WikiZero / NotMediaWiki Footer with 88x31 Buttons & Display Mode Controls */}
      {!(isZenMode && currentView === 'reader') && (
        <WikiFooter
          onNavigateHome={() => {
            setCurrentView('home');
            window.location.hash = '#/home';
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateLgpd={() => handleNavigateArticle(LGPD_INVESTIGATION_SLUG)}
        />
      )}

      {/* Modal to add new article */}
      <NewArticleModal
        isOpen={isNewArticleModalOpen}
        onClose={() => setIsNewArticleModalOpen(false)}
        onCreate={(slug, _title, initialWikitext, _namespace) => {
          setActiveArticleSlug(slug);
          setCurrentView('editor');
          window.location.hash = `#/edit/${encodeURIComponent(slug)}`;
        }}
      />

      {/* 3.05.3.af & 3.05.8.b - Daily Checklist & Monthly Points Modal */}
      <DailyChecklistModal
        isOpen={isChecklistOpen}
        onClose={() => setIsChecklistOpen(false)}
        currentUser={currentUser}
        onUserChanged={setCurrentUser}
        onNavigateToArticle={handleNavigateArticle}
        onNavigateToEditor={slug => handleOpenEdit(slug || 'MediaWiki')}
      />

      {/* Real-time Chat Drawer */}
      <ChatDrawer
        currentUser={currentUser}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        targetUserForNewChat={chatTargetUser}
        onClearTargetUser={() => setChatTargetUser(null)}
      />

      {/* Google One Tap / Quick Sign-in popup at top-right */}
      {!(isZenMode && currentView === 'reader') && (
        <GoogleOneTapPopup
          currentUser={currentUser}
          onUserChanged={setCurrentUser}
        />
      )}

      {/* Offline connectivity indicator */}
      <OfflineIndicator />

      {/* Floating Chat Trigger Button */}
      {!isChatOpen && !(isZenMode && currentView === 'reader') && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-5 right-5 z-40 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-105"
          title="Abrir Chat em Tempo Real"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="text-xs font-bold hidden sm:inline">Chat Comunitário</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}
      {/* Startup Extension Config Loading Indicator (non-blocking tiny badge if still syncing initially) */}
      {isLoadingExtensions && (
        <span className="sr-only" role="status">
          Carregando configurações de extensões do Firebase...
        </span>
      )}
    </div>
  );
};
