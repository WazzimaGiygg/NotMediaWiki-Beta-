import React, { useState } from 'react';
import {
  ShieldAlert,
  RefreshCw,
  LogIn,
  LogOut,
  Lock,
  Loader2,
  Database,
} from 'lucide-react';
import { loginWithGoogle, logoutGoogle } from '../firebase';
import { DEFAULT_WIKI_SITE_TITLE } from '../extensions/siteTitleExtension';

export interface ExtensionsLoadFailureScreenProps {
  mode: 'loading' | 'failed';
  errorMessage?: string | null;
  googleUserEmail: string | null;
  isNonBureaucratSignedIn: boolean;
  siteTitle?: string;
  onRetryLoad: () => Promise<void>;
}

export const ExtensionsLoadFailureScreen: React.FC<ExtensionsLoadFailureScreenProps> = ({
  mode,
  errorMessage,
  googleUserEmail,
  isNonBureaucratSignedIn,
  siteTitle = DEFAULT_WIKI_SITE_TITLE,
  onRetryLoad,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetryLoad();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleBureaucratLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setAuthError(
        err?.message || 'Não foi possível concluir o login Google. Verifique se popups estão liberados.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSwitchAccount = async () => {
    setAuthError(null);
    try {
      await logoutGoogle();
    } catch (err: any) {
      setAuthError(err?.message || 'Erro ao encerrar sessão atual.');
    }
  };

  return (
    <div
      data-testid="extensions-startup-gate"
      className="min-h-screen bg-stone-50 dark:bg-slate-950 text-stone-900 dark:text-slate-100 flex flex-col justify-between font-sans transition-colors"
    >
      {/* Top Institutional Bar */}
      <header className="border-b border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/image_370f9ede.png"
              alt={siteTitle}
              className="w-8 h-8 object-contain rounded shrink-0"
            />
            <span className="font-serif font-bold text-base tracking-tight text-stone-900 dark:text-slate-100 whitespace-nowrap truncate">
              {siteTitle}
            </span>
          </div>
          <span className="text-xs text-stone-500 dark:text-slate-400 whitespace-nowrap shrink-0">
            {mode === 'loading' ? 'Inicializando extensões' : 'Sistema bloqueado'}
          </span>
        </div>
      </header>

      {/* Main Centered Gate Content */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10">
        {mode === 'loading' ? (
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 rounded-xl p-8 space-y-6 text-center">
            <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 flex items-center justify-center mx-auto text-blue-700 dark:text-blue-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-slate-400 font-medium">
                Inicialização obrigatória
              </p>
              <h1 className="text-2xl font-serif font-semibold text-stone-900 dark:text-slate-100 text-balance">
                Carregando extensões do Wiki-site
              </h1>
              <p className="text-sm text-stone-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
                Aguardando a leitura das configurações oficiais de extensões no Firebase Firestore antes de liberar o acesso ao Wiki.
              </p>
            </div>

            <div className="pt-4 border-t border-stone-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleBureaucratLogin}
                disabled={isLoggingIn}
                className="px-4 py-2.5 text-xs font-medium text-stone-700 dark:text-slate-200 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 border border-stone-200 dark:border-slate-700 rounded-lg transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isLoggingIn ? 'Autenticando...' : 'Entrar com Google (Burocrata)'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-xl w-full bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-700 dark:text-rose-400 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 min-w-0">
                <p className="text-xs uppercase tracking-widest text-rose-700 dark:text-rose-400 font-semibold">
                  Falha no carregamento de extensões
                </p>
                <h1 className="text-2xl font-serif font-semibold text-stone-900 dark:text-slate-100 text-balance leading-snug">
                  O Wiki-site não pode funcionar sem as extensões carregadas
                </h1>
              </div>
            </div>

            <p className="text-sm text-stone-600 dark:text-slate-300 leading-relaxed">
              As extensões determinam regras essenciais de funcionamento, título e segurança ao abrir o Wiki-site. Como o carregamento a partir do Firebase falhou, o acesso público permanece bloqueado — exceto mediante autenticação com login de Burocrata.
            </p>

            {errorMessage && (
              <div className="bg-stone-50 dark:bg-slate-950 border border-stone-200 dark:border-slate-800 rounded-lg p-3.5 flex items-start gap-2.5 text-xs text-stone-700 dark:text-slate-300 font-mono break-words">
                <Database className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span className="min-w-0 flex-1">{errorMessage}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>{isRetrying ? 'Recarregando...' : 'Tentar carregar extensões novamente'}</span>
              </button>
            </div>

            <div className="pt-5 border-t border-stone-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-stone-800 dark:text-slate-200">
                <Lock className="w-3.5 h-3.5 text-stone-500 dark:text-slate-400" />
                <span>Exceção administrativa: Login do Burocrata</span>
              </div>

              {authError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-800 dark:text-rose-300">
                  {authError}
                </div>
              )}

              {isNonBureaucratSignedIn && googleUserEmail ? (
                <div className="space-y-3">
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <div className="font-semibold">Acesso não autorizado para esta conta</div>
                    <p className="leading-relaxed">
                      A conta Google <strong>{googleUserEmail}</strong> não possui privilégios de Burocrata para operar o Wiki em estado de falha de carregamento.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    className="w-full px-4 py-2.5 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 border border-stone-200 dark:border-slate-700 text-stone-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Trocar de Conta Google</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={handleBureaucratLogin}
                    disabled={isLoggingIn}
                    className="w-full px-4 py-2.5 bg-stone-900 dark:bg-white hover:bg-stone-800 dark:hover:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                  >
                    {isLoggingIn ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <LogIn className="w-3.5 h-3.5" />
                    )}
                    <span>{isLoggingIn ? 'Autenticando Burocrata...' : 'Entrar com Google (Burocrata)'}</span>
                  </button>
                  <p className="text-xs text-stone-500 dark:text-slate-400 leading-relaxed">
                    Somente burocratas autorizados podem acessar o Wiki e a Página dos Burocratas quando as extensões falham no carregamento inicial.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Quiet Institutional Footer */}
      <footer className="border-t border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3.5 px-6 text-center text-xs text-stone-500 dark:text-slate-400">
        {siteTitle} · Governança de Extensões Firebase
      </footer>
    </div>
  );
};
