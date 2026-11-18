import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { DataRemovalRequest, UserSession } from '../types';
import {
  auth,
  fetchDataRemovalsFromFirestore,
  saveDataRemovalToFirestore,
  deleteDataRemovalFromFirestore,
  subscribeToDataRemovalsFromFirestore,
} from '../firebase';

export interface CreateLgpdRequestInput {
  requesterNameOrAlias: string;
  requesterEmail?: string;
  legalBasis: DataRemovalRequest['legalBasis'];
  targetSlug: string;
  targetRevisionId?: string;
  description: string;
}

export interface LgpdRequestsContextValue {
  requests: DataRemovalRequest[];
  isLoading: boolean;
  error: string | null;
  pendingCount: number;
  processedCount: number;
  rejectedCount: number;
  createRequest: (input: CreateLgpdRequestInput) => Promise<DataRemovalRequest>;
  processRequest: (id: string, actionLabel: string, processedBy?: string) => Promise<DataRemovalRequest | null>;
  rejectRequest: (id: string, reason: string, processedBy?: string) => Promise<DataRemovalRequest | null>;
  deleteRequest: (id: string) => Promise<void>;
  refreshRequests: () => Promise<void>;
  seedInitialRequests: () => Promise<void>;
}

const LgpdRequestsContext = createContext<LgpdRequestsContextValue | undefined>(undefined);

const STORAGE_CACHE_KEY = 'notmediawiki_lgpd_requests_cache';

export const INITIAL_LGPD_SEED_REQUESTS: DataRemovalRequest[] = [
  {
    id: 'rem-1',
    protocolNumber: 'LGPD-2026-089',
    requesterNameOrAlias: 'Cidadão_SP (Nome civil sob sigilo)',
    requesterEmail: 'titular.dados@email.com',
    legalBasis: 'Doxxing',
    targetSlug: 'MediaWiki',
    targetRevisionId: 'rev-103',
    description:
      'Vazamento de número de CPF, telefone celular particular e endereço residencial em sumário de edição e notas de rodapé de artigo público.',
    status: 'pendente',
    createdAt: '2026-10-11T17:40:00Z',
  },
  {
    id: 'rem-2',
    protocolNumber: 'LGPD-2026-074',
    requesterNameOrAlias: 'Maria Souza Silva',
    requesterEmail: 'maria.souza@provedor.com.br',
    legalBasis: 'LGPD_Art18',
    targetSlug: 'Teste',
    targetRevisionId: 'rev-101',
    description:
      'Solicitação expressa de eliminação de dados biográficos não consentidos e desatualizados, com base no Art. 18, inciso VI da Lei Geral de Proteção de Dados (LGPD).',
    status: 'processado',
    actionsTaken: [
      'Revision Deletion executada na revisão #rev-101',
      'Supressão de nome de usuário dos logs públicos',
      'Certificado de eliminação emitido ao titular',
    ],
    processedBy: 'Burocrata_Wazzima',
    createdAt: '2026-10-09T10:15:00Z',
    processedAt: '2026-10-09T11:30:00Z',
  },
  {
    id: 'rem-3',
    protocolNumber: 'JUD-2026-012',
    requesterNameOrAlias: 'Vara Cível da Comarca de Curitiba / TJPR',
    requesterEmail: 'oficio.judicial@tjpr.jus.br',
    legalBasis: 'OrdemJudicial',
    targetSlug: 'Parsoid',
    targetRevisionId: 'rev-102',
    description:
      'Cumprimento de decisão liminar em tutela de urgência (Processo nº 0023491-88.2026.8.16.0001) para remoção de conteúdo sob pena de multa diária (Art. 19 Marco Civil).',
    status: 'processado',
    actionsTaken: [
      'Supressão definitiva via Oversight em 2 horas',
      'Preservação de logs sob segredo de justiça nos termos do Art. 15 da Lei 12.965/14',
    ],
    processedBy: 'Burocrata_Wazzima',
    createdAt: '2026-10-07T08:00:00Z',
    processedAt: '2026-10-07T09:45:00Z',
  },
];

function sortByCreatedAtDesc(items: DataRemovalRequest[]): DataRemovalRequest[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function readCachedRequests(): DataRemovalRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sortByCreatedAtDesc(parsed) : [];
  } catch {
    return [];
  }
}

