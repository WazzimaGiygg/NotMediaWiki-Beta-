import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { UserSession, WikiExtension } from '../types';
import { DEFAULT_EXTENSIONS } from '../data/defaultExtensions';
import {
  initOrSyncExtensionsOnWikiAccess,
  subscribeToExtensionsFromFirestore,
  fetchExtensionsFromFirestore,
  saveExtensionToFirestore,
  syncAllExtensionsToFirestore,
  deleteExtensionFromFirestore,
  mergeExtensionsWithDefaults,
} from '../firebase';
import { getMaintenanceModeConfig } from '../extensions/maintenanceModeExtension';
import { getExternalRedirectConfig } from '../extensions/externalRedirectExtension';
import { getSupportTicketsConfig } from '../extensions/supportTicketsExtension';
import { getPortalsConfig } from '../extensions/portalsExtension';

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
  hasLoadedFromFirebase: boolean;
  lastSyncAt: string | null;
  getExtension: (idOrName: string) => WikiExtension | undefined;
  isExtensionEnabled: (idOrName: string, fallback?: boolean) => boolean;
  getExtensionParam: <T = any>(idOrName: string, paramKey: string, fallback: T) => T;
  maintenanceConfig: ReturnType<typeof getMaintenanceModeConfig>;
  externalRedirectConfig: ReturnType<typeof getExternalRedirectConfig>;
  supportTicketsConfig: ReturnType<typeof getSupportTicketsConfig>;
  portalsConfig: ReturnType<typeof getPortalsConfig>;
  saveExtension: (ext: WikiExtension) => Promise<WikiExtension>;
  syncAllExtensions: (list: WikiExtension[]) => Promise<{ saved: number }>;
  deleteExtension: (extensionId: string) => Promise<void>;
  refreshExtensions: () => Promise<WikiExtension[]>;
  setLocalExtensions: React.Dispatch<React.SetStateAction<WikiExtension[]>>;
}

const defaultContextValue: ExtensionsContextValue = {
  extensions: DEFAULT_EXTENSIONS,
  isLoadingExtensions: false,
  hasLoadedFromFirebase: false,
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
  maintenanceConfig: getMaintenanceModeConfig(DEFAULT_EXTENSIONS),
  externalRedirectConfig: getExternalRedirectConfig(DEFAULT_EXTENSIONS),
  supportTicketsConfig: getSupportTicketsConfig(DEFAULT_EXTENSIONS),
  portalsConfig: getPortalsConfig(DEFAULT_EXTENSIONS),
  saveExtension: async (ext: WikiExtension) => ext,
  syncAllExtensions: async (list: WikiExtension[]) => ({ saved: list.length }),
  deleteExtension: async () => {},
  refreshExtensions: async () => DEFAULT_EXTENSIONS,
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
  const [hasLoadedFromFirebase, setHasLoadedFromFirebase] = useState<boolean>(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  // Load extension configurations from Firebase during Wiki-site startup
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
        setLastSyncAt(new Date().toISOString());
      })
      .catch(err => {
        console.warn('Notice: Failed startup extension load from Firebase:', err);
      })
      .finally(() => {
        if (mounted) {
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

  const refreshExtensions = useCallback(async (): Promise<WikiExtension[]> => {
    const cloudExts = await fetchExtensionsFromFirestore();
    if (cloudExts && cloudExts.length > 0) {
      const merged = mergeExtensionsWithDefaults(cloudExts, DEFAULT_EXTENSIONS);
      setExtensions(merged);
      writeCachedExtensions(merged);
      setLastSyncAt(new Date().toISOString());
      return merged;
    }
    return extensions;
  }, [extensions]);

  const maintenanceConfig = useMemo(() => getMaintenanceModeConfig(extensions), [extensions]);
  const externalRedirectConfig = useMemo(() => getExternalRedirectConfig(extensions), [extensions]);
  const supportTicketsConfig = useMemo(() => getSupportTicketsConfig(extensions), [extensions]);
  const portalsConfig = useMemo(() => getPortalsConfig(extensions), [extensions]);

  const value = useMemo<ExtensionsContextValue>(
    () => ({
      extensions,
      isLoadingExtensions,
      hasLoadedFromFirebase,
      lastSyncAt,
      getExtension,
      isExtensionEnabled,
      getExtensionParam,
      maintenanceConfig,
      externalRedirectConfig,
      supportTicketsConfig,
      portalsConfig,
      saveExtension,
      syncAllExtensions,
      deleteExtension,
      refreshExtensions,
      setLocalExtensions: setExtensions,
    }),
    [
      extensions,
      isLoadingExtensions,
      hasLoadedFromFirebase,
      lastSyncAt,
      getExtension,
      isExtensionEnabled,
      getExtensionParam,
      maintenanceConfig,
      externalRedirectConfig,
      supportTicketsConfig,
      portalsConfig,
      saveExtension,
      syncAllExtensions,
      deleteExtension,
      refreshExtensions,
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
