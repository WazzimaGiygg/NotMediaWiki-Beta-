import { useEffect, useState, useCallback } from 'react';

export type AppDeviceMode = 'auto' | 'mobile' | 'desktop' | 'tv';
export type DetectedPlatformOS = 'android' | 'ios' | 'windows' | 'macos' | 'linux';

export const DEVICE_MODE_STORAGE_KEY = 'notmediawiki_device_mode';
const DEVICE_MODE_EVENT = 'notmediawiki:device-mode-changed';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function detectPlatformOS(): DetectedPlatformOS {
  if (typeof navigator === 'undefined') return 'linux';
  const ua = (navigator.userAgent || '').toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/mac os x|macintosh/.test(ua)) return 'macos';
  if (/win/.test(ua)) return 'windows';
  return 'linux';
}

export function readStoredDeviceMode(): AppDeviceMode {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(DEVICE_MODE_STORAGE_KEY) as AppDeviceMode | null;
      if (saved && ['auto', 'mobile', 'desktop', 'tv'].includes(saved)) {
        return saved;
      }
    }
  } catch {
    // Ignore storage read errors
  }
  if (typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth < 768) {
    return 'mobile';
  }
  return 'desktop';
}

export function writeDeviceMode(mode: AppDeviceMode): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(DEVICE_MODE_STORAGE_KEY, mode);
    }
  } catch {
    // Ignore storage write errors
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-device-mode', mode);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DEVICE_MODE_EVENT, { detail: mode }));
  }
}

export function useAppPlatformMode() {
  const [deviceMode, setDeviceModeState] = useState<AppDeviceMode>(() => readStoredDeviceMode());

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-device-mode', deviceMode);
    }
  }, [deviceMode]);

  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<AppDeviceMode>;
      if (customEvent.detail && ['auto', 'mobile', 'desktop', 'tv'].includes(customEvent.detail)) {
        setDeviceModeState(customEvent.detail);
      } else {
        setDeviceModeState(readStoredDeviceMode());
      }
    };
    window.addEventListener(DEVICE_MODE_EVENT, handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener(DEVICE_MODE_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const setDeviceMode = useCallback((mode: AppDeviceMode) => {
    setDeviceModeState(mode);
    writeDeviceMode(mode);
  }, []);

  return { deviceMode, setDeviceMode };
}

export function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches) ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkIsStandalone());
  const [platformOS, setPlatformOS] = useState<DetectedPlatformOS>(() => detectPlatformOS());

  useEffect(() => {
    setPlatformOS(detectPlatformOS());
    setIsInstalled(checkIsStandalone());

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const isIOS = platformOS === 'ios';
  const isAndroid = platformOS === 'android';
  const isMobileOS = isIOS || isAndroid;

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    platformOS,
    isIOS,
    isAndroid,
    isMobileOS,
    install,
  };
}
