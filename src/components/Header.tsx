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
  FileText,
  CornerDownLeft,
  Loader2,
  Shuffle,
  Bell,
  CheckCheck,
  Trash2,
  Star,
  Palette,
  Smartphone,
} from 'lucide-react';
import { UserSession, VpnDetectionLog, ArticleNotification, WatchlistSubscription } from '../types';
import { api } from '../api';
import {
  loginWithGoogle,
  logoutGoogle,
  auth,
  recordDailyChecklistAction,
  subscribeToMonthlyPoints,
  getCurrentMonthString,
} from '../firebase';
import { mergeArticleNotifications, WebPushPermissionStatus } from '../services/notificationService';
import { FcmTopicSubscriptions } from './FcmTopicSubscriptions';
import { onAuthStateChanged } from 'firebase/auth';
import { wrapExternalUrl } from '../utils/urlHelper';
import { performVpnAudit } from '../utils/vpnDetector';
import { useExtensions } from '../context/ExtensionsContext';

interface HeaderProps {
  currentView: string;
  onSelectView: (view: string) => void;
  currentUser: UserSession | null;
  onUserChanged: (user: UserSession | null) => void;
  onNavigateArticle: (slug: string) => void;
  onOpenSearch: (query: string) => void;
  onOpenNewArticle: () => void;
  activeArticleSlug: string;
  activeSpecialPage?: string;
  readingProgress?: number;
  onOpenChat?: () => void;
  onOpenDirectory?: () => void;
  onOpenMyUserPage?: () => void;
  onOpenChecklist?: () => void;
  onRandomArticle?: () => void;
  onOpenAppOptions?: () => void;
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
  activeSpecialPage,
  readingProgress,
  onOpenChat,
  onOpenDirectory,
  onOpenMyUserPage,
  onOpenChecklist,
  onRandomArticle,
  onOpenAppOptions,
}) => {
  const [internalProgress, setInternalProgress] = useState<number>(0);
  const activeProgress = readingProgress !== undefined ? readingProgress : internalProgress;
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ title: string; slug: string; snippet?: string; namespace?: number; categories?: string[]; score?: number }>>([]);
  const [isLoadingRandom, setIsLoadingRandom] = useState(false);

  const handleRandomClick = async () => {
    if (onRandomArticle) {
      onRandomArticle();
      return;
    }
    setIsLoadingRandom(true);
    try {
      const random = await api.getRandomArticle(activeArticleSlug);
      if (random && random.slug) {
        onNavigateArticle(random.slug);
      }
    } catch (e) {
      console.warn('Erro ao carregar artigo aleatório:', e);
    } finally {
      setIsLoadingRandom(false);
    }
  };
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [monthlyPoints, setMonthlyPoints] = useState<number>(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    isExtensionEnabled,
    supportTicketsConfig,
    siteTitleConfig,
    themeAppearanceConfig,
    activeTheme,
    setUserTheme,
    openThemeSelector,
  } = useExtensions();
  const isChecklistExtEnabled = isExtensionEnabled ? isExtensionEnabled('DailyChecklist', true) : true;
  const isCirrusEnabled = isExtensionEnabled ? isExtensionEnabled('CirrusSearch', true) : true;
  const isEchoEnabled = isExtensionEnabled ? isExtensionEnabled('Echo', true) : true;
  const isKarmaEnabled = isExtensionEnabled ? isExtensionEnabled('ArticleRatingAndKarma', true) : true;
  const isChatEnabled = isExtensionEnabled ? isExtensionEnabled('CommunityChat', true) : true;
  const isDirectoryEnabled = isExtensionEnabled ? isExtensionEnabled('UserDirectoryProfiles', true) : true;
  const isSpecialPagesEnabled = isExtensionEnabled ? isExtensionEnabled('SpecialPagesHub', true) : true;
  const isRecentChangesEnabled = isExtensionEnabled ? isExtensionEnabled('EventStreams', true) : true;
  const isPromoStudioEnabled = isExtensionEnabled ? isExtensionEnabled('PromoVideoStudio', true) : true;
  const isPwaEnabled = isExtensionEnabled ? isExtensionEnabled('PwaMobileDesktopApp', true) : true;
  const isRandomEnabled = isExtensionEnabled ? isExtensionEnabled('RandomArticle', true) : true;
  const isFocusModeEnabled = isExtensionEnabled ? isExtensionEnabled('FocusReadingMode', true) : true;
  const isGovernanceEnabled = isExtensionEnabled ? isExtensionEnabled('GovernanceAndCompliance', true) : true;
  const isThemeAppearanceEnabled = isExtensionEnabled ? isExtensionEnabled('ThemeAppearance', true) : true;

  // Real-time Push & Watchlist Notifications (Firestore onSnapshot listeners + Web Push API)
  const [notifications, setNotifications] = useState<ArticleNotification[]>([]);
  const [watchedArticles, setWatchedArticles] = useState<WatchlistSubscription[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifTab, setNotifTab] = useState<'alerts' | 'topics'>('alerts');
  const [liveAlert, setLiveAlert] = useState<ArticleNotification | null>(null);
  const [pushFeedback, setPushFeedback] = useState<{ type: 'success' | 'warning'; text: string } | null>(null);
  const [webPushPermission, setWebPushPermission] = useState<WebPushPermissionStatus>(() => api.getWebPushPermissionState());
  const [isActivatingPush, setIsActivatingPush] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const initialLoadRef = useRef(true);
  const seenNotifKeysRef = useRef<Set<string>>(new Set());
  const liveAlertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getNotificationKey = (n: ArticleNotification) =>
    n.revisionId ? `${n.articleSlug}::${n.revisionId}` : n.id;

  const triggerLiveAlert = (newest: ArticleNotification) => {
    setLiveAlert(newest);
    if (liveAlertTimerRef.current) {
      clearTimeout(liveAlertTimerRef.current);
    }
    liveAlertTimerRef.current = setTimeout(() => {
      setLiveAlert(null);
    }, 12000);

    api.playNotificationChime();
    api
      .showBrowserPushNotification({
        title: `${siteTitleConfig.siteTitle}: ${newest.articleTitle} foi editado`,
        body: `${newest.editorName}: ${newest.changeSummary}`,
        articleSlug: newest.articleSlug,
        tag: `article-${newest.articleSlug}-${newest.id}`,
      })
      .catch(() => {});
  };

  const handleActivateWebPush = async () => {
    if (!currentUser?.id || isActivatingPush) return;
    setIsActivatingPush(true);
    try {
      const result = await api.requestWebPushPermission(currentUser.id);
      setWebPushPermission(result.permission);
      setPushFeedback({
        type: result.permission === 'granted' ? 'success' : 'warning',
        text: result.message,
      });
    } finally {
      setIsActivatingPush(false);
    }
  };

  useEffect(() => {
    if (!currentUser?.id || !isEchoEnabled) {
      setNotifications([]);
      setWatchedArticles([]);
      setLiveAlert(null);
      initialLoadRef.current = true;
      seenNotifKeysRef.current.clear();
      return;
    }

    initialLoadRef.current = true;
    seenNotifKeysRef.current.clear();

    const perm = api.getWebPushPermissionState();
    setWebPushPermission(perm);
    if (perm === 'granted') {
      api.syncExistingFcmRegistration(currentUser.id).catch(() => {});
    }

    // 1. Real-time Firestore listener on user's persisted notifications
    const unsubNotifs = api.subscribeUserNotifications(currentUser.id, list => {
      if (initialLoadRef.current) {
        list.forEach(n => seenNotifKeysRef.current.add(getNotificationKey(n)));
        initialLoadRef.current = false;
        setNotifications(prev => mergeArticleNotifications(list, prev));
        return;
      }

      const newest = list.find(n => !n.isRead && !seenNotifKeysRef.current.has(getNotificationKey(n)));
      list.forEach(n => seenNotifKeysRef.current.add(getNotificationKey(n)));

      if (newest) {
        triggerLiveAlert(newest);
      }

      setNotifications(list);
    });

    // 2. Real-time Firestore listeners directly on followed articles (watchlist_subscriptions + articles/{slug})
    const unsubFollowed = api.subscribeFollowedArticlesEdits(
      currentUser.id,
      liveNotif => {
        const key = getNotificationKey(liveNotif);
        if (seenNotifKeysRef.current.has(key)) return;
        seenNotifKeysRef.current.add(key);

        setNotifications(prev => mergeArticleNotifications(prev, [liveNotif]));
        triggerLiveAlert(liveNotif);
      },
      watchlist => {
        setWatchedArticles(watchlist);
      }
    );

    return () => {
      unsubNotifs();
      unsubFollowed();
      if (liveAlertTimerRef.current) {
        clearTimeout(liveAlertTimerRef.current);
      }
    };
  }, [currentUser?.id, isEchoEnabled]);

  const handleMarkAsRead = (notificationId: string) => {
    setNotifications(prev => prev.map(n => (n.id === notificationId ? { ...n, isRead: true } : n)));
    api.markNotificationAsRead(notificationId);
  };

  const handleMarkAllAsRead = () => {
    if (!currentUser?.id) return;
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    api.markAllNotificationsAsRead(currentUser.id);
  };

  const handleDeleteNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    if (liveAlert?.id === notificationId) {
      setLiveAlert(null);
    }
    api.deleteNotification(notificationId);
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const unreadNotifCount = notifications.filter(n => !n.isRead).length;

  // Subscribe to user monthly points for live counter in header
  useEffect(() => {
    if (!currentUser) return;
    const monthStr = getCurrentMonthString();
    const unsub = subscribeToMonthlyPoints(currentUser.id, ledger => {
      if (ledger) setMonthlyPoints(ledger.totalMonthlyPoints);
    }, monthStr);
    return () => unsub();
  }, [currentUser]);

  // Sync Light/Dark quick toggle with ThemeAppearance extension & activeTheme
  const isDarkMode = activeTheme.colorScheme === 'dark';

  const toggleDarkMode = () => {
    setUserTheme(isDarkMode ? 'vector-light' : 'vector-dark');
  };

  useEffect(() => {
    // Keep track of signed-in Google email for Header admin UI affordances
    const unsubscribe = onAuthStateChanged(auth, fbUser => {
      setGoogleUserEmail(fbUser?.email || null);
    });

    return () => unsubscribe();
  }, []);

  // Global keyboard shortcut: Ctrl+K / Cmd+K or / to focus search
  useEffect(() => {
    if (!isCirrusEnabled) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setShowSuggestions(true);
      }
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        !(document.activeElement as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        setShowSuggestions(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isCirrusEnabled]);

  useEffect(() => {
    if (!isCirrusEnabled || !searchQuery.trim()) {
      setSuggestions([]);
      setIsSearching(false);
      setSelectedIndex(-1);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      api.suggest(searchQuery)
        .then(res => {
          setSuggestions(res);
          setSelectedIndex(-1);
        })
        .catch(() => {
          setSuggestions([]);
          setSelectedIndex(-1);
        })
        .finally(() => {
          setIsSearching(false);
        });
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery, isCirrusEnabled]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
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
    if (!isGovernanceEnabled) {
      setShowVpnBanner(false);
      return;
    }
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
  }, [currentUser?.id, isGovernanceEnabled]);

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

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/70 px-0.5 rounded">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const getNamespaceBadge = (ns?: number) => {
    switch (ns) {
      case 0:
        return 'Artigo';
      case 1:
        return 'Discussão';
      case 2:
        return 'Usuário';
      case 4:
        return 'Projeto';
      case 6:
        return 'Ficheiro';
      case 10:
        return 'Predefinição';
      case 14:
        return 'Categoria';
      default:
        return 'Página';
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setShowSuggestions(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        const chosen = suggestions[selectedIndex];
        onNavigateArticle(chosen.slug);
        setSearchQuery('');
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowSuggestions(false);
      setSelectedIndex(-1);
      inputRef.current?.blur();
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setShowSuggestions(false);
    if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
      onNavigateArticle(suggestions[selectedIndex].slug);
      setSearchQuery('');
      setSelectedIndex(-1);
      return;
    }
    const exact = suggestions.find(s => s.title.toLowerCase() === searchQuery.toLowerCase().trim());
    if (exact) {
      onNavigateArticle(exact.slug);
      setSearchQuery('');
    } else {
      onOpenSearch(searchQuery);
    }
    setSelectedIndex(-1);
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

  const isSuperAdminEmail =
    googleUserEmail &&
    ['pedrohenriquecardonaperes@gmail.com', 'pedrohenriquecaronaperes@gmail.com', 'mafersao1100@gmail.com'].includes(
      googleUserEmail.toLowerCase().trim()
    );

  const isAdminOrBureaucrat =
    Boolean(isSuperAdminEmail) ||
    currentUser?.role === 'bureaucrat' ||
    currentUser?.role === 'sysop';

  const navItems = [
    { id: 'home', label: 'Página Inicial (Início)' },
    { id: 'reader', label: 'Artigos (Reader)' },
    ...(isSpecialPagesEnabled && isRecentChangesEnabled
      ? [{ id: 'recent_changes', label: 'Mudanças Recentes' }]
      : []),
    ...(isSpecialPagesEnabled ? [{ id: 'special', label: 'Páginas Especiais' }] : []),
    ...(isDirectoryEnabled ? [{ id: 'directory', label: 'Diretório de Usuários' }] : []),
    { id: 'bureaucrats', label: 'Burocratas' },
    { id: 'editor', label: 'Wikitext Editor' },
    ...(isPromoStudioEnabled ? [{ id: 'promo_video', label: 'Vídeo Comercial' }] : []),
    ...(isAdminOrBureaucrat ? [{ id: 'dev_admin', label: 'Desenvolvedor e Administrador' }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
      {/* VPN & Proxy Security Notification on Login */}
      {isGovernanceEnabled && showVpnBanner && vpnStatus && (
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

      {/* Real-time Firestore Notification Banner when a followed article is edited */}
      {isEchoEnabled && liveAlert && (
        <div
          role="status"
          aria-live="polite"
          data-testid="followed-article-live-alert"
          className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs border-b border-blue-700 dark:border-blue-800"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
            </span>
            <Bell className="w-4 h-4 shrink-0 text-blue-100" />
            <div className="truncate">
              <strong>Artigo seguido editado:</strong>{' '}
              <span className="font-semibold underline decoration-blue-200/70">
                {liveAlert.articleTitle}
              </span>{' '}
              <span className="text-blue-100">
                — por {liveAlert.editorName} ({liveAlert.changeSummary})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                handleMarkAsRead(liveAlert.id);
                onNavigateArticle(liveAlert.articleSlug);
                setLiveAlert(null);
              }}
              className="px-2.5 py-1 bg-white text-blue-700 hover:bg-blue-50 rounded text-[11px] font-semibold cursor-pointer transition-colors shadow-2xs"
            >
              Abrir artigo
            </button>
            <button
              type="button"
              onClick={() => setLiveAlert(null)}
              className="p-1 hover:bg-blue-500/60 rounded text-blue-100 hover:text-white cursor-pointer"
              title="Dispensar alerta"
              aria-label="Dispensar alerta"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Windows 3.1 Program Manager Classic Navy Titlebar (only active in windows-31 theme) */}
      {activeTheme.id === 'windows-31' && (
        <div
          data-testid="win31-program-manager-bar"
          className="bg-[#000080] text-white px-3 py-1 flex items-center justify-between gap-2 text-xs font-sans border-b border-black"
        >
          <span className="font-bold tracking-tight truncate">
            Program Manager — {siteTitleConfig.siteTitle} (Windows 3.1)
          </span>
          <button
            type="button"
            onClick={openThemeSelector}
            className="px-2 py-0.5 bg-[#c0c0c0] text-black border border-t-white border-l-white border-r-[#808080] border-b-[#808080] hover:bg-[#d4d0c8] text-[11px] font-bold cursor-pointer whitespace-nowrap shrink-0"
            title="Abrir seletor de Aparência & Temas"
          >
            Trocar Tema
          </button>
        </div>
      )}

      {/* Windows 95 Explorer Gradient Titlebar (only active in windows-95 theme) */}
      {activeTheme.id === 'windows-95' && (
        <div
          data-testid="win95-title-bar"
          className="bg-gradient-to-r from-[#000080] to-[#1084d0] text-white px-3 py-1 flex items-center justify-between gap-2 text-xs font-sans border-b border-black"
        >
          <span className="font-bold tracking-tight truncate">
            Explorador — {siteTitleConfig.siteTitle} (Windows 95)
          </span>
          <button
            type="button"
            onClick={openThemeSelector}
            className="px-2 py-0.5 bg-[#c0c0c0] text-black border border-t-white border-l-white border-r-[#000000] border-b-[#000000] shadow-[inset_1px_1px_0_#dfdfdf,inset_-1px_-1px_0_#808080] hover:bg-[#d4d0c8] text-[11px] font-bold cursor-pointer whitespace-nowrap shrink-0"
            title="Abrir seletor de Aparência & Temas"
          >
            Trocar Tema
          </button>
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
              <img
                src="/assets/aistudio/image_370f9ede.png"
                alt={`${siteTitleConfig.siteTitle} Logo Oficial`}
                className="w-8.5 h-8.5 object-contain rounded group-hover:scale-105 transition-transform shrink-0 drop-shadow-xs"
              />
              <div>
                <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span data-testid="header-site-title" className="whitespace-nowrap">
                    {activeTheme.id === 'wikidiota' ? 'Wikidiota' : siteTitleConfig.siteTitle}
                  </span>
                  {activeTheme.id === 'wikidiota' ? (
                    <span className="text-[11px] font-mono text-rose-700 whitespace-nowrap">
                      · Wikiomite Foundation (Paródia)
                    </span>
                  ) : (
                    siteTitleConfig.projectBadge && (
                      <span className="text-[10px] font-mono font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-200 dark:border-purple-800 whitespace-nowrap">
                        {siteTitleConfig.projectBadge}
                      </span>
                    )
                  )}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-sans hidden sm:flex items-center gap-1">
                  {activeTheme.id === 'wikidiota' ? (
                    <>
                      <span>{siteTitleConfig.siteTitle} • Sátira Institucional</span>
                      <span>•</span>
                    </>
                  ) : (
                    siteTitleConfig.siteSubtitle && (
                      <>
                        <span>{siteTitleConfig.siteSubtitle}</span>
                        <span>•</span>
                      </>
                    )
                  )}
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

        {/* Global Instant Search Bar (CirrusSearch) */}
        {isCirrusEnabled ? (
        <div ref={searchRef} className="relative flex-1 max-w-md">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleInputKeyDown}
              placeholder={`Pesquisar artigos no ${siteTitleConfig.siteTitle}...`}
              className="w-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-750 focus:bg-white dark:focus:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 pl-9 pr-14 py-1.5 rounded border border-slate-200 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 font-sans"
            />
            {isSearching ? (
              <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSuggestions([]);
                  setSelectedIndex(-1);
                  inputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="Limpar pesquisa"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 pointer-events-none select-none">
                <kbd className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded leading-none">
                  Ctrl
                </kbd>
                <kbd className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded leading-none">
                  K
                </kbd>
              </div>
            )}
          </form>

          {/* Autocomplete Dropdown & Quick Random Discovery */}
          {showSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl py-1.5 z-50 overflow-hidden backdrop-blur-md">
              {searchQuery.trim().length === 0 ? (
                /* Empty query discovery drawer */
                <div className="p-2 space-y-1">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                    <span>Descoberta Rápida</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSuggestions(false);
                      handleRandomClick();
                    }}
                    className="w-full text-left px-3 py-2 text-xs rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <Shuffle className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          Buscar Artigo Aleatório
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Sortear e abrir uma página ao acaso da enciclopédia
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      Special:Random
                    </span>
                  </button>
                </div>
              ) : (
                /* Active query suggestions list */
                <>
                  <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span>Resultados da Busca Rápida</span>
                    {isSearching ? (
                      <span className="flex items-center gap-1 text-blue-500 font-normal normal-case">
                        <Loader2 className="w-3 h-3 animate-spin" /> Pesquisando...
                      </span>
                    ) : (
                      <span>{suggestions.length} resultado{suggestions.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>

                  {suggestions.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                      {suggestions.map((s, idx) => {
                        const isSelected = idx === selectedIndex;
                        return (
                          <button
                            key={s.slug}
                            type="button"
                            onMouseEnter={() => setSelectedIndex(idx)}
                            onClick={() => {
                              onNavigateArticle(s.slug);
                              setSearchQuery('');
                              setShowSuggestions(false);
                              setSelectedIndex(-1);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors flex flex-col gap-0.5 cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-950 dark:text-blue-100 border-l-2 border-blue-600 pl-2.5'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200 border-l-2 border-transparent'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                                <span className="font-medium truncate">{highlightMatch(s.title, searchQuery)}</span>
                                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                                  {getNamespaceBadge(s.namespace)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-[11px] font-mono ${isSelected ? 'text-blue-600 dark:text-blue-300' : 'text-slate-400'}`}>
                                  /wiki/{s.slug}
                                </span>
                                {isSelected && (
                                  <CornerDownLeft className="w-3 h-3 text-blue-600 dark:text-blue-400 animate-pulse" />
                                )}
                              </div>
                            </div>
                            {s.snippet && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 pl-5">
                                {s.snippet}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : !isSearching ? (
                    <div className="px-4 py-5 text-center space-y-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                        Nenhum artigo encontrado com o título &ldquo;<span className="font-semibold text-slate-700 dark:text-slate-300">{searchQuery}</span>&rdquo;
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowSuggestions(false);
                            onOpenNewArticle();
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Criar página &ldquo;{searchQuery}&rdquo;
                        </button>
                      {isRandomEnabled && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowSuggestions(false);
                            handleRandomClick();
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                        >
                          <Shuffle className="w-3.5 h-3.5 text-indigo-500" />
                          Buscar Artigo Aleatório
                        </button>
                      )}
                      </div>
                    </div>
                  ) : null}

                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 px-3 py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          onOpenSearch(searchQuery);
                          setShowSuggestions(false);
                        }}
                        className="font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Buscar em todo o texto</span>
                        <span>→</span>
                      </button>
                      {isRandomEnabled && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowSuggestions(false);
                            handleRandomClick();
                          }}
                          className="font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer"
                          title="Buscar e abrir um verbete sorteado aleatoriamente"
                        >
                          <Shuffle className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Artigo Aleatório</span>
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline">
                      <kbd className="font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1">↑↓</kbd> navegar <kbd className="font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 ml-1">Enter</kbd> abrir <kbd className="font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 ml-1">Esc</kbd> fechar
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Action Controls: New Page & Authentication */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Special:Random / Artigo Aleatório Action Button */}
          {isRandomEnabled && (
            <button
              onClick={handleRandomClick}
              disabled={isLoadingRandom}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs whitespace-nowrap disabled:opacity-50"
              title="Sortear e abrir uma página aleatória da enciclopédia (Special:Random)"
            >
              <Shuffle className={`w-3.5 h-3.5 text-blue-600 dark:text-blue-400 ${isLoadingRandom ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Página Aleatória</span>
            </button>
          )}

          {/* + Nova Página Button */}
          <button
            onClick={onOpenNewArticle}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
            title="Criar novo artigo enciclopédico"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nova Página</span>
          </button>

          {/* Theme Appearance Picker Button (ThemeAppearance extension) */}
          {themeAppearanceConfig.extensionEnabled &&
            themeAppearanceConfig.showThemePickerInHeader && (
              <button
                id="btn-header-appearance"
                type="button"
                onClick={openThemeSelector}
                className="px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                title={`Aparência atual: ${activeTheme.name}. Clique para escolher um tema do Wiki-site.`}
                aria-label="Selecionar tema de aparência"
              >
                <Palette className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden xl:inline">{activeTheme.shortLabel}</span>
              </button>
            )}

          {/* Mobile & Desktop App Option Button */}
          {isPwaEnabled && (
            <button
              id="btn-header-app-options"
              type="button"
              onClick={() => {
                if (onOpenAppOptions) {
                  onOpenAppOptions();
                } else if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('notmediawiki:open-app-modal'));
                }
              }}
              className="px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
              title="Aplicativo Mobile & para Computador (Instalar ou alternar modo)"
              aria-label="Opções de aplicativo mobile e computador"
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden xl:inline">App</span>
            </button>
          )}

          {/* Global Light / Dark Quick Toggle */}
          {isThemeAppearanceEnabled && (
            <button
              onClick={toggleDarkMode}
              disabled={
                themeAppearanceConfig.extensionEnabled &&
                !themeAppearanceConfig.allowUserThemeSwitch
              }
              className="p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
              title={
                themeAppearanceConfig.extensionEnabled &&
                !themeAppearanceConfig.allowUserThemeSwitch
                  ? `Tema fixado pelo burocrata: ${activeTheme.name}`
                  : isDarkMode
                    ? 'Mudar para Modo Claro'
                    : 'Mudar para Modo Escuro'
              }
              aria-label={isDarkMode ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              )}
            </button>
          )}

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

          {/* Authenticated user actions & profile */}
          {(googleUserEmail || currentUser?.isGoogleUser) && currentUser && (
            <>
              {/* 3.05.3.af & 3.05.8.b - Checklist Diário & Pontos Mensais Trigger Button */}
              {isChecklistExtEnabled && (
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
              )}

              {/* User Karma Reputation Button */}
              {currentUser && isKarmaEnabled && (
                <button
                  onClick={onOpenMyUserPage}
                  className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                  title={`Seu Karma: ${currentUser.karma ?? 10} pontos de reputação baseados em votos positivos`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span className="hidden sm:inline">Karma</span>
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200">
                    {currentUser.karma ?? 10}
                  </span>
                </button>
              )}

              {/* Push & Watchlist Notifications Bell */}
              {isEchoEnabled && (
              <div ref={notifRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setPushFeedback(null);
                    setWebPushPermission(api.getWebPushPermissionState());
                    setIsNotifOpen(prev => !prev);
                  }}
                  aria-label="Notificações de artigos seguidos"
                  data-testid="header-notifications-bell"
                  className="relative p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shadow-2xs"
                  title={`Notificações (${watchedArticles.length} artigos seguidos • Push: ${webPushPermission})`}
                >
                  <Bell className={`w-4 h-4 ${unreadNotifCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`} />
                  {unreadNotifCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[9px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center animate-pulse shadow-xs">
                      {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                    </span>
                  )}
                </button>

                {/* Notifications Popover Dropdown */}
                {isNotifOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-2 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
                          <Bell className="w-3.5 h-3.5 text-blue-600" />
                          <span>Notificações de Artigos Seguidos</span>
                          {unreadNotifCount > 0 && (
                            <span className="bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-mono text-[10px] px-1.5 py-0.2 rounded">
                              {unreadNotifCount} {unreadNotifCount === 1 ? 'nova' : 'novas'}
                            </span>
                          )}
                        </div>
                        {unreadNotifCount > 0 && currentUser?.id && (
                          <button
                            type="button"
                            onClick={handleMarkAllAsRead}
                            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCheck className="w-3 h-3" />
                            <span>Marcar lidas</span>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          <span>
                            Seguindo {watchedArticles.length} {watchedArticles.length === 1 ? 'artigo' : 'artigos'}
                          </span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.2 rounded font-mono border ${
                              webPushPermission === 'granted'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : webPushPermission === 'denied'
                                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {webPushPermission === 'granted'
                              ? 'Push Ativo'
                              : webPushPermission === 'denied'
                                ? 'Push Bloqueado'
                                : webPushPermission === 'unsupported'
                                  ? 'Push Indisponível'
                                  : 'Push Desativado'}
                          </span>
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Tempo Real
                          </span>
                        </div>
                      </div>

                      {/* Tabs: Alertas vs Tópicos FCM */}
                      <div className="flex items-center gap-1 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => setNotifTab('alerts')}
                          className={`flex-1 py-1 px-2 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                            notifTab === 'alerts'
                              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          Alertas ({notifications.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setNotifTab('topics')}
                          className={`flex-1 py-1 px-2 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                            notifTab === 'topics'
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          Tópicos &amp; Novos Artigos (FCM)
                        </button>
                      </div>
                    </div>

                    {notifTab === 'topics' ? (
                      <FcmTopicSubscriptions
                        userId={currentUser?.id}
                        onPermissionChange={perm => setWebPushPermission(perm)}
                      />
                    ) : (
                      <>
                    {watchedArticles.length > 0 && webPushPermission === 'default' && !pushFeedback && (
                      <div className="mx-3 mt-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-2">
                        <div className="text-[11px] text-blue-800 dark:text-blue-200 leading-snug">
                          Receba alertas no navegador mesmo fora do aplicativo quando artigos seguidos forem editados.
                        </div>
                        <button
                          type="button"
                          onClick={handleActivateWebPush}
                          disabled={isActivatingPush}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-semibold shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {isActivatingPush ? 'Ativando...' : 'Permitir'}
                        </button>
                      </div>
                    )}

                    {pushFeedback && (
                      <div
                        className={`mx-3 mt-2 px-2.5 py-1.5 rounded border text-[11px] ${
                          pushFeedback.type === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {pushFeedback.text}
                      </div>
                    )}

                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {notifications.length === 0 ? (
                        <div className="py-8 px-4 text-center text-slate-400 text-xs">
                          Nenhuma notificação no momento.
                          <div className="text-[11px] text-slate-500 mt-1">
                            Clique em <strong>Vigiar</strong> em qualquer artigo para ser alertado em tempo real quando ele for editado.
                          </div>
                        </div>
                      ) : (
                        notifications.map(notif => (
                          <div
                            key={notif.id}
                            onClick={() => {
                              handleMarkAsRead(notif.id);
                              onNavigateArticle(notif.articleSlug);
                              setIsNotifOpen(false);
                            }}
                            className={`p-3 transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-start justify-between gap-2 ${
                              !notif.isRead ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                  {notif.articleTitle || notif.articleSlug}
                                </span>
                                {!notif.isRead && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                                )}
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">
                                <strong>{notif.editorName}</strong>: {notif.changeSummary}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-1">
                                {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                handleDeleteNotification(notif.id);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
                              title="Remover"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                      </>
                    )}

                    <div className="pt-2 px-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          setIsNotifOpen(false);
                          onNavigateArticle('Special:Watchlist');
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        Gerenciar páginas seguidas →
                      </button>
                      <button
                        type="button"
                        onClick={handleActivateWebPush}
                        disabled={isActivatingPush || webPushPermission === 'unsupported'}
                        className={`cursor-pointer font-medium disabled:opacity-50 ${
                          webPushPermission === 'granted'
                            ? 'text-emerald-600 dark:text-emerald-400 hover:underline'
                            : webPushPermission === 'denied'
                              ? 'text-rose-600 dark:text-rose-400 hover:underline'
                              : 'text-blue-600 dark:text-blue-400 hover:underline'
                        }`}
                      >
                        {isActivatingPush
                          ? 'Configurando...'
                          : webPushPermission === 'granted'
                            ? 'Sincronizar Push FCM'
                            : webPushPermission === 'denied'
                              ? 'Push Bloqueado'
                              : 'Ativar Web Push'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* Real-time Chat Trigger Button */}
              {isChatEnabled && (
                <button
                  onClick={onOpenChat}
                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                  title="Abrir Chat em Tempo Real com outros usuários"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Chat</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </button>
              )}

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
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>Papel: <strong className="text-slate-700 dark:text-slate-300 capitalize">{currentUser?.role}</strong></span>
                        {isKarmaEnabled && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                              <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                              {currentUser?.karma ?? 10} Karma
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="px-1 py-1 space-y-0.5">
                      {isDirectoryEnabled && (
                        <>
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
                        </>
                      )}

                      {isChatEnabled && (
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
                      )}

                      {isChecklistExtEnabled && (
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
                      )}

                      {themeAppearanceConfig.extensionEnabled && (
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            openThemeSelector();
                          }}
                          className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Palette className="w-3.5 h-3.5 text-amber-500" />
                          <span>Aparência &amp; Temas ({activeTheme.shortLabel})</span>
                        </button>
                      )}

                      {isPwaEnabled && (
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            if (onOpenAppOptions) {
                              onOpenAppOptions();
                            } else if (typeof window !== 'undefined') {
                              window.dispatchEvent(new CustomEvent('notmediawiki:open-app-modal'));
                            }
                          }}
                          className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Aplicativo Mobile &amp; Computador</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onSelectView('bureaucrats');
                        }}
                        className="w-full text-left px-3 py-2 rounded hover:bg-purple-50 dark:hover:bg-purple-950/50 text-purple-700 dark:text-purple-300 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>Página dos Burocratas & Extensões</span>
                      </button>

                      {supportTicketsConfig.enabled && supportTicketsConfig.showInHeader && (
                        <a
                          href={wrapExternalUrl(supportTicketsConfig.url)}
                          target={supportTicketsConfig.openInNewTab ? '_blank' : '_self'}
                          rel="noopener noreferrer"
                          className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>{supportTicketsConfig.buttonLabel}</span>
                        </a>
                      )}
                    </div>

                    {/* Network / VPN Verification Status */}
                    {isGovernanceEnabled && (
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
                    )}

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
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Primary Navigation Bar (Segmented Controls) */}
      <div className="bg-slate-50/80 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar py-1">
          <nav className="flex items-center gap-1">
            {navItems.map(item => {
              const isRecentChangesActive =
                currentView === 'recent_changes' ||
                (currentView === 'special' && activeSpecialPage === 'RecentChanges');
              const isActive =
                item.id === 'recent_changes'
                  ? isRecentChangesActive
                  : item.id === 'special'
                    ? currentView === 'special' && !isRecentChangesActive
                    : currentView === item.id || (item.id === 'reader' && currentView === 'history');
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectView(item.id)}
                  data-testid={`nav-item-${item.id}`}
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

            {/* Special:Random Navigation Link */}
            {isRandomEnabled && (
              <button
                type="button"
                onClick={handleRandomClick}
                disabled={isLoadingRandom}
                className="px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Acessar uma página aleatória da enciclopédia (Special:Random)"
              >
                <Shuffle className={`w-3.5 h-3.5 text-blue-500 dark:text-blue-400 ${isLoadingRandom ? 'animate-spin' : ''}`} />
                <span>Página Aleatória</span>
              </button>
            )}
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
              {isFocusModeEnabled && (
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
              )}
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
      {currentView === 'reader' && isFocusModeEnabled && (
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
