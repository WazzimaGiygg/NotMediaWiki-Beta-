import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { UserSession, WikiExtension } from '../types';
import { DEFAULT_EXTENSIONS } from '../data/defaultExtensions';
import {
  initOrSyncExtensionsOnWikiAccess,
  subscribeToExtensionsFromFirestore,
  saveExtensionToFirestore,
  syncAllExtensionsToFirestore,
  deleteExtensionFromFirestore,
  mergeExtensionsWithDefaults,
} from '../firebase';
import { getMaintenanceModeConfig } from '../extensions/maintenanceModeExtension';
import { getExternalRedirectConfig } from '../extensions/externalRedirectExtension';
import { getSupportTicketsConfig } from '../extensions/supportTicketsExtension';
import { getPortalsConfig } from '../extensions/portalsExtension';
import { getSiteTitleConfig, SiteTitleConfig } from '../extensions/siteTitleExtension';
import {
  getThemeAppearanceConfig,
  ThemeAppearanceConfig,
} from '../extensions/themeAppearanceExtension';
import {
  applyWikiThemeToDocument,
  readStoredUserWikiTheme,
  resolveWikiTheme,
  USER_THEME_STORAGE_KEY,
  WikiThemeDefinition,
  writeStoredUserWikiTheme,
} from '../themes/themeRegistry';

const STORAGE_KEY = 'notmediawiki_extensions';

function readCachedExtensions(): WikiExtension[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return mergeExtensionsWithDefaults(parsed, DEFAULT_EXTENSIONS);
        }
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return DEFAULT_EXTENSIONS;
}

function writeCachedExtensions(list: WikiExtension[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
  } catch {
    // Ignore storage write errors
  }
}

export interface ExtensionsContextValue {
  extensions: WikiExtension[];
  isLoadingExtensions: boolean;
  hasAttemptedInitialLoad: boolean;
  hasLoadedFromFirebase: boolean;
  extensionsLoadError: string | null;
  lastSyncAt: string | null;
  getExtension: (idOrName: string) => WikiExtension | undefined;
  isExtensionEnabled: (idOrName: string, fallback?: boolean) => boolean;
  getExtensionParam: <T = any>(idOrName: string, paramKey: string, fallback: T) => T;
  siteTitleConfig: SiteTitleConfig;
  themeAppearanceConfig: ThemeAppearanceConfig;
  activeTheme: WikiThemeDefinition;
  setUserTheme: (themeId: string) => boolean;
  resetToDefaultTheme: () => void;
  isThemeSelectorOpen: boolean;
  openThemeSelector: () => void;
  closeThemeSelector: () => void;
  maintenanceConfig: ReturnType<typeof getMaintenanceModeConfig>;
  externalRedirectConfig: ReturnType<typeof getExternalRedirectConfig>;
  supportTicketsConfig: ReturnType<typeof getSupportTicketsConfig>;
  portalsConfig: ReturnType<typeof getPortalsConfig>;
  saveExtension: (ext: WikiExtension) => Promise<WikiExtension>;
  syncAllExtensions: (list: WikiExtension[]) => Promise<{ saved: number }>;
  deleteExtension: (extensionId: string) => Promise<void>;
  refreshExtensions: () => Promise<WikiExtension[]>;
  retryLoadExtensions: () => Promise<WikiExtension[]>;
  setLocalExtensions: React.Dispatch<React.SetStateAction<WikiExtension[]>>;
}

const initialDefaultThemeAppearance = getThemeAppearanceConfig(DEFAULT_EXTENSIONS);

