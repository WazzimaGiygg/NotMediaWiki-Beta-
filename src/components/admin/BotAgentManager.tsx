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
import { botAgentService } from '../../services/botAgentService';

interface BotAgentManagerProps {
  currentUser?: UserSession | null;
  onNavigateArticle?: (slug: string) => void;
}

export const BotAgentManager: React.FC<BotAgentManagerProps> = ({
  currentUser,
  onNavigateArticle,
}) => {
  // Navigation sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'users' | 'scan' | 'audit' | 'logs'>('overview');

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

  // Gemini Citation Test Modal / State (4.1.1.WV.1)
  const [citationTestSlug, setCitationTestSlug] = useState<string>('');
  const [isTestingGemini, setIsTestingGemini] = useState<boolean>(false);
  const [geminiResult, setGeminiResult] = useState<any>(null);

  // Bot User Modal
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [newBotUsername, setNewBotUsername] = useState<string>('');
  const [newBotDescription, setNewBotDescription] = useState<string>('');
  const [newBotAgentId, setNewBotAgentId] = useState<BotAgentId>('citation_bot');

  // Load all initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const [c, u, a, l, audits] = await Promise.all([
        api.getBotConfigs(),
        api.getBotUsers(),
        api.getArticles(),
        api.getBotActivityLogs(),
        api.getUserAudits(),
      ]);
      setConfigs(c);
      setBotUsers(u);
      setArticles(a);
      setLogs(l);
      setUserAudits(audits);
      if (a.length > 0 && !citationTestSlug) {
        setCitationTestSlug(a[0].slug);
      }
    } catch (e) {
      console.warn('Erro ao carregar dados dos bots:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Bot toggle handler
  const handleToggleBot = async (botId: BotAgentId, currentStatus: boolean) => {
    try {
      const updated = await api.toggleBot(botId, !currentStatus);
      setConfigs(prev => prev.map(c => (c.id === botId ? updated : c)));
    } catch (e) {
      console.error(e);
    }
  };

  // Bot mode change handler
  const handleModeChange = async (botId: BotAgentId, mode: 'automatic' | 'manual' | 'dry_run') => {
    try {
      const updated = await api.updateBotConfig(botId, { mode });
      setConfigs(prev => prev.map(c => (c.id === botId ? updated : c)));
    } catch (e) {
      console.error(e);
    }
  };

  // Run Custom Scan (4.1.1.1JE.1)
  const handleRunScan = async () => {
    setIsScanning(true);
    setScanFeedback(null);
    try {
      const results = await api.runBotScan(articles, scanConditions);
      setScanResults(results);
      setScanFeedback(
        `Varredura concluída com sucesso! ${results.length} ocorrência(s) detectada(s) em ${articles.length} artigo(s) analisado(s).`
      );
      // Reload logs
      const updatedLogs = await api.getBotActivityLogs();
      setLogs(updatedLogs);
    } catch (e: any) {
      setScanFeedback(`Erro na varredura: ${e.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Test Gemini Citation Bot (4.1.1.WV.1)
  const handleTestGeminiCitations = async () => {
    const target = articles.find(a => a.slug === citationTestSlug);
    if (!target) return;

    setIsTestingGemini(true);
    setGeminiResult(null);
    try {
      const res = await api.verifyCitationsWithGemini(target.title, target.wikitext);
      setGeminiResult(res);
      await api.getBotActivityLogs().then(setLogs);
    } catch (e: any) {
      setGeminiResult({ error: e.message });
    } finally {
      setIsTestingGemini(false);
    }
  };

  // Create Bot User (4.1.1.PN.1)
  const handleCreateBotUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotUsername.trim()) return;

    try {
      const tag = `#${Math.floor(1000 + Math.random() * 9000)}`;
      const created = await api.upsertBotUser({
        id: `bot_${newBotUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString(36)}`,
        username: newBotUsername.trim(),
        userTag: tag,
        displayName: `${newBotUsername.trim()}${tag}`,
        avatar: newBotUsername.substring(0, 2).toUpperCase(),
        description: newBotDescription.trim() || 'Bot de automação enciclopédica do NotMediaWiki',
        botFlag: true,
        role: 'bot',
        status: 'active',
        permissions: ['read', 'edit', 'flag_citations'],
        assignedBotAgentId: newBotAgentId,
        totalEdits: 0,
      });

      setBotUsers(prev => [...prev, created]);
      setIsUserModalOpen(false);
      setNewBotUsername('');
      setNewBotDescription('');
    } catch (e: any) {
      alert('Falha ao registrar Bot User: ' + e.message);
    }
  };

  // Apply autofix markup from scan result to article
  const handleApplyFix = async (result: BotScanResult) => {
    if (!result.suggestedMarkup) return;
    const target = articles.find(a => a.slug === result.articleSlug);
    if (!target) return;

    try {
      const newWikitext = `${target.wikitext}${result.suggestedMarkup}`;
      await api.saveArticle({
        slug: target.slug,
        title: target.title,
        wikitext: newWikitext,
        summary: `Correção automática aplicada por ${result.botName}`,
        comment: `Correção automática aplicada por ${result.botName}: ${result.title}`,
        isMinor: true,
      });

      // Update scan results UI
      setScanResults(prev =>
        prev.map(r => (r.id === result.id ? { ...r, actionTaken: 'fixed' } : r))
      );

      // Record log
      await botAgentService.recordActivityLog({
        botId: result.botId,
        botName: result.botName,
        action: 'AUTO_FIX_APPLIED',
        targetArticleSlug: target.slug,
        severity: 'info',
        summary: `Correção automática aplicada no artigo ${target.title}: ${result.title}`,
      });
      loadData();
    } catch (e: any) {
      alert(`Falha ao aplicar correção: ${e.message}`);
    }
  };

  // Revert vandalism using bot
  const handleBotRevert = async (result: BotScanResult) => {
    try {
      const res = await api.autoRevertWithBot(result.articleSlug, undefined, 'Reversão de vandalismo pelo AntiVandalBot');
      if (res.success) {
        setScanResults(prev =>
          prev.map(r => (r.id === result.id ? { ...r, actionTaken: 'reverted' } : r))
        );
        alert(res.message);
        loadData();
      } else {
        alert(res.error || 'Erro ao reverter');
      }
    } catch (e: any) {
      alert('Falha ao reverter: ' + e.message);
    }
  };

  const activeBotsCount = configs.filter(c => c.enabled).length;
  const totalActions = configs.reduce((acc, c) => acc + (c.stats.actionsTaken || 0), 0);
  const totalFlags = configs.reduce((acc, c) => acc + (c.stats.flagsRaised || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner / Identity (4.1.1.8T.1) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl p-6 shadow-md border border-indigo-900/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-inner">
              <Bot className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  Agente de BOTS & Subsistema de Automação
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                  4.1.1.8T.1
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Extensão Ativa
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-1 max-w-3xl">
                Gerenciamento autônomo dos 7 bots especializados: Verificação de Citações com Gemini (4.1.1.WV.1), Anti-Vandalismo com reversão automática (4.1.1.11E.1), Categorização (4.1.1.G2.1), Qualidade (4.1.1.IL.1), Links Quebrados (4.1.1.GW.1), LGPD (4.1.1.E0.1) e Auditoria Contínua de Usuários (4.1.1.18C.1).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center">
              <div className="text-xs text-slate-400">Bots Ativos</div>
              <div className="text-lg font-bold text-emerald-400 font-mono">
                {activeBotsCount} / {configs.length}
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center">
              <div className="text-xs text-slate-400">Ações Executadas</div>
              <div className="text-lg font-bold text-indigo-300 font-mono">{totalActions}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center">
              <div className="text-xs text-slate-400">Alertas Emitidos</div>
              <div className="text-lg font-bold text-amber-400 font-mono">{totalFlags}</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/10 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Painel dos Bots (Toggles)
          </button>

          <button
            onClick={() => setActiveSubTab('users')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'users'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Usuários Bots (4.1.1.PN.1)
          </button>

          <button
            onClick={() => setActiveSubTab('scan')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'scan'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Varredura com Condições de Busca (4.1.1.1JE.1)
          </button>

          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'audit'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Auditoria de Usuários (4.1.1.18C.1)
          </button>

          <button
            onClick={() => setActiveSubTab('logs')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'logs'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Histórico & Logs ({logs.length})
          </button>
        </div>
      </div>

      {/* =======================================================================
          TAB 1: PAINEL DOS BOTS (OVERVIEW & TOGGLES)
         ======================================================================= */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configs.map(bot => {
              const assignedUser = botUsers.find(u => u.id === bot.assignedUserId);
              return (
                <div
                  key={bot.id}
                  className={`bg-white dark:bg-slate-900 border rounded-xl p-5 shadow-xs transition-all flex flex-col justify-between ${
                    bot.enabled
                      ? 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800'
                      : 'border-slate-200/60 dark:border-slate-800/60 opacity-75 bg-slate-50/50 dark:bg-slate-950/40'
                  }`}
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                            bot.id === 'antivandal_bot'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              : bot.id === 'citation_bot'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                              : bot.id === 'lgpd_bot'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                          }`}
                        >
                          {bot.id === 'antivandal_bot' && <ShieldAlert className="w-5 h-5" />}
                          {bot.id === 'citation_bot' && <Sparkles className="w-5 h-5" />}
                          {bot.id === 'category_bot' && <Tag className="w-5 h-5" />}
                          {bot.id === 'quality_bot' && <Award className="w-5 h-5" />}
                          {bot.id === 'link_checker_bot' && <Link2 className="w-5 h-5" />}
                          {bot.id === 'lgpd_bot' && <Lock className="w-5 h-5" />}
                          {bot.id === 'user_audit_bot' && <UserCheck className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                              {bot.name}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-semibold">
                              {bot.code}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {bot.namePt}
                          </div>
                        </div>
                      </div>

                      {/* Enable/Disable Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleBot(bot.id, bot.enabled)}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                          bot.enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                        title={bot.enabled ? 'Desativar este bot' : 'Ativar este bot'}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            bot.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
                      {bot.description}
                    </p>

                    {/* Settings Details */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2.5 text-xs space-y-1.5 border border-slate-200/80 dark:border-slate-700/80 mb-3">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400">Conta Associada:</span>
                        <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">
                          {assignedUser?.displayName || bot.assignedUsername}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400">Modo de Operação:</span>
                        <select
                          value={bot.mode}
                          onChange={e =>
                            handleModeChange(bot.id, e.target.value as 'automatic' | 'manual' | 'dry_run')
                          }
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-slate-800 dark:text-slate-200"
                        >
                          <option value="automatic">Automático</option>
                          <option value="manual">Manual (Varredura)</option>
                          <option value="dry_run">Dry-Run (Simulação)</option>
                        </select>
                      </div>

                      {bot.id === 'citation_bot' && (
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-slate-500 dark:text-slate-400">Modelo IA:</span>
                          <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> gemini-3.8-flash
                          </span>
                        </div>
                      )}

                      {bot.id === 'antivandal_bot' && (
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-slate-500 dark:text-slate-400">Reversão Automática:</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {bot.settings.autoRevertVandalism ? 'Habilitada (>35%)' : 'Apenas Notificar'}
                          </span>
                        </div>
                      )}

                      {bot.id === 'user_audit_bot' && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                          <span>4.1.1.18C.1: Auto-carregada por padrão</span>
                          <span className="block text-slate-400 dark:text-slate-500 italic">
                            (4.1.1.1IT.1 - Varredura universal no login: Descontinuada)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Metrics */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <span>Execuções: <strong className="text-slate-700 dark:text-slate-200 font-mono">{bot.stats.totalRuns}</strong></span>
                      <span>•</span>
                      <span>Ações: <strong className="text-slate-700 dark:text-slate-200 font-mono">{bot.stats.actionsTaken}</strong></span>
                    </div>

                    {bot.id === 'citation_bot' ? (
                      <button
                        onClick={() => {
                          setActiveSubTab('scan');
                          setScanConditions(prev => ({ ...prev, selectedBots: ['citation_bot'] }));
                        }}
                        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        Testar IA <ChevronRight className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                        <Check className="w-3 h-3" /> Online
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Special Focus: Gemini Citation Verifier Test Panel (4.1.1.WV.1) */}
          <div className="bg-gradient-to-r from-purple-50 via-white to-indigo-50 dark:from-purple-950/20 dark:via-slate-900 dark:to-indigo-950/20 border border-purple-200 dark:border-purple-800/60 rounded-xl p-5 shadow-xs">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    4.1.1.WV.1: Bot de Verificação de Citações com Gemini 3.8 Flash
                    <span className="text-[10px] bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded font-mono">
                      @google/genai
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Analisa o wikitext do artigo, detecta parágrafos com afirmações factuais sem fonte e sugere tags de citação precisas.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
              <select
                value={citationTestSlug}
                onChange={e => setCitationTestSlug(e.target.value)}
                className="w-full sm:w-80 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                {articles.map(a => (
                  <option key={a.slug} value={a.slug}>
                    {a.title} ({a.slug})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleTestGeminiCitations}
                disabled={isTestingGemini || !citationTestSlug}
                className="w-full sm:w-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
              >
                {isTestingGemini ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Analisando com Gemini...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Executar Verificação de Citações
                  </>
                )}
              </button>
            </div>

            {geminiResult && (
              <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-lg border border-purple-200 dark:border-purple-800/60 text-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Resultado da Análise de Citações:
                  </span>
                  <span className="text-[11px] font-mono text-purple-600 dark:text-purple-400">
                    Fonte: {geminiResult.source || 'gemini-3.8-flash'}
                  </span>
                </div>

                {geminiResult.analysis?.summary && (
                  <p className="text-slate-700 dark:text-slate-300 italic">
                    &ldquo;{geminiResult.analysis.summary}&rdquo;
                  </p>
                )}

                {geminiResult.analysis?.claimsNeedingCitations?.length > 0 && (
                  <div className="space-y-2">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
                      Afirmações Pendentes de Fonte Encontradas:
                    </div>
                    {geminiResult.analysis.claimsNeedingCitations.map((item: any, i: number) => (
                      <div key={i} className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                        <div className="text-slate-800 dark:text-slate-200 font-medium">
                          &bull; {item.claim}
                        </div>
                        <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                          {item.issue}
                        </div>
                        {item.suggestedMarkup && (
                          <div className="mt-1 font-mono text-[10px] bg-slate-100 dark:bg-slate-800 p-1.5 rounded text-indigo-700 dark:text-indigo-300">
                            Sugestão: {item.suggestedMarkup}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 2: GERENCIAMENTO DE BOT USERS (4.1.1.PN.1)
         ======================================================================= */}
      {activeSubTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                4.1.1.PN.1: Gerenciamento de Usuários Bots (Bot Users)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Contas com a flag especial de robô (<code className="font-mono text-indigo-600">role: 'bot'</code>) para registro no histórico de revisões.
              </p>
            </div>
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Cadastrar Novo Bot User
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {botUsers.map(user => {
              const assignedAgent = configs.find(c => c.id === user.assignedBotAgentId);
              return (
                <div
                  key={user.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center font-bold text-xs text-indigo-700 dark:text-indigo-300">
                          {user.avatar}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1">
                            {user.displayName}
                            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                              BOT
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            ID: {user.id}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          user.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {user.status === 'active' ? 'Ativo' : 'Pausado'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
                      {user.description}
                    </p>

                    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2.5 text-xs space-y-1 border border-slate-200 dark:border-slate-700/60 mb-3">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Agente Atribuído:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {assignedAgent?.name || user.assignedBotAgentId}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Edições Realizadas:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {user.totalEdits}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                      {user.permissions.map(perm => (
                        <span
                          key={perm}
                          className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded"
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <button
                      onClick={async () => {
                        const newStatus = user.status === 'active' ? 'paused' : 'active';
                        const updated = await api.upsertBotUser({ id: user.id, status: newStatus });
                        setBotUsers(prev => prev.map(u => (u.id === user.id ? updated : u)));
                      }}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      {user.status === 'active' ? 'Pausar Operações' : 'Reativar Bot'}
                    </button>

                    <button
                      onClick={() => api.deleteBotUser(user.id).then(() => setBotUsers(prev => prev.filter(u => u.id !== user.id)))}
                      className="text-rose-600 hover:text-rose-700 cursor-pointer p-1"
                      title="Excluir Bot User"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal: Novo Bot User */}
          {isUserModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-600" /> Cadastrar Usuário Bot
                  </h3>
                  <button
                    onClick={() => setIsUserModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateBotUser} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Nome de Usuário do Bot (ex: CitationHelperBot)
                    </label>
                    <input
                      type="text"
                      required
                      value={newBotUsername}
                      onChange={e => setNewBotUsername(e.target.value)}
                      placeholder="Ex: CitationHelperBot"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Agente Especializado Associado
                    </label>
                    <select
                      value={newBotAgentId}
                      onChange={e => setNewBotAgentId(e.target.value as BotAgentId)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                    >
                      {configs.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.namePt})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Descrição da Função do Bot
                    </label>
                    <textarea
                      rows={3}
                      value={newBotDescription}
                      onChange={e => setNewBotDescription(e.target.value)}
                      placeholder="Descreva as tarefas e escopo de atuação do robô..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsUserModalOpen(false)}
                      className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg cursor-pointer"
                    >
                      Registrar Bot User
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =======================================================================
          TAB 3: VARREDURA COM CONDIÇÕES DE BUSCA (4.1.1.1JE.1)
         ======================================================================= */}
      {activeSubTab === 'scan' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Search className="w-4 h-4 text-indigo-600" />
                  4.1.1.1JE.1: Serviço Front-End de Varredura com Condições de Busca
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure filtros avançados para disparar a auditoria dos bots sobre artigos específicos ou em lote.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunScan}
                disabled={isScanning}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Executando Varredura...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Iniciar Varredura
                  </>
                )}
              </button>
            </div>

            {/* Filter Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                  Espaço Nominal (Namespace)
                </label>
                <select
                  value={scanConditions.namespace ?? ''}
                  onChange={e =>
                    setScanConditions(prev => ({
                      ...prev,
                      namespace: e.target.value === '' ? undefined : Number(e.target.value),
                    }))
                  }
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Todos os Namespaces</option>
                  <option value="0">0 - Principal (Artigos)</option>
                  <option value="1">1 - Discussão</option>
                  <option value="2">2 - Usuário</option>
                  <option value="4">4 - Projeto NotMediaWiki</option>
                  <option value="14">14 - Categoria</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                  Filtrar por Categoria
                </label>
                <input
                  type="text"
                  placeholder="Ex: Ciência da computação"
                  value={scanConditions.category || ''}
                  onChange={e => setScanConditions(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                  Termo no Texto / Título
                </label>
                <input
                  type="text"
                  placeholder="Palavra-chave no wikitext"
                  value={scanConditions.query || ''}
                  onChange={e => setScanConditions(prev => ({ ...prev, query: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                  Período de Modificação
                </label>
                <select
                  value={scanConditions.recentHours || 0}
                  onChange={e =>
                    setScanConditions(prev => ({
                      ...prev,
                      recentHours: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                >
                  <option value="0">Todo o Histórico</option>
                  <option value="2">Últimas 2 Horas (Ref. 4.1.1.1IT.1)</option>
                  <option value="24">Últimas 24 Horas</option>
                  <option value="72">Últimos 3 Dias</option>
                  <option value="168">Últimos 7 Dias</option>
                </select>
              </div>
            </div>

            {/* Bots Selection for Scan */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Bots que participarão desta varredura:
              </label>
              <div className="flex flex-wrap gap-2 text-xs">
                {configs.map(bot => {
                  const isSelected = scanConditions.selectedBots?.includes(bot.id);
                  return (
                    <button
                      key={bot.id}
                      type="button"
                      onClick={() => {
                        const cur = scanConditions.selectedBots || [];
                        const updated = isSelected
                          ? cur.filter(id => id !== bot.id)
                          : [...cur, bot.id];
                        setScanConditions(prev => ({ ...prev, selectedBots: updated }));
                      }}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded text-indigo-600 pointer-events-none"
                      />
                      <span>{bot.name}</span>
                      <span className="text-[10px] opacity-75 font-mono">({bot.code})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {scanFeedback && (
              <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>{scanFeedback}</span>
              </div>
            )}
          </div>

          {/* Results Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Ocorrências Detectadas na Varredura
                </h4>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {scanResults.length} resultado(s)
                </span>
              </div>

              {scanResults.length > 0 && (
                <button
                  onClick={() => setScanResults([])}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                >
                  Limpar Resultados
                </button>
              )}
            </div>

            {scanResults.length === 0 ? (
              <div className="p-10 text-center text-slate-400 dark:text-slate-500 text-xs">
                Nenhuma ocorrência encontrada ou nenhuma varredura executada ainda. Clique em &ldquo;Iniciar Varredura&rdquo; acima.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {scanResults.map(res => (
                  <div key={res.id} className="p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            res.severity === 'critical'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              : res.severity === 'warning'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          }`}
                        >
                          {res.severity}
                        </span>

                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span>{res.title}</span>
                            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">
                              [{res.botName}]
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Artigo: <strong className="text-slate-700 dark:text-slate-300">{res.articleTitle}</strong> (/wiki/{res.articleSlug})
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {res.autoFixAvailable && res.actionTaken !== 'fixed' && (
                          <button
                            type="button"
                            onClick={() => handleApplyFix(res)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Check className="w-3 h-3" /> Aplicar Correção
                          </button>
                        )}

                        {res.botId === 'antivandal_bot' && res.actionTaken !== 'reverted' && (
                          <button
                            type="button"
                            onClick={() => handleBotRevert(res)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" /> Reverter Vandalismo
                          </button>
                        )}

                        {onNavigateArticle && (
                          <button
                            type="button"
                            onClick={() => onNavigateArticle(res.articleSlug)}
                            className="px-2.5 py-1 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" /> Ver Artigo
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 mb-2">
                      {res.details}
                    </p>

                    {res.suggestion && (
                      <div className="ml-8 p-2 rounded bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs">
                        <strong className="text-slate-700 dark:text-slate-300">Sugestão do Bot:</strong>{' '}
                        <span className="text-slate-600 dark:text-slate-400">{res.suggestion}</span>
                        {res.suggestedMarkup && (
                          <pre className="mt-1 font-mono text-[11px] p-1.5 rounded bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 overflow-x-auto border border-slate-200 dark:border-slate-800">
                            {res.suggestedMarkup}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 4: AUDITORIA DE USUÁRIOS E ANTI-ABUSO (4.1.1.18C.1)
         ======================================================================= */}
      {activeSubTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  4.1.1.18C.1: Auditoria Automática de Abuso em Contribuições de Usuários
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Ferramenta de extensão auto-carregada por padrão que avalia a integridade comportamental, detecta rajadas de edições suspeitas e esvaziamentos recorrentes.
                </p>
              </div>

              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                Patrulha Ativa 24/7
              </span>
            </div>

            {/* User Audits Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3">Usuário</th>
                    <th className="py-2.5 px-3">Score de Risco de Abuso</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Esvaziamentos Massivos</th>
                    <th className="py-2.5 px-3">Reversões Registradas</th>
                    <th className="py-2.5 px-3">Última Auditoria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {userAudits.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        Nenhum registro de abuso flagrado até o momento. O sistema está íntegro.
                      </td>
                    </tr>
                  ) : (
                    userAudits.map(audit => (
                      <tr key={audit.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                          {audit.username}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  audit.riskScore >= 70
                                    ? 'bg-rose-600'
                                    : audit.riskScore >= 35
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${audit.riskScore}%` }}
                              />
                            </div>
                            <span className="font-mono font-bold text-xs">{audit.riskScore}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              audit.status === 'flagged'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                : audit.status === 'suspicious'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}
                          >
                            {audit.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">{audit.massDeletionsCount}</td>
                        <td className="py-2.5 px-3 font-mono">{audit.revertCount}</td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {new Date(audit.lastAuditAt).toLocaleTimeString('pt-BR')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 5: LOG DE ATIVIDADES & AUDITORIA
         ======================================================================= */}
      {activeSubTab === 'logs' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" /> Histórico de Ações dos Bots em Tempo Real
            </h4>
            <span className="text-xs text-slate-500 font-mono">
              Total: {logs.length} eventos
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Nenhum log de bot registrado ainda.
              </div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {log.botName}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {log.action}
                      </span>
                      {log.targetArticleSlug && (
                        <span className="text-indigo-600 dark:text-indigo-400 font-mono text-[11px]">
                          /wiki/{log.targetArticleSlug}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      {log.summary}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
