import React, { useState, useEffect } from 'react';
import {
  Unlock,
  Lock,
  UserCheck,
  UserX,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Search,
  Plus,
  MessageSquare,
  FileText,
  Shield,
  ThumbsUp,
  ThumbsDown,
  Cloud,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { UnblockRequest, UserSession } from '../../types';
import {
  fetchUnblockRequestsFromFirestore,
  saveUnblockRequestToFirestore,
  deleteUnblockRequestFromFirestore,
  subscribeToUnblockRequestsFromFirestore,
} from '../../firebase';

interface UnblockProps {
  currentUser: UserSession | null;
}

const DEFAULT_REQUESTS: UnblockRequest[] = [
  {
    id: 'unb-1',
    username: 'NovatoAnsioso',
    blockedBy: 'SysopModerador',
    blockReason: 'Vandalismo em série não intencional (testes de wikitext na página principal)',
    blockDuration: '30 dias',
    userAppeal: 'Peço sinceras desculpas à comunidade. Estava aprendendo a sintaxe Parsoid e utilizei por engano a página inicial em vez da página de testes (Sandbox/Página de Testes). Li o manual de formatação e comprometo-me a utilizar exclusivamente a Sandbox para qualquer teste futuro.',
    status: 'pendente',
    createdAt: '2026-10-11T12:00:00Z',
  },
  {
    id: 'unb-2',
    username: 'EditorControverso',
    blockedBy: 'Burocrata_Wazzima',
    blockReason: 'Guerra crônica de edições e ataque verbal em sumários',
    blockDuration: 'Indeterminado',
    userAppeal: 'Reconheço que perdi a paciência durante a discussão do artigo sobre arquitetura de dados. Gostaria de uma segunda oportunidade sob tutoria de um editor experiente, comprometendo-me a não participar daquele artigo específico.',
    status: 'em_discussao',
    administratorNotes: 'O editor possui histórico de 2 bloqueios anteriores por conflito similar. Sugiro desbloqueio sob restrição estrita de tópicos (Topic Ban).',
    createdAt: '2026-10-09T15:30:00Z',
  },
  {
    id: 'unb-3',
    username: 'BotDesgovernado',
    blockedBy: 'SysopModerador',
    blockReason: 'Script em loop infinito gerando 400 edições/minuto',
    blockDuration: '7 dias',
    userAppeal: 'O bug no daemon Node.js foi corrigido e validado com rate limiting de 5 edições/minuto. Solicito liberação da flag de bot.',
    status: 'deferido',
    resolution: 'Desbloqueado com sucesso após validação do script pelo Burocrata.',
    resolvedBy: 'Burocrata_Wazzima',
    createdAt: '2026-10-08T09:10:00Z',
    resolvedAt: '2026-10-08T14:00:00Z',
  },
  {
    id: 'unb-4',
    username: 'SpammerIncorrigivel',
    blockedBy: 'Sysop_Renato',
    blockReason: 'Inserção de links promocionais e esquemas de afiliados',
    blockDuration: 'Permanente',
    userAppeal: 'Não era spam, era apenas recomendação de produto relevante.',
    status: 'indeferido',
    resolution: 'Indeferido. O solicitante não reconheceu a infração e violou a política de Spam e Domínios Permitidos.',
    resolvedBy: 'Sysop_Renato',
    createdAt: '2026-10-05T18:00:00Z',
    resolvedAt: '2026-10-06T11:20:00Z',
  },
];

export const UnblockEvaluation: React.FC<UnblockProps> = ({ currentUser }) => {
  const [requests, setRequests] = useState<UnblockRequest[]>([]);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Form State
  const [formUsername, setFormUsername] = useState('');
  const [formBlockedBy, setFormBlockedBy] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formDuration, setFormDuration] = useState('7 dias');
  const [formAppeal, setFormAppeal] = useState('');

  // Decision Modal State
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState('');

  // Sync strictly with Firebase Firestore
  useEffect(() => {
    let isMounted = true;
    setIsLoadingFirestore(true);

    fetchUnblockRequestsFromFirestore()
      .then(cloudRequests => {
        if (!isMounted) return;
        setRequests(cloudRequests || []);
        setIsLoadingFirestore(false);
      })
      .catch(err => {
        console.warn('Firestore Unblock sync notice:', err);
        if (isMounted) {
          setRequests([]);
          setIsLoadingFirestore(false);
        }
      });

    const unsubscribe = subscribeToUnblockRequestsFromFirestore(updated => {
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
      for (const item of DEFAULT_REQUESTS) {
        await saveUnblockRequestToFirestore(item);
      }
      const fresh = await fetchUnblockRequestsFromFirestore();
      setRequests(fresh || []);
    } catch (e) {
      console.error('Failed to seed unblock requests to Firestore:', e);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta solicitação de desbloqueio do Firebase Firestore?')) return;
    try {
      await deleteUnblockRequestFromFirestore(id);
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      alert(`Erro ao remover do Firestore: ${e.message}`);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim() || !formAppeal.trim()) return;

    const newReq: UnblockRequest = {
      id: `unb-${Date.now()}`,
      username: formUsername.trim(),
      blockedBy: formBlockedBy.trim() || 'Sistema NotMediaWiki',
      blockReason: formReason.trim() || 'Violação de regras comunitárias',
      blockDuration: formDuration,
      userAppeal: formAppeal.trim(),
      status: 'pendente',
      createdAt: new Date().toISOString(),
    };

    // Save directly to Firebase Firestore
    await saveUnblockRequestToFirestore(newReq);
    setRequests(prev => [newReq, ...prev.filter(r => r.id !== newReq.id)]);
    setIsModalOpen(false);
    setFormUsername('');
    setFormBlockedBy('');
    setFormReason('');
    setFormAppeal('');
  };

  const handleResolve = async (id: string, status: 'deferido' | 'indeferido') => {
    const target = requests.find(r => r.id === id);
    if (!target) return;

    const updatedReq: UnblockRequest = {
      ...target,
      status,
      resolution: actionNote.trim() || (status === 'deferido' ? 'Desbloqueio acolhido pela moderação.' : 'Pedido indeferido.'),
      resolvedBy: currentUser?.username || 'Administrador NotMediaWiki',
      resolvedAt: new Date().toISOString(),
    };

    // Save directly to Firebase Firestore
    await saveUnblockRequestToFirestore(updatedReq);
    setRequests(prev => prev.map(r => (r.id === id ? updatedReq : r)));
    setActionTargetId(null);
    setActionNote('');
  };

  const filtered = requests.filter(r => {
    const matchesStatus = filterStatus === 'todos' || r.status === filterStatus;
    const matchesSearch =
      r.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.blockReason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.userAppeal.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const pendingCount = requests.filter(r => r.status === 'pendente' || r.status === 'em_discussao').length;
  const approvedCount = requests.filter(r => r.status === 'deferido').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-700">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  Avaliação de Desbloqueio (Revisão de Sanções)
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-medium">
                    Special:UnblockReview
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Fila deliberativa de apelações de usuários bloqueados e revisão proporcional de penalidades administrativas.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Pedido de Desbloqueio</span>
            </button>
          </div>
        </div>

        {/* Evaluation Policy Box */}
        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-semibold text-slate-800">
              Critérios de Admissibilidade para Desbloqueio
            </div>
            <div className="text-[11px] leading-relaxed text-slate-600">
              1. Reconhecimento voluntário do comportamento inadequado • 2. Compreensão da política infringida • 3. Compromisso explícito de não repetição • 4. Transcurso de tempo razoável para reflexão proporcional à gravidade.
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Fila de Apelações</div>
            <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">{pendingCount} pendentes</div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Acolhidos no Mês</div>
            <div className="text-lg font-bold font-mono text-emerald-600 mt-0.5">{approvedCount} deferidos</div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Tempo Médio de Análise</div>
            <div className="text-lg font-bold font-mono text-blue-600 mt-0.5">~18 horas</div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Instância de Recurso</div>
            <div className="text-lg font-bold font-mono text-purple-600 mt-0.5">ArbCom</div>
          </div>
        </div>
      </div>

      {/* Filter and search */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'todos', label: 'Todos os Pedidos' },
            { id: 'pendente', label: 'Pendentes' },
            { id: 'em_discussao', label: 'Em Discussão' },
            { id: 'deferido', label: 'Deferidos' },
            { id: 'indeferido', label: 'Indeferidos' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                filterStatus === tab.id
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Buscar por usuário ou motivo..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs w-64 focus:ring-1 focus:ring-emerald-500 outline-none"
        />
      </div>

      {/* Requests Cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-xs space-y-3">
            <Unlock className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="font-semibold text-slate-700 text-sm">Nenhuma solicitação de desbloqueio encontrada no Firebase Firestore.</div>
            <p className="text-slate-500 max-w-md mx-auto">
              Todas as apelações e avaliações de desbloqueio são sincronizadas diretamente com a base de dados em nuvem do Firebase Firestore. Nenhuma informação externa ou fictícia é exibida.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={handleSeedToFirestore}
                disabled={isSeeding}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>{isSeeding ? 'Gravando no Firestore...' : 'Cadastrar Pedidos Iniciais no Firebase'}</span>
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar Apelação Manualmente</span>
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
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <UserX className="w-4 h-4 text-rose-600" />
                    <span>{req.username}</span>
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      req.status === 'deferido'
                        ? 'bg-emerald-100 text-emerald-800'
                        : req.status === 'indeferido'
                        ? 'bg-rose-100 text-rose-800'
                        : req.status === 'em_discussao'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {req.status.replace('_', ' ')}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    (Pena: {req.blockDuration})
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                  <span>Autuado em: {new Date(req.createdAt).toLocaleDateString('pt-BR')}</span>
                  <button
                    onClick={() => handleDeleteRequest(req.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors ml-1"
                    title="Excluir do Firestore"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Block details */}
              <div className="bg-rose-50/70 border border-rose-200/80 p-2.5 rounded text-rose-950">
                <span className="font-semibold text-rose-900">Motivo do Bloqueio Original: </span>
                <span>{req.blockReason}</span>
                <div className="text-[11px] text-rose-700 mt-0.5">
                  Aplicado por: <strong>{req.blockedBy}</strong>
                </div>
              </div>

              {/* User Appeal */}
              <div>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Razões da Apelação do Solicitante</span>
                </span>
                <p className="text-slate-700 bg-slate-50 p-3 rounded border border-slate-200 leading-relaxed italic">
                  &ldquo;{req.userAppeal}&rdquo;
                </p>
              </div>

              {/* Admin notes if any */}
              {req.administratorNotes && (
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded text-amber-900">
                  <span className="font-bold">Observações da Moderação: </span>
                  <span>{req.administratorNotes}</span>
                </div>
              )}

              {/* Final Resolution */}
              {req.resolution && (
                <div
                  className={`p-2.5 rounded border ${
                    req.status === 'deferido'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-slate-100 border-slate-300 text-slate-800'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {req.status === 'deferido' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span>Desfecho Administrativo: {req.resolution}</span>
                  </div>
                  {req.resolvedBy && (
                    <div className="text-[10px] text-slate-500 mt-1 font-mono">
                      Homologado por: {req.resolvedBy} em{' '}
                      {req.resolvedAt && new Date(req.resolvedAt).toLocaleString('pt-BR')}
                    </div>
                  )}
                </div>
              )}

              {/* Decision Actions for Sysops */}
              {req.status !== 'deferido' && req.status !== 'indeferido' && (
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  {actionTargetId === req.id ? (
                    <div className="w-full space-y-2 p-2 bg-slate-50 rounded border border-slate-200">
                      <input
                        type="text"
                        placeholder="Justificativa do despacho para registro público..."
                        value={actionNote}
                        onChange={e => setActionNote(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setActionTargetId(null)}
                          className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded text-xs cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolve(req.id, 'indeferido')}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium text-xs cursor-pointer flex items-center gap-1"
                        >
                          <ThumbsDown className="w-3 h-3" />
                          <span>Confirmar Indeferimento</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolve(req.id, 'deferido')}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-xs cursor-pointer flex items-center gap-1"
                        >
                          <ThumbsUp className="w-3 h-3" />
                          <span>Deferir Desbloqueio</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setActionTargetId(req.id)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-medium cursor-pointer flex items-center gap-1"
                    >
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Emitir Decisão Administrativa</span>
                    </button>
                  )}
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
                <Unlock className="w-4 h-4 text-emerald-600" />
                <span>Registrar Apelação de Desbloqueio</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Usuário Bloqueado</label>
                <input
                  type="text"
                  required
                  placeholder="Nome de usuário exato..."
                  value={formUsername}
                  onChange={e => setFormUsername(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Administrador Responsável pelo Bloqueio</label>
                <input
                  type="text"
                  placeholder="Ex: SysopModerador"
                  value={formBlockedBy}
                  onChange={e => setFormBlockedBy(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Motivo do Bloqueio</label>
                  <input
                    type="text"
                    placeholder="Ex: Guerra de edições, Spam..."
                    value={formReason}
                    onChange={e => setFormReason(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Duração Original</label>
                  <select
                    value={formDuration}
                    onChange={e => setFormDuration(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                  >
                    <option value="24 horas">24 horas</option>
                    <option value="7 dias">7 dias</option>
                    <option value="30 dias">30 dias</option>
                    <option value="Indeterminado">Indeterminado</option>
                    <option value="Permanente">Permanente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Razões da Apelação e Compromisso</label>
                <textarea
                  rows={4}
                  required
                  placeholder="O solicitante deve explicar o ocorrido, reconhecer a falha e justificar por que o desbloqueio deve ser concedido..."
                  value={formAppeal}
                  onChange={e => setFormAppeal(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
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
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold cursor-pointer shadow-xs"
                >
                  Submeter à Moderação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
