import React, { useState, useEffect } from 'react';
import {
  Server,
  Cloud,
  Clock,
  Radio,
  Layers,
  Terminal,
  Shield,
  Activity,
  Cpu,
  Database,
  ArrowRight,
  Sparkles,
  Users,
  ScrollText,
  Puzzle,
  Globe,
  Scale,
  Fingerprint,
  Unlock,
  Trash2,
  Siren,
  ShieldAlert,
  HeartHandshake,
  Award,
  Bot,
} from 'lucide-react';
import { HistoryDiff } from './HistoryDiff';
import { MeshTopology } from './MeshTopology';
import { FirebaseSync } from './FirebaseSync';
import { EventStreamViewer } from './EventStreamViewer';
import { MigrationExplorer } from './MigrationExplorer';
import { ApiWorkbench } from './ApiWorkbench';
import { UserManagement } from './UserManagement';
import { SystemLogs } from './SystemLogs';
import { ExtensionsManager } from './ExtensionsManager';
import { AllowedDomainsManager } from './AllowedDomainsManager';
import { ArbitrationCouncil } from './admin/ArbitrationCouncil';
import { CheckUserVerification } from './admin/CheckUserVerification';
import { UnblockEvaluation } from './admin/UnblockEvaluation';
import { DataRemovalRequests } from './admin/DataRemovalRequests';
import { EmergencyContact } from './admin/EmergencyContact';
import { LgpdMarcoCivilRules } from './admin/LgpdMarcoCivilRules';
import { VpnAdminChecker } from './admin/VpnAdminChecker';
import { BlpEthicsCouncil } from './admin/BlpEthicsCouncil';
import { ChecklistGamificationAdmin } from './admin/ChecklistGamificationAdmin';
import { BotAgentManager } from './admin/BotAgentManager';
import { UserSession, Article, WikiExtension } from '../types';
import { api } from '../api';
import { isFeatureExtensionEnabled } from '../extensions';

interface DevAdminDashboardProps {
  activeArticleSlug: string;
  currentUser: UserSession | null;
  onUserChanged?: (user: UserSession) => void;
  onNavigateArticle: (slug: string) => void;
  onBackToReader: () => void;
  initialTab?: string;
}

