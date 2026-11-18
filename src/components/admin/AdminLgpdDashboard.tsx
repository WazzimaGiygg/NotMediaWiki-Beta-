import React, { useState, useMemo } from 'react';
import {
  Trash2,
  EyeOff,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Scale,
  RefreshCw,
  Cloud,
  ShieldCheck,
  AlertTriangle,
  FileJson,
  FileSpreadsheet,
  ExternalLink,
} from 'lucide-react';
import { DataRemovalRequest, UserSession } from '../../types';
import { useLgpdRequests } from '../../context/LgpdRequestsContext';

export interface AdminLgpdDashboardProps {
  currentUser: UserSession | null;
  onNavigateArticle?: (slug: string) => void;
}

const LEGAL_BASIS_LABELS: Record<DataRemovalRequest['legalBasis'], string> = {
  LGPD_Art18: 'LGPD Art. 18 (Eliminação / Anonimização)',
  MarcoCivil_Art19: 'Marco Civil Art. 19 (Remoção de Conteúdo)',
  Doxxing: 'Doxxing (Vazamento de PII)',
  Difamacao: 'Difamação / Injúria Grave',
  OrdemJudicial: 'Ordem Judicial',
};

const STATUS_LABELS: Record<DataRemovalRequest['status'], string> = {
  pendente: 'Pendente',
  processado: 'Deferido / Suprimido',
  rejeitado: 'Indeferido',
};

