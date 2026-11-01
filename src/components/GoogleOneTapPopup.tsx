import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, ShieldCheck, Zap, UserCheck, ArrowRight } from 'lucide-react';
import { UserSession } from '../types';
import { loginWithGoogle, loginWithGoogleCredential, recordDailyChecklistAction } from '../firebase';
import { firebaseConfig } from '../firebaseConfig';
import { api } from '../api';
import { performVpnAudit } from '../utils/vpnDetector';

interface GoogleOneTapPopupProps {
  currentUser: UserSession | null;
  onUserChanged: (user: UserSession | null) => void;
  onVpnAlert?: (isVpn: boolean, score: number) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          renderButton?: (parent: HTMLElement, options: any) => void;
          cancel?: () => void;
        };
      };
    };
  }
}

export const GoogleOneTapPopup: React.FC<GoogleOneTapPopupProps> = ({
  currentUser,
  onUserChanged,
  onVpnAlert,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Remembered previous account details for instant personalized One Tap
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [savedPhoto, setSavedPhoto] = useState<string | null>(null);
  const gisInitialized = useRef(false);

  useEffect(() => {
    // Read previous user from localStorage if exists
    try {
      const email = localStorage.getItem('notmediawiki_last_google_email');
      const name = localStorage.getItem('notmediawiki_last_google_name');
      const photo = localStorage.getItem('notmediawiki_last_google_photo');
      if (email) setSavedEmail(email);
      if (name) setSavedName(name);
      if (photo) setSavedPhoto(photo);
    } catch {}
  }, []);

  // Handle successful Google credential response from GIS or popup
  const completeAuthProcess = async (user: UserSession) => {
    const serverUser = await api.upsertUser(user);
    await api.switchUser(serverUser.id).catch(console.warn);
    onUserChanged(serverUser);

    // Record daily checklist login mission (+1.00 pt)
    recordDailyChecklistAction(serverUser.id, serverUser.username, 'login').catch(console.warn);

    // Perform background VPN & IP audit
    performVpnAudit(serverUser)
      .then(vpnRes => {
        if (vpnRes.isVpn || vpnRes.riskScore >= 40) {
          onVpnAlert?.(true, vpnRes.riskScore);
        }
      })
      .catch(console.warn);

    setIsVisible(false);
  };

  // Google Identity Services (GIS) One Tap initialization
  useEffect(() => {
    if (currentUser) {
      setIsVisible(false);
      return;
    }

    const isDismissed = sessionStorage.getItem('nmw_google_onetap_dismissed');
    if (isDismissed === 'true') {
      return;
    }

    const clientId = firebaseConfig.oAuthClientId || '249427877153-9t3mbfk8bc5qg6jvavk9rjrmf618qfh9.apps.googleusercontent.com';

    const tryInitGIS = () => {
      if (typeof window !== 'undefined' && window.google?.accounts?.id && !gisInitialized.current) {
        gisInitialized.current = true;
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: any) => {
              if (response?.credential) {
                setIsLoading(true);
                setErrorMessage(null);
                try {
                  const user = await loginWithGoogleCredential(response.credential);
                  await completeAuthProcess(user);
                } catch (err: any) {
                  console.warn('GIS credential login error:', err);
                  setErrorMessage('Erro ao validar credencial do Google.');
                } finally {
                  setIsLoading(false);
                }
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          // Trigger the Google native prompt
          window.google.accounts.id.prompt((notification: any) => {
            // If the native GIS prompt is suppressed (e.g. iframe sandbox, third-party cookies disabled, etc.),
            // our custom top-right floating One Tap card remains visible and fully actionable.
            if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
              setIsVisible(true);
            }
          });
        } catch (e) {
          console.warn('Google Identity Services init warning:', e);
        }
      }
    };

    // Attempt GIS initialization immediately if script is already loaded
    tryInitGIS();

    // Check again after a short interval if script was loading async
    const gisCheckTimer = setTimeout(() => {
      tryInitGIS();
    }, 800);

    // Display our floating Google Quick Sign-In popup in the top right after 1.2s
    const displayTimer = setTimeout(() => {
      setIsVisible(true);
    }, 1200);

    return () => {
      clearTimeout(gisCheckTimer);
      clearTimeout(displayTimer);
    };
  }, [currentUser]);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('nmw_google_onetap_dismissed', 'true');
    try {
      window.google?.accounts?.id?.cancel?.();
    } catch {}
  };

  const handleQuickLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const user = await loginWithGoogle();
      await completeAuthProcess(user);
    } catch (err: any) {
      console.warn('Google One Tap Sign-in canceled or failed:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMessage('A janela de autenticação foi fechada. Clique novamente para entrar.');
      } else {
        setErrorMessage('Não foi possível autenticar com o Google. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible || currentUser) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-labelledby="google-onetap-title"
      className="fixed top-16 sm:top-18 right-3 sm:right-6 z-50 w-[94vw] sm:w-[360px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-5 animate-in fade-in slide-in-from-top-4 duration-300 transition-all font-sans"
    >
      {/* Top Header: Brand & Google One Tap Indicator */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          {/* Official Google G Logo */}
          <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
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
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Fazer login com o Google
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>Para NotMediaWiki</span>
              <img
                src="/assets/aistudio/image_370f9ede.png"
                alt="NotMediaWiki Logo"
                className="w-3.5 h-3.5 object-contain rounded inline-block"
              />
            </div>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          title="Fechar aviso de login rápido"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Content / Account Preview */}
      <div className="space-y-2 mb-4">
        {savedEmail ? (
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center gap-2.5">
            {savedPhoto ? (
              <img
                src={savedPhoto}
                alt={savedName || savedEmail}
                className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-600"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {(savedName || savedEmail || 'U').substring(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {savedName || 'Usuário Google'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {savedEmail}
              </div>
            </div>
            <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          </div>
        ) : (
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Identifique-se com um clique para editar artigos, acumular pontos de{' '}
            <strong className="text-amber-600 dark:text-amber-400 font-semibold inline-flex items-center gap-0.5">
              <Zap className="w-3 h-3 fill-amber-500 text-amber-500" /> Karma
            </strong>{' '}
            e receber notificações de páginas seguidas.
          </p>
        )}

        {errorMessage && (
          <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-[11px] text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}
      </div>

      {/* CTA Button: Continuous Sign-in with Google */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleQuickLogin}
          disabled={isLoading}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <svg className="w-4 h-4 shrink-0 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
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
          <span>
            {isLoading
              ? 'Conectando ao Google...'
              : savedName
              ? `Continuar como ${savedName}`
              : 'Continuar com o Google'}
          </span>
          {!isLoading && <ArrowRight className="w-3.5 h-3.5 opacity-80" />}
        </button>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>Firebase Auth Seguro</span>
          </div>
          <button
            onClick={handleDismiss}
            className="hover:underline text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
};
