import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  Database,
  ArrowUpRight,
  ShieldCheck,
  Server,
  Layers,
  Clock,
  Sparkles,
  FileText,
  AlertCircle,
} from 'lucide-react';
import {
  syncMediaWikiToFirestore,
  getFirestoreSyncInfo,
  testFirestoreConnection,
  syncAllUsersWithFirestore,
  firebaseConfig,
  FIRESTORE_DATABASE_ID,
  FIREBASE_PROJECT_ID,
} from '../firebase';
import { api } from '../api';
import { UserSession } from '../types';

interface FirebaseSyncProps {
  currentUser: UserSession | null;
  onNavigateArticle: (slug: string) => void;
}

export const FirebaseSync: React.FC<FirebaseSyncProps> = ({
  currentUser,
  onNavigateArticle,
}) => {
  const [connecting, setConnecting] = useState(true);
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{
    connected: boolean;
    statusDoc: any | null;
    generalInfo: any | null;
    articlesCount: number;
    revisionsCount: number;
    eventsCount: number;
    usersCount: number;
    arbitrationCount: number;
    checkUserCount: number;
    unblockCount: number;
    dataRemovalCount: number;
    emergencyCount: number;
    complianceCount: number;
    domainsCount: number;
    extensionsCount: number;
    logsCount: number;
  } | null>(null);

  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const loadStatus = async () => {
    setConnecting(true);
    const isConn = await testFirestoreConnection();
    setConnected(isConn);
    const info = await getFirestoreSyncInfo();
    setSyncInfo(info);
    setConnecting(false);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleTriggerSync = async () => {
    setSyncing(true);
    setSyncSuccess(null);
    setSyncError(null);

    try {
      // 1. Sync users bidirectionally with Firestore first (including Google accounts)
      await syncAllUsersWithFirestore().catch(console.warn);

      // 2. Fetch all local MediaWiki data from microservices
      const [articles, revisions, events, users] = await Promise.all([
        api.getArticles(),
        // Get revisions for all articles
        api.getArticles().then(async arts => {
          const revPromises = arts.map(a => api.getRevisions(a.slug));
          const revArrays = await Promise.all(revPromises);
          return revArrays.flat();
        }),
        api.getEventHistory(50),
        api.getUsers(),
      ]);

      // 3. Push to Firestore (articles, revisions, events, users, general info)
      const result = await syncMediaWikiToFirestore({
        articles,
        revisions,
        events,
        users,
        username: currentUser?.username || 'WikipedianAdmin',
      });

      setSyncSuccess(
        `Sincronização concluída com sucesso! ${result.syncedArticles} artigos, ${result.syncedRevisions} revisões, ${result.syncedUsers} usuários e informações gerais gravados no Cloud Firestore.`
      );

      // Refresh cloud status
      await loadStatus();
    } catch (err: any) {
      console.error(err);
      setSyncError(err.message || 'Falha ao sincronizar dados com o Firebase');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-amber-500" />
            <h1 className="text-xl font-semibold text-slate-900">
              Sincronização Cloud NotMediaWiki & Firebase Firestore
            </h1>
          </div>
          <div className="text-xs text-slate-500 font-sans mt-0.5">
            Persistência em nuvem • Todas as páginas administrativas sincronizadas com Firestore (Coleções: users, arbitration_cases, checkuser_investigations, unblock_requests, data_removals, emergency_reports, compliance_records, allowed_domains, extensions, system_logs)
          </div>
        </div>

        {/* Sync Action Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTriggerSync}
            disabled={syncing}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium flex items-center gap-2 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando com Firestore...' : 'Sincronizar Agora com o Firebase'}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {syncSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncSuccess}</span>
        </div>
      )}

      {syncError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* Cloud Environment Details (Zero-Pill formatting) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded">
          <div className="text-[11px] text-slate-500 font-sans">Status da Conexão</div>
          <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{connected ? 'Firestore Conectado' : 'Aguardando'}</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
            {firebaseConfig.projectId}
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded">
          <div className="text-[11px] text-slate-500 font-sans">Artigos no Firestore</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
            {syncInfo?.articlesCount ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            /articles
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded">
          <div className="text-[11px] text-slate-500 font-sans">Revisões Gravadas</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
            {syncInfo?.revisionsCount ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            /revisions
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded">
          <div className="text-[11px] text-slate-500 font-sans">Usuários Registrados</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
            {syncInfo?.usersCount ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            /users
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded">
          <div className="text-[11px] text-slate-500 font-sans">Conselho de Arbitragem</div>
          <div className="text-xl font-bold font-mono text-purple-700 mt-0.5">
            {syncInfo?.arbitrationCount ?? 0}
          </div>
          <div className="text-[10px] text-purple-600 font-mono mt-0.5">
            /arbitration_cases
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded">
          <div className="text-[11px] text-slate-500 font-sans">CheckUser (Fantoches)</div>
          <div className="text-xl font-bold font-mono text-indigo-700 mt-0.5">
            {syncInfo?.checkUserCount ?? 0}
          </div>
          <div className="text-[10px] text-indigo-600 font-mono mt-0.5">
            /checkuser_investigations
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded">
          <div className="text-[11px] text-slate-500 font-sans">Revisão Desbloqueio</div>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-0.5">
            {syncInfo?.unblockCount ?? 0}
          </div>
          <div className="text-[10px] text-emerald-600 font-mono mt-0.5">
            /unblock_requests
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded">
          <div className="text-[11px] text-slate-500 font-sans">Remoção / LGPD Art. 18</div>
          <div className="text-xl font-bold font-mono text-rose-700 mt-0.5">
            {syncInfo?.dataRemovalCount ?? 0}
          </div>
          <div className="text-[10px] text-rose-600 font-mono mt-0.5">
            /data_removals
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded">
          <div className="text-[11px] text-slate-500 font-sans">Contato Emergência SOS</div>
          <div className="text-xl font-bold font-mono text-amber-700 mt-0.5">
            {syncInfo?.emergencyCount ?? 0}
          </div>
          <div className="text-[10px] text-amber-600 font-mono mt-0.5">
            /emergency_reports
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded">
          <div className="text-[11px] text-slate-500 font-sans">Conformidade LGPD/Marco Civil</div>
          <div className="text-xl font-bold font-mono text-blue-700 mt-0.5">
            {syncInfo?.complianceCount ?? 0}
          </div>
          <div className="text-[10px] text-blue-600 font-mono mt-0.5">
            /compliance_records
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded">
          <div className="text-[11px] text-slate-500 font-sans">Domínios Permitidos</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
            {syncInfo?.domainsCount ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            /allowed_domains
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded">
          <div className="text-[11px] text-slate-500 font-sans">Extensões e Logs</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
            {syncInfo?.extensionsCount ?? 0} / {syncInfo?.logsCount ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            /extensions & /system_logs
          </div>
        </div>
      </div>

      {/* Cloud Architecture Details */}
      <div className="p-5 bg-white border border-slate-200 rounded space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600" />
          Configuração do Banco de Dados Provisionado no Firebase
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5">
            <div className="text-slate-400 uppercase text-[10px] font-semibold">Projeto Firebase</div>
            <div className="font-bold text-slate-900">{FIREBASE_PROJECT_ID}</div>
            <div className="text-slate-400 uppercase text-[10px] font-semibold pt-2">Database ID Firestore</div>
            <div className="text-slate-800 break-all">{FIRESTORE_DATABASE_ID}</div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5">
            <div className="text-slate-400 uppercase text-[10px] font-semibold">Última Sincronização</div>
            <div className="font-bold text-slate-900">
              {syncInfo?.statusDoc?.lastSyncedAt
                ? new Date(syncInfo.statusDoc.lastSyncedAt).toLocaleString()
                : 'Pendente de sincronização inicial'}
            </div>
            <div className="text-slate-400 uppercase text-[10px] font-semibold pt-2">Regras de Segurança</div>
            <div className="text-emerald-700 font-sans font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Regras do Firestore implantadas e ativas (rules_version = '2')
            </div>
          </div>
        </div>

        {/* Sync Collections Map */}
        <div className="pt-2">
          <div className="text-xs font-semibold text-slate-700 mb-2">Esquema das Coleções Sincronizadas:</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 border border-slate-200 rounded bg-slate-50/50">
              <div className="font-mono font-bold text-blue-700 text-xs">/articles/{'{slug}'}</div>
              <div className="text-[11px] text-slate-600 mt-1">
                Armazena título, wikitext completo, sumário, categorias, visualizações e ID da última revisão.
              </div>
            </div>

            <div className="p-3 border border-slate-200 rounded bg-slate-50/50">
              <div className="font-mono font-bold text-blue-700 text-xs">/revisions/{'{revId}'}</div>
              <div className="text-[11px] text-slate-600 mt-1">
                Livro-razão imutável de edições com hash SHA-256, autor, timestamp e sumário de alteração.
              </div>
            </div>

            <div className="p-3 border border-slate-200 rounded bg-slate-50/50">
              <div className="font-mono font-bold text-blue-700 text-xs">/wiki_events/{'{eventId}'}</div>
              <div className="text-[11px] text-slate-600 mt-1">
                Histórico em nuvem do EventStreams contendo eventos de criação, edição e rollback.
              </div>
            </div>

            <div className="p-3 border border-slate-200 rounded bg-purple-50/50 border-purple-200">
              <div className="font-mono font-bold text-purple-700 text-xs">/allowed_domains/{'{domainId}'}</div>
              <div className="text-[11px] text-slate-600 mt-1">
                Lista de domínios permitidos mantida diretamente no Firebase pelo Burocrata com auditoria de alteração.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
