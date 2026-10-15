import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HomeScreen } from './components/HomeScreen';
import { WikiReader } from './components/WikiReader';
import { WikiEditor } from './components/WikiEditor';
import { DevAdminDashboard } from './components/DevAdminDashboard';
import { ArticleHistory } from './components/ArticleHistory';
import { SearchResults } from './components/SearchResults';
import { NewArticleModal } from './components/NewArticleModal';
import { UserDirectory } from './components/UserDirectory';
import { UserPageView } from './components/UserPageView';
import { ChatDrawer } from './components/ChatDrawer';
import { DailyChecklistModal } from './components/DailyChecklistModal';
import { MessageSquare } from 'lucide-react';
import { UserSession } from './types';
import { api } from './api';
import { wrapExternalUrl } from './utils/urlHelper';
import { fetchUsersFromFirestore } from './firebase';

export default function App() {
  const [currentView, setCurrentView] = useState<string>('home');
  const [activeArticleSlug, setActiveArticleSlug] = useState<string>('MediaWiki');
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isNewArticleModalOpen, setIsNewArticleModalOpen] = useState(false);
  const [adminSubTab, setAdminSubTab] = useState<string>('users');
  const [readingProgress, setReadingProgress] = useState<number>(0);

  // Real-time Chat & User Pages & Daily Checklist State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [chatTargetUser, setChatTargetUser] = useState<UserSession | null>(null);
  const [selectedUserForPage, setSelectedUserForPage] = useState<UserSession | null>(null);

  // Initial load: current user & check URL hash & sync extensions from Firebase
  useEffect(() => {
    api.getCurrentUser().then(setCurrentUser).catch(console.error);

    // Sincronização de extensões com o Firebase Firestore ao acessar o Wiki
    api.initExtensionsOnWikiAccess().then(exts => {
      console.log(`[Firebase Cloud] ${exts.length} extensões sincronizadas no acesso ao Wiki.`);
    }).catch(err => {
      console.warn('Notice: Extensions Firestore initialization on Wiki access:', err);
    });

    // Assinatura em tempo real para atualizações de extensões feitas por burocratas
    const unsubExtensions = api.subscribeExtensions(cloudExts => {
      if (cloudExts && cloudExts.length > 0) {
        try {
          localStorage.setItem('notmediawiki_extensions', JSON.stringify(cloudExts));
        } catch {}
      }
    });

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
      } else if (hash.startsWith('#/wiki/')) {
        const slug = decodeURIComponent(hash.replace('#/wiki/', ''));
        setActiveArticleSlug(slug);
        setCurrentView('reader');
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
      } else if (hash === '#/data-removal' || hash === '#/remocao-dados') {
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

    return () => {
      unsubExtensions();
      unsubDomains();
      window.removeEventListener('hashchange', handleHash);
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, []);

  const handleNavigateArticle = (slug: string) => {
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
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Global Header */}
      <Header
        currentView={currentView}
        onSelectView={view => {
          setCurrentView(view);
          if (view === 'home') {
            window.location.hash = '#/home';
          } else if (view === 'reader') {
            window.location.hash = `#/wiki/${encodeURIComponent(activeArticleSlug)}`;
          } else if (view === 'directory') {
            window.location.hash = '#/usuarios';
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
      />

      {/* Main View Container */}
      <main className="flex-1">
        {currentView === 'home' && (
          <HomeScreen
            currentUser={currentUser}
            onNavigateArticle={handleNavigateArticle}
            onEditArticle={handleOpenEdit}
            onOpenNewArticle={() => setIsNewArticleModalOpen(true)}
          />
        )}

        {currentView === 'reader' && (
          <WikiReader
            slug={activeArticleSlug}
            currentUser={currentUser}
            onNavigate={handleNavigateArticle}
            onEdit={handleOpenEdit}
            onHistory={handleOpenHistory}
            onNewArticle={() => setIsNewArticleModalOpen(true)}
            onProgressChange={setReadingProgress}
            onOpenChecklist={() => setIsChecklistOpen(true)}
          />
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

        {currentView === 'search' && (
          <SearchResults
            initialQuery={searchQuery}
            onNavigateArticle={handleNavigateArticle}
          />
        )}
      </main>

      {/* Global NotMediaWiki Status Bar & Attribution */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 px-4 sm:px-6 text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 font-sans">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-800 dark:text-slate-200">NotMediaWiki</span>
            <span aria-hidden="true">·</span>
            <span>
              Faz parte do desenvolvimento de projetos <strong className="text-slate-700 dark:text-slate-300">WazzimaGiygg</strong>, do site{' '}
              <a
                href={wrapExternalUrl("https://wazzimagiygg.com")}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                wazzimagiygg.com
              </a>
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400 dark:text-slate-500">
            <span>Parsoid AST</span>
            <span>·</span>
            <span>Firebase Cloud</span>
            <span>·</span>
            <a
              href={wrapExternalUrl("https://wazzimagiygg.com")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 underline"
            >
              wazzimagiygg.com
            </a>
          </div>
        </div>
      </footer>

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

      {/* Floating Chat Trigger Button */}
      {!isChatOpen && (
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
    </div>
  );
}