function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const AdminLgpdDashboard: React.FC<AdminLgpdDashboardProps> = ({
  currentUser,
  onNavigateArticle,
}) => {
  const {
    requests,
    isLoading,
    error,
    pendingCount,
    processedCount,
    rejectedCount,
    createRequest,
    processRequest,
    rejectRequest,
    deleteRequest,
    refreshRequests,
    seedInitialRequests,
  } = useLgpdRequests();

  const [filterStatus, setFilterStatus] = useState<'todos' | DataRemovalRequest['status']>('todos');
  const [filterBasis, setFilterBasis] = useState<'todos' | DataRemovalRequest['legalBasis']>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Inline rejection & delete confirmation state (avoids window.prompt / window.confirm)
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // New Request Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formBasis, setFormBasis] = useState<DataRemovalRequest['legalBasis']>('LGPD_Art18');
  const [formSlug, setFormSlug] = useState('MediaWiki');
  const [formRevId, setFormRevId] = useState('');
  const [formDesc, setFormDesc] = useState('');

  const canAdminister =
    !currentUser ||
    currentUser.role === 'bureaucrat' ||
    currentUser.role === 'sysop' ||
    currentUser.role === 'moderator';

  const showFeedback = (type: 'success' | 'error' | 'info', message: string) => {
    setStatusFeedback({ type, message });
    window.setTimeout(() => {
      setStatusFeedback(prev => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const filteredRequests = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return requests.filter(req => {
      const matchesStatus = filterStatus === 'todos' || req.status === filterStatus;
      const matchesBasis = filterBasis === 'todos' || req.legalBasis === filterBasis;
      const matchesQuery =
        !query ||
        req.protocolNumber.toLowerCase().includes(query) ||
        req.requesterNameOrAlias.toLowerCase().includes(query) ||
        (req.requesterEmail || '').toLowerCase().includes(query) ||
        req.targetSlug.toLowerCase().includes(query) ||
        req.description.toLowerCase().includes(query);
      return matchesStatus && matchesBasis && matchesQuery;
    });
  }, [requests, filterStatus, filterBasis, searchTerm]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim() || !formDesc.trim()) return;

    const created = await createRequest({
      requesterNameOrAlias: formName,
      requesterEmail: formEmail,
      legalBasis: formBasis,
      targetSlug: formSlug,
      targetRevisionId: formRevId,
      description: formDesc,
    });

    setIsModalOpen(false);
    setFormName('');
    setFormEmail('');
    setFormRevId('');
    setFormDesc('');
    showFeedback('success', `Solicitação ${created.protocolNumber} registrada no estado global.`);
  };

  const handleExecuteSuppression = async (id: string, actionLabel: string) => {
    const updated = await processRequest(id, actionLabel, currentUser?.username);
    if (updated) {
      showFeedback(
        'success',
        `Protocolo ${updated.protocolNumber} concluído: ${actionLabel}.`
      );
    }
  };

  const handleConfirmReject = async (id: string) => {
    if (!rejectReason.trim()) {
      showFeedback('error', 'Informe a fundamentação jurídica para indeferir a solicitação.');
      return;
    }
    const updated = await rejectRequest(id, rejectReason, currentUser?.username);
    if (updated) {
      setRejectingId(null);
      setRejectReason('');
      showFeedback('info', `Protocolo ${updated.protocolNumber} indeferido com justificativa registrada.`);
    }
  };

  const handleConfirmDelete = async (id: string) => {
    await deleteRequest(id);
    setConfirmDeleteId(null);
    showFeedback('info', 'Registro de solicitação removido.');
  };

  const handleSeedInitial = async () => {
    setIsSeeding(true);
    try {
      await seedInitialRequests();
      showFeedback('success', 'Solicitações iniciais de exemplo carregadas no estado global.');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleExportJson = () => {
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        total: filteredRequests.length,
        requests: filteredRequests,
      },
      null,
      2
    );
    triggerFileDownload(
      `lgpd-solicitacoes-exclusao-${new Date().toISOString().slice(0, 10)}.json`,
      payload,
      'application/json;charset=utf-8'
    );
    showFeedback('success', `Relatório JSON exportado (${filteredRequests.length} registro(s)).`);
  };

  const handleExportCsv = () => {
    const escapeCsv = (val?: string) => `"${(val || '').replace(/"/g, '""')}"`;
    const headers = [
      'Protocolo',
      'Status',
      'Base Legal',
      'Solicitante',
      'E-mail',
      'Artigo Alvo',
      'Revisão',
      'Criado Em',
      'Processado Por',
      'Descrição',
    ];
    const rows = filteredRequests.map(r =>
      [
        escapeCsv(r.protocolNumber),
        escapeCsv(STATUS_LABELS[r.status]),
        escapeCsv(r.legalBasis),
        escapeCsv(r.requesterNameOrAlias),
        escapeCsv(r.requesterEmail),
        escapeCsv(r.targetSlug),
        escapeCsv(r.targetRevisionId),
        escapeCsv(r.createdAt),
        escapeCsv(r.processedBy),
        escapeCsv(r.description),
      ].join(',')
    );
    triggerFileDownload(
      `lgpd-solicitacoes-exclusao-${new Date().toISOString().slice(0, 10)}.csv`,
      [headers.join(','), ...rows].join('\n'),
      'text/csv;charset=utf-8'
    );
    showFeedback('success', `Relatório CSV exportado (${filteredRequests.length} registro(s)).`);
  };

  return (
    <div className="space-y-6" data-testid="admin-lgpd-dashboard">
      {/* Inline Status Feedback Banner */}
      {statusFeedback && (
        <div
          role="status"
          className={`p-3 rounded-lg border text-xs font-medium flex items-center justify-between gap-2 ${
            statusFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : statusFeedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : statusFeedback.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span>{statusFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusFeedback(null)}
            className="text-slate-500 hover:text-slate-800 text-xs px-1 cursor-pointer"
            aria-label="Fechar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header & KPI Overview */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-200 text-rose-700 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex flex-wrap items-center gap-2">
                <span>Central de Solicitações de Exclusão (LGPD / Oversight)</span>
                <span className="text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-mono font-medium">
                  Art. 18 LGPD &amp; Art. 19 Marco Civil
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Gerenciamento unificado via estado global da aplicação para pedidos de eliminação de dados pessoais, contenção de doxxing, Revision Deletion e ordens judiciais.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => refreshRequests()}
              disabled={isLoading}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Recarregar solicitações do Firestore"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Sincronizar</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Exportar solicitações em JSON"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Exportar solicitações em CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Solicitação de Exclusão</span>
            </button>
          </div>
        </div>

        {/* Legal Framework Notice */}
        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
          <Scale className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-semibold text-slate-800">
              Procedimento Técnico de Supressão (Revision Deletion &amp; Oversight)
            </div>
            <div className="text-[11px] leading-relaxed text-slate-600">
              A supressão remove o conteúdo ofensivo ou dados pessoais do banco de dados visível ao público. Os registros de auditoria e logs de conexão são mantidos em cofre isolado pelo prazo obrigatório de 6 meses conforme o{' '}
              <strong>Art. 15 do Marco Civil da Internet (Lei 12.965/14)</strong>.
            </div>
          </div>
        </div>

        {/* KPI Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Pendentes</div>
            <div className="text-lg font-bold font-mono text-rose-600 mt-0.5">
              {pendingCount} urgente{pendingCount === 1 ? '' : 's'}
            </div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Suprimidos / Deferidos</div>
            <div className="text-lg font-bold font-mono text-emerald-600 mt-0.5">
              {processedCount} concluído{processedCount === 1 ? '' : 's'}
            </div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Indeferidos</div>
            <div className="text-lg font-bold font-mono text-slate-700 mt-0.5">
              {rejectedCount} arquivado{rejectedCount === 1 ? '' : 's'}
            </div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Encarregado DPO</div>
            <div className="text-sm sm:text-base font-bold font-mono text-slate-800 mt-1 truncate">
              dpo@wazzimagiygg.com
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'todos', label: `Todos (${requests.length})` },
              { id: 'pendente', label: `Pendentes (${pendingCount})` },
              { id: 'processado', label: `Deferidos (${processedCount})` },
              { id: 'rejeitado', label: `Indeferidos (${rejectedCount})` },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                filterStatus === tab.id
                  ? 'bg-rose-600 text-white font-semibold'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filtrar por base legal"
            value={filterBasis}
            onChange={e => setFilterBasis(e.target.value as any)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-700 focus:ring-1 focus:ring-rose-500 outline-none"
          >
            <option value="todos">Todas as Bases Legais</option>
            <option value="LGPD_Art18">LGPD Art. 18</option>
            <option value="MarcoCivil_Art19">Marco Civil Art. 19</option>
            <option value="Doxxing">Doxxing / PII</option>
            <option value="OrdemJudicial">Ordem Judicial</option>
            <option value="Difamacao">Difamação / Injúria</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar protocolo, artigo ou titular..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs w-60 focus:ring-1 focus:ring-rose-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Requests Queue */}
      <div className="space-y-3">
        {isLoading && requests.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-xs">
            Carregando solicitações de exclusão LGPD...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-xs space-y-3">
            <Trash2 className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="font-semibold text-slate-700 text-sm">
              {requests.length === 0
                ? 'Nenhuma solicitação de exclusão LGPD registrada.'
                : 'Nenhuma solicitação corresponde aos filtros aplicados.'}
            </div>
            <p className="text-slate-500 max-w-md mx-auto">
              Todas as solicitações de Oversight, LGPD Art. 18 e ordens judiciais são gerenciadas pelo estado global da aplicação e sincronizadas em tempo real com o Firebase Firestore.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {requests.length === 0 && (
                <button
                  type="button"
                  onClick={handleSeedInitial}
                  disabled={isSeeding}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium text-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>{isSeeding ? 'Carregando...' : 'Carregar Pedidos de Exemplo'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar Nova Solicitação</span>
              </button>
            </div>
          </div>
        ) : (
          filteredRequests.map(req => (
            <article
              key={req.id}
              className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3 text-xs"
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-xs">
                    {req.protocolNumber}
                  </span>
                  <span className="font-bold text-slate-900 inline-flex items-center gap-1">
                    Artigo Alvo:{' '}
                    {onNavigateArticle ? (
                      <button
                        type="button"
                        onClick={() => onNavigateArticle(req.targetSlug)}
                        className="text-blue-600 hover:underline font-mono inline-flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>[[{req.targetSlug}]]</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="text-blue-600 font-mono">[[{req.targetSlug}]]</span>
                    )}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      req.status === 'processado'
                        ? 'bg-emerald-100 text-emerald-800'
                        : req.status === 'pendente'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {STATUS_LABELS[req.status]}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-mono text-[10px] font-semibold border border-purple-200">
                    {LEGAL_BASIS_LABELS[req.legalBasis] || req.legalBasis}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                  <span>
                    {new Date(req.createdAt).toLocaleDateString('pt-BR')} às{' '}
                    {new Date(req.createdAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {canAdminister && (
                    confirmDeleteId === req.id ? (
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          type="button"
                          onClick={() => handleConfirmDelete(req.id)}
                          className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-sans font-semibold cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-sans cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(req.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors ml-1 cursor-pointer"
                        title="Remover registro"
                        aria-label={`Remover protocolo ${req.protocolNumber}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Requester Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px]">
                <div>
                  <strong className="text-slate-700">Solicitante:</strong> {req.requesterNameOrAlias}
                  {req.requesterEmail && (
                    <span className="text-slate-500 font-mono block">
                      E-mail: {req.requesterEmail}
                    </span>
                  )}
                </div>
                <div>
                  <strong className="text-slate-700">Revisão Específica:</strong>{' '}
                  <span className="font-mono">
                    {req.targetRevisionId || 'Artigo integral / Múltiplas revisões'}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="bg-white p-3 rounded border border-slate-200 leading-relaxed text-slate-700">
                <span className="font-bold text-slate-900 block mb-1">
                  Fundamentação e Conteúdo Alvo:
                </span>
                {req.description}
              </div>

              {/* Audit Trail / Actions Taken */}
              {req.actionsTaken && req.actionsTaken.length > 0 && (
                <div
                  className={`p-3 rounded border ${
                    req.status === 'rejeitado'
                      ? 'bg-slate-50 border-slate-200 text-slate-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    {req.status === 'rejeitado' ? (
                      <XCircle className="w-3.5 h-3.5 text-slate-500" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    <span>Medidas Técnicas e Jurídicas Registradas:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {req.actionsTaken.map((act, idx) => (
                      <li key={idx}>{act}</li>
                    ))}
                  </ul>
                  {req.processedBy && (
                    <div className="text-[10px] opacity-75 font-mono mt-2">
                      Concluído por: {req.processedBy}
                      {req.processedAt && ` em ${new Date(req.processedAt).toLocaleString('pt-BR')}`}
                    </div>
                  )}
                </div>
              )}

              {/* Inline Rejection Box */}
              {rejectingId === req.id && (
                <div className="p-3 bg-rose-50/60 border border-rose-200 rounded space-y-2">
                  <label className="block font-semibold text-rose-900 text-[11px]">
                    Fundamentação jurídica para o indeferimento ({req.protocolNumber}):
                  </label>
                  <textarea
                    rows={2}
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Ex.: Conteúdo de interesse público jornalístico sem exposição de dados sensíveis..."
                    className="w-full p-2 bg-white border border-rose-300 rounded text-xs focus:ring-1 focus:ring-rose-500 outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingId(null);
                        setRejectReason('');
                      }}
                      className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmReject(req.id)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold cursor-pointer"
                    >
                      Confirmar Indeferimento
                    </button>
                  </div>
                </div>
              )}

              {/* Admin Action Buttons for Pending Requests */}
              {req.status === 'pendente' && canAdminister && rejectingId !== req.id && (
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingId(req.id);
                      setRejectReason('');
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium cursor-pointer"
                  >
                    Indeferir Pedido
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleExecuteSuppression(
                        req.id,
                        'Revision Deletion (Texto Ocultado do Histórico)'
                      )
                    }
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium cursor-pointer flex items-center gap-1"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Ocultar Revisão (RevDel)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleExecuteSuppression(
                        req.id,
                        'Supressão Total e Permanente (Oversight / Anonimização)'
                      )
                    }
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supressão Definitiva (Oversight)</span>
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </div>

      {/* Modal: Nova Solicitação de Exclusão LGPD */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Autuar Solicitação de Exclusão / LGPD</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Fechar modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nome do Titular ou Representante
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nome completo ou alias..."
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    E-mail para Notificação
                  </label>
                  <input
                    type="email"
                    placeholder="contato@titular.com"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Fundamento Jurídico
                  </label>
                  <select
                    value={formBasis}
                    onChange={e => setFormBasis(e.target.value as DataRemovalRequest['legalBasis'])}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 outline-none"
                  >
                    <option value="LGPD_Art18">LGPD (Art. 18 - Eliminação/Anonimização)</option>
                    <option value="Doxxing">Doxxing (Vazamento de Documentos/Endereço)</option>
                    <option value="MarcoCivil_Art19">Marco Civil (Art. 19 - Remoção)</option>
                    <option value="OrdemJudicial">Ordem Judicial</option>
                    <option value="Difamacao">Difamação / Injúria Grave</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Artigo Afetado (Slug)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: MediaWiki"
                    value={formSlug}
                    onChange={e => setFormSlug(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ID da Revisão Específica (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: rev-102"
                  value={formRevId}
                  onChange={e => setFormRevId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 outline-none font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Descrição Detalhada do Conteúdo Sensível
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Especifique com exatidão quais dados foram expostos e por que devem ser suprimidos..."
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold cursor-pointer shadow-xs"
                >
                  Registrar Solicitação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLgpdDashboard;
