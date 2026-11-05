import React, { useState } from 'react';
import {
  Wrench,
  ShieldAlert,
  ShieldCheck,
  Lock,
  ArrowRight,
  LogOut,
  RefreshCw,
  Power,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import { UserSession } from '../types';
import { loginWithGoogle, logoutGoogle } from '../firebase';
import { getMaintenanceModeConfig } from '../extensions/maintenanceModeExtension';
import { api } from '../api';

interface MaintenanceScreenProps {
  currentUser: UserSession | null;
  googleUserEmail: string | null;
  isBureaucrat: boolean;
  onBypassToAdmin: () => void;
  onDisableMaintenance?: () => Promise<void>;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({
  currentUser,
  googleUserEmail,
  isBureaucrat,
  onBypassToAdmin,
  onDisableMaintenance,
}) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const maintenanceConfig = getMaintenanceModeConfig();

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Erro no login Google durante manutenção:', err);
      setLoginError('Falha ao autenticar com o Google. Verifique o popup ou tente novamente.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutGoogle();
    } catch (err) {
      console.error('Erro no logout Google:', err);
    }
  };

  const handleDeactivate = async () => {
    if (!onDisableMaintenance) return;
    setIsDisabling(true);
    try {
      await onDisableMaintenance();
    } catch (e) {
      console.error('Erro ao desativar manutenção:', e);
    } finally {
      setIsDisabling(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-purple-500 selection:text-white">
      {/* Top Header Bar */}
      <header className="border-b border-slate-800 bg-slate-950/80 px-6 py-4 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/image_370f9ede.png"
              alt="NotMediaWiki Logo"
              className="w-8 h-8 rounded drop-shadow-sm"
            />
            <div>
              <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                WikiWorlWeb
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Manutenção
                </span>
              </span>
              <span className="text-[11px] text-slate-400 font-sans block">
                NotMediaWiki • WazzimaGiygg Ecosystem
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs font-mono text-amber-300 hidden sm:inline">
              Status: Manutenção Restrita
            </span>
          </div>
        </div>
      </header>

      {/* Center Hero Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
        <div className="max-w-xl w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 sm:p-10 shadow-2xl relative overflow-hidden backdrop-blur-sm">
          {/* Subtle Accent Glow */}
          <div className="absolute -top-24 -right-24 w-52 h-52 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Icon Badge */}
          <div className="flex items-center justify-center mb-6">
            <div className="w-18 h-18 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Wrench className="w-9 h-9 animate-spin-slow" />
            </div>
          </div>

          {/* Heading */}
          <div className="text-center space-y-2 mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Lock className="w-3 h-3" />
              <span>3.05.3.e • Extensão de Manutenção</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
              {maintenanceConfig.title || 'WikiWorlWeb em Manutenção'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
              {maintenanceConfig.message}
            </p>
          </div>

          {/* Estimated Completion Banner */}
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3.5 mb-6 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{maintenanceConfig.estimatedEnd || 'Previsão de retorno: em breve'}</span>
            </div>
            <span className="font-mono text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
              ext-maintenance-mode
            </span>
          </div>

          {/* Bureaucrat Authentication Area */}
          <div className="border-t border-slate-700/80 pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 text-center font-mono">
              Acesso Exclusivo para Burocratas
            </h3>

            {/* Error Message */}
            {loginError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-rose-300 text-xs mb-4 text-center">
                {loginError}
              </div>
            )}

            {!googleUserEmail ? (
              /* Case 1: Visitor is not authenticated via Google */
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-3 cursor-pointer shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                  )}
                  <span>{isLoggingIn ? 'Autenticando...' : 'Entrar com Google (Burocrata)'}</span>
                </button>
                <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                  Use sua conta Google vinculada aos privilégios de Burocrata ou Desenvolvedor para desbloquear o acesso às configurações.
                </p>
              </div>
            ) : isBureaucrat ? (
              /* Case 2: Authenticated as a Bureaucrat */
              <div className="space-y-4">
                <div className="bg-emerald-950/60 border border-emerald-800/80 rounded-xl p-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-emerald-200">
                        Burocrata Reconhecido
                      </div>
                      <div className="text-[11px] text-emerald-400/80 truncate max-w-xs">
                        {googleUserEmail}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Desconectar"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={onBypassToAdmin}
                    className="py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Configurações do Wiki</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {onDisableMaintenance && (
                    <button
                      onClick={handleDeactivate}
                      disabled={isDisabling}
                      className="py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{isDisabling ? 'Desativando...' : 'Desativar Manutenção'}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Case 3: Authenticated with Google, but NOT a bureaucrat */
              <div className="space-y-3">
                <div className="bg-rose-950/60 border border-rose-800/80 rounded-xl p-4 text-xs text-rose-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-300">
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Acesso Restrito durante a Manutenção</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-200/90">
                    A conta Google <strong>{googleUserEmail}</strong> está autenticada, porém não possui privilégios de Burocrata ou Administrador no WikiWorlWeb.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Trocar de Conta Google</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-400">
        <p>
          WikiWorlWeb • Sistema NotMediaWiki • Licença Creative Commons CC BY-SA 4.0
        </p>
      </footer>
    </div>
  );
};
