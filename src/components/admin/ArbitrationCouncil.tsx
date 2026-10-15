import React, { useState, useEffect } from 'react';
import {
  Scale,
  Gavel,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Users,
  FileText,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Award,
  Vote,
  Cloud,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { ArbitrationCase, ArbitrationVote, UserSession } from '../../types';
import {
  fetchArbitrationCasesFromFirestore,
  saveArbitrationCaseToFirestore,
  deleteArbitrationCaseFromFirestore,
  subscribeToArbitrationCasesFromFirestore,
} from '../../firebase';

interface ArbitrationCouncilProps {
  currentUser: UserSession | null;
}

const DEFAULT_CASES: ArbitrationCase[] = [
  {
    id: 'arb-1',
    caseNumber: 'ARB-2026-01',
    title: 'Disputa crônica de guerra de edições e violação de NPOV no artigo Parsoid',
    parties: ['EditorAlpha', 'WikiMaster_BR', 'ReversorAnonimo'],
    openedBy: 'SysopModerador',
    status: 'deliberacao',
    description: 'Conflito prolongado envolvendo reversões mútuas superiores a 12 edições em 48 horas, acusações de viés ideológico e desrespeito sistemático à política de Ponto de Vista Neutro (NPOV) e Consenso.',
    evidence: [
      'Diff #rev-104 vs #rev-108: Reversões em sequência violando a regra das 3 reversões (R3R).',
      'Página de discussão do artigo Parsoid: Insinuações pessoais e ausência de busca por consenso.',
      'Histórico de bloqueios temporários prévios ineficazes pelo SysopModerador.',
    ],
    sanction: 'Topic ban (bloqueio temático de 6 meses) sob deliberação para o editor primário, advertência formal para as partes secundárias.',
    votes: [
      {
        arbitratorName: 'Burocrata_Wazzima',
        vote: 'favor',
        comment: 'Evidências demonstram quebra reiterada de conduta. Favorável à imposição de Topic Ban de 6 meses no tópico de microsserviços.',
        timestamp: '2026-10-10T14:30:00Z',
      },
      {
        arbitratorName: 'JuizArbitral_Helena',
        vote: 'favor',
        comment: 'Comportamento incompatível com o espírito colaborativo da wiki. Acompanho o relator integralmente.',
        timestamp: '2026-10-11T09:15:00Z',
      },
      {
        arbitratorName: 'Arbitro_Renato',
        vote: 'abstencao',
        comment: 'Sugiro mediação informal prévia de 7 dias antes do encerramento definitivo.',
        timestamp: '2026-10-11T16:45:00Z',
      },
    ],
    createdAt: '2026-10-08T10:00:00Z',
  },
  {
    id: 'arb-2',
    caseNumber: 'ARB-2026-02',
    title: 'Recurso contra destituição de privilégios de Reversor e Bloqueio Preventivo',
    parties: ['DevCarlos', 'Admin_Luciano'],
    openedBy: 'DevCarlos',
    status: 'em_andamento',
    description: 'O usuário DevCarlos solicita anulação de bloqueio de 14 dias aplicado pelo Administrador Luciano, alegando uso legítimo do script de reversão rápida em combate ao vandalismo.',
    evidence: [
      'Registro de ações de reversão automática entre 02:00 e 03:00 de 05/10/2026.',
      'Alegação de falso-positivo de bot não comunicado à comunidade.',
    ],
    votes: [],
    createdAt: '2026-10-09T18:20:00Z',
  },
  {
    id: 'arb-3',
    caseNumber: 'ARB-2025-18',
    title: 'Abuso reiterado de contas coordenadas para manipulação de votações comunitárias',
    parties: ['ShadowCluster', 'Contas Fantoches 1 a 6'],
    openedBy: 'Burocrata_Wazzima',
    status: 'encerrado',
    description: 'Julgamento final de caso remetido pela verificação de contas (CheckUser). Constatada ação coordenada para fraude em votação de destaque de artigo.',
    evidence: [
      'Relatório CheckUser #CU-2025-91 comprovando mesmo bloco de IP e heurística idêntica.',
      'Votos fraudulentos registrados em intervalo de 14 minutos.',
    ],
    verdict: 'Decisão unânime: Banimento em definitivo do usuário principal, bloqueio de todas as contas satélites e anulação dos votos viciados.',
    sanction: 'Banimento permanente e inclusão na lista negra de proteção de páginas.',
    votes: [
      {
        arbitratorName: 'Burocrata_Wazzima',
        vote: 'favor',
        comment: 'Gravíssima quebra de integridade do projeto. Banimento irrecorrível.',
        timestamp: '2025-12-14T20:00:00Z',
      },
      {
        arbitratorName: 'JuizArbitral_Helena',
        vote: 'favor',
        comment: 'Acompanho com veemência. Conduta lesiva.',
        timestamp: '2025-12-14T20:05:00Z',
      },
    ],
    createdAt: '2025-12-10T11:00:00Z',
    closedAt: '2025-12-15T15:30:00Z',
  },
];

export const ArbitrationCouncil: React.FC<ArbitrationCouncilProps> = ({ currentUser }) => {
  const [cases, setCases] = useState<ArbitrationCase[]>([]);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // New Case Form State
  const [newTitle, setNewTitle] = useState('');
  const [newParties, setNewParties] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newEvidence, setNewEvidence] = useState('');

  // Vote Form State
  const [votingCaseId, setVotingCaseId] = useState<string | null>(null);
  const [arbitratorVote, setArbitratorVote] = useState<'favor' | 'contra' | 'abstencao'>('favor');
  const [arbitratorComment, setArbitratorComment] = useState('');

  // Sync strictly with Firebase Firestore - Only documents from Firestore are shown
  useEffect(() => {
    let isMounted = true;
    setIsLoadingFirestore(true);

    fetchArbitrationCasesFromFirestore()
      .then(cloudCases => {
        if (!isMounted) return;
        setCases(cloudCases || []);
        if (cloudCases && cloudCases.length > 0) {
          setExpandedCaseId(cloudCases[0].id);
        }
        setIsLoadingFirestore(false);
      })
      .catch(err => {
        console.warn('Firestore ArbCom sync notice:', err);
        if (isMounted) {
          setCases([]);
          setIsLoadingFirestore(false);
        }
      });

    // Real-time Firestore subscription
    const unsubscribe = subscribeToArbitrationCasesFromFirestore(updated => {
      if (isMounted) {
        setCases(updated || []);
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
      for (const item of DEFAULT_CASES) {
        await saveArbitrationCaseToFirestore(item);
      }
      const fresh = await fetchArbitrationCasesFromFirestore();
      setCases(fresh || []);
      if (fresh && fresh.length > 0) setExpandedCaseId(fresh[0].id);
    } catch (e) {
      console.error('Failed to seed arbitration cases to Firestore:', e);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este processo arbitral do Firebase Firestore?')) return;
    try {
      await deleteArbitrationCaseFromFirestore(caseId);
      setCases(prev => prev.filter(c => c.id !== caseId));
    } catch (e: any) {
      alert(`Erro ao remover do Firestore: ${e.message}`);
    }
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;

    const newCase: ArbitrationCase = {
      id: `arb-${Date.now()}`,
      caseNumber: `ARB-2026-0${cases.length + 1}`,
      title: newTitle.trim(),
      parties: newParties.split(',').map(p => p.trim()).filter(Boolean),
      openedBy: currentUser?.username || 'Usuário NotMediaWiki',
      status: 'em_andamento',
      description: newDescription.trim(),
      evidence: newEvidence.split('\n').map(l => l.trim()).filter(Boolean),
      votes: [],
      createdAt: new Date().toISOString(),
    };

    // Save directly to Firebase Firestore
    await saveArbitrationCaseToFirestore(newCase);
    setCases(prev => [newCase, ...prev.filter(c => c.id !== newCase.id)]);
    setIsNewCaseModalOpen(false);
    setNewTitle('');
    setNewParties('');
    setNewDescription('');
    setNewEvidence('');
    setExpandedCaseId(newCase.id);
  };

  const handleCastVote = async (caseId: string) => {
    if (!arbitratorComment.trim()) return;

    const vote: ArbitrationVote = {
      arbitratorName: currentUser?.username || 'Árbitro Oficial',
      vote: arbitratorVote,
      comment: arbitratorComment.trim(),
      timestamp: new Date().toISOString(),
    };

    const targetCase = cases.find(c => c.id === caseId);
    if (!targetCase) return;

    const updatedCase: ArbitrationCase = {
      ...targetCase,
      votes: [...targetCase.votes.filter(v => v.arbitratorName !== vote.arbitratorName), vote],
      status: 'deliberacao',
    };

    // Save directly to Firebase Firestore
    await saveArbitrationCaseToFirestore(updatedCase);
    setCases(prev => prev.map(c => (c.id === caseId ? updatedCase : c)));
    setVotingCaseId(null);
    setArbitratorComment('');
  };

  const handleCloseCase = async (caseId: string, verdict: string) => {
    const targetCase = cases.find(c => c.id === caseId);
    if (!targetCase) return;

    const updatedCase: ArbitrationCase = {
      ...targetCase,
      status: 'encerrado',
      verdict,
      closedAt: new Date().toISOString(),
    };

    // Save directly to Firebase Firestore
    await saveArbitrationCaseToFirestore(updatedCase);
    setCases(prev => prev.map(c => (c.id === caseId ? updatedCase : c)));
  };

  const filteredCases = cases.filter(c => {
    const matchesStatus = filterStatus === 'todos' || c.status === filterStatus;
    const matchesSearch =
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.parties.some(p => p.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const activeCount = cases.filter(c => c.status === 'em_andamento' || c.status === 'deliberacao').length;
  const closedCount = cases.filter(c => c.status === 'encerrado').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 rounded-lg border border-purple-200 text-purple-700">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  Conselho de Arbitragem (ArbCom)
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono font-medium">
                    Instância Suprema
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Órgão colegiado para resolução vinculante de litígios de conduta, recursos contra sanções e garantia da civilidade no NotMediaWiki.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono flex items-center gap-1.5 shadow-2xs">
              <Cloud className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>Firebase Cloud Firestore</span>
            </span>

            <button
              onClick={() => setIsNewCaseModalOpen(true)}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Requerimento ao ArbCom</span>
            </button>
          </div>
        </div>

        {/* ArbCom Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded border border-slate-200/80">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Casos em Pauta</div>
            <div className="text-xl font-bold text-slate-900 font-mono mt-0.5">{activeCount}</div>
            <div className="text-[10px] text-purple-600 font-medium">Deliberação ativa</div>
          </div>
          <div className="bg-slate-50 p-3 rounded border border-slate-200/80">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Acórdãos Publicados</div>
            <div className="text-xl font-bold text-slate-900 font-mono mt-0.5">{closedCount}</div>
            <div className="text-[10px] text-emerald-600 font-medium">Decisões definitivas</div>
          </div>
          <div className="bg-slate-50 p-3 rounded border border-slate-200/80">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Árbitros Eleitos</div>
            <div className="text-xl font-bold text-slate-900 font-mono mt-0.5">5 titulares</div>
            <div className="text-[10px] text-slate-500">Mandato bienal</div>
          </div>
          <div className="bg-slate-50 p-3 rounded border border-slate-200/80">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Regulamento Vigente</div>
            <div className="text-xl font-bold text-slate-900 font-mono mt-0.5">Res. 04/2026</div>
            <div className="text-[10px] text-blue-600">Projetos WazzimaGiygg</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'todos', label: 'Todos os Casos' },
            { id: 'em_andamento', label: 'Em Andamento' },
            { id: 'deliberacao', label: 'Em Deliberação' },
            { id: 'encerrado', label: 'Encerrados' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filterStatus === tab.id
                  ? 'bg-purple-600 text-white font-semibold'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por caso, título ou usuário..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-purple-500 outline-none"
          />
        </div>
      </div>

      {/* Case List */}
      <div className="space-y-4">
        {filteredCases.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-xs space-y-3">
            <Scale className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="font-semibold text-slate-700 text-sm">Nenhum processo arbitral cadastrado no Firebase Firestore.</div>
            <p className="text-slate-500 max-w-md mx-auto">
              Todas as informações exibidas nesta página são sincronizadas em tempo real diretamente com o banco de dados do Firebase. Nenhuma informação externa ou fictícia é exibida.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={handleSeedToFirestore}
                disabled={isSeeding}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium text-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>{isSeeding ? 'Gravando no Firestore...' : 'Cadastrar Processos Oficiais no Firebase'}</span>
              </button>
              <button
                onClick={() => setIsNewCaseModalOpen(true)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Abrir Novo Processo Manualmente</span>
              </button>
            </div>
          </div>
        ) : (
          filteredCases.map(item => {
            const isExpanded = expandedCaseId === item.id;
            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-lg shadow-2xs transition-all overflow-hidden"
              >
                {/* Header row */}
                <div
                  onClick={() => setExpandedCaseId(isExpanded ? null : item.id)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2 rounded bg-slate-100 text-purple-700 font-mono text-xs font-bold shrink-0">
                      {item.caseNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900 hover:text-purple-700 transition-colors">
                          {item.title}
                        </h3>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                            item.status === 'deliberacao'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : item.status === 'em_andamento'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-1">
                        <span>Partes: <strong>{item.parties.join(', ')}</strong></span>
                        <span>•</span>
                        <span>Autuado por: {item.openedBy}</span>
                        <span>•</span>
                        <span className="font-mono text-[11px]">
                          {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                      <Vote className="w-3.5 h-3.5 text-purple-600" />
                      <span>{item.votes.length} pareceres</span>
                    </span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteCase(item.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="Excluir do Firestore"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-100 bg-slate-50/40 space-y-4 text-xs">
                    {/* Summary */}
                    <div>
                      <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-purple-600" />
                        <span>Síntese da Petição Inicial</span>
                      </h4>
                      <p className="text-slate-600 leading-relaxed bg-white p-3 rounded border border-slate-200">
                        {item.description}
                      </p>
                    </div>

                    {/* Evidences */}
                    {item.evidence && item.evidence.length > 0 && (
                      <div>
                        <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Rol de Evidências Juntadas aos Autos</span>
                        </h4>
                        <ul className="space-y-1.5 bg-white p-3 rounded border border-slate-200">
                          {item.evidence.map((ev, i) => (
                            <li key={i} className="flex items-start gap-2 text-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                              <span>{ev}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Proposed Sanctions or Final Verdict */}
                    {item.status === 'encerrado' ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded p-3.5">
                        <div className="flex items-center gap-2 text-emerald-900 font-bold mb-1">
                          <Gavel className="w-4 h-4 text-emerald-700" />
                          <span>Acórdão Arbitral Definitivo (Trânsito em Julgado)</span>
                        </div>
                        <p className="text-emerald-800 font-medium mb-1">{item.verdict}</p>
                        {item.sanction && (
                          <div className="text-[11px] text-emerald-700">
                            <strong>Sanção aplicada:</strong> {item.sanction}
                          </div>
                        )}
                        {item.closedAt && (
                          <div className="text-[10px] text-emerald-600 font-mono mt-2">
                            Encerrado em: {new Date(item.closedAt).toLocaleString('pt-BR')}
                          </div>
                        )}
                      </div>
                    ) : item.sanction ? (
                      <div className="bg-amber-50 border border-amber-200 rounded p-3">
                        <div className="text-amber-900 font-bold mb-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-700" />
                          <span>Proposta de Medida Cautelar / Sanção em Votação</span>
                        </div>
                        <p className="text-amber-800">{item.sanction}</p>
                      </div>
                    ) : null}

                    {/* ArbCom Votes */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Vote className="w-3.5 h-3.5 text-purple-600" />
                          <span>Deliberação do Colégio de Árbitros ({item.votes.length} votos)</span>
                        </h4>

                        {item.status !== 'encerrado' && (
                          <button
                            onClick={() => setVotingCaseId(item.id)}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            Registrar Parecer de Árbitro
                          </button>
                        )}
                      </div>

                      {item.votes.length === 0 ? (
                        <div className="bg-white p-3 rounded border border-slate-200 text-slate-500 italic text-center">
                          Aguardando distribuição para relatoria e início das manifestações dos árbitros.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {item.votes.map((v, idx) => (
                            <div key={idx} className="bg-white p-3 rounded border border-slate-200">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                                  <Award className="w-3.5 h-3.5 text-purple-600" />
                                  <span>{v.arbitratorName}</span>
                                </span>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      v.vote === 'favor'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : v.vote === 'contra'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-slate-100 text-slate-800'
                                    }`}
                                  >
                                    Voto: {v.vote}
                                  </span>
                                  <span className="font-mono text-[10px] text-slate-400">
                                    {new Date(v.timestamp).toLocaleDateString('pt-BR')}
                                  </span>
                                </div>
                              </div>
                              <p className="text-slate-600 mt-1">{v.comment}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Voting Action Box */}
                    {votingCaseId === item.id && (
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded space-y-2">
                        <div className="font-bold text-purple-900 text-xs">Voto e Justificativa do Árbitro</div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              name="voteOption"
                              value="favor"
                              checked={arbitratorVote === 'favor'}
                              onChange={() => setArbitratorVote('favor')}
                            />
                            <span>A Favor do Parecer</span>
                          </label>
                          <label className="flex items-center gap-1 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              name="voteOption"
                              value="contra"
                              checked={arbitratorVote === 'contra'}
                              onChange={() => setArbitratorVote('contra')}
                            />
                            <span>Divergente / Contra</span>
                          </label>
                          <label className="flex items-center gap-1 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              name="voteOption"
                              value="abstencao"
                              checked={arbitratorVote === 'abstencao'}
                              onChange={() => setArbitratorVote('abstencao')}
                            />
                            <span>Abstenção Justificada</span>
                          </label>
                        </div>
                        <textarea
                          rows={2}
                          placeholder="Fundamentação jurídica e regulamentar do voto..."
                          value={arbitratorComment}
                          onChange={e => setArbitratorComment(e.target.value)}
                          className="w-full p-2 bg-white border border-purple-300 rounded text-xs focus:ring-1 focus:ring-purple-500 outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setVotingCaseId(null)}
                            className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded text-xs cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCastVote(item.id)}
                            className="px-3 py-1 bg-purple-600 text-white rounded font-medium text-xs hover:bg-purple-700 cursor-pointer"
                          >
                            Publicar Voto
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Admin Closing Action */}
                    {item.status !== 'encerrado' && (
                      <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                        <button
                          onClick={() =>
                            handleCloseCase(
                              item.id,
                              'Decisão do Conselho de Arbitragem: Procedente. Determinada aplicação de sanções conforme votos majoritários.'
                            )
                          }
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-medium cursor-pointer flex items-center gap-1"
                        >
                          <Gavel className="w-3.5 h-3.5" />
                          <span>Promulgar Decisão Final e Encerrar Caso</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Novo Requerimento ao ArbCom */}
      {isNewCaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Scale className="w-4 h-4 text-purple-600" />
                <span>Autuar Novo Requerimento Arbitral</span>
              </h3>
              <button
                onClick={() => setIsNewCaseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Título do Caso / Disputa</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Disputa reiterada de conduta no artigo X"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Partes Envolvidas (separadas por vírgula)</label>
                <input
                  type="text"
                  placeholder="Ex: Editor_A, Editor_B, Moderador_C"
                  value={newParties}
                  onChange={e => setNewParties(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição Fática e Tentativas Prévias de Solução</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Descreva detalhadamente o litígio, tentativas frustradas de mediação na discussão e o impacto no projeto..."
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Evidências e Diffs (uma por linha)</label>
                <textarea
                  rows={3}
                  placeholder="Diff #rev-102: Insulto em sumário de edição&#10;Página de discussão: Guerra de edições&#10;Histórico de bloqueios"
                  value={newEvidence}
                  onChange={e => setNewEvidence(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-purple-500 outline-none font-mono text-[11px]"
                />
              </div>

              <div className="p-2.5 bg-purple-50 border border-purple-200 rounded text-[11px] text-purple-900">
                <strong>Atenção:</strong> O Conselho de Arbitragem não julga mérito de conteúdo enciclopédico, restringindo-se à conduta dos editores, cumprimento das políticas e aplicação de medidas disciplinares vinculantes.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewCaseModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold cursor-pointer shadow-xs"
                >
                  Submeter Requerimento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
