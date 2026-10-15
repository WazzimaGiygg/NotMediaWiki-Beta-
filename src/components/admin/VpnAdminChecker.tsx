import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Globe,
  Radio,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Wifi,
  Search,
  Lock,
  Layers,
  Terminal,
} from 'lucide-react';
import { VpnDetectionLog, UserSession } from '../../types';
import {
  fetchVpnDetectionsFromFirestore,
  subscribeToVpnDetectionsFromFirestore,
  deleteVpnDetectionFromFirestore,
  saveVpnDetectionToFirestore,
} from '../../firebase';
import { performVpnAudit } from '../../utils/vpnDetector';

interface VpnAdminCheckerProps {
  currentUser?: UserSession | null;
}

export const VpnAdminChecker: React.FC<VpnAdminCheckerProps> = ({ currentUser }) => {
  const [detections, setDetections] = useState<VpnDetectionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuditing, setIsAuditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'alerta' | 'bloqueado' | 'permitido'>('todos');
  const [selectedLog, setSelectedLog] = useState<VpnDetectionLog | null>(null);
  const [auditNotice, setAuditNotice] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetchVpnDetectionsFromFirestore()
      .then(list => {
        if (!isMounted) return;
        setDetections(list || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.warn('Notice: Error loading VPN detections from Firestore:', err);
        if (isMounted) setIsLoading(false);
      });

    const unsubscribe = subscribeToVpnDetectionsFromFirestore(updated => {
      if (isMounted) {
        setDetections(updated || []);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleRunAuditNow = async () => {
    setIsAuditing(true);
    setAuditNotice(null);
    try {
      const result = await performVpnAudit(currentUser);
      setAuditNotice(
        `Auditoria concluída! IP: ${result.ip} • Risco: ${result.riskScore}% (${result.status.toUpperCase()})`
      );
      // Ensure detection is in state
      setDetections(prev => [result, ...prev.filter(d => d.id !== result.id)]);
      setSelectedLog(result);
      setTimeout(() => setAuditNotice(null), 6000);
    } catch (err: any) {
      alert(`Falha ao executar auditoria de VPN: ${err.message}`);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deseja excluir este registro de auditoria de VPN do Firebase Firestore?')) return;
    try {
      await deleteVpnDetectionFromFirestore(id);
      setDetections(prev => prev.filter(d => d.id !== id));
      if (selectedLog?.id === id) setSelectedLog(null);
    } catch (err: any) {
      alert(`Erro ao remover: ${err.message}`);
    }
  };

  const handleSeedModelAudits = async () => {
    const modelLogs: VpnDetectionLog[] = [
      {
        id: `vpn-sample-m247`,
        userId: 'usr-proxy-probe',
        username: 'EditorAnonimo_99',
        ip: '185.220.101.5',
        isVpn: true,
        isProxy: true,
        isTor: false,
        isDatacenter: true,
        riskScore: 85,
        confidence: 'critico',
        asn: 'AS9009 M247 Europe Ltd',
        isp: 'M247 Ltd Hosting Infrastructure',
        city: 'Amsterdam',
        country: 'Países Baixos',
        countryCode: 'NL',
        timezoneMismatch: true,
        browserTimezone: 'America/Sao_Paulo',
        ipTimezone: 'Europe/Amsterdam',
        webrtcLeakIp: '192.168.15.1, 10.8.0.2',
        reasons: [
          'ASN identificado como Datacenter/Hosting comercial (M247)',
          'Discrepância Geográfica: Fuso horário do navegador (America/Sao_Paulo) difere do IP (Europe/Amsterdam)',
          'Assinatura de adaptador de túnel virtual identificada via candidatos ICE WebRTC (10.8.0.2)',
        ],
        status: 'bloqueado',
        detectedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: `vpn-sample-clean`,
        userId: currentUser?.id,
        username: currentUser?.username || 'Mafersao',
        ip: '189.40.12.190',
        isVpn: false,
        isProxy: false,
        isTor: false,
        isDatacenter: false,
        riskScore: 5,
        confidence: 'baixo',
        asn: 'AS28573 Claro Brasil Telecom',
        isp: 'Claro S.A. Fibra Residencial',
        city: 'São Paulo',
        country: 'Brasil',
        countryCode: 'BR',
        timezoneMismatch: false,
        browserTimezone: 'America/Sao_Paulo',
        ipTimezone: 'America/Sao_Paulo',
        reasons: [
          'Conexão limpa: IP residencial verificado, conformidade de fuso horário e ausência de túneis de proxy.',
        ],
        status: 'permitido',
        detectedAt: new Date(Date.now() - 1800000).toISOString(),
      },
    ];

    for (const log of modelLogs) {
      await saveVpnDetectionToFirestore(log);
    }
  };

  const filtered = detections.filter(d => {
    const matchesSearch =
      d.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.username && d.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (d.isp && d.isp.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (d.asn && d.asn.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (d.country && d.country.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === 'todos') return true;
    return d.status === statusFilter;
  });

  const vpnCount = detections.filter(d => d.isVpn || d.isProxy).length;
  const mismatchCount = detections.filter(d => d.timezoneMismatch).length;
  const blockedCount = detections.filter(d => d.status === 'bloqueado').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Verificador de VPN, Proxies e Auditoria Telemática
              </h2>
              <span className="text-[11px] font-mono bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-semibold">
                Network Guard • Firebase Sincronizado
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
              Auditoria ativa de conexões anônimas, servidores proxy abertos, instâncias de datacenters comerciais e
              verificação de discrepâncias geográficas (Fuso Horário vs Geolocation IP & candidatos WebRTC ICE).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRunAuditNow}
              disabled={isAuditing}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 transition-all"
            >
              {isAuditing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Auditoria em Execução...</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Auditar Minha Conexão Agora</span>
                </>
              )}
            </button>
          </div>
        </div>

        {auditNotice && (
          <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded text-xs text-indigo-800 dark:text-indigo-300 flex items-center gap-2 animate-fade-in">
            <CheckCircle className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span>{auditNotice}</span>
          </div>
        )}

        {/* Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-3 rounded-lg">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Total de Auditorias</span>
            <div className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100 mt-0.5">
              {detections.length}
            </div>
          </div>
          <div className="bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 p-3 rounded-lg">
            <span className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">VPNs / Proxies Detectados</span>
            <div className="text-xl font-bold font-mono text-rose-700 dark:text-rose-300 mt-0.5">
              {vpnCount}
            </div>
          </div>
          <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-3 rounded-lg">
            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">Fuso Horário Divergente</span>
            <div className="text-xl font-bold font-mono text-amber-700 dark:text-amber-300 mt-0.5">
              {mismatchCount}
            </div>
          </div>
          <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 p-3 rounded-lg">
            <span className="text-[11px] text-purple-700 dark:text-purple-400 font-medium">Restrições / Bloqueados</span>
            <div className="text-xl font-bold font-mono text-purple-700 dark:text-purple-300 mt-0.5">
              {blockedCount}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar por IP, ASN, provedor, usuário ou país..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-[11px]">Status:</span>
          {(['todos', 'alerta', 'bloqueado', 'permitido'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer capitalize ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Detections List & Details Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {isLoading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-12 text-center text-slate-500 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
              Carregando registros de auditoria do Firebase Firestore...
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center text-slate-500 text-xs space-y-3">
              <ShieldCheck className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
              <div className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                Nenhuma detecção de VPN ou proxy registrada no Firebase Firestore.
              </div>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Audite sua conexão atual para registrar métricas telemáticas em tempo real no banco de dados do Firebase.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={handleRunAuditNow}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold cursor-pointer"
                >
                  Auditar Conexão Agora
                </button>
                <button
                  onClick={handleSeedModelAudits}
                  className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-xs font-medium cursor-pointer"
                >
                  Carregar Amostras Modelo
                </button>
              </div>
            </div>
          ) : (
            filtered.map(log => {
              const isSelected = selectedLog?.id === log.id;
              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className={`bg-white dark:bg-slate-900 border rounded-lg p-4 transition-all cursor-pointer text-xs space-y-2.5 ${
                    isSelected
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {log.ip}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          log.status === 'bloqueado'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                            : log.status === 'alerta'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                        }`}
                      >
                        {log.status}
                      </span>
                      {log.isVpn && (
                        <span className="px-1.5 py-0.2 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold rounded">
                          VPN / Datacenter
                        </span>
                      )}
                      {log.timezoneMismatch && (
                        <span className="px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold rounded">
                          Fuso Divergente
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-[11px] font-mono text-slate-500">
                          {new Date(log.detectedAt).toLocaleString('pt-BR')}
                        </div>
                      </div>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDelete(log.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                        title="Excluir do Firestore"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600 dark:text-slate-400">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Usuário Identificado:</span>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {log.username || 'Não autenticado'}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Provedor / ISP:</span>
                      <div className="truncate font-mono">{log.isp || log.asn || 'Desconhecido'}</div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Localidade do IP:</span>
                      <div>
                        {log.city ? `${log.city}, ` : ''}
                        {log.country || 'Desconhecido'}
                      </div>
                    </div>
                  </div>

                  {/* Reasons Preview */}
                  {log.reasons && log.reasons.length > 0 && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-800 truncate">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Diagnóstico: </span>
                      {log.reasons[0]}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Selected Audit Details Card */}
        <div>
          {selectedLog ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-4 text-xs sticky top-20">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Dossiê da Auditoria Telemática</span>
                </h3>
                <span className="font-mono text-[10px] text-slate-400">{selectedLog.id}</span>
              </div>

              {/* Risk Gauge */}
              <div className="bg-slate-50 dark:bg-slate-800 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-200">Score Heurístico de Risco:</span>
                  <span
                    className={`font-mono font-bold text-sm ${
                      selectedLog.riskScore >= 70
                        ? 'text-rose-600'
                        : selectedLog.riskScore >= 35
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }`}
                  >
                    {selectedLog.riskScore}% ({selectedLog.confidence.toUpperCase()})
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      selectedLog.riskScore >= 70
                        ? 'bg-rose-500'
                        : selectedLog.riskScore >= 35
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${selectedLog.riskScore}%` }}
                  />
                </div>
              </div>

              {/* Technical Attributes */}
              <div className="space-y-2">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Endereço IP e ASN</span>
                  <div className="font-mono font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                    {selectedLog.ip}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">{selectedLog.asn || 'Sem ASN registrado'}</div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Fuso Horário e Geografia</span>
                  <div className="text-slate-700 dark:text-slate-300 mt-0.5">
                    {selectedLog.city ? `${selectedLog.city}, ` : ''}
                    {selectedLog.country} ({selectedLog.countryCode || 'N/A'})
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1 space-y-0.5">
                    <div>Browser TZ: {selectedLog.browserTimezone || 'Desconhecido'}</div>
                    <div>IP Geo TZ: {selectedLog.ipTimezone || 'Desconhecido'}</div>
                  </div>
                </div>

                {selectedLog.webrtcLeakIp && (
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Candidatos WebRTC ICE</span>
                    <div className="font-mono text-slate-700 dark:text-slate-300 mt-0.5 text-[11px] break-all">
                      {selectedLog.webrtcLeakIp}
                    </div>
                  </div>
                )}
              </div>

              {/* Diagnostic Reasons */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block">
                  Evidências e Heurísticas Acionadas
                </span>
                <ul className="space-y-1.5 text-[11px]">
                  {selectedLog.reasons.map((r, i) => (
                    <li
                      key={i}
                      className="p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-800 flex items-start gap-1.5 text-slate-700 dark:text-slate-300"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center text-slate-400 text-xs">
              Selecione um registro na lista ao lado para inspecionar os parâmetros técnicos detalhados da conexão.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