export const DevAdminDashboard: React.FC<DevAdminDashboardProps> = ({
  activeArticleSlug,
  currentUser,
  onUserChanged,
  onNavigateArticle,
  onBackToReader,
  initialTab = 'users',
}) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [selectedArticleSlug, setSelectedArticleSlug] = useState<string>(activeArticleSlug);
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [extensions, setExtensions] = useState<WikiExtension[]>(() => {
    try {
      const saved = localStorage.getItem('notmediawiki_extensions');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  useEffect(() => {
    setSelectedArticleSlug(activeArticleSlug);
  }, [activeArticleSlug]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    api.getArticles().then(setAllArticles).catch(console.error);
    api.getExtensions().then(exts => {
      if (exts && exts.length > 0) setExtensions(exts);
    }).catch(console.warn);

    const unsub = api.subscribeExtensions(exts => {
      if (exts && exts.length > 0) setExtensions(exts);
    });
    return () => unsub();
  }, []);

  const [categoryFilter, setCategoryFilter] = useState<'todos' | 'governanca' | 'sistema'>('todos');

  // Verificar se cada recurso está habilitado via arquivo da extensão / runtime
  const isLogsEnabled = isFeatureExtensionEnabled('logs', extensions);
  const isMeshEnabled = isFeatureExtensionEnabled('mesh', extensions);
  const isEventsEnabled = isFeatureExtensionEnabled('events', extensions);
  const isMigrationEnabled = isFeatureExtensionEnabled('migration', extensions);
  const isWorkbenchEnabled = isFeatureExtensionEnabled('workbench', extensions);
  const isBotsEnabled = isFeatureExtensionEnabled('bots', extensions);

  const adminTabs = [
    // Governança, Jurídico & Compliance (Solicitados pelo usuário)
    { id: 'arbitration', label: 'Conselho de Arbitragem', icon: Scale, badge: 'ArbCom', category: 'governanca', enabled: true },
    { id: 'checkuser', label: 'Verificação de Contas (Fantoches)', icon: Fingerprint, badge: 'CheckUser', category: 'governanca', enabled: true },
    { id: 'unblock', label: 'Avaliação de Desbloqueio', icon: Unlock, badge: 'Revisão', category: 'governanca', enabled: true },
    { id: 'data_removal', label: 'Pedido de Remoção de Dados', icon: Trash2, badge: 'Oversight', category: 'governanca', enabled: true },
    { id: 'emergency', label: 'Contato de Emergência', icon: Siren, badge: '24/7 SOS', category: 'governanca', enabled: true },
    { id: 'lgpd_rules', label: 'Regras LGPD e Marco Civil', icon: Shield, badge: 'Legislação BR', category: 'governanca', enabled: true },
    { id: 'blp_ethics', label: 'Conselho de Ética (Pessoas Vivas)', icon: HeartHandshake, badge: 'WP:BLP', category: 'governanca', enabled: true },
    // Moderação & Administração
    { id: 'users', label: 'Gerenciamento de Usuários', icon: Users, badge: 'Moderação', category: 'governanca', enabled: true },
    { id: 'domains', label: 'Domínios Permitidos', icon: Globe, badge: 'Burocrata', category: 'governanca', enabled: true },
    // Sistema, Extensões & Infraestrutura
    { id: 'bots', label: 'Agente de Bots (4.1.1.8T.1)', icon: Bot, badge: isBotsEnabled ? '4.1.1.8T' : 'Desativado', category: 'sistema', enabled: isBotsEnabled },
    { id: 'daily_checklist', label: 'Checklist Diário & Pontos', icon: Award, badge: '3.05.8.b', category: 'sistema', enabled: true },
    { id: 'vpn_checker', label: 'Verificador de VPN e Redes', icon: ShieldAlert, badge: 'Anti-Proxy', category: 'sistema', enabled: true },
    { id: 'extensions', label: 'Extensões do Sistema', icon: Puzzle, badge: 'Special:Version', category: 'sistema', enabled: true },
    { id: 'firebase', label: 'Firebase Cloud', icon: Cloud, badge: 'Firestore', category: 'sistema', enabled: true },
    { id: 'history', label: 'Histórico & Diffs', icon: Clock, badge: 'Ledger', category: 'sistema', enabled: true },
    { id: 'logs', label: 'Logs de Microsserviços', icon: ScrollText, badge: isLogsEnabled ? 'Realtime' : 'Desativado', category: 'sistema', enabled: isLogsEnabled },
    { id: 'mesh', label: 'Service Mesh & Telemetria', icon: Server, badge: isMeshEnabled ? 'Cluster' : 'Desativado', category: 'sistema', enabled: isMeshEnabled },
    { id: 'events', label: 'EventStreams', icon: Radio, badge: isEventsEnabled ? 'SSE / Kafka' : 'Desativado', category: 'sistema', enabled: isEventsEnabled },
    { id: 'migration', label: 'PHP Migration', icon: Layers, badge: isMigrationEnabled ? 'Rosetta' : 'Desativado', category: 'sistema', enabled: isMigrationEnabled },
    { id: 'workbench', label: 'API Workbench', icon: Terminal, badge: isWorkbenchEnabled ? 'REST' : 'Desativado', category: 'sistema', enabled: isWorkbenchEnabled },
  ];

  const visibleTabs = adminTabs.filter(tab => {
    if (categoryFilter === 'governanca') return tab.category === 'governanca';
    if (categoryFilter === 'sistema') return tab.category === 'sistema';
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner: Central Desenvolvedor e Administrador */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Painel do Desenvolvedor e Administrador
              </h1>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-700">
                NotMediaWiki • WazzimaGiygg
              </span>
            </div>
            <div className="text-xs text-slate-500 font-sans mt-1">
              Console unificado de governança jurídica, conformidade LGPD/Marco Civil, controle de malha, auditoria e moderação avançada.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onBackToReader}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors cursor-pointer"
            >
              Voltar ao Leitor de Artigos
            </button>
          </div>
        </div>

        {/* Quick Category Filter Pills */}
        <div className="flex items-center gap-2 pt-3">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Áreas:</span>
          {[
            { id: 'todos', label: 'Todas as Seções (16)' },
            { id: 'governanca', label: '⚖️ Governança, Jurídico & LGPD (8)' },
            { id: 'sistema', label: '⚙️ Sistema & Infraestrutura (8)' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id as any)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                categoryFilter === cat.id
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sub-Navigation Tabs (Segmented Controls) */}
        <div className="pt-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-md w-max min-w-full sm:min-w-0">
            {visibleTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  <span className="text-[10px] font-mono text-slate-400 font-normal hidden lg:inline">
                    · {tab.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Specific Content */}
      <div className="bg-slate-50/30 rounded-lg">
        {activeTab === 'arbitration' && (
          <ArbitrationCouncil currentUser={currentUser} />
        )}

        {activeTab === 'checkuser' && (
          <CheckUserVerification currentUser={currentUser} />
        )}

        {activeTab === 'unblock' && (
          <UnblockEvaluation currentUser={currentUser} />
        )}

        {activeTab === 'data_removal' && (
          <DataRemovalRequests currentUser={currentUser} />
        )}

        {activeTab === 'emergency' && (
          <EmergencyContact currentUser={currentUser} />
        )}

        {activeTab === 'lgpd_rules' && (
          <LgpdMarcoCivilRules currentUser={currentUser} />
        )}

        {activeTab === 'blp_ethics' && (
          <BlpEthicsCouncil
            currentUser={currentUser}
            onNavigateArticle={onNavigateArticle}
          />
        )}

        {activeTab === 'users' && (
          <UserManagement
            currentUser={currentUser}
            onUserChanged={onUserChanged}
          />
        )}

        {activeTab === 'domains' && (
          <AllowedDomainsManager currentUser={currentUser} />
        )}

        {activeTab === 'vpn_checker' && (
          <VpnAdminChecker currentUser={currentUser} />
        )}

        {activeTab === 'daily_checklist' && (
          <ChecklistGamificationAdmin currentUser={currentUser} />
        )}

        {activeTab === 'extensions' && (
          <ExtensionsManager currentUser={currentUser} />
        )}

        {activeTab === 'logs' && (
          isLogsEnabled ? (
            <SystemLogs />
          ) : (
            <DisabledFeatureNotice
              title="Logs de Microsserviços"
              extensionName="MicroserviceLogs"
              file="src/extensions/systemLogsExtension.ts"
              onManageExtensions={() => setActiveTab('extensions')}
            />
          )
        )}

        {activeTab === 'mesh' && (
          isMeshEnabled ? (
            <MeshTopology />
          ) : (
            <DisabledFeatureNotice
              title="Service Mesh & Telemetria"
              extensionName="ServiceMeshTelemetry"
              file="src/extensions/serviceMeshExtension.ts"
              onManageExtensions={() => setActiveTab('extensions')}
            />
          )
        )}

        {activeTab === 'firebase' && (
          <FirebaseSync
            currentUser={currentUser}
            onNavigateArticle={onNavigateArticle}
          />
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Quick Article Picker for History */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">Artigo em Análise no Histórico:</span>
                <select
                  value={selectedArticleSlug}
                  onChange={e => setSelectedArticleSlug(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded px-3 py-1.5 font-medium text-slate-800 outline-none cursor-pointer focus:ring-1 focus:ring-blue-500"
                >
                  {allArticles.map(a => (
                    <option key={a.slug} value={a.slug}>
                      {a.title} ({a.slug})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Article Pill Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-400 text-[11px] font-mono mr-1">Atalhos:</span>
                {allArticles.slice(0, 5).map(a => (
                  <button
                    key={a.slug}
                    onClick={() => setSelectedArticleSlug(a.slug)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      selectedArticleSlug === a.slug
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {a.title}
                  </button>
                ))}
              </div>
            </div>

            <HistoryDiff
              slug={selectedArticleSlug}
              currentUser={currentUser}
              onNavigate={onNavigateArticle}
              onBackToReader={onBackToReader}
            />
          </div>
        )}

        {activeTab === 'events' && (
          isEventsEnabled ? (
            <EventStreamViewer onNavigateArticle={onNavigateArticle} />
          ) : (
            <DisabledFeatureNotice
              title="EventStreams"
              extensionName="EventStreams"
              file="src/extensions/eventStreamsExtension.ts"
              onManageExtensions={() => setActiveTab('extensions')}
            />
          )
        )}

        {activeTab === 'migration' && (
          isMigrationEnabled ? (
            <MigrationExplorer />
          ) : (
            <DisabledFeatureNotice
              title="PHP Migration"
              extensionName="PhpMigrationRosetta"
              file="src/extensions/phpMigrationExtension.ts"
              onManageExtensions={() => setActiveTab('extensions')}
            />
          )
        )}

        {activeTab === 'bots' && (
          isBotsEnabled ? (
            <BotAgentManager
              currentUser={currentUser}
              onNavigateArticle={onNavigateArticle}
            />
          ) : (
            <DisabledFeatureNotice
              title="Agente de Bots"
              extensionName="BotAgent"
              file="src/extensions/botAgentExtension.ts"
              onManageExtensions={() => setActiveTab('extensions')}
            />
          )
        )}

        {activeTab === 'workbench' && (
          isWorkbenchEnabled ? (
            <ApiWorkbench />
          ) : (
            <DisabledFeatureNotice
              title="API Workbench"
              extensionName="ApiWorkbench"
              file="src/extensions/apiWorkbenchExtension.ts"
              onManageExtensions={() => setActiveTab('extensions')}
            />
          )
        )}
      </div>
    </div>
  );
};

interface DisabledFeatureNoticeProps {
  title: string;
  extensionName: string;
  file: string;
  onManageExtensions: () => void;
}

const DisabledFeatureNotice: React.FC<DisabledFeatureNoticeProps> = ({
  title,
  extensionName,
  file,
  onManageExtensions,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center max-w-xl mx-auto shadow-2xs space-y-4 my-6">
      <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
        <Puzzle className="w-6 h-6" />
      </div>
      <div>
        <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
          Recurso Desabilitado • {title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          O módulo <strong className="text-slate-700 dark:text-slate-300 font-mono">{extensionName}</strong> está desativado. O parâmetro de controle de habilitação/desabilitação fica dentro do próprio arquivo da extensão em <code className="text-purple-600 dark:text-purple-400 font-mono bg-purple-50 dark:bg-purple-950 px-1.5 py-0.5 rounded">{file}</code> (sendo <code className="text-amber-700 dark:text-amber-400 font-bold">false</code> ou <code className="text-emerald-700 dark:text-emerald-400 font-bold">true</code>).
        </p>
      </div>
      <div className="pt-2 flex items-center justify-center gap-2">
        <button
          onClick={onManageExtensions}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
        >
          <Puzzle className="w-3.5 h-3.5" />
          <span>Gerenciar em Extensões do Sistema</span>
        </button>
      </div>
    </div>
  );
};
