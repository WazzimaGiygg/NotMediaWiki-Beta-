import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Globe,
  Shield,
  User,
  ChevronDown,
  Check,
  Zap,
  Radio,
  Plus,
  LogIn,
  LogOut,
  ExternalLink,
  Sun,
  Moon,
  BookOpen,
  MessageSquare,
  Users,
  ShieldAlert,
  ShieldCheck,
  Hash,
  Wifi,
  AlertTriangle,
  X,
  Award,
} from 'lucide-react';
import { UserSession, VpnDetectionLog } from '../types';
import { api } from '../api';
import {
  loginWithGoogle,
  logoutGoogle,
  auth,
  fetchUsersFromFirestore,
  recordDailyChecklistAction,
  subscribeToMonthlyPoints,
  getCurrentMonthString,
} from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { wrapExternalUrl } from '../utils/urlHelper';
import { performVpnAudit } from '../utils/vpnDetector';

interface HeaderProps {
  currentView: string;
  onSelectView: (view: string) => void;
  currentUser: UserSession | null;
  onUserChanged: (user: UserSession) => void;
  onNavigateArticle: (slug: string) => void;
  onOpenSearch: (query: string) => void;
  onOpenNewArticle: () => void;
  activeArticleSlug: string;
  readingProgress?: number;
  onOpenChat?: () => void;
  onOpenDirectory?: () => void;
  onOpenMyUserPage?: () => void;
  onOpenChecklist?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onSelectView,
  currentUser,
  onUserChanged,
  onNavigateArticle,
  onOpenSearch,
  onOpenNewArticle,
  activeArticleSlug,
  readingProgress,
  onOpenChat,
  onOpenDirectory,
  onOpenMyUserPage,
  onOpenChecklist,
}) => {
  const [internalProgress, setInternalProgress] = useState<number>(0);
  const activeProgress = readingProgress !== undefined ? readingProgress : internalProgress;
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ title: string; slug: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [monthlyPoints, setMonthlyPoints] = useState<number>(0);
  const searchRef = useRef<HTMLDivElement>(null);

  // Subscribe to user monthly points for live counter in header
  useEffect(() => {
    if (!currentUser) return;
    const monthStr = getCurrentMonthString();
    const unsub = subscribeToMonthlyPoints(currentUser.id, ledger => {
      if (ledger) setMonthlyPoints(ledger.totalMonthlyPoints);
    }, monthStr);
    return () => unsub();
  }, [currentUser]);

  // Persistent Dark Mode state using localStorage and system preference
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('theme') || localStorage.getItem('notmediawiki_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('notmediawiki_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      localStorage.setItem('notmediawiki_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  useEffect(() => {
    // Listen to Firebase auth state
    const unsubscribe = onAuthStateChanged(auth, async fbUser => {
      if (fbUser) {
        setGoogleUserEmail(fbUser.email);
        try {
          const cloudUsers = await fetchUsersFromFirestore();
          const match = cloudUsers.find(u => u.id === fbUser.uid || u.email === fbUser.email);
          if (match) {
            const serverUser = await api.upsertUser(match);
            if (!currentUser || currentUser.id !== match.id) {
              await api.switchUser(match.id).catch(console.warn);
              onUserChanged(serverUser);
            }
          }
        } catch (e) {
          console.warn('Silent Google auth sync notice:', e);
        }
      } else {
        setGoogleUserEmail(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      api.suggest(searchQuery)
        .then(res => setSuggestions(res))
        .catch(() => setSuggestions([]));
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Track article content scroll progress directly in the Header
  useEffect(() => {
    if (currentView !== 'reader') {
      setInternalProgress(0);
      return;
    }

    const calculateProgress = () => {
      const articleEl = (document.getElementById('wiki-article-container') ||
        document.querySelector('article.wiki-content') ||
        document.querySelector('main')) as HTMLElement | null;

      if (!articleEl) {
        return;
      }

      const rect = articleEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const headerEl = document.querySelector('header');
      const headerHeight = headerEl ? headerEl.offsetHeight : 95;

      const totalDistance = rect.height - viewportHeight + headerHeight;

      if (totalDistance <= 0) {
        setInternalProgress(100);
        return;
      }

      const scrolled = headerHeight - rect.top;

      if (scrolled <= 0) {
        setInternalProgress(0);
      } else if (scrolled >= totalDistance) {
        setInternalProgress(100);
      } else {
        const pct = Math.min(100, Math.max(0, Math.round((scrolled / totalDistance) * 100)));
        setInternalProgress(pct);
      }
    };

    calculateProgress();
    window.addEventListener('scroll', calculateProgress, { passive: true });
    window.addEventListener('resize', calculateProgress, { passive: true });

    return () => {
      window.removeEventListener('scroll', calculateProgress);
      window.removeEventListener('resize', calculateProgress);
    };
  }, [currentView, activeArticleSlug]);

  const [vpnStatus, setVpnStatus] = useState<VpnDetectionLog | null>(null);
  const [showVpnBanner, setShowVpnBanner] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [isTestingVpn, setIsTestingVpn] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Run VPN verification audit on initial load for the logged-in session
  useEffect(() => {
    if (currentUser) {
      performVpnAudit(currentUser)
        .then(res => {
          setVpnStatus(res);
          if (res.isVpn || res.riskScore >= 40) {
            setShowVpnBanner(true);
          }
        })
        .catch(console.warn);
    }
  }, [currentUser?.id]);

  const runVpnCheck = async () => {
    setIsTestingVpn(true);
    try {
      const res = await performVpnAudit(currentUser);
      setVpnStatus(res);
      if (res.isVpn || res.riskScore >= 40) {
        setShowVpnBanner(true);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setIsTestingVpn(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setShowSuggestions(false);
    const exact = suggestions.find(s => s.title.toLowerCase() === searchQuery.toLowerCase());
    if (exact) {
      onNavigateArticle(exact.slug);
    } else {
      onOpenSearch(searchQuery);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const user = await loginWithGoogle();
      const serverUser = await api.upsertUser(user);
      await api.switchUser(serverUser.id).catch(console.warn);
      onUserChanged(serverUser);

      // 3.05.8.b.a: Conceder 1 ponto por login no Wiki-Site
      recordDailyChecklistAction(serverUser.id, serverUser.username, 'login')
        .then(res => {
          setMonthlyPoints(res.newMonthlyTotal);
        })
        .catch(console.warn);

      // Verificador de VPN no login
      performVpnAudit(serverUser)
        .then(vpnRes => {
          setVpnStatus(vpnRes);
          if (vpnRes.isVpn || vpnRes.riskScore >= 40) {
            setShowVpnBanner(true);
          }
        })
        .catch(console.warn);
    } catch (err) {
      console.error('Google Sign-in failed:', err);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logoutGoogle();
      const defaultUser = await api.getCurrentUser();
      onUserChanged(defaultUser);
    } catch (err) {
      console.error('Google Logout failed:', err);
    }
  };

  const navItems = [
    { id: 'home', label: 'Página Inicial (Início)' },
    { id: 'reader', label: 'Artigos (Reader)' },
    { id: 'directory', label: 'Diretório de Usuários' },
    { id: 'editor', label: 'Wikitext Editor' },
    { id: 'dev_admin', label: 'Desenvolvedor e Administrador' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
      {/* VPN & Proxy Security Notification on Login */}
      {showVpnBanner && vpnStatus && (
        <div className="bg-rose-600 text-white px-4 py-2 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 max-w-5xl">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-200" />
            <span>
              <strong>Aviso de Auditoria de Conexão:</strong> VPN ou Proxy detectado no login (IP: {vpnStatus.ip} • ISP: {vpnStatus.isp || vpnStatus.asn} • Risco: {vpnStatus.riskScore}%). Conexões residenciais diretas são recomendadas para salvaguardar a integridade do histórico.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onSelectView('dev_admin')}
              className="px-2 py-0.5 bg-rose-700 hover:bg-rose-800 text-white rounded text-[11px] font-medium underline cursor-pointer"
            >
              Ver na Administração
            </button>
            <button
              onClick={() => setShowVpnBanner(false)}
              className="p-1 hover:bg-rose-700 rounded text-rose-200 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Top Identity & Global Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onSelectView('home')}
              className="flex items-center gap-2.5 text-left group cursor-pointer"
              title="NotMediaWiki - Ir para a Página Inicial"
            >
              <div className="w-8 h-8 rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-serif font-black text-xl text-slate-800 dark:text-slate-100 group-hover:border-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors shadow-2xs">
                N
              </div>
              <div>
                <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  NotMediaWiki
                  <span className="text-[10px] font-mono font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-200 dark:border-purple-800">
                    WazzimaGiygg
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-sans hidden sm:flex items-center gap-1">
                  <span>Projetos WazzimaGiygg</span>
                  <span>•</span>
                  <a
                    href={wrapExternalUrl("https://wazzimagiygg.com")}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                    title="Visitar wazzimagiygg.com"
                  >
                    wazzimagiygg.com
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Global Instant Search Bar */}
        <div ref={searchRef} className="relative flex-1 max-w-md">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Pesquisar no NotMediaWiki..."
              className="w-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-750 focus:bg-white dark:focus:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 pl-9 pr-4 py-1.5 rounded border border-slate-200 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 font-sans"
            />
          </form>

          {/* Autocomplete Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded shadow-lg py-1.5 z-50">
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                CirrusSearch Prefix Suggestions
              </div>
              {suggestions.map(s => (
                <button
                  key={s.slug}
                  onClick={() => {
                    onNavigateArticle(s.slug);
                    setSearchQuery('');
                    setShowSuggestions(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-slate-800 dark:text-slate-200 hover:bg-blue-50/70 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-blue-400 flex items-center justify-between group transition-colors"
                >
                  <span className="font-medium">{s.title}</span>
                  <span className="text-xs text-slate-400 font-mono group-hover:text-blue-500">
                    /wiki/{s.slug}
                  </span>
                </button>
              ))}
              <button
                onClick={() => {
                  onOpenSearch(searchQuery);
                  setShowSuggestions(false);
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800"
              >
                Search all pages containing &ldquo;{searchQuery}&rdquo; →
              </button>
            </div>
          )}
        </div>

        {/* Action Controls: New Page & Authentication */}
        <div className="flex items-center gap-2 shrink-0">
          {/* + Nova Página Button */}
          <button
            onClick={onOpenNewArticle}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
            title="Criar novo artigo enciclopédico"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nova Página</span>
          </button>

          {/* Global Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-2xs"
            title={isDarkMode ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            aria-label={isDarkMode ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            )}
          </button>

          {/* Google Sign-in / Connected State */}
          {googleUserEmail ? (
            <div className="flex items-center gap-1.5">
              <div className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 hidden md:flex">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="truncate max-w-32">{googleUserEmail}</span>
              </div>
              <button
                onClick={handleGoogleLogout}
                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-xs transition-colors cursor-pointer"
                title="Desconectar do Google"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50 whitespace-nowrap"
              title="Autenticar via Google Firebase"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                />
              </svg>
              <span className="hidden sm:inline">{isGoogleLoading ? 'Entrando...' : 'Login Google'}</span>
            </button>
          )}

          {/* 3.05.3.af & 3.05.8.b - Checklist Diário & Pontos Mensais Trigger Button */}
          <button
            onClick={onOpenChecklist}
            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
            title="Abrir Checklist Diário e Pontos Mensais (3.05.3.af / 3.05.8.b)"
          >
            <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">Checklist</span>
            <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200">
              ⭐ {monthlyPoints.toFixed(1)}
            </span>
          </button>

          {/* Real-time Chat Trigger Button */}
          <button
            onClick={onOpenChat}
            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
            title="Abrir Chat em Tempo Real com outros usuários"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Chat</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </button>

          {/* Current User Profile Badge with Dropdown */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setIsUserMenuOpen(prev => !prev)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs text-slate-800 dark:text-slate-200 transition-colors cursor-pointer shadow-2xs"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold text-[10px] flex items-center justify-center shadow-xs">
                {currentUser?.avatar || 'U'}
              </div>
              <div className="text-left hidden lg:block">
                <div className="font-semibold text-slate-900 dark:text-slate-100 leading-tight flex items-center gap-1">
                  <span>{currentUser?.username || 'User'}</span>
                  {currentUser?.userTag && (
                    <span className="font-mono text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                      {currentUser.userTag}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 leading-tight capitalize">
                  {currentUser?.role || 'editor'}
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* User Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl py-2 z-50 text-xs animate-fade-in space-y-1">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {currentUser?.username}
                    </span>
                    <span className="font-mono font-bold text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 px-1.5 py-0.2 rounded">
                      {currentUser?.userTag || '#1100'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {currentUser?.email || 'Usuário Autenticado'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Papel: <strong className="text-slate-700 dark:text-slate-300 capitalize">{currentUser?.role}</strong>
                  </div>
                </div>

                <div className="px-1 py-1 space-y-0.5">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenMyUserPage?.();
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Minha Página Pessoal</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenDirectory?.();
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Users className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Diretório Público de Usuários</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenChat?.();
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Chat Comunitário em Tempo Real</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenChecklist?.();
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    <span>Checklist Diário & Pontos (3.05.8.b)</span>
                  </button>
                </div>

                {/* Network / VPN Verification Status */}
                <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/60 text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Auditoria de VPN / Rede:</span>
                    <button
                      onClick={runVpnCheck}
                      disabled={isTestingVpn}
                      className="text-[10px] text-indigo-600 hover:underline cursor-pointer disabled:opacity-50"
                    >
                      {isTestingVpn ? 'Auditando...' : 'Reavaliar'}
                    </button>
                  </div>

                  {vpnStatus ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {vpnStatus.isVpn ? (
                          <span className="text-rose-600 font-bold flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" /> VPN/Proxy Detectado ({vpnStatus.riskScore}%)
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Conexão Residencial Limpa
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        IP: {vpnStatus.ip} • {vpnStatus.country || 'BR'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 text-[10px]">Clique em Reavaliar para checar IP e proxy.</div>
                  )}
                </div>

                {googleUserEmail && (
                  <div className="px-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        handleGoogleLogout();
                      }}
                      className="w-full text-left px-3 py-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Desconectar Conta Google</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Primary Navigation Bar (Segmented Controls) */}
      <div className="bg-slate-50/80 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar py-1">
          <nav className="flex items-center gap-1">
            {navItems.map(item => {
              const isActive = currentView === item.id || (item.id === 'reader' && currentView === 'history');
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectView(item.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Quick Context & Reading Progress Indicator */}
          {currentView === 'reader' ? (
            <div className="flex items-center gap-2 sm:gap-3 text-xs shrink-0 pl-2">
              <div className="hidden lg:flex items-center gap-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                <span className="text-slate-400 dark:text-slate-500">Artigo:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-44">
                  {activeArticleSlug || 'MediaWiki'}
                </span>
              </div>

              {/* Reading Progress Indicator Badge in Header */}
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium transition-all cursor-pointer ${
                  activeProgress === 100
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs'
                }`}
                title="Progresso de leitura do artigo. Clique para voltar ao topo."
              >
                <BookOpen className={`w-3.5 h-3.5 ${activeProgress === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`} />
                <span className="text-[11px] font-sans hidden sm:inline">Leitura:</span>
                <span className="font-mono font-bold text-[11px]">
                  {activeProgress}%
                </span>
                {activeProgress === 100 ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ml-0.5" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse ml-0.5" />
                )}
              </button>
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
              <span>Article:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-44">
                {activeArticleSlug || 'MediaWiki'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Reading Progress Bar pinned at the bottom edge of the sticky Header */}
      {currentView === 'reader' && (
        <div
          className="w-full h-1 bg-slate-200/50 dark:bg-slate-800/80 relative overflow-hidden"
          role="progressbar"
          aria-valuenow={activeProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Barra de progresso de leitura do artigo"
        >
          <div
            className={`h-full transition-all duration-150 ease-out ${
              activeProgress === 100
                ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                : 'bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 dark:from-blue-500 dark:via-indigo-400 dark:to-purple-500'
            }`}
            style={{ width: `${activeProgress}%` }}
          />
        </div>
      )}
    </header>
  );
};