const defaultContextValue: ExtensionsContextValue = {
  extensions: DEFAULT_EXTENSIONS,
  isLoadingExtensions: false,
  hasAttemptedInitialLoad: true,
  hasLoadedFromFirebase: true,
  extensionsLoadError: null,
  lastSyncAt: null,
  getExtension: (idOrName: string) =>
    DEFAULT_EXTENSIONS.find(e => e.id === idOrName || e.name === idOrName),
  isExtensionEnabled: (idOrName: string, fallback = true) => {
    const ext = DEFAULT_EXTENSIONS.find(e => e.id === idOrName || e.name === idOrName);
    return ext ? Boolean(ext.enabled) : fallback;
  },
  getExtensionParam: <T,>(idOrName: string, paramKey: string, fallback: T): T => {
    const ext = DEFAULT_EXTENSIONS.find(e => e.id === idOrName || e.name === idOrName);
    const param = ext?.config?.find(c => c.key === paramKey);
    return param && param.value !== undefined ? (param.value as T) : fallback;
  },
  siteTitleConfig: getSiteTitleConfig(DEFAULT_EXTENSIONS),
  themeAppearanceConfig: initialDefaultThemeAppearance,
  activeTheme: initialDefaultThemeAppearance.defaultTheme,
  setUserTheme: () => true,
  resetToDefaultTheme: () => {},
  isThemeSelectorOpen: false,
  openThemeSelector: () => {},
  closeThemeSelector: () => {},
  maintenanceConfig: getMaintenanceModeConfig(DEFAULT_EXTENSIONS),
  externalRedirectConfig: getExternalRedirectConfig(DEFAULT_EXTENSIONS),
  supportTicketsConfig: getSupportTicketsConfig(DEFAULT_EXTENSIONS),
  portalsConfig: getPortalsConfig(DEFAULT_EXTENSIONS),
  saveExtension: async (ext: WikiExtension) => ext,
  syncAllExtensions: async (list: WikiExtension[]) => ({ saved: list.length }),
  deleteExtension: async () => {},
  refreshExtensions: async () => DEFAULT_EXTENSIONS,
  retryLoadExtensions: async () => DEFAULT_EXTENSIONS,
  setLocalExtensions: () => {},
};

const ExtensionsContext = createContext<ExtensionsContextValue>(defaultContextValue);

interface ExtensionsProviderProps {
  currentUser: UserSession | null;
  children: React.ReactNode;
}

