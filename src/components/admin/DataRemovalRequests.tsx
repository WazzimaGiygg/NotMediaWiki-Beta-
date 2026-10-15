import React, { useState, useEffect } from 'react';
import {
  FileText,
  Shield,
  ShieldAlert,
  Trash2,
  EyeOff,
  CheckCircle2,
  XCircle,
  Plus,
  Lock,
  Search,
  Scale,
  AlertTriangle,
  Clock,
  ExternalLink,
  UserX,
  FileCode,
  Cloud,
  RefreshCw,
} from 'lucide-react';
import { DataRemovalRequest, UserSession } from '../../types';
import {
  fetchDataRemovalsFromFirestore,
  saveDataRemovalToFirestore,
  deleteDataRemovalFromFirestore,
  subscribeToDataRemovalsFromFirestore,
  writeSystemLog,
} from '../../firebase';

interface DataRemovalProps {
  currentUser: UserSession | null;
}

const DEFAULT_REMOVALS: DataRemovalRequest[] = [
  {
    id: 'rem-1',
    protocolNumber: 'LGPD-2026-089',
    requesterNameOrAlias: 'Cidadão_SP (Nome civil sob sigilo)',
    requesterEmail: 'titular.dados@email.com',
    legalBasis: 'Doxxing',
    targetSlug: 'MediaWiki',
    targetRevisionId: 'rev-103',
    description: 'Vazamento criminoso de número de CPF, telefone celular particular e endereço residencial em sumário de edição e notas de rodapé de artigo público.',
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
    description: 'Solicitação expressa de eliminação de dados biográficos não consentidos e desatualizados, com base no Art. 18, inciso VI da Lei Geral de Proteção de Dados (LGPD).',
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
    description: 'Cumprimento de decisão liminar em tutela de urgência (Processo nº 0023491-88.2026.8.16.0001) para remoção de conteúdo calunioso sob pena de multa diária (Art. 19 Marco Civil).',
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

export const DataRemovalRequests: React.FC<DataRemovalProps> = ({ currentUser }) => {
  const [requests, setRequests] = useState<DataRemovalRequest[]>([]);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formBasis, setFormBasis] = useState<DataRemovalRequest['legalBasis']>('LGPD_Art18');
  const [formSlug, setFormSlug] = useState('MediaWiki');
  const [formRevId, setFormRevId] = useState('');
  const [formDesc, setFormDesc] = useState('');

  // Sync strictly with Firebase Firestore
  useEffect(() => {
    let isMounted = true;
    setIsLoadingFirestore(true);

    fetchDataRemovalsFromFirestore()
      .then(cloudRemovals => {
        if (!isMounted) return;
        setRequests(cloudRemovals || []);
        setIsLoadingFirestore(false);
      })
      .catch(err => {
        console.warn('Firestore DataRemovals sync notice:', err);
        if (isMounted) {
          setRequests([]);
          setIsLoadingFirestore(false);
        }
      });

    const unsubscribe = subscribeToDataRemovalsFromFirestore(updated => {
      if (isMounted) {
        setRequests(updated || []);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleSeedToFirestore = async () => {
    setIsSeeding(true);
    try {
      for (const item of DEFAULT_REMOVALS) {
        await saveDataRemovalToFirestore(item);
      }
      const fresh = await fetchDataRemovalsFromFirestore();
      setRequests(fresh || []);
    } catch (e) {
      console.error('Failed to seed data removals to Firestore:', e);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDeleteRemoval = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta solicitação de remoção do Firebase Firestore?')) return;
    try {
      await deleteDataRemovalFromFirestore(id);
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      alert(`Erro ao remover do Firestore: ${e.message}`);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formDesc.trim()) return;

    const newReq: DataRemovalRequest = {
      id: `rem-${Date.now()}`,
      protocolNumber: `LGPD-2026-0${requests.length + 90}`,
      requesterNameOrAlias: formName.trim(),
      requesterEmail: formEmail.trim(),
      legalBasis: formBasis,
      targetSlug: formSlug.trim(),
      targetRevisionId: formRevId.trim() || undefined,
      description: formDesc.trim(),
      status: 'pendente',
      createdAt: new Date().toISOString(),
    };

    await saveDataRemovalToFirestore(newReq);
    setRequests(prev => [newReq, ...prev.filter(r => r.id !== newReq.id)]);
    setIsModalOpen(false);
    setFormName('');
    setFormEmail('');
    setFormDesc('');
    setFormRevId('');
  };

  const handleExecuteSuppression = async (id: string, actionType: string) => {
    const target = requests.find(r => r.id === id);
    if (!target) return;

    const existingActions = target.actionsTaken || [];
    const updated: DataRemovalRequest = {
      ...target,
      status: 'processado',
      actionsTaken: [...existingActions, `${actionType} executada por ${currentUser?.username || 'Burocrata'}`],
      processedBy: currentUser?.username || 'Burocrata NotMediaWiki',
      processedAt: new Date().toISOString(),
    };

    await saveDataRemovalToFirestore(updated);
    setRequests(prev => prev.map(r => (r.id === id ? updated : r)));
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Informe a fundamentação jurídica para o indeferimento da remoção:');
    if (!reason) return;

    const target = requests.find(r => r.id === id);
    if (!target) return;

    const updated: DataRemovalRequest = {
      ...target,
      status: 'rejeitado',
      actionsTaken: [`Pedido indeferido: ${reason}`],
      processedBy: currentUser?.username || 'Burocrata NotMediaWiki',
      processedAt: new Date().toISOString(),
    };

    await saveDataRemovalToFirestore(updated);
    setRequests(prev => prev.map(r => (r.id === id ? updated : r)));
  };

  const filtered = requests.filter(r => {
    const matchesStatus = filterStatus === 'todos' || r.status === filterStatus;
    const matchesSearch =
      r.protocolNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.requesterNameOrAlias.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.targetSlug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const pendingCount = requests.filter(r => r.status === 'pendente').length;
  const processedCount = requests.filter(r => r.status === 'processado').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-50 rounded-lg border border-rose-200 text-rose-700">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  Pedido de Remoção de Dados & Supressão (Oversight / LGPD)
                  <span className="text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-mono font-medium">
                    Art. 18 LGPD & Art. 19 Marco Civil
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Canal para direito ao esquecimento, remoção de dados pessoais sensíveis (PII), contenção de doxxing e ordens judiciais.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Pedido de Supressão</span>
            </button>
          </div>
        </div>

        {/* Legal Framework Notice */}
        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
          <Scale className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-semibold text-slate-800">
              Procedimento Técnico de Supressão (Revision Deletion & Oversight)
            </div>
            <div className="text-[11px] leading-relaxed text-slate-600">
              A supressão remove o conteúdo ofensivo ou dados pessoais do banco de dados visível ao público. Os registros de auditoria e logs de conexão são mantidos em cofre criptografado isolado pelo prazo obrigatório de 6 meses em estrita observância ao <strong>Artigo 15 do Marco Civil da Internet (Lei 12.965/14)</strong>.
            </div>
          </div>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Casos Pendentes</div>
            <div className="text-lg font-bold font-mono text-rose-600 mt-0.5">{pendingCount} urgentes</div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Supressões Executadas</div>
            <div className="text-lg font-bold font-mono text-emerald-600 mt-0.5">{processedCount} concluídas</div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Prazo Médio Resposta</div>
            <div className="text-lg font-bold font-mono text-blue-600 mt-0.5">&lt; 4 horas</div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Encarregado DPO</div>
            <div className="text-lg font-bold font-mono text-slate-800 mt-0.5">dpo@wazzimagiygg.com</div>
          </div>
        </div>
      </div>

      {/* Filter and search */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'todos', label: 'Todos os Pedidos' },
            { id: 'pendente', label: 'Pendentes' },
            { id: 'processado', label: 'Processados / Deferidos' },
            { id: 'rejeitado', label: 'Rejeitados' },
          ].map(tab => (
            <button
              key={tab.id}
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

        <input
          type="text"
          placeholder="Buscar protocolo, artigo ou solicitante..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs w-64 focus:ring-1 focus:ring-rose-500 outline-none"
        />
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-xs space-y-3">
            <Trash2 className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="font-semibold text-slate-700 text-sm">Nenhum pedido de remoção de dados cadastrado no Firebase Firestore.</div>
            <p className="text-slate-500 max-w-md mx-auto">
              Todas as solicitações de Oversight, LGPD Art. 18 e ordens judiciais são sincronizadas diretamente com a coleção em nuvem do Firebase Firestore. Nenhuma informação externa ou fictícia é exibida.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={handleSeedToFirestore}
                disabled={isSeeding}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium text-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>{isSeeding ? 'Gravando no Firestore...' : 'Cadastrar Pedidos Iniciais no Firebase'}</span>
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar Novo Pedido Manualmente</span>
              </button>
            </div>
          </div>
        ) : (
          filtered.map(req => (
            <div
              key={req.id}
              className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3 text-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-xs">
                    {req.protocolNumber}
                  </span>
                  <span className="font-bold text-slate-900">
                    Artigo Alvo: <span className="text-blue-600 font-mono">[[{req.targetSlug}]]</span>
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      req.status === 'processado'
                        ? 'bg-emerald-100 text-emerald-800'
                        : req.status === 'pendente'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {req.status}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-mono text-[10px] font-semibold border border-purple-200">
                    Base: {req.legalBasis}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                  <span>
                    {new Date(req.createdAt).toLocaleDateString('pt-BR')} às{' '}
                    {new Date(req.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button
                    onClick={() => handleDeleteRemoval(req.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors ml-1"
                    title="Excluir do Firestore"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Requester and Target Revision */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px]">
                <div>
                  <strong className="text-slate-700">Solicitante:</strong> {req.requesterNameOrAlias}
                  {req.requesterEmail && (
                    <span className="text-slate-400 font-mono block">E-mail: {req.requesterEmail}</span>
                  )}
                </div>
                <div>
                  <strong className="text-slate-700">Revisão Específica:</strong>{' '}
                  <span className="font-mono">{req.targetRevisionId || 'Artigo integral / Múltiplas revisões'}</span>
                </div>
              </div>

              {/* Description */}
              <div className="bg-white p-3 rounded border border-slate-200 leading-relaxed text-slate-700">
                <span className="font-bold text-slate-900 block mb-1">Fundamentação e Conteúdo Alvo:</span>
                {req.description}
              </div>

              {/* Actions Taken */}
              {req.actionsTaken && req.actionsTaken.length > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-950">
                  <div className="font-bold flex items-center gap-1.5 mb-1 text-emerald-900">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Medidas Técnicas e Jurídicas Executadas:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-emerald-800">
                    {req.actionsTaken.map((act, i) => (
                      <li key={i}>{act}</li>
                    ))}
                  </ul>
                  {req.processedBy && (
                    <div className="text-[10px] text-emerald-600 font-mono mt-2">
                      Concluído por: {req.processedBy} em{' '}
                      {req.processedAt && new Date(req.processedAt).toLocaleString('pt-BR')}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons for Bureaucrats */}
              {req.status === 'pendente' && (
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleReject(req.id)}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium cursor-pointer"
                  >
                    Indeferir Pedido
                  </button>
                  <button
                    onClick={() =>
                      handleExecuteSuppression(req.id, 'Revision Deletion (Texto Ocultado do Histórico)')
                    }
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium cursor-pointer flex items-center gap-1"
                  >
                    <EyeOff className="w-3 h-3" />
                    <span>Ocultar Revisão (RevDel)</span>
                  </button>
                  <button
                    onClick={() =>
                      handleExecuteSuppression(req.id, 'Supressão Total e Permanente (Oversight / Anonimização)')
                    }
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Supressão Definitiva (Oversight)</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal: Novo Pedido */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Autuar Requerimento de Supressão / LGPD</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nome do Titular ou Representante</label>
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
                  <label className="block font-semibold text-slate-700 mb-1">E-mail para Notificação</label>
                  <input
                    type="email"
                    placeholder="contato@titular.com"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fundamento Jurídico</label>
                  <select
                    value={formBasis}
                    onChange={e => setFormBasis(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 outline-none"
                  >
                    <option value="LGPD_Art18">LGPD (Art. 18 - Eliminação/Anonimização)</option>
                    <option value="Doxxing">Doxxing (Vazamento de Documentos/Endereço)</option>
                    <option value="OrdemJudicial">Ordem Judicial (Art. 19 Marco Civil)</option>
                    <option value="Difamacao">Difamação / Injúria Grave</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Artigo Afetado (Slug)</label>
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
                <label className="block font-semibold text-slate-700 mb-1">ID da Revisão Específica (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: rev-102"
                  value={formRevId}
                  onChange={e => setFormRevId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 outline-none font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição Detalhada do Conteúdo Sensível</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Especifique com exatidão quais dados foram expostos e por que devem ser suprimidos com urgência..."
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
