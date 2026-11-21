import React, { useEffect, useState, useMemo } from 'react';
import {
  ShieldCheck,
  Puzzle,
  Users,
  Cloud,
  Lock,
  LogIn,
  ArrowLeft,
  Settings,
  Globe,
  CheckCircle2,
  MessageSquare,
  ExternalLink,
  Award,
  Wrench,
  RefreshCw,
} from 'lucide-react';
import { UserSession } from '../types';
import { ExtensionsManager } from './ExtensionsManager';
import { useExtensions } from '../context/ExtensionsContext';
import {
  auth,
  fetchUsersFromFirestore,
  subscribeToFirestoreUsers,
  hasBureaucratPrivileges,
  loginWithGoogle,
} from '../firebase';
import { FIRESTORE_DATABASE_ID } from '../firebaseConfig';
import { api } from '../api';

export interface BureaucratPageProps {
  currentUser: UserSession | null;
  onUserChanged?: (user: UserSession | null) => void;
  onBackToWiki: () => void;
  onOpenAdminConsole?: (tab?: string) => void;
  onOpenUserPage?: (user: UserSession) => void;
  onStartChatWithUser?: (user: UserSession) => void;
  initialTab?: 'extensions' | 'bureaucrats';
}

export const BureaucratPage: React.FC<BureaucratPageProps> = ({
  currentUser,
  onUserChanged,
  onBackToWiki,
  onOpenAdminConsole,
  onOpenUserPage,
  onStartChatWithUser,
  initialTab = 'extensions',
}) => {
  const [activeTab, setActiveTab] = useState<'extensions' | 'bureaucrats'>(initialTab);
  const [users, setUsers] = useState<UserSession[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const {
    extensions,
    isLoadingExtensions,
    hasLoadedFromFirebase,
    extensionsLoadError,
    lastSyncAt,
    siteTitleConfig,
    maintenanceConfig,
  } = useExtensions();

  const isBureaucrat =
    hasBureaucratPrivileges(currentUser, auth.currentUser?.email) &&
    Boolean(auth.currentUser || currentUser?.role === 'bureaucrat' || currentUser?.role === 'sysop');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let mounted = true;
    setLoadingUsers(true);
    fetchUsersFromFirestore()
      .then(list => {
        if (!mounted) return;
        setUsers(list || []);
        setLoadingUsers(false);
      })
      .catch(() => {
        if (mounted) setLoadingUsers(false);
      });

    const unsub = subscribeToFirestoreUsers(liveUsers => {
      if (mounted && Array.isArray(liveUsers)) {
        setUsers(liveUsers);
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const bureaucrats = useMemo(
    () =>
      users
        .filter(u => u.role === 'bureaucrat' || u.role === 'sysop')
        .sort((a, b) => {
          if (a.role === 'bureaucrat' && b.role !== 'bureaucrat') return -1;
          if (a.role !== 'bureaucrat' && b.role === 'bureaucrat') return 1;
          return (b.editCount || 0) - (a.editCount || 0);
        }),
    [users]
  );

  const enabledCount = extensions.filter(e => e.enabled).length;

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await loginWithGoogle();
      const updatedUser = await api.getCurrentUser();
      onUserChanged?.(updatedUser);
    } catch (err: any) {
      setLoginError(err?.message || 'Não foi possível autenticar via Google.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div
      data-testid="bureaucrat-page"
      className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6"
    >
      {/* Hero Banner: Página dos Burocratas */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Página dos Burocratas
                </h1>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300">
                  Especial:Burocratas
                </span>
                {hasLoadedFromFirebase && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                    <Cloud className="w-3 h-3" />
                    <span>Firebase Sync Ativo</span>
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-sans mt-1 max-w-3xl leading-relaxed">
                Centro oficial de governança burocrática do <strong>{siteTitleConfig.siteTitle}</strong>. Todas as configurações e estados das extensões (incluindo o título do Wiki-site) determinados aqui são salvos no Firebase Firestore e carregados obrigatoriamente na abertura do Wiki-site.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onBackToWiki}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Wiki</span>
            </button>

            {onOpenAdminConsole && isBureaucrat && (
              <button
                type="button"
                onClick={() => onOpenAdminConsole('users')}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Console Administrativo</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase text-slate-400">Extensões no Firebase</div>
              <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                {enabledCount} / {extensions.length} ativas
              </div>
            </div>
            <Puzzle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase text-slate-400">Carga na Abertura</div>
              <div
                className={`text-sm font-semibold ${
                  extensionsLoadError
                    ? 'text-rose-600 dark:text-rose-400'
                    : hasLoadedFromFirebase
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {isLoadingExtensions
                  ? 'Carregando...'
                  : extensionsLoadError
                    ? 'Falha (Acesso via Burocrata)'
                    : hasLoadedFromFirebase
                      ? 'Sincronizado do Firestore'
                      : 'Aguardando Firebase'}
              </div>
            </div>
            <Cloud className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase text-slate-400">Modo Manutenção</div>
              <div
                className={`text-sm font-semibold ${
                  maintenanceConfig.isMaintenanceActive
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {maintenanceConfig.isMaintenanceActive ? 'Ativo (Restrito)' : 'Operacional'}
              </div>
            </div>
            <Wrench className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase text-slate-400">Autoridade Atual</div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {currentUser ? `${currentUser.username} (${currentUser.role})` : 'Visitante'}
              </div>
            </div>
            {isBureaucrat ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <Lock className="w-5 h-5 text-amber-500 shrink-0" />
            )}
          </div>
        </div>

        {/* Auth Prompt when non-bureaucrat opens Bureaucrat Page */}
        {!isBureaucrat && (
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1 text-amber-900 dark:text-amber-200">
              <div className="font-bold flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Autenticação de Burocrata Necessária para Modificações</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                Você pode visualizar as extensões e a lista oficial de burocratas carregadas do banco{' '}
                <code>{FIRESTORE_DATABASE_ID}</code>. Para ativar, desativar ou configurar extensões no Firebase, entre com uma conta Google com privilégio de Burocrata.
              </p>
              {loginError && <p className="text-rose-600 dark:text-rose-400 font-semibold">{loginError}</p>}
            </div>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors disabled:opacity-50"
            >
              {isLoggingIn ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
              <span>{isLoggingIn ? 'Autenticando...' : 'Entrar com Google (Burocrata)'}</span>
            </button>
          </div>
        )}

        {/* Sub-navigation tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('extensions')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'extensions'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Puzzle className="w-4 h-4" />
            <span>Gerenciamento de Extensões ({extensions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bureaucrats')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'bureaucrats'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Burocratas & Administradores ({bureaucrats.length})</span>
          </button>

          {lastSyncAt && (
            <span className="ml-auto text-[11px] font-mono text-slate-400">
              Última leitura Firebase: {new Date(lastSyncAt).toLocaleTimeString('pt-BR')}
            </span>
          )}
        </div>
      </div>

      {/* Tab 1: Gerenciamento de Extensões (Firebase) */}
      {activeTab === 'extensions' && (
        <div className="space-y-4">
          <ExtensionsManager currentUser={currentUser} />
        </div>
      )}

      {/* Tab 2: Lista de Burocratas & Atribuições */}
      {activeTab === 'bureaucrats' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-600" />
                <span>Corpo de Burocratas e Administradores Oficiais</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Contas autorizadas a configurar extensões globais, gerenciar domínios permitidos no Firebase, deliberar no ArbCom e administrar usuários.
              </p>
            </div>
          </div>

          {loadingUsers ? (
            <div className="py-10 text-center text-xs text-slate-500">
              Carregando burocratas do Firestore...
            </div>
          ) : bureaucrats.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              Nenhum burocrata encontrado no diretório do Firestore.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bureaucrats.map(bUser => (
                <div
                  key={bUser.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {bUser.avatar || bUser.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {bUser.username}
                        </span>
                        {bUser.userTag && (
                          <span className="text-[11px] font-mono text-slate-400">{bUser.userTag}</span>
                        )}
                      </div>
                      <span
                        className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          bUser.role === 'bureaucrat'
                            ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800'
                            : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800'
                        }`}
                      >
                        {bUser.role === 'bureaucrat' ? 'Burocrata' : 'Administrador (Sysop)'}
                      </span>
                      {bUser.bio && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">
                          {bUser.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs">
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {bUser.editCount || 0} edições
                    </span>
                    <div className="flex items-center gap-1.5">
                      {onOpenUserPage && (
                        <button
                          type="button"
                          onClick={() => onOpenUserPage(bUser)}
                          className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Página</span>
                        </button>
                      )}
                      {onStartChatWithUser && (
                        <button
                          type="button"
                          onClick={() => onStartChatWithUser(bUser)}
                          className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 rounded text-[11px] font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-1 cursor-pointer"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>Chat</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {onOpenAdminConsole && isBureaucrat && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 mr-2">Atalhos Burocráticos:</span>
              <button
                type="button"
                onClick={() => onOpenAdminConsole('domains')}
                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Domínios Permitidos (Firebase)</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAdminConsole('arbitration')}
                className="px-3 py-1.5 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded text-xs font-medium cursor-pointer"
              >
                Conselho de Arbitragem
              </button>
              <button
                type="button"
                onClick={() => onOpenAdminConsole('users')}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded text-xs font-medium cursor-pointer"
              >
                Gerenciamento de Usuários
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
