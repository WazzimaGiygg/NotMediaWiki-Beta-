import React, { useState, useEffect } from 'react';
import {
  ScrollText,
  Filter,
  Search,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Info,
  Bug,
  Flame,
  CheckCircle2,
  Copy,
  ChevronDown,
  ChevronRight,
  Database,
  Terminal,
  Activity,
  PlusCircle,
} from 'lucide-react';
import { SystemLog, LogLevel } from '../types';
import { subscribeToFirestoreLogs, writeSystemLog } from '../firebase';

export const SystemLogs: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedService, setSelectedService] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [generatingLog, setGeneratingLog] = useState(false);

  // Subscribe to real-time logs from Firebase Firestore
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToFirestoreLogs(
      incomingLogs => {
        setLogs(incomingLogs);
        setLoading(false);
      },
      error => {
        console.warn('Real-time logs subscription warning:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Filter logs based on level, microservice, and search query
  const filteredLogs = logs.filter(log => {
    if (selectedLevel !== 'ALL' && log.level !== selectedLevel) {
      return false;
    }
    if (selectedService !== 'ALL' && log.service !== selectedService) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMsg = log.message.toLowerCase().includes(q);
      const matchService = log.service.toLowerCase().includes(q);
      const matchTrace = log.traceId?.toLowerCase().includes(q);
      const matchDetails = log.details ? JSON.stringify(log.details).toLowerCase().includes(q) : false;
      return matchMsg || matchService || matchTrace || matchDetails;
    }
    return true;
  });

  // Calculate statistics
  const totalCount = logs.length;
  const errorCount = logs.filter(l => l.level === 'ERROR' || l.level === 'FATAL').length;
  const warnCount = logs.filter(l => l.level === 'WARN').length;
  const infoCount = logs.filter(l => l.level === 'INFO').length;
  const debugCount = logs.filter(l => l.level === 'DEBUG').length;

  // Unique microservices in current logs
  const availableServices = Array.from(new Set(logs.map(l => l.service).filter(Boolean)));
  if (!availableServices.includes('ContentService')) availableServices.push('ContentService');
  if (!availableServices.includes('Parsoid')) availableServices.push('Parsoid');
  if (!availableServices.includes('EventGate')) availableServices.push('EventGate');
  if (!availableServices.includes('CentralAuth')) availableServices.push('CentralAuth');

  const handleGenerateTestLog = async (level: LogLevel = 'ERROR') => {
    setGeneratingLog(true);
    try {
      const services = ['ContentService', 'Parsoid', 'EventGate', 'CentralAuth', 'StorageMesh'];
      const randomService = services[Math.floor(Math.random() * services.length)];
      const sampleMessages: Record<LogLevel, string[]> = {
        DEBUG: [
          'Parsoid AST worker cache hit (0.4ms) for page tokenization',
          'EventGate SSE keep-alive ping broadcasted to 14 active listeners',
        ],
        INFO: [
          'Revision snapshot serialized to Firebase Cloud document mesh',
          'CentralAuth user token verified via Firebase Authentication session',
          'ContentService article fetched from Firestore /articles with low latency',
        ],
        WARN: [
          'Circuit breaker: High latency observed on search microservice replica #2 (p95 > 180ms)',
          'Parsoid template transclusion limit near threshold for {{Infobox}}',
        ],
        ERROR: [
          'EventStreams connection transient timeout on Kafka bridge, retry queued',
          'ContentService optimistic lock conflict on concurrent article revision commit',
          'Parsoid HTML5 tree serialization warning: malformed wikitext token syntax',
        ],
        FATAL: [
          'StorageMesh disk I/O saturated on partition /data/cache, failover initiated',
        ],
      };

      const messages = sampleMessages[level];
      const message = messages[Math.floor(Math.random() * messages.length)];

      await writeSystemLog({
        level,
        service: randomService,
        message,
        traceId: `tr-test-${Date.now().toString(36)}`,
        details: {
          test: true,
          generatedBy: 'AdminDashboard',
          clientTimestamp: new Date().toISOString(),
          environment: 'MediaWiki-Node-Microservices',
        },
      });
    } catch (e) {
      console.error('Failed to create test log:', e);
    } finally {
      setGeneratingLog(false);
    }
  };

  const handleCopyLog = (log: SystemLog) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopySuccess(log.id);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const getLevelBadge = (level: LogLevel) => {
    switch (level) {
      case 'FATAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
            <Flame className="w-3 h-3 text-purple-600" /> FATAL
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" /> ERROR
          </span>
        );
      case 'WARN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> WARN
          </span>
        );
      case 'INFO':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
            <Info className="w-3 h-3 text-blue-600" /> INFO
          </span>
        );
      case 'DEBUG':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            <Bug className="w-3 h-3 text-slate-500" /> DEBUG
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
            {level}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Logs do Sistema & Microsserviços em Tempo Real
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Firebase Realtime Stream
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Transmissão ao vivo de eventos de telemetria, erros e diagnósticos dos microsserviços sincronizados diretamente no Firebase Firestore (/system_logs).
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleGenerateTestLog('ERROR')}
              disabled={generatingLog}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>Simular Erro</span>
            </button>
            <button
              onClick={() => handleGenerateTestLog('WARN')}
              disabled={generatingLog}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Simular Alerta</span>
            </button>
            <button
              onClick={() => handleGenerateTestLog('INFO')}
              disabled={generatingLog}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-blue-600" />
              <span>Log Info</span>
            </button>
          </div>
        </div>

        {/* Real-time KPI Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-4 border-t border-slate-100">
          <div
            onClick={() => setSelectedLevel('ALL')}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              selectedLevel === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="text-[11px] font-medium opacity-80">Total de Logs</div>
            <div className="text-xl font-bold font-mono mt-0.5">{totalCount}</div>
            <div className="text-[10px] opacity-70 mt-0.5">Coleção Firestore</div>
          </div>

          <div
            onClick={() => setSelectedLevel('ERROR')}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              selectedLevel === 'ERROR'
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-rose-50/70 border-rose-200 text-rose-800 hover:bg-rose-100/70'
            }`}
          >
            <div className="text-[11px] font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Erros & Falhas
            </div>
            <div className="text-xl font-bold font-mono mt-0.5">{errorCount}</div>
            <div className="text-[10px] opacity-80 mt-0.5">Nível ERROR / FATAL</div>
          </div>

          <div
            onClick={() => setSelectedLevel('WARN')}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              selectedLevel === 'WARN'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-amber-50/70 border-amber-200 text-amber-800 hover:bg-amber-100/70'
            }`}
          >
            <div className="text-[11px] font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Avisos (Warn)
            </div>
            <div className="text-xl font-bold font-mono mt-0.5">{warnCount}</div>
            <div className="text-[10px] opacity-80 mt-0.5">Degradação potencial</div>
          </div>

          <div
            onClick={() => setSelectedLevel('INFO')}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              selectedLevel === 'INFO'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-blue-50/70 border-blue-200 text-blue-800 hover:bg-blue-100/70'
            }`}
          >
            <div className="text-[11px] font-medium flex items-center gap-1">
              <Info className="w-3 h-3" /> Informativos
            </div>
            <div className="text-xl font-bold font-mono mt-0.5">{infoCount}</div>
            <div className="text-[10px] opacity-80 mt-0.5">Operações normais</div>
          </div>

          <div
            onClick={() => setSelectedLevel('DEBUG')}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              selectedLevel === 'DEBUG'
                ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <div className="text-[11px] font-medium flex items-center gap-1">
              <Bug className="w-3 h-3" /> Depuração
            </div>
            <div className="text-xl font-bold font-mono mt-0.5">{debugCount}</div>
            <div className="text-[10px] opacity-80 mt-0.5">AST e traces</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Error Level Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md overflow-x-auto w-full sm:w-auto">
            <span className="text-[10px] uppercase font-bold text-slate-500 px-2 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Nível:
            </span>
            {['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'].map(lvl => (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  selectedLevel === lvl
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lvl === 'ALL' ? 'Todos os Níveis' : lvl}
              </button>
            ))}
          </div>

          {/* Microservice selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Serviço:</span>
            <select
              value={selectedService}
              onChange={e => setSelectedService(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded px-2.5 py-1.5 outline-none focus:border-blue-500 cursor-pointer w-full sm:w-auto"
            >
              <option value="ALL">Todos os Microsserviços</option>
              {availableServices.map(svc => (
                <option key={svc} value={svc}>
                  {svc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Text Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filtrar por mensagem de log, ID de rastreamento (traceId), autor ou detalhes JSON..."
            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded pl-9 pr-24 py-2 outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono placeholder:font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Real-time Logs List / Terminal */}
      <div className="bg-slate-900 text-slate-100 rounded-lg border border-slate-800 overflow-hidden shadow-sm">
        {/* Console Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-semibold text-slate-300">
              Live EventStream & Microservices Ledger
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              ({filteredLogs.length} {filteredLogs.length === 1 ? 'registro' : 'registros'})
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Stream Conectado
            </span>
          </div>
        </div>

        {/* Logs Feed */}
        {loading ? (
          <div className="p-8 text-center text-slate-400 font-mono text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-500" />
            Carregando fluxo de logs em tempo real do Firebase...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-mono text-xs">
            <Database className="w-8 h-8 mx-auto mb-3 text-slate-600 opacity-60" />
            <div className="text-slate-300 font-medium">Nenhum log encontrado para os filtros selecionados.</div>
            <div className="text-slate-500 text-[11px] mt-1">
              Use os botões &quot;Simular Erro&quot; ou &quot;Simular Alerta&quot; acima para gerar registros de teste no Firebase.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60 max-h-[600px] overflow-y-auto font-mono text-xs">
            {filteredLogs.map(log => {
              const isExpanded = expandedLogId === log.id;
              const isCopied = copySuccess === log.id;

              return (
                <div
                  key={log.id}
                  className={`p-3.5 transition-colors hover:bg-slate-800/50 ${
                    log.level === 'ERROR' || log.level === 'FATAL'
                      ? 'bg-rose-950/20'
                      : log.level === 'WARN'
                      ? 'bg-amber-950/10'
                      : ''
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="text-slate-500 hover:text-slate-300 mt-0.5 cursor-pointer"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <div className="shrink-0">{getLevelBadge(log.level)}</div>

                      <div className="shrink-0">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {log.service}
                        </span>
                      </div>

                      <div className="text-slate-200 break-words flex-1 leading-relaxed">
                        {log.message}
                      </div>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="flex items-center gap-3 shrink-0 sm:self-start text-[11px] text-slate-400 pl-6 sm:pl-0">
                      {log.traceId && (
                        <span className="text-[10px] text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60">
                          {log.traceId}
                        </span>
                      )}
                      <span className="text-slate-500 text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <button
                        onClick={() => handleCopyLog(log)}
                        title="Copiar JSON do log"
                        className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer transition-colors"
                      >
                        {isCopied ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Details JSON Drawer */}
                  {isExpanded && (
                    <div className="mt-3 ml-6 p-3 bg-slate-950/90 rounded border border-slate-800 text-[11px] text-slate-300">
                      <div className="text-[10px] uppercase font-bold text-slate-500 mb-1.5 flex items-center justify-between">
                        <span>Payload Completo do Documento (/system_logs/{log.id})</span>
                        <span className="text-slate-600 font-mono">ISO: {log.timestamp}</span>
                      </div>
                      <pre className="overflow-x-auto text-emerald-300/90 whitespace-pre-wrap leading-snug">
                        {JSON.stringify(
                          {
                            id: log.id,
                            level: log.level,
                            service: log.service,
                            message: log.message,
                            traceId: log.traceId,
                            timestamp: log.timestamp,
                            details: log.details || null,
                          },
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