function persistCachedRequests(items: DataRemovalRequest[]): void {
  try {
    localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

interface LgpdRequestsProviderProps {
  currentUser: UserSession | null;
  initialRequests?: DataRemovalRequest[];
  disableFirestoreSync?: boolean;
  children: React.ReactNode;
}

export const LgpdRequestsProvider: React.FC<LgpdRequestsProviderProps> = ({
  currentUser,
  initialRequests,
  disableFirestoreSync = false,
  children,
}) => {
  const [requests, setRequests] = useState<DataRemovalRequest[]>(() => {
    if (initialRequests) return sortByCreatedAtDesc(initialRequests);
    return readCachedRequests();
  });
  const [isLoading, setIsLoading] = useState<boolean>(!initialRequests && !disableFirestoreSync);
  const [error, setError] = useState<string | null>(null);

  const updateRequestsState = useCallback(
    (updater: DataRemovalRequest[] | ((prev: DataRemovalRequest[]) => DataRemovalRequest[])) => {
      setRequests(prev => {
        const next = sortByCreatedAtDesc(
          typeof updater === 'function' ? updater(prev) : updater
        );
        persistCachedRequests(next);
        return next;
      });
    },
    []
  );

  const refreshRequests = useCallback(async () => {
    if (disableFirestoreSync) return;
    setIsLoading(true);
    setError(null);
    try {
      const cloudRemovals = await fetchDataRemovalsFromFirestore();
      updateRequestsState(cloudRemovals || []);
    } catch (err: any) {
      console.warn('LGPD global state sync notice:', err);
      setError(err?.message || 'Não foi possível sincronizar as solicitações LGPD com o Firestore.');
    } finally {
      setIsLoading(false);
    }
  }, [disableFirestoreSync, updateRequestsState]);

  useEffect(() => {
    if (disableFirestoreSync) {
      setIsLoading(false);
      return;
    }

    // Only attach Firestore listeners when user is authenticated to respect Firestore rules
    const fbUid = auth.currentUser?.uid;
    if (!currentUser && !fbUid) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchDataRemovalsFromFirestore()
      .then(cloudRemovals => {
        if (!isMounted) return;
        updateRequestsState(cloudRemovals || []);
        setIsLoading(false);
      })
      .catch(err => {
        if (!isMounted) return;
        console.warn('Firestore DataRemovals initial fetch notice:', err);
        setError(err?.message || null);
        setIsLoading(false);
      });

    const unsubscribe = subscribeToDataRemovalsFromFirestore(
      updated => {
        if (isMounted) {
          updateRequestsState(updated || []);
          setIsLoading(false);
          setError(null);
        }
      },
      err => {
        if (isMounted) {
          console.warn('Firestore DataRemovals subscription notice:', err);
          setError(err?.message || 'Permissão insuficiente para sincronização em tempo real.');
          setIsLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [currentUser?.id, disableFirestoreSync, updateRequestsState]);

  const createRequest = useCallback(
    async (input: CreateLgpdRequestInput): Promise<DataRemovalRequest> => {
      const year = new Date().getFullYear();
      const seq = String(requests.length + 90).padStart(3, '0');
      const prefix = input.legalBasis === 'OrdemJudicial' ? 'JUD' : 'LGPD';

      const newReq: DataRemovalRequest = {
        id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: auth.currentUser?.uid || currentUser?.id,
        protocolNumber: `${prefix}-${year}-${seq}`,
        requesterNameOrAlias: input.requesterNameOrAlias.trim(),
        requesterEmail: input.requesterEmail?.trim() || undefined,
        legalBasis: input.legalBasis,
        targetSlug: input.targetSlug.trim(),
        targetRevisionId: input.targetRevisionId?.trim() || undefined,
        description: input.description.trim(),
        status: 'pendente',
        createdAt: new Date().toISOString(),
      };

      updateRequestsState(prev => [newReq, ...prev.filter(r => r.id !== newReq.id)]);

      if (!disableFirestoreSync && (auth.currentUser || currentUser)) {
        try {
          await saveDataRemovalToFirestore(newReq);
        } catch (err: any) {
          setError(err?.message || 'Solicitação registrada localmente; falha ao sincronizar no Firestore.');
        }
      }

      return newReq;
    },
    [currentUser, disableFirestoreSync, requests.length, updateRequestsState]
  );

  const processRequest = useCallback(
    async (
      id: string,
      actionLabel: string,
      processedBy?: string
    ): Promise<DataRemovalRequest | null> => {
      const target = requests.find(r => r.id === id);
      if (!target) return null;

      const actor = processedBy || currentUser?.username || 'Burocrata NotMediaWiki';
      const updated: DataRemovalRequest = {
        ...target,
        status: 'processado',
        actionsTaken: [...(target.actionsTaken || []), `${actionLabel} executada por ${actor}`],
        processedBy: actor,
        processedAt: new Date().toISOString(),
      };

      updateRequestsState(prev => prev.map(r => (r.id === id ? updated : r)));

      if (!disableFirestoreSync && (auth.currentUser || currentUser)) {
        try {
          await saveDataRemovalToFirestore(updated);
        } catch (err: any) {
          setError(err?.message || 'Atualizado no estado global; falha ao persistir no Firestore.');
        }
      }

      return updated;
    },
    [currentUser, disableFirestoreSync, requests, updateRequestsState]
  );

  const rejectRequest = useCallback(
    async (
      id: string,
      reason: string,
      processedBy?: string
    ): Promise<DataRemovalRequest | null> => {
      const trimmedReason = reason.trim();
      if (!trimmedReason) return null;

      const target = requests.find(r => r.id === id);
      if (!target) return null;

      const actor = processedBy || currentUser?.username || 'Burocrata NotMediaWiki';
      const updated: DataRemovalRequest = {
        ...target,
        status: 'rejeitado',
        actionsTaken: [...(target.actionsTaken || []), `Pedido indeferido: ${trimmedReason}`],
        processedBy: actor,
        processedAt: new Date().toISOString(),
      };

      updateRequestsState(prev => prev.map(r => (r.id === id ? updated : r)));

      if (!disableFirestoreSync && (auth.currentUser || currentUser)) {
        try {
          await saveDataRemovalToFirestore(updated);
        } catch (err: any) {
          setError(err?.message || 'Indeferimento salvo localmente; falha ao persistir no Firestore.');
        }
      }

      return updated;
    },
    [currentUser, disableFirestoreSync, requests, updateRequestsState]
  );

  const deleteRequest = useCallback(
    async (id: string): Promise<void> => {
      updateRequestsState(prev => prev.filter(r => r.id !== id));

      if (!disableFirestoreSync && (auth.currentUser || currentUser)) {
        try {
          await deleteDataRemovalFromFirestore(id);
        } catch (err: any) {
          setError(err?.message || 'Removido do estado global; falha ao expurgar no Firestore.');
        }
      }
    },
    [currentUser, disableFirestoreSync, updateRequestsState]
  );

  const seedInitialRequests = useCallback(async (): Promise<void> => {
    const uid = auth.currentUser?.uid || currentUser?.id;
    const seeded = INITIAL_LGPD_SEED_REQUESTS.map(item => ({
      ...item,
      userId: item.userId || uid,
    }));

    updateRequestsState(prev => {
      const existingIds = new Set(prev.map(r => r.id));
      const merged = [...prev, ...seeded.filter(s => !existingIds.has(s.id))];
      return merged;
    });

    if (!disableFirestoreSync && (auth.currentUser || currentUser)) {
      for (const item of seeded) {
        try {
          await saveDataRemovalToFirestore(item);
        } catch (err: any) {
          setError(err?.message || 'Erro ao gravar solicitações iniciais no Firestore.');
        }
      }
    }
  }, [currentUser, disableFirestoreSync, updateRequestsState]);

  const counts = useMemo(() => {
    let pendingCount = 0;
    let processedCount = 0;
    let rejectedCount = 0;
    for (const r of requests) {
      if (r.status === 'pendente') pendingCount++;
      else if (r.status === 'processado') processedCount++;
      else if (r.status === 'rejeitado') rejectedCount++;
    }
    return { pendingCount, processedCount, rejectedCount };
  }, [requests]);

  const value = useMemo<LgpdRequestsContextValue>(
    () => ({
      requests,
      isLoading,
      error,
      pendingCount: counts.pendingCount,
      processedCount: counts.processedCount,
      rejectedCount: counts.rejectedCount,
      createRequest,
      processRequest,
      rejectRequest,
      deleteRequest,
      refreshRequests,
      seedInitialRequests,
    }),
    [
      requests,
      isLoading,
      error,
      counts.pendingCount,
      counts.processedCount,
      counts.rejectedCount,
      createRequest,
      processRequest,
      rejectRequest,
      deleteRequest,
      refreshRequests,
      seedInitialRequests,
    ]
  );

  return (
    <LgpdRequestsContext.Provider value={value}>
      {children}
    </LgpdRequestsContext.Provider>
  );
};

export function useLgpdRequests(): LgpdRequestsContextValue {
  const ctx = useContext(LgpdRequestsContext);
  if (!ctx) {
    throw new Error('useLgpdRequests deve ser usado dentro de um LgpdRequestsProvider.');
  }
  return ctx;
}
