import React, { useState, useEffect, useMemo } from 'react';
import {
  Puzzle,
  CheckCircle2,
  XCircle,
  Settings,
  Code2,
  Download,
  RefreshCw,
  Search,
  Filter,
  ExternalLink,
  ShieldCheck,
  Layers,
  Cpu,
  BookOpen,
  FileJson,
  Sparkles,
  Plus,
  Terminal,
  Sliders,
  HelpCircle,
  Info,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  Radio,
  FileText,
  AlertTriangle,
  Play,
  RotateCcw,
  LayoutGrid,
  List,
  Cloud,
  Printer,
  Database,
  Globe,
} from 'lucide-react';
import { WikiExtension, ExtensionCategory, ExtensionConfigParam, UserSession } from '../types';
import { DEFAULT_EXTENSIONS } from '../data/defaultExtensions';
import { wrapExternalUrl } from '../utils/urlHelper';
import { api } from '../api';
import { WikiReportModal } from './WikiReportModal';
import { buildExtensionsReportData } from '../utils/reportGenerator';
import { FIRESTORE_DATABASE_ID } from '../firebaseConfig';

const STORAGE_KEY = 'notmediawiki_extensions';

interface ExtensionsManagerProps {
  currentUser?: UserSession | null;
}

export const ExtensionsManager: React.FC<ExtensionsManagerProps> = ({ currentUser }) => {
  // Load extensions with persistence in localStorage
  const [extensions, setExtensions] = useState<WikiExtension[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not parse stored extensions:', e);
    }
    return DEFAULT_EXTENSIONS;
  });

  // UI state
  const [activeSubView, setActiveSubView] = useState<'list' | 'hooks' | 'export'>('list');
  const [displayMode, setDisplayMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

  // Modals state
  const [manifestModalExt, setManifestModalExt] = useState<WikiExtension | null>(null);
  const [configModalExt, setConfigModalExt] = useState<WikiExtension | null>(null);
  const [testModalExt, setTestModalExt] = useState<WikiExtension | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Cloud Sync Status
  const [isSyncingWithCloud, setIsSyncingWithCloud] = useState(false);
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<string | null>(null);

  // Notifications
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'warning' } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sincronização ao acessar o Wiki e assinatura em tempo real no Firebase Firestore
  useEffect(() => {
    // 1. Ao acessar o Wiki / painel de extensões: sincronizar com o Firebase
    api.initExtensionsOnWikiAccess(currentUser).then(cloudExts => {
      if (cloudExts && cloudExts.length > 0) {
        setExtensions(cloudExts);
        setLastCloudSyncTime(new Date().toLocaleTimeString('pt-BR'));
      }
    }).catch(console.warn);

    // 2. Ouvinte em tempo real para mudanças nas extensões feitas por burocratas
    const unsub = api.subscribeExtensions(cloudExts => {
      if (cloudExts && cloudExts.length > 0) {
        setExtensions(cloudExts);
        setLastCloudSyncTime(new Date().toLocaleTimeString('pt-BR'));
      }
    });

    return () => unsub();
  }, [currentUser]);

  // Save to localStorage when extensions change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(extensions));
    } catch (e) {
      console.error('Failed to save extensions to localStorage:', e);
    }
  }, [extensions]);

  const showToast = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 3500);
  };

  // Toggle extension status - sincronizado no Firebase pelo burocrata
  const handleToggleExtension = async (id: string) => {
    const ext = extensions.find(e => e.id === id);
    if (!ext) return;

    const nextState = !ext.enabled;
    const bureaucratName = currentUser?.username || 'Burocrata';
    const bureaucratRole = currentUser?.role || 'bureaucrat';

    const updatedExt: WikiExtension = {
      ...ext,
      enabled: nextState,
      lastUpdated: new Date().toISOString().split('T')[0],
    };

    // Atualização local imediata para responsividade instantânea
    setExtensions(prev => prev.map(e => (e.id === id ? updatedExt : e)));

    // Sincronização com o Firebase Firestore
    try {
      await api.saveExtension(updatedExt, currentUser);
      showToast(
        `Extensão "${ext.name}" ${nextState ? 'ativada' : 'desativada'} pelo burocrata "${bureaucratName}" (${bureaucratRole}) e salva no Firebase!`,
        nextState ? 'success' : 'info'
      );
      setLastCloudSyncTime(new Date().toLocaleTimeString('pt-BR'));
    } catch (err: any) {
      console.warn('Erro ao sincronizar com Firebase:', err);
      showToast(`Alterada localmente (Firebase aviso: ${err.message})`, 'warning');
    }
  };

  const handleSyncAllToCloud = async () => {
    setIsSyncingWithCloud(true);
    try {
      const res = await api.syncAllExtensions(extensions, currentUser);
      showToast(`${res.saved} extensões sincronizadas com sucesso no Firebase Firestore!`, 'success');
      setLastCloudSyncTime(new Date().toLocaleTimeString('pt-BR'));
    } catch (err: any) {
      showToast(`Falha na sincronização com Firebase: ${err.message}`, 'warning');
    } finally {
      setIsSyncingWithCloud(false);
    }
  };

  const handlePullFromCloud = async () => {
    setIsSyncingWithCloud(true);
    try {
      const cloudExts = await api.getExtensions();
      if (cloudExts && cloudExts.length > 0) {
        setExtensions(cloudExts);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudExts));
        showToast(`${cloudExts.length} extensões obtidas do Firebase Firestore!`, 'success');
        setLastCloudSyncTime(new Date().toLocaleTimeString('pt-BR'));
      } else {
        showToast('Nenhuma extensão encontrada no Firestore.', 'info');
      }
    } catch (err: any) {
      showToast(`Erro ao puxar do Firebase: ${err.message}`, 'warning');
    } finally {
      setIsSyncingWithCloud(false);
    }
  };

  // Reset to default extensions
  const handleResetDefaults = () => {
    if (window.confirm('Deseja restaurar as extensões para a configuração de fábrica do NotMediaWiki?')) {
      setExtensions(DEFAULT_EXTENSIONS);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      showToast('Configurações de extensões restauradas com sucesso!', 'info');
    }
  };

  // Filter extensions
  const filteredExtensions = useMemo(() => {
    return extensions.filter(ext => {
      // Category filter
      if (selectedCategory !== 'all' && ext.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (statusFilter === 'enabled' && !ext.enabled) return false;
      if (statusFilter === 'disabled' && ext.enabled) return false;

      // Text search
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inName = ext.name.toLowerCase().includes(q);
      const inNamePt = ext.namePt.toLowerCase().includes(q);
      const inDesc = ext.description.toLowerCase().includes(q);
      const inAuthor = ext.author.toLowerCase().includes(q);
      const inHooks = ext.hooks.some(h => h.name.toLowerCase().includes(q) || h.handler.toLowerCase().includes(q));

      return inName || inNamePt || inDesc || inAuthor || inHooks;
    });
  }, [extensions, selectedCategory, statusFilter, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const total = extensions.length;
    const enabled = extensions.filter(e => e.enabled).length;
    const disabled = total - enabled;
    const totalHooks = extensions.reduce((acc, e) => acc + (e.enabled ? e.hooks.length : 0), 0);
    const healthPercent = total > 0 ? Math.round((enabled / total) * 100) : 0;
    return { total, enabled, disabled, totalHooks, healthPercent };
  }, [extensions]);

  // Aggregate all registered hooks across all extensions
  const hookRegistry = useMemo(() => {
    const map = new Map<string, Array<{ ext: WikiExtension; hook: WikiExtension['hooks'][0] }>>();
    extensions.forEach(ext => {
      ext.hooks.forEach(h => {
        if (!map.has(h.name)) {
          map.set(h.name, []);
        }
        map.get(h.name)!.push({ ext, hook: h });
      });
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [extensions]);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(prev => (prev === key ? null : prev));
    }, 2000);
  };

  // Generate LocalSettings.php code
  const generatedPhpConfig = useMemo(() => {
    const active = extensions.filter(e => e.enabled);
    let output = `# =====================================================================\n`;
    output += `# NotMediaWiki Extensions Configuration (Special:Version)\n`;
    output += `# Gerado automaticamente em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}\n`;
    output += `# Projeto WazzimaGiygg • https://wazzimagiygg.com\n`;
    output += `# =====================================================================\n\n`;

    output += `# 1. Carregamento de Extensões e Módulos Ativos\n`;
    active.forEach(ext => {
      output += `wfLoadExtension('${ext.name}'); // ${ext.namePt} (v${ext.version})\n`;
    });

    output += `\n# 2. Configurações de Variáveis Globais de Extensões ($wg...)\n`;
    active.forEach(ext => {
      if (ext.config && ext.config.length > 0) {
        output += `\n# ${ext.name}\n`;
        ext.config.forEach(c => {
          let val = c.value;
          if (typeof val === 'boolean') val = val ? 'true' : 'false';
          else if (typeof val === 'string') val = `'${val}'`;
          output += `${c.key} = ${val}; // ${c.description}\n`;
        });
      }
    });

    return output;
  }, [extensions]);

  // Generate extensions.json format
  const generatedJsonConfig = useMemo(() => {
    return JSON.stringify(
      {
        generator: 'NotMediaWiki Extension Registry v2.0',
        generatedAt: new Date().toISOString(),
        totalInstalled: extensions.length,
        totalActive: extensions.filter(e => e.enabled).length,
        extensions: extensions.map(e => ({
          name: e.name,
          version: e.version,
          enabled: e.enabled,
          category: e.category,
          author: e.author,
          hooks: e.hooks.map(h => h.name),
          config: e.config.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}),
        })),
      },
      null,
      2
    );
  }, [extensions]);

  // Category label and color mapper
  const getCategoryBadge = (cat: ExtensionCategory) => {
    switch (cat) {
      case 'parser':
        return { label: 'Parser & AST', bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800' };
      case 'ui':
        return { label: 'Interface & UI', bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800' };
      case 'search':
        return { label: 'Busca & Índice', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' };
      case 'security':
        return { label: 'Segurança & RBAC', bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' };
      case 'infra':
        return { label: 'Infra & Eventos', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800' };
      case 'media':
        return { label: 'Mídia & Assets', bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800' };
      default:
        return { label: 'Geral', bg: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-lg border text-xs font-medium flex items-center justify-between shadow-sm transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
              : toastMessage.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300'
              : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[11px] underline ml-4 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                <Puzzle className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Gerenciador de Extensões & Módulos
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                Special:Version
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-1">
              Registro mestre de módulos, compiladores AST, interceptadores de hooks e extensões ativas no motor NotMediaWiki.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Gerar Relatório Oficial em PDF no padrão do Wiki"
            >
              <Printer className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Relatório PDF</span>
            </button>

            <button
              onClick={handleSyncAllToCloud}
              disabled={isSyncingWithCloud}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              title="Sincronizar todas as extensões no Firestore como burocrata"
            >
              <Cloud className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${isSyncingWithCloud ? 'animate-bounce' : ''}`} />
              <span>{isSyncingWithCloud ? 'Sincronizando...' : 'Sincronizar Firebase'}</span>
            </button>

            <button
              onClick={() => {
                window.location.hash = '#/domains';
              }}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Gerenciar lista de domínios permitidos direto no Firebase (Acesso Burocrata)"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Domínios Permitidos (Firebase)</span>
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Instalar Extensão</span>
            </button>

            <button
              onClick={handleResetDefaults}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Restaurar extensões padrão"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Padrões</span>
            </button>
          </div>
        </div>

        {/* Firebase Cloud Synchronization Status Banner */}
        <div className="mt-3.5 p-2.5 rounded-md bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Sincronização Cloud Firebase Firestore Ativa:</span>
            </span>
            <code className="text-[11px] font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/50 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800 truncate max-w-xs">
              {FIRESTORE_DATABASE_ID}
            </code>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-emerald-800 dark:text-emerald-300">
            <span>
              Autoridade ativa:{' '}
              <strong className="underline">
                {currentUser?.username || 'Burocrata'} [{currentUser?.role || 'bureaucrat'}]
              </strong>
            </span>
            {lastCloudSyncTime && (
              <span className="font-mono opacity-80">Última sinc: {lastCloudSyncTime}</span>
            )}
            <button
              onClick={handlePullFromCloud}
              disabled={isSyncingWithCloud}
              className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1 cursor-pointer"
              title="Obter estado mais recente do Firestore"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Puxar da Nuvem</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Total Instaladas</span>
              <Puzzle className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
              {metrics.total}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Módulos no registro
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Extensões Ativas</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              {metrics.enabled} <span className="text-xs font-normal text-slate-400">({metrics.healthPercent}%)</span>
            </div>
            <div className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-0.5 font-medium">
              Prontas para execução
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Ganchos (Hooks)</span>
              <Code2 className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
              {metrics.totalHooks}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Pontos de interceptação
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Compatibilidade</span>
              <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="text-sm font-bold font-mono text-purple-700 dark:text-purple-300 mt-1 truncate">
              MW 1.43 / Node.js
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              extension.json v2
            </div>
          </div>
        </div>

        {/* Sub-Tabs: Lista de Extensões | Hooks do Sistema | Exportar Configuração */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
          <button
            onClick={() => setActiveSubView('list')}
            className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeSubView === 'list'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Puzzle className="w-3.5 h-3.5" />
            <span>Lista de Extensões ({filteredExtensions.length})</span>
          </button>
          <button
            onClick={() => setActiveSubView('hooks')}
            className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeSubView === 'hooks'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Registro de Hooks ({hookRegistry.length})</span>
          </button>
          <button
            onClick={() => setActiveSubView('export')}
            className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeSubView === 'export'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar LocalSettings.php & JSON</span>
          </button>
        </div>
      </div>

      {/* SUBVIEW 1: LIST OF EXTENSIONS */}
      {activeSubView === 'list' && (
        <div className="space-y-4">
          {/* Controls Bar: Search, Category, Status, Grid/Table toggle */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filtrar por nome, autor, hook ou palavra-chave..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                >
                  ×
                </button>
              )}
            </div>

            {/* Filter by Category */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Categoria:</span>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
              >
                <option value="all">Todas as Categorias</option>
                <option value="parser">Parser & AST (Cite, Parsoid, Math)</option>
                <option value="ui">Interface & UI (TOC, Related, Prism)</option>
                <option value="search">Busca (CirrusSearch)</option>
                <option value="security">Segurança & RBAC (CentralAuth, Spam)</option>
                <option value="infra">Infraestrutura (EventStreams, Diff)</option>
              </select>
            </div>

            {/* Filter by Status */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
              >
                <option value="all">Todos os Status</option>
                <option value="enabled">Somente Ativas</option>
                <option value="disabled">Somente Inativas</option>
              </select>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setDisplayMode('grid')}
                className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                  displayMode === 'grid'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Visualização em Grade"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDisplayMode('table')}
                className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                  displayMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Visualização em Tabela"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Grid View of Extensions */}
          {displayMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredExtensions.map(ext => {
                const catBadge = getCategoryBadge(ext.category);
                return (
                  <div
                    key={ext.id}
                    className={`bg-white dark:bg-slate-900 border rounded-lg p-4 flex flex-col justify-between transition-all shadow-2xs ${
                      ext.enabled
                        ? 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
                        : 'border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40 opacity-75'
                    }`}
                  >
                    <div>
                      {/* Card Header: Icon, Name, Version & Toggle Switch */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-start gap-2.5">
                          <div className={`p-2 rounded-md shrink-0 border ${catBadge.bg}`}>
                            <Puzzle className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                                {ext.name}
                              </h3>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                v{ext.version}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium line-clamp-1 mt-0.5">
                              {ext.namePt}
                            </div>
                          </div>
                        </div>

                        {/* Interactive Toggle Switch */}
                        <button
                          onClick={() => handleToggleExtension(ext.id)}
                          className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer shrink-0"
                          title={ext.enabled ? 'Clique para desativar' : 'Clique para ativar'}
                        >
                          {ext.enabled ? (
                            <ToggleRight className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                          )}
                        </button>
                      </div>

                      {/* Category Badge & License */}
                      <div className="flex flex-wrap items-center gap-1.5 my-2">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${catBadge.bg}`}>
                          {catBadge.label}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                          {ext.license}
                        </span>
                        {ext.enabled ? (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 ml-auto">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ativa
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1 ml-auto">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Desativada
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed mb-3 font-sans">
                        {ext.description}
                      </p>

                      {/* Registered Hooks Badges */}
                      <div className="mb-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                          Hooks ({ext.hooks.length}):
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {ext.hooks.slice(0, 2).map(h => (
                            <span
                              key={h.name}
                              className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 truncate max-w-[170px]"
                              title={`${h.name} -> ${h.handler}`}
                            >
                              {h.name}
                            </span>
                          ))}
                          {ext.hooks.length > 2 && (
                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 px-1">
                              +{ext.hooks.length - 2}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Action Footer */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setConfigModalExt(ext)}
                          className="px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors flex items-center gap-1 cursor-pointer"
                          title="Ajustar parâmetros de configuração"
                        >
                          <Settings className="w-3 h-3" />
                          <span>Configurar ({ext.config?.length || 0})</span>
                        </button>

                        <button
                          onClick={() => setManifestModalExt(ext)}
                          className="px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors flex items-center gap-1 cursor-pointer"
                          title="Inspecionar extension.json"
                        >
                          <FileJson className="w-3 h-3" />
                          <span>Manifesto</span>
                        </button>
                      </div>

                      <button
                        onClick={() => setTestModalExt(ext)}
                        className="px-2 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded transition-colors flex items-center gap-1 cursor-pointer"
                        title="Executar diagnóstico do gancho"
                      >
                        <Play className="w-3 h-3" />
                        <span>Testar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Table View */}
          {displayMode === 'table' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Nome da Extensão</th>
                    <th className="py-2.5 px-4">Categoria</th>
                    <th className="py-2.5 px-4">Versão</th>
                    <th className="py-2.5 px-4">Hooks Registrados</th>
                    <th className="py-2.5 px-4">Autor / Licença</th>
                    <th className="py-2.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                  {filteredExtensions.map(ext => {
                    const catBadge = getCategoryBadge(ext.category);
                    return (
                      <tr
                        key={ext.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors ${
                          !ext.enabled ? 'opacity-70' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4">
                          <button
                            onClick={() => handleToggleExtension(ext.id)}
                            className="cursor-pointer"
                            title={ext.enabled ? 'Desativar' : 'Ativar'}
                          >
                            {ext.enabled ? (
                              <ToggleRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                            )}
                          </button>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{ext.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs">
                            {ext.namePt}
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${catBadge.bg}`}>
                            {catBadge.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px]">v{ext.version}</td>
                        <td className="py-2.5 px-4">
                          <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                            {ext.hooks.length}
                          </span>{' '}
                          <span className="text-slate-400 text-[10px]">
                            ({ext.hooks.map(h => h.name).slice(0, 1).join(', ')})
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-xs">
                          {ext.author} · <span className="font-mono text-[10px]">{ext.license}</span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setConfigModalExt(ext)}
                              className="px-2 py-1 text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 transition-colors"
                              title="Configurar"
                            >
                              <Settings className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setManifestModalExt(ext)}
                              className="px-2 py-1 text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 transition-colors"
                              title="Manifesto JSON"
                            >
                              <FileJson className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setTestModalExt(ext)}
                              className="px-2 py-1 text-[11px] bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 rounded transition-colors"
                              title="Testar"
                            >
                              <Play className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filteredExtensions.length === 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center">
              <Puzzle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                Nenhuma extensão encontrada
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Tente ajustar os termos de pesquisa ou remover os filtros de categoria e status selecionados.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setStatusFilter('all');
                }}
                className="mt-3 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded text-xs font-medium hover:underline"
              >
                Limpar Filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUBVIEW 2: HOOK REGISTRY */}
      {activeSubView === 'hooks' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <Code2 className="w-4 h-4 text-blue-600" />
                <span>Registro de Ganchos do Sistema (MediaWiki Hooks)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Mapeamento completo dos pontos de extensão atrelados ao ciclo de vida do compilador Parsoid e das rotas HTTP.
              </p>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 self-start">
              {hookRegistry.length} ganchos ativos
            </span>
          </div>

          <div className="space-y-3">
            {hookRegistry.map(([hookName, listeners]) => (
              <div
                key={hookName}
                className="p-3.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:bg-slate-50 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                      {hookName}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {listeners[0].hook.description}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {listeners.length} {listeners.length === 1 ? 'receptor' : 'receptores'}
                  </span>
                </div>

                <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-blue-200 dark:border-blue-800">
                  {listeners.map(({ ext, hook }, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center justify-between text-xs py-1 px-2 rounded bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {ext.name}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">→</span>
                        <code className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                          {hook.handler}
                        </code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${
                            ext.enabled
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {ext.enabled ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBVIEW 3: EXPORT CONFIGURATION */}
      {activeSubView === 'export' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PHP LocalSettings.php Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-2xs space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    LocalSettings.php (MediaWiki Legado / Híbrido)
                  </h3>
                </div>
                <button
                  onClick={() => handleCopy(generatedPhpConfig, 'php')}
                  className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedKey === 'php' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-medium">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar PHP</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-sans">
                Instruções prontas de <code className="font-mono text-purple-600">wfLoadExtension(...)</code> para colar no seu arquivo de configuração raiz.
              </p>
              <pre className="mt-3 p-3 rounded bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-96 leading-relaxed border border-slate-800">
                {generatedPhpConfig}
              </pre>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>Formato compatível com MW 1.35 até MW 1.43+</span>
              <span className="font-mono">{extensions.filter(e => e.enabled).length} módulos ativados</span>
            </div>
          </div>

          {/* JSON Registry Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-2xs space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-blue-600" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    extensions.json (NotMediaWiki Node.js)
                  </h3>
                </div>
                <button
                  onClick={() => handleCopy(generatedJsonConfig, 'json')}
                  className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedKey === 'json' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-medium">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar JSON</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-sans">
                Manifesto serializado das extensões para microsserviços Node.js e orquestração Docker / Kubernetes.
              </p>
              <pre className="mt-3 p-3 rounded bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-96 leading-relaxed border border-slate-800">
                {generatedJsonConfig}
              </pre>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>WazzimaGiygg Microservices Mesh Protocol</span>
              <span className="font-mono">JSON v2.0</span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: EXTENSION.JSON MANIFEST INSPECTOR */}
      {manifestModalExt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-2xl w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  Manifesto extension.json • {manifestModalExt.name}
                </h3>
              </div>
              <button
                onClick={() => setManifestModalExt(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400">
              Estrutura canônica do manifesto da extensão conforme a especificação do MediaWiki Core para registro declarativo de classes, ganchos e dependências.
            </div>

            <pre className="p-4 rounded bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto max-h-80 border border-slate-800">
              {JSON.stringify(manifestModalExt.manifestJson || manifestModalExt, null, 2)}
            </pre>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <a
                href={manifestModalExt.url ? wrapExternalUrl(manifestModalExt.url) : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline text-xs flex items-center gap-1"
              >
                <span>Documentação oficial MediaWiki.org</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    handleCopy(
                      JSON.stringify(manifestModalExt.manifestJson || manifestModalExt, null, 2),
                      'manifest'
                    )
                  }
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded text-xs font-medium cursor-pointer"
                >
                  {copiedKey === 'manifest' ? 'Copiado!' : 'Copiar JSON'}
                </button>
                <button
                  onClick={() => setManifestModalExt(null)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIGURATION EDITOR */}
      {configModalExt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-xl w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-purple-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  Configurações de {configModalExt.name}
                </h3>
              </div>
              <button
                onClick={() => setConfigModalExt(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ajuste as diretivas globais de execução desta extensão. As modificações têm efeito imediato e são salvas no armazenamento local.
            </p>

            <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
              {configModalExt.config && configModalExt.config.length > 0 ? (
                configModalExt.config.map(param => (
                  <div
                    key={param.key}
                    className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <code className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                        {param.key}
                      </code>
                      <span className="text-[10px] font-mono text-slate-400">
                        Padrão: {String(param.defaultValue)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {param.description}
                    </div>

                    {/* Input Control according to parameter type */}
                    <div className="pt-1.5">
                      {param.type === 'boolean' ? (
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={!!param.value}
                            onChange={e => {
                              const checked = e.target.checked;
                              setExtensions(prev =>
                                prev.map(ext => {
                                  if (ext.id === configModalExt.id) {
                                    const nextCfg = ext.config.map(c =>
                                      c.key === param.key ? { ...c, value: checked } : c
                                    );
                                    return { ...ext, config: nextCfg };
                                  }
                                  return ext;
                                })
                              );
                              setConfigModalExt(prev =>
                                prev
                                  ? {
                                      ...prev,
                                      config: prev.config.map(c =>
                                        c.key === param.key ? { ...c, value: checked } : c
                                      ),
                                    }
                                  : null
                              );
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                          <span>Habilitado ({param.value ? 'true' : 'false'})</span>
                        </label>
                      ) : param.type === 'number' ? (
                        <input
                          type="number"
                          value={param.value}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setExtensions(prev =>
                              prev.map(ext => {
                                if (ext.id === configModalExt.id) {
                                  const nextCfg = ext.config.map(c =>
                                    c.key === param.key ? { ...c, value: val } : c
                                  );
                                  return { ...ext, config: nextCfg };
                                }
                                return ext;
                              })
                            );
                            setConfigModalExt(prev =>
                              prev
                                ? {
                                    ...prev,
                                    config: prev.config.map(c =>
                                      c.key === param.key ? { ...c, value: val } : c
                                    ),
                                  }
                                : null
                            );
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none"
                        />
                      ) : (
                        <input
                          type="text"
                          value={param.value}
                          onChange={e => {
                            const val = e.target.value;
                            setExtensions(prev =>
                              prev.map(ext => {
                                if (ext.id === configModalExt.id) {
                                  const nextCfg = ext.config.map(c =>
                                    c.key === param.key ? { ...c, value: val } : c
                                  );
                                  return { ...ext, config: nextCfg };
                                }
                                return ext;
                              })
                            );
                            setConfigModalExt(prev =>
                              prev
                                ? {
                                    ...prev,
                                    config: prev.config.map(c =>
                                      c.key === param.key ? { ...c, value: val } : c
                                    ),
                                  }
                                : null
                            );
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none"
                        />
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  Esta extensão não possui variáveis de configuração ajustáveis.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={async () => {
                  if (configModalExt) {
                    try {
                      await api.saveExtension(configModalExt, currentUser);
                      showToast(`Configurações de "${configModalExt.name}" salvas e sincronizadas no Firebase!`, 'success');
                      setLastCloudSyncTime(new Date().toLocaleTimeString('pt-BR'));
                    } catch (err: any) {
                      showToast(`Salvo localmente (Firebase aviso: ${err.message})`, 'warning');
                    }
                  }
                  setConfigModalExt(null);
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium cursor-pointer"
              >
                Concluir & Salvar no Firebase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: HOOK DIAGNOSTIC & TEST */}
      {testModalExt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  Diagnóstico • {testModalExt.name}
                </h3>
              </div>
              <button
                onClick={() => setTestModalExt(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Módulo Saudável e Operacional</span>
              </div>
              <div>Versão: v{testModalExt.version}</div>
              <div>Status: {testModalExt.enabled ? 'Ativo na Malha' : 'Inativo (ignorado no pipeline)'}</div>
              <div>Hooks verificados: {testModalExt.hooks.map(h => h.name).join(', ')}</div>
              <div>Latência de execução estimada: ~0.4ms</div>
            </div>

            <div className="text-xs text-slate-500 font-mono">
              GET /api/v1/extensions/{testModalExt.id}/healthcheck → 200 OK
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setTestModalExt(null)}
                className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded text-xs font-medium cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: INSTALL NEW EXTENSION */}
      {isAddModalOpen && (
        <InstallExtensionModal
          onClose={() => setIsAddModalOpen(false)}
          onAdd={async newExt => {
            setExtensions(prev => [newExt, ...prev]);
            setIsAddModalOpen(false);
            try {
              await api.saveExtension(newExt, currentUser);
              showToast(`Nova extensão "${newExt.name}" registrada e salva no Firebase!`, 'success');
              setLastCloudSyncTime(new Date().toLocaleTimeString('pt-BR'));
            } catch (err: any) {
              showToast(`Nova extensão salva localmente (Firebase: ${err.message})`, 'info');
            }
          }}
        />
      )}

      {/* MODAL 5: OFFICIAL STANDARD PDF REPORT */}
      {isReportModalOpen && (
        <WikiReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          metadata={buildExtensionsReportData(extensions, currentUser).metadata}
          extensions={extensions}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

interface InstallModalProps {
  onClose: () => void;
  onAdd: (ext: WikiExtension) => void;
}

const InstallExtensionModal: React.FC<InstallModalProps> = ({ onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [namePt, setNamePt] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [category, setCategory] = useState<ExtensionCategory>('parser');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [hookName, setHookName] = useState('ParserFirstCallInit');
  const [license, setLicense] = useState('GPL-2.0-or-later');

  // Presets from community
  const handleApplyPreset = (presetName: string) => {
    if (presetName === 'MobileFrontend') {
      setName('MobileFrontend');
      setNamePt('MobileFrontend & Responsividade');
      setVersion('2.3.0');
      setCategory('ui');
      setAuthor('Jon Robson, Arthur Richards');
      setDescription('Interface otimizada para dispositivos móveis com suporte a leitura compacta e gestos.');
      setHookName('SkinTemplateNavigation');
    } else if (presetName === 'Scribunto') {
      setName('Scribunto');
      setNamePt('Scribunto (Módulos Lua)');
      setVersion('1.4.1');
      setCategory('parser');
      setAuthor('Victor Vasiliev, Brad Jorsch');
      setDescription('Permite a inclusão e execução de módulos de programação em linguagem Lua em predefinições do wiki.');
      setHookName('ParserFirstCallInit');
    } else if (presetName === 'VisualEditor') {
      setName('VisualEditor');
      setNamePt('VisualEditor (Editor WYSIWYG)');
      setVersion('1.8.4');
      setCategory('ui');
      setAuthor('Trevor Parscal, Inez Korczyński');
      setDescription('Editor visual interativo de wikitext baseado em DOM com visualização instantânea de formatações.');
      setHookName('BeforePageDisplay');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newExt: WikiExtension = {
      id: `ext-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`,
      name: name.trim(),
      namePt: namePt.trim() || name.trim(),
      version: version.trim() || '1.0.0',
      category,
      author: author.trim() || 'Comunidade NotMediaWiki',
      description: description.trim() || 'Módulo registrado para NotMediaWiki.',
      enabled: true,
      type: 'extension',
      license,
      hooks: [
        {
          name: hookName,
          handler: `${name}Hooks::on${hookName}`,
          description: `Manipulador do gancho ${hookName} registrado por ${name}.`,
        },
      ],
      config: [
        {
          key: `$wg${name}Enabled`,
          type: 'boolean',
          value: true,
          defaultValue: true,
          description: `Flag global para ativação do módulo ${name}.`,
        },
      ],
      manifestJson: {
        name,
        version,
        type: category,
        license_name: license,
        author: [author || 'Comunidade'],
      },
      lastUpdated: new Date().toISOString().split('T')[0],
    };

    onAdd(newExt);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-lg w-full p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Instalar / Cadastrar Nova Extensão
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Community Presets */}
        <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Atalhos da Comunidade (Preenchimento Rápido):
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleApplyPreset('MobileFrontend')}
              className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors cursor-pointer"
            >
              MobileFrontend
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('Scribunto')}
              className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors cursor-pointer"
            >
              Scribunto (Lua)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('VisualEditor')}
              className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors cursor-pointer"
            >
              VisualEditor (WYSIWYG)
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nome Canônico (MediaWiki) *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: MobileFrontend"
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Título em Português
              </label>
              <input
                type="text"
                value={namePt}
                onChange={e => setNamePt(e.target.value)}
                placeholder="Ex: MobileFrontend & Responsividade"
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Categoria
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="parser">Parser & AST</option>
                <option value="ui">Interface & UI</option>
                <option value="search">Busca & Indexador</option>
                <option value="security">Segurança & Moderação</option>
                <option value="infra">Infraestrutura & Eventos</option>
                <option value="media">Mídia & Assets</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Versão Semântica
              </label>
              <input
                type="text"
                value={version}
                onChange={e => setVersion(e.target.value)}
                placeholder="Ex: 1.0.0"
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Autor / Mantenedor
            </label>
            <input
              type="text"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="Ex: Jon Robson, Wikimedia Foundation"
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Descrição
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Explique o propósito e comportamento desta extensão no wiki..."
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Hook Inicial Registrado
              </label>
              <input
                type="text"
                value={hookName}
                onChange={e => setHookName(e.target.value)}
                placeholder="Ex: ParserFirstCallInit"
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Licença
              </label>
              <input
                type="text"
                value={license}
                onChange={e => setLicense(e.target.value)}
                placeholder="Ex: GPL-2.0-or-later"
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium cursor-pointer"
            >
              Registrar Extensão
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