export const ExtensionsProvider: React.FC<ExtensionsProviderProps> = ({
  currentUser,
  children,
}) => {
  const [extensions, setExtensions] = useState<WikiExtension[]>(() => readCachedExtensions());
  const [isLoadingExtensions, setIsLoadingExtensions] = useState<boolean>(true);
  const [hasAttemptedInitialLoad, setHasAttemptedInitialLoad] = useState<boolean>(false);
  const [hasLoadedFromFirebase, setHasLoadedFromFirebase] = useState<boolean>(false);
  const [extensionsLoadError, setExtensionsLoadError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [userSelectedThemeId, setUserSelectedThemeId] = useState<string | null>(() =>
    readStoredUserWikiTheme()
  );
  const [isThemeSelectorOpen, setIsThemeSelectorOpen] = useState<boolean>(false);

  const performStartupLoad = useCallback(
    async (user: UserSession | null): Promise<WikiExtension[]> => {
      setIsLoadingExtensions(true);
      try {
        const loaded = await initOrSyncExtensionsOnWikiAccess(user);
        if (loaded && loaded.length > 0) {
          setExtensions(loaded);
          writeCachedExtensions(loaded);
        }
        setHasLoadedFromFirebase(true);
        setExtensionsLoadError(null);
        setLastSyncAt(new Date().toISOString());
        return loaded;
      } catch (err: any) {
        const message =
          err?.message ||
          'Não foi possível carregar as extensões do Firebase Firestore na abertura do Wiki-site.';
        setHasLoadedFromFirebase(false);
        setExtensionsLoadError(message);
        throw err;
      } finally {
        setHasAttemptedInitialLoad(true);
        setIsLoadingExtensions(false);
      }
    },
    []
  );

  // Load extension configurations strictly from Firebase during Wiki-site startup
  useEffect(() => {
    let mounted = true;
    setIsLoadingExtensions(true);

    initOrSyncExtensionsOnWikiAccess(currentUser)
      .then(loaded => {
        if (!mounted) return;
        if (loaded && loaded.length > 0) {
          setExtensions(loaded);
          writeCachedExtensions(loaded);
        }
        setHasLoadedFromFirebase(true);
        setExtensionsLoadError(null);
        setLastSyncAt(new Date().toISOString());
      })
      .catch(err => {
        if (!mounted) return;
        console.error('Critical: Failed startup extension load from Firebase:', err);
        setHasLoadedFromFirebase(false);
        setExtensionsLoadError(
          err?.message ||
            'Falha ao carregar extensões do Firebase Firestore na abertura do Wiki-site.'
        );
      })
      .finally(() => {
        if (mounted) {
          setHasAttemptedInitialLoad(true);
          setIsLoadingExtensions(false);
        }
      });

    // Live subscription so bureaucrat updates in Firebase propagate immediately across the Wiki
    const unsubscribe = subscribeToExtensionsFromFirestore(
      cloudExts => {
        if (!mounted || !cloudExts || cloudExts.length === 0) return;
        setExtensions(cloudExts);
        writeCachedExtensions(cloudExts);
        setHasLoadedFromFirebase(true);
        setExtensionsLoadError(null);
        setLastSyncAt(new Date().toISOString());
      },
      err => {
        console.warn('Notice: Extension subscription warning:', err);
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [currentUser]);

  const getExtension = useCallback(
    (idOrName: string) =>
      extensions.find(
        e => e.id === idOrName || e.name.toLowerCase() === idOrName.toLowerCase()
      ),
    [extensions]
  );

  const isExtensionEnabled = useCallback(
    (idOrName: string, fallback = true) => {
      const ext = getExtension(idOrName);
      return ext ? Boolean(ext.enabled) : fallback;
    },
    [getExtension]
  );

  const getExtensionParam = useCallback(
    <T,>(idOrName: string, paramKey: string, fallback: T): T => {
      const ext = getExtension(idOrName);
      const param = ext?.config?.find(c => c.key === paramKey);
      return param && param.value !== undefined ? (param.value as T) : fallback;
    },
    [getExtension]
  );

  const saveExtension = useCallback(
    async (ext: WikiExtension): Promise<WikiExtension> => {
      const saved = await saveExtensionToFirestore(ext, currentUser);
      setExtensions(prev => {
        const exists = prev.some(e => e.id === saved.id);
        const next = exists ? prev.map(e => (e.id === saved.id ? saved : e)) : [saved, ...prev];
        writeCachedExtensions(next);
        return next;
      });
      setHasLoadedFromFirebase(true);
      setExtensionsLoadError(null);
      setLastSyncAt(new Date().toISOString());
      return saved;
    },
    [currentUser]
  );

  const syncAllExtensions = useCallback(
    async (list: WikiExtension[]): Promise<{ saved: number }> => {
      const res = await syncAllExtensionsToFirestore(list, currentUser);
      setExtensions(list);
      writeCachedExtensions(list);
      if (res.saved > 0) {
        setHasLoadedFromFirebase(true);
        setExtensionsLoadError(null);
      }
      setLastSyncAt(new Date().toISOString());
      return res;
    },
    [currentUser]
  );

  const deleteExtension = useCallback(
    async (extensionId: string): Promise<void> => {
      await deleteExtensionFromFirestore(extensionId, currentUser);
      setExtensions(prev => {
        const next = prev.filter(e => e.id !== extensionId);
        writeCachedExtensions(next);
        return next;
      });
      setLastSyncAt(new Date().toISOString());
    },
    [currentUser]
  );

  const retryLoadExtensions = useCallback(async (): Promise<WikiExtension[]> => {
    try {
      return await performStartupLoad(currentUser);
    } catch {
      return extensions;
    }
  }, [performStartupLoad, currentUser, extensions]);

  const refreshExtensions = useCallback(async (): Promise<WikiExtension[]> => {
    return retryLoadExtensions();
  }, [retryLoadExtensions]);

  const siteTitleConfig = useMemo(() => getSiteTitleConfig(extensions), [extensions]);
  const themeAppearanceConfig = useMemo(
    () => getThemeAppearanceConfig(extensions),
    [extensions]
  );

  const activeTheme = useMemo<WikiThemeDefinition>(() => {
    if (!themeAppearanceConfig.extensionEnabled) {
      const wantsDark =
        userSelectedThemeId === 'vector-dark' ||
        userSelectedThemeId === 'high-contrast-dark';
      return resolveWikiTheme(
        wantsDark ? 'vector-dark' : 'vector-light',
        themeAppearanceConfig.availableThemes
      );
    }

    if (!themeAppearanceConfig.allowUserThemeSwitch) {
      return themeAppearanceConfig.defaultTheme;
    }

    if (userSelectedThemeId) {
      const match = themeAppearanceConfig.availableThemes.find(
        t => t.id === userSelectedThemeId
      );
      if (match) return match;
    }

    return themeAppearanceConfig.defaultTheme;
  }, [themeAppearanceConfig, userSelectedThemeId]);

  useEffect(() => {
    applyWikiThemeToDocument(activeTheme);
  }, [activeTheme]);

  const setUserTheme = useCallback(
    (themeId: string): boolean => {
      if (
        themeAppearanceConfig.extensionEnabled &&
        !themeAppearanceConfig.allowUserThemeSwitch
      ) {
        return false;
      }
      const resolved = resolveWikiTheme(themeId, themeAppearanceConfig.availableThemes);
      setUserSelectedThemeId(resolved.id);
      writeStoredUserWikiTheme(resolved);
      applyWikiThemeToDocument(resolved);
      return true;
    },
    [themeAppearanceConfig]
  );

  const resetToDefaultTheme = useCallback(() => {
    setUserSelectedThemeId(null);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(USER_THEME_STORAGE_KEY);
        window.localStorage.setItem('theme', themeAppearanceConfig.defaultTheme.colorScheme);
        window.localStorage.setItem(
          'notmediawiki_theme',
          themeAppearanceConfig.defaultTheme.colorScheme
        );
      }
    } catch {
      // Ignore storage errors
    }
    applyWikiThemeToDocument(themeAppearanceConfig.defaultTheme);
  }, [themeAppearanceConfig.defaultTheme]);

  const openThemeSelector = useCallback(() => setIsThemeSelectorOpen(true), []);
  const closeThemeSelector = useCallback(() => setIsThemeSelectorOpen(false), []);

  const maintenanceConfig = useMemo(() => getMaintenanceModeConfig(extensions), [extensions]);
  const externalRedirectConfig = useMemo(() => getExternalRedirectConfig(extensions), [extensions]);
  const supportTicketsConfig = useMemo(() => getSupportTicketsConfig(extensions), [extensions]);
  const portalsConfig = useMemo(() => getPortalsConfig(extensions), [extensions]);

  const value = useMemo<ExtensionsContextValue>(
    () => ({
      extensions,
      isLoadingExtensions,
      hasAttemptedInitialLoad,
      hasLoadedFromFirebase,
      extensionsLoadError,
      lastSyncAt,
      getExtension,
      isExtensionEnabled,
      getExtensionParam,
      siteTitleConfig,
      themeAppearanceConfig,
      activeTheme,
      setUserTheme,
      resetToDefaultTheme,
      isThemeSelectorOpen,
      openThemeSelector,
      closeThemeSelector,
      maintenanceConfig,
      externalRedirectConfig,
      supportTicketsConfig,
      portalsConfig,
      saveExtension,
      syncAllExtensions,
      deleteExtension,
      refreshExtensions,
      retryLoadExtensions,
      setLocalExtensions: setExtensions,
    }),
    [
      extensions,
      isLoadingExtensions,
      hasAttemptedInitialLoad,
      hasLoadedFromFirebase,
      extensionsLoadError,
      lastSyncAt,
      getExtension,
      isExtensionEnabled,
      getExtensionParam,
      siteTitleConfig,
      themeAppearanceConfig,
      activeTheme,
      setUserTheme,
      resetToDefaultTheme,
      isThemeSelectorOpen,
      openThemeSelector,
      closeThemeSelector,
      maintenanceConfig,
      externalRedirectConfig,
      supportTicketsConfig,
      portalsConfig,
      saveExtension,
      syncAllExtensions,
      deleteExtension,
      refreshExtensions,
      retryLoadExtensions,
    ]
  );

  return (
    <ExtensionsContext.Provider value={value}>
      {children}
    </ExtensionsContext.Provider>
  );
};

export function useExtensions(): ExtensionsContextValue {
  return useContext(ExtensionsContext);
}
