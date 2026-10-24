import React, { useState, useEffect } from 'react';
import {
  Bot,
  ShieldAlert,
  Sparkles,
  Search,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  UserCheck,
  UserX,
  Plus,
  Filter,
  Layers,
  FileText,
  Link2,
  Lock,
  Tag,
  Award,
  Zap,
  Activity,
  Check,
  ExternalLink,
  ChevronRight,
  Sliders,
  RefreshCw,
  Eye,
  Trash2,
  ShieldCheck,
  FolderTree,
  Code2,
} from 'lucide-react';
import {
  Article,
  BotAgentConfig,
  BotAgentId,
  BotScanCondition,
  BotScanResult,
  BotUser,
  BotActivityLog,
  UserAbuseAudit,
  UserSession,
} from '../../types';
import { api } from '../../api';
import { botService } from '../../services/BotService';

interface BotManagementViewProps {
  currentUser?: UserSession | null;
  onNavigateArticle?: (slug: string) => void;
}

export const BotManagementView: React.FC<BotManagementViewProps> = ({
  currentUser,
  onNavigateArticle,
}) => {
  // Navigation sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'tree' | 'users' | 'scan' | 'audit' | 'logs'>('overview');

  // Core Data
  const [configs, setConfigs] = useState<BotAgentConfig[]>([]);
  const [botUsers, setBotUsers] = useState<BotUser[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [logs, setLogs] = useState<BotActivityLog[]>([]);
  const [userAudits, setUserAudits] = useState<UserAbuseAudit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Scan state (4.1.1.1JE.1)
  const [scanConditions, setScanConditions] = useState<BotScanCondition>({
    namespace: 0,
    category: '',
    query: '',
    articleSlug: '',
    recentHours: 0,
    limit: 20,
    selectedBots: [
      'citation_bot',
      'antivandal_bot',
      'category_bot',
      'quality_bot',
      'link_checker_bot',
      'lgpd_bot',
    ],
  });
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResults, setScanResults] = useState<BotScanResult[]>([]);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  // Bot User Modal (4.1.1.PN.1)
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [newBotUsername, setNewBotUsername] = useState<string>('');
  const [newBotDescription, setNewBotDescription] = useState<string>('');
  const [newBotAgentId, setNewBotAgentId] = useState<BotAgentId>('citation_bot');

  // Load all initial data
  const refreshData = async () => {
    try {
      setLoading(true);
      const [fetchedConfigs, fetchedUsers, fetchedArticles] = await Promise.all([
        botService.getConfigs(),
        botService.getBotUsers(),
        api.getArticles(),
      ]);
      setConfigs(fetchedConfigs);
      setBotUsers(fetchedUsers);
      setArticles(fetchedArticles);
      setLogs(botService.getLogs());
      setUserAudits(botService.getUserAudits());
    } catch (err) {
      console.error('Erro ao carregar dados do BotManagementView:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Toggle Bot Enable/Disable (4.1.1.PN.1)
  const handleToggleBot = async (botId: BotAgentId, currentStatus: boolean) => {
    try {
      const updated = await botService.toggleBot(botId, !currentStatus);
      setConfigs(prev => prev.map(c => (c.id === botId ? updated : c)));
      setLogs(botService.getLogs());
    } catch (err) {
      console.error('Erro ao alterar status do bot:', err);
    }
  };

  // Run Real-time scan (4.1.1.1JE.1)
  const handleExecuteScan = async () => {
    setIsScanning(true);
    setScanFeedback(null);
    try {
      const results = await botService.runScan(articles, scanConditions);
      setScanResults(results);
      setLogs(botService.getLogs());
      setScanFeedback(
        `Varredura concluída com sucesso! ${results.length} artigos analisados através dos robôs selecionados.`
      );
    } catch (err: any) {
      setScanFeedback(`Falha na varredura: ${err?.message || 'Erro desconhecido'}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Create Bot User Account (4.1.1.PN.1)
  const handleCreateBotUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotUsername.trim()) return;

    try {
      const user = await botService.upsertBotUser({
        id: `bot_${newBotAgentId}_${Date.now()}`,
        username: newBotUsername.trim(),
        assignedBotAgentId: newBotAgentId,
        description: newBotDescription.trim() || 'Conta de bot para automação autorizada.',
        status: 'active',
      });
      setBotUsers(prev => [...prev.filter(u => u.id !== user.id), user]);
      setLogs(botService.getLogs());
      setIsUserModalOpen(false);
      setNewBotUsername('');
      setNewBotDescription('');
    } catch (err) {
      console.error('Erro ao criar usuário de bot:', err);
    }
  };

  const handleToggleBotUserActive = async (user: BotUser) => {
    try {
      const newStatus = user.status === 'active' ? 'paused' : 'active';
      const updated = await botService.upsertBotUser({
        id: user.id,
        status: newStatus,
      });
      setBotUsers(prev => prev.map(u => (u.id === user.id ? updated : u)));
      setLogs(botService.getLogs());
    } catch (err) {
      console.error('Erro ao alterar status do usuário bot:', err);
    }
  };

  const handleDeleteBotUser = async (id: string) => {
    if (!confirm('Deseja realmente remover esta conta de bot?')) return;
    try {
      await botService.deleteBotUser(id);
      setBotUsers(prev => prev.filter(u => u.id !== id));
      setLogs(botService.getLogs());
    } catch (err) {
      console.error('Erro ao remover conta de bot:', err);
    }
  };

  // Run Abuse audit on current user or simulate check (4.1.1.18C.1)
  const handleRunAbuseAudit = async () => {
    const targetUser: UserSession = currentUser || {
      id: 'user_audit_guest',
      username: 'EditorColaborador',
      email: 'editor@notmediawiki.local',
      role: 'editor',
      editCount: 14,
      avatar: 'EC',
    };

    await botService.auditUserContributions(targetUser, {
      articleSlug: articles[0]?.slug || 'WazzimaGiygg',
      charDelta: 85,
      isVandal: false,
    });
    setUserAudits(botService.getUserAudits());
    setLogs(botService.getLogs());
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Central de Bots & Automação Inteligente
                </h2>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                  4.1.1.13W.2
                </span>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  6 Robôs Ativos
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                Extensão de gerenciamento de bots, contas com papel <code className="bg-slate-100 px-1 py-0.2 rounded font-mono text-slate-700">role: 'bot'</code>, varreduras com filtros customizados e verificação automática de abusos e citações.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sincronizar</span>
            </button>
            <button
              onClick={() => setActiveSubTab('scan')}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Executar Varredura</span>
            </button>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center gap-1.5 pt-4 overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', label: 'Robôs & Toggles', icon: Sliders, badge: `${configs.filter(c => c.enabled).length}/${configs.length}` },
            { id: 'tree', label: 'Árvore de Configuração (4.1.1.13W.2)', icon: FolderTree, badge: '11 Módulos' },
            { id: 'users', label: 'Contas de Bot (4.1.1.PN.1)', icon: UserCheck, badge: `${botUsers.length}` },
            { id: 'scan', label: 'Varredura com Condições (4.1.1.1JE.1)', icon: Search, badge: 'Scanner' },
            { id: 'audit', label: 'Auditoria de Abuso (4.1.1.18C.1)', icon: ShieldAlert, badge: `${userAudits.length}` },
            { id: 'logs', label: 'Logs de Execução', icon: Activity, badge: `${logs.length}` },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'
                }`}>
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SUB-TAB: OVERVIEW / BOT TOGGLES */}
      {activeSubTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configs.map(config => {
              const assignedUser = botUsers.find(u => u.assignedBotAgentId === config.id);
              return (
                <div
                  key={config.id}
                  className={`bg-white border rounded-lg p-5 transition-all shadow-2xs flex flex-col justify-between ${
                    config.enabled ? 'border-slate-200' : 'border-slate-200 bg-slate-50/50 opacity-75'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-md ${
                          config.enabled ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-400'
                        }`}>
                          <Bot className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900">{config.name}</div>
                          <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                            {config.code}
                          </span>
                        </div>
                      </div>

                      {/* Active Toggle Switch */}
                      <button
                        onClick={() => handleToggleBot(config.id, config.enabled)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          config.enabled ? 'bg-indigo-600' : 'bg-slate-300'
                        }`}
                        title={config.enabled ? 'Desativar este bot' : 'Ativar este bot'}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            config.enabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed min-h-[36px]">
                      {config.description}
                    </p>

                    <div className="p-2.5 rounded bg-slate-50 border border-slate-100 space-y-1.5 text-[11px]">
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Usuário Associado:</span>
                        <span className="font-mono font-medium text-slate-800">
                          {assignedUser ? assignedUser.username : config.assignedUsername}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Modo de Operação:</span>
                        <span className="capitalize font-medium text-slate-800">{config.mode}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Ações Executadas:</span>
                        <span className="font-mono font-semibold text-indigo-700">
                          {config.stats.actionsTaken} ({config.stats.flagsRaised} sinalizações)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Execuções: {config.stats.totalRuns}</span>
                    <span className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${config.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      {config.enabled ? 'Ativo' : 'Desativado'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB: TREE CONFIGURATION VIEW (4.1.1.13W.2) */}
      {activeSubTab === 'tree' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-2xs space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">
                Árvore de Configurações Modular (4.1.1.13W.2)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Topologia de arquivos e dependências estritas do ecossistema de bots, garantindo isolamento contra perda de dados e rastreabilidade total.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto space-y-1 shadow-inner">
              <div className="text-indigo-400 font-bold mb-2">src/</div>
              <div className="text-indigo-300 pl-4">├── extensions/</div>
              <div className="text-indigo-300 pl-8">│   └── bots/</div>
              <div className="text-emerald-400 pl-12">├── BotManagerExtension.ts          <span className="text-slate-400"># Extensão principal (ativar/desativar)</span></div>
              <div className="text-emerald-400 pl-12">├── BotUserManager.ts               <span className="text-slate-400"># Gerenciamento de contas de bot</span></div>
              <div className="text-indigo-300 pl-12">└── bots/</div>
              <div className="text-emerald-400 pl-16">├── AntiVandalismBot.ts           <span className="text-slate-400"># 4.1.1.11E.1</span></div>
              <div className="text-emerald-400 pl-16">├── CitationCheckerBot.ts         <span className="text-slate-400"># 4.1.1.WV.1</span></div>
              <div className="text-emerald-400 pl-16">├── QualityBot.ts                 <span className="text-slate-400"># 4.1.1.IL.1</span></div>
              <div className="text-emerald-400 pl-16">├── CategorizationBot.ts          <span className="text-slate-400"># 4.1.1.G2.1</span></div>
              <div className="text-emerald-400 pl-16">├── BrokenLinksBot.ts             <span className="text-slate-400"># 4.1.1.GW.1</span></div>
              <div className="text-emerald-400 pl-16">└── LgpdModerationBot.ts          <span className="text-slate-400"># 4.1.1.E0.1</span></div>
              <div className="text-indigo-300 pl-4">├── services/</div>
              <div className="text-emerald-400 pl-8">├── BotService.ts                   <span className="text-slate-400"># Serviço central</span></div>
              <div className="text-emerald-400 pl-8">└── BotExecutionService.ts          <span className="text-slate-400"># Execução e logs</span></div>
              <div className="text-indigo-300 pl-4">└── components/</div>
              <div className="text-indigo-300 pl-8">└── admin/</div>
              <div className="text-emerald-400 pl-12">└── BotManagementView.tsx           <span className="text-slate-400"># Painel de gerenciamento</span></div>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Garantias de Imutabilidade & Auditoria (4.1.1.1SK.2)
                </div>
                <p className="text-[11px] text-blue-800 mt-1 leading-relaxed">
                  As regras do Firebase Firestore impedem qualquer sobrescrita de revisões e versões passadas (<code className="font-mono bg-blue-100 px-1 py-0.5 rounded">allow update, delete: if false;</code>). Ações realizadas por bots são assinadas com <code className="font-mono bg-blue-100 px-1 py-0.5 rounded">role: 'bot'</code> gerando novas revisões na esteira auditável.
                </p>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <Lock className="w-4 h-4 text-amber-600" />
                  Blindagem de Regras Criptografadas (4.1.1.23B.2)
                </div>
                <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                  O endpoint público de leitura das regras (<code className="font-mono bg-amber-100 px-1 py-0.5 rounded">/firestore.rules</code>) está bloqueado com HTTP 403 e integridade SHA-256 no backend, prevenindo vazamento de lógica de segurança.
                </p>
              </div>

              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
                  <Code2 className="w-4 h-4 text-purple-600" />
                  Extensão Auto-Carregada por Padrão (4.1.1.18C.1)
                </div>
                <p className="text-[11px] text-purple-800 mt-1 leading-relaxed">
                  A extensão <code className="font-mono bg-purple-100 px-1 py-0.5 rounded">BotManagerExtension</code> é montada globalmente para verificar a situação de contribuição de qualquer usuário autenticado ou visitante ao propor novas edições.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: BOT USERS (4.1.1.PN.1) */}
      {activeSubTab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <span>Gerenciamento de Contas de Bot (BotUserManager)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Contas dedicadas com a bandeira de bot (role: 'bot') para executar alterações autorizadas no histórico sem poluir a lista de usuários comuns.
              </p>
            </div>

            <button
              onClick={() => setIsUserModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Criar Nova Conta de Bot</span>
            </button>
          </div>

          {/* Bot Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Conta / Usuário</th>
                  <th className="py-2.5 px-3">Robô Vinculado</th>
                  <th className="py-2.5 px-3">Permissões</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Última Ação</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {botUsers.map(user => {
                  const isUserActive = user.status === 'active';
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-slate-900">{user.username}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{user.id}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 font-medium">
                          {user.assignedBotAgentId}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {user.permissions.map(perm => (
                            <span
                              key={perm}
                              className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.2 rounded font-mono"
                            >
                              {perm}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isUserActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isUserActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          {isUserActive ? 'Autorizado' : 'Pausado'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                        {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString('pt-BR') : 'Nenhuma'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleBotUserActive(user)}
                            className={`p-1.5 rounded hover:bg-slate-100 transition-colors cursor-pointer ${
                              isUserActive ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'
                            }`}
                            title={isUserActive ? 'Pausar bot' : 'Reativar bot'}
                          >
                            {isUserActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDeleteBotUser(user.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                            title="Remover conta"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB: SCANNER COM CONDIÇÕES DE BUSCA (4.1.1.1JE.1) */}
      {activeSubTab === 'scan' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-indigo-600" />
                  <span>Condições de Varredura Customizada (4.1.1.1JE.1)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Filtre artigos por namespace, categoria, termo de busca ou janela de tempo recente e execute a análise com múltiplos robôs.
                </p>
              </div>

              <button
                onClick={handleExecuteScan}
                disabled={isScanning}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 fill-current ${isScanning ? 'animate-pulse' : ''}`} />
                <span>{isScanning ? 'Analisando Artigos...' : 'Iniciar Varredura'}</span>
              </button>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Namespace:</label>
                <select
                  value={scanConditions.namespace ?? 0}
                  onChange={e => setScanConditions(c => ({ ...c, namespace: Number(e.target.value) }))}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 bg-white text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500"
                >
                  <option value={0}>0 - Principal (Artigos)</option>
                  <option value={1}>1 - Discussão</option>
                  <option value={4}>4 - Projeto (WazzimaGiygg)</option>
                  <option value={14}>14 - Categoria</option>
                  <option value={828}>828 - Módulo (Lua)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Filtrar Categoria:</label>
                <input
                  type="text"
                  placeholder="Ex: Ciência, Tecnologia"
                  value={scanConditions.category || ''}
                  onChange={e => setScanConditions(c => ({ ...c, category: e.target.value }))}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 bg-white text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Termo no Texto / Título:</label>
                <input
                  type="text"
                  placeholder="Buscar texto..."
                  value={scanConditions.query || ''}
                  onChange={e => setScanConditions(c => ({ ...c, query: e.target.value }))}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 bg-white text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Janela de Tempo Recente:</label>
                <select
                  value={scanConditions.recentHours ?? 0}
                  onChange={e => setScanConditions(c => ({ ...c, recentHours: Number(e.target.value) }))}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 bg-white text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500"
                >
                  <option value={0}>Todos os Artigos (Sem filtro de tempo)</option>
                  <option value={2}>Últimas 2 horas (4.1.1.1IT.1)</option>
                  <option value={24}>Últimas 24 horas</option>
                  <option value={72}>Últimos 3 dias</option>
                </select>
              </div>
            </div>

            {/* Select Bots Checklist */}
            <div className="pt-2">
              <span className="block font-semibold text-slate-700 text-xs mb-2">Robôs Executores na Varredura:</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {configs.map(b => {
                  const selectedList = scanConditions.selectedBots ?? [];
                  const isChecked = selectedList.includes(b.id);
                  return (
                    <label
                      key={b.id}
                      className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-indigo-300 bg-indigo-50/50 text-indigo-900 font-medium'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          const currentSelected = scanConditions.selectedBots ?? [];
                          const updated = e.target.checked
                            ? [...currentSelected, b.id]
                            : currentSelected.filter(id => id !== b.id);
                          setScanConditions(c => ({ ...c, selectedBots: updated }));
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="truncate">{b.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {scanFeedback && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded text-xs text-indigo-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>{scanFeedback}</span>
              </div>
            )}
          </div>

          {/* Results List */}
          {scanResults.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  Resultados da Varredura ({scanResults.length} achados registrados)
                </h4>
              </div>

              <div className="divide-y divide-slate-100 space-y-3">
                {scanResults.map(res => (
                  <div key={res.id} className="pt-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{res.articleTitle}</span>
                        <span className="font-mono text-[11px] text-slate-400">({res.articleSlug})</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {res.botName}
                        </span>
                      </div>

                      {onNavigateArticle && (
                        <button
                          onClick={() => onNavigateArticle(res.articleSlug)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <span>Abrir no Leitor</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="p-3 rounded bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                            res.severity === 'critical'
                              ? 'bg-red-100 text-red-800'
                              : res.severity === 'warning'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {res.severity.toUpperCase()}
                        </span>
                        <span className="font-bold text-slate-800">{res.title}</span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">{res.details}</p>

                      {res.suggestion && (
                        <div className="text-[11px] text-indigo-700 font-medium bg-indigo-50/60 p-2 rounded border border-indigo-100">
                          💡 Sugestão: {res.suggestion}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB: AUDITORIA DE CONTRIBUIÇÃO E ABUSO (4.1.1.18C.1) */}
      {activeSubTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-indigo-600" />
                <span>Auditoria Automática de Contribuições & Abusos (4.1.1.18C.1)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoramento contínuo de conduta: calcula pontuação de risco, detecta edições muito rápidas e esvaziamentos de artigos.
              </p>
            </div>

            <button
              onClick={handleRunAbuseAudit}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Simular Análise de Abuso</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Usuário / ID</th>
                  <th className="py-2.5 px-3">Edições Recentes</th>
                  <th className="py-2.5 px-3">Edições Rápidas (&lt;10s)</th>
                  <th className="py-2.5 px-3">Remoções em Massa</th>
                  <th className="py-2.5 px-3">Risco Calculado</th>
                  <th className="py-2.5 px-3">Conduta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {userAudits.map(audit => (
                  <tr key={audit.userId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-mono font-bold text-slate-900">{audit.username}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{audit.userId}</div>
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-slate-800">{audit.recentEditsCount}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{audit.burstEditsCount}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{audit.massDeletionsCount}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full ${
                              audit.riskScore > 60
                                ? 'bg-red-500'
                                : audit.riskScore > 30
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${audit.riskScore}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] font-bold text-slate-700">
                          {audit.riskScore}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          audit.status !== 'clean'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {audit.status !== 'clean' ? 'Alerta de Abuso' : 'Regular'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB: LOGS DE ATIVIDADE */}
      {activeSubTab === 'logs' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                <span>Trilha de Auditoria & Execução dos Robôs (BotExecutionService)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Histórico imutável de eventos disparados por robôs na plataforma.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">Total: {logs.length} eventos</span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {logs.map(log => (
              <div
                key={log.id}
                className="p-3 rounded border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{log.botName}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                      {log.action}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                        log.severity === 'warning'
                          ? 'bg-amber-100 text-amber-800'
                          : log.severity === 'critical'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {log.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">{log.summary}</p>
                </div>

                <div className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: CRIAR CONTA DE BOT (4.1.1.PN.1) */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Bot className="w-4 h-4 text-indigo-600" />
                Criar Nova Conta de Bot
              </h3>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBotUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome de Usuário:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: AntiVandalGuard#0001"
                  value={newBotUsername}
                  onChange={e => setNewBotUsername(e.target.value)}
                  className="w-full border border-slate-200 rounded px-3 py-1.5 text-slate-800 font-mono text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Robô Associado:</label>
                <select
                  value={newBotAgentId}
                  onChange={e => setNewBotAgentId(e.target.value as BotAgentId)}
                  className="w-full border border-slate-200 rounded px-3 py-1.5 text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  {configs.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição / Finalidade:</label>
                <textarea
                  rows={3}
                  placeholder="Explique o propósito desta conta de automação..."
                  value={newBotDescription}
                  onChange={e => setNewBotDescription(e.target.value)}
                  className="w-full border border-slate-200 rounded px-3 py-1.5 text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold cursor-pointer"
                >
                  Cadastrar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
