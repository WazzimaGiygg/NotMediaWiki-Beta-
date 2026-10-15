import React, { useState, useEffect } from 'react';
import {
  HeartHandshake,
  ShieldAlert,
  ShieldCheck,
  Scale,
  Plus,
  RefreshCw,
  Trash2,
  FileText,
  AlertOctagon,
  UserCheck,
  Clock,
  Eye,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { BlpEthicsCase, UserSession } from '../../types';
import {
  fetchBlpEthicsCasesFromFirestore,
  saveBlpEthicsCaseToFirestore,
  deleteBlpEthicsCaseFromFirestore,
  subscribeToBlpEthicsCasesFromFirestore,
} from '../../firebase';

interface BlpEthicsProps {
  currentUser?: UserSession | null;
  onNavigateArticle?: (slug: string) => void;
}

const DEFAULT_BLP_CASES: BlpEthicsCase[] = [
  {
    id: 'blp-case-001',
    caseNumber: 'BLP-2026-001',
    articleSlug: 'MediaWiki',
    articleTitle: 'MediaWiki (Fundadores e Desenvolvedores Vivos)',
    targetPerson: 'Magnus Manske e Lee Daniel Crocker',
    category: 'falta_fontes_secundarias',
    complainant: 'Comissão de Biografias Comunitária',
    complainantType: 'editor',
    status: 'parecer_emitido',
    severity: 'media',
    claims:
      'Alegações sobre disputas contratuais privadas da década de 2000 incluídas no texto sem referência a veículos de imprensa de reputação reconhecida ou fontes secundárias idôneas.',
    evidence: [
      'Diff #rev-048 inserindo afirmações não verificadas sobre finanças pessoais.',
      'Violação direta do princípio de verificabilidade estrita para figuras públicas vivas (WP:BLP).',
    ],
    remedyRequested: 'supressao_historico',
    ethicsBoardNotes:
      'Conselho de Ética deliberou pela reversão imediata das alegações sem fontes e supressão da revisão difamatória via Oversight para resguardar a honra e privacidade dos biografados.',
    decisionSummary:
      'Parecer Deferido: Supressão cautelar do texto ofensivo e proteção temporária do artigo para edição exclusiva por usuários autoconfirmados.',
    deliberators: ['Burocrata_Wazzima', 'Auditor_Juridico_BR'],
    createdAt: '2026-10-09T14:30:00Z',
    updatedAt: '2026-10-10T11:00:00Z',
  },
  {
    id: 'blp-case-002',
    caseNumber: 'BLP-2026-002',
    articleSlug: 'Internet_no_Brasil',
    articleTitle: 'Internet no Brasil (Pioneiros e Diretores Vivos)',
    targetPerson: 'Membros do Comitê Gestor da Internet no Brasil (CGI.br)',
    category: 'invasao_privacidade',
    complainant: 'Representante dos Pesquisadores',
    complainantType: 'representante_legal',
    status: 'em_deliberacao',
    severity: 'alta',
    claims:
      'Divulgação de endereços residenciais e filiação familiar de conselheiros que não exercem mandato político eletivo em seção biográfica.',
    evidence: [
      'Inclusão de dados de foro íntimo em notas de rodapé.',
      'Violação dos artigos 11 e 18 da LGPD c/c diretrizes de privacidade de biografias de pessoas vivas.',
    ],
    remedyRequested: 'exclusao_paragrafo',
    ethicsBoardNotes:
      'Artigo colocado sob escrutínio cautelar com ocultação preventiva de dados pessoais até votação final do Conselho de Ética.',
    decisionSummary: 'Em deliberação: Análise de proporcionalidade de interesse público versus intimidade pessoal.',
    deliberators: ['Conselheiro_Etica_01', 'Burocrata_Wazzima'],
    createdAt: '2026-10-11T09:15:00Z',
    updatedAt: '2026-10-11T16:20:00Z',
  },
];

export const BlpEthicsCouncil: React.FC<BlpEthicsProps> = ({ currentUser, onNavigateArticle }) => {
  const [cases, setCases] = useState<BlpEthicsCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterSeverity, setFilterSeverity] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [selectedCase, setSelectedCase] = useState<BlpEthicsCase | null>(null);

  // New Case Form
  const [formArticleSlug, setFormArticleSlug] = useState('MediaWiki');
  const [formArticleTitle, setFormArticleTitle] = useState('');
  const [formTargetPerson, setFormTargetPerson] = useState('');
  const [formCategory, setFormCategory] = useState<BlpEthicsCase['category']>('difamacao_calunia');
  const [formComplainantType, setFormComplainantType] = useState<BlpEthicsCase['complainantType']>('sujeito_biografado');
  const [formSeverity, setFormSeverity] = useState<BlpEthicsCase['severity']>('alta');
  const [formRemedy, setFormRemedy] = useState<BlpEthicsCase['remedyRequested']>('exclusao_paragrafo');
  const [formClaims, setFormClaims] = useState('');

  // Deliberation Modal / Form
  const [deliberationVerdict, setDeliberationVerdict] = useState('');
  const [deliberationStatus, setDeliberationStatus] = useState<BlpEthicsCase['status']>('parecer_emitido');

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetchBlpEthicsCasesFromFirestore()
      .then(cloudCases => {
        if (!isMounted) return;
        setCases(cloudCases || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.warn('Notice: Error loading BLP cases from Firestore:', err);
        if (isMounted) setIsLoading(false);
      });

    const unsubscribe = subscribeToBlpEthicsCasesFromFirestore(updated => {
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
      for (const item of DEFAULT_BLP_CASES) {
        await saveBlpEthicsCaseToFirestore(item);
      }
      const fresh = await fetchBlpEthicsCasesFromFirestore();
      setCases(fresh || []);
    } catch (e) {
      console.error('Failed to seed BLP cases to Firestore:', e);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este processo ético do Firebase Firestore?')) return;
    try {
      await deleteBlpEthicsCaseFromFirestore(id);
      setCases(prev => prev.filter(c => c.id !== id));
      if (selectedCase?.id === id) setSelectedCase(null);
    } catch (err: any) {
      alert(`Erro ao remover caso: ${err.message}`);
    }
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTargetPerson.trim() || !formClaims.trim()) return;

    const newCaseNumber = `BLP-2026-${(cases.length + 3).toString().padStart(3, '0')}`;
    const newCase: BlpEthicsCase = {
      id: `blp-${Date.now()}`,
      caseNumber: newCaseNumber,
      articleSlug: formArticleSlug.trim() || 'MediaWiki',
      articleTitle: formArticleTitle.trim() || formArticleSlug.trim(),
      targetPerson: formTargetPerson.trim(),
      category: formCategory,
      complainant: currentUser?.username || 'Denunciante Anônimo',
      complainantType: formComplainantType,
      status: 'aberto',
      severity: formSeverity,
      claims: formClaims.trim(),
      evidence: ['Denúncia formal protocolada no Conselho de Ética'],
      remedyRequested: formRemedy,
      deliberators: currentUser?.username ? [currentUser.username] : ['Conselheiro_Plantão'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveBlpEthicsCaseToFirestore(newCase);
      setCases(prev => [newCase, ...prev]);
      setIsModalOpen(false);
      setSelectedCase(newCase);
      // Reset form
      setFormTargetPerson('');
      setFormClaims('');
    } catch (err: any) {
      alert(`Erro ao abrir processo ético: ${err.message}`);
    }
  };

  const handleSaveDeliberation = async () => {
    if (!selectedCase || !deliberationVerdict.trim()) return;

    const updated: BlpEthicsCase = {
      ...selectedCase,
      status: deliberationStatus,
      decisionSummary: deliberationVerdict.trim(),
      deliberators: Array.from(new Set([...selectedCase.deliberators, currentUser?.username || 'Conselheiro'])),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveBlpEthicsCaseToFirestore(updated);
      setSelectedCase(updated);
      setCases(prev => prev.map(c => (c.id === updated.id ? updated : c)));
      setDeliberationVerdict('');
    } catch (err: any) {
      alert(`Erro ao salvar deliberação: ${err.message}`);
    }
  };

  const filtered = cases.filter(c => {
    const matchesSearch =
      c.targetPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.articleTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.claims.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (filterStatus !== 'todos' && c.status !== filterStatus) return false;
    if (filterSeverity !== 'todos' && c.severity !== filterSeverity) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <HeartHandshake className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Conselho de Ética: Artigos de Pessoas Vivas e Derivados
              </h2>
              <span className="text-[11px] font-mono bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded font-semibold">
                WP:BLP • Direitos da Personalidade
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
              Órgão guardião do rigor deontológico para biografias de pessoas vivas (BLP) e conteúdos derivados
              (familiares, cônjuges e descendentes). Aplicação estrita dos direitos à honra, imagem, intimidade e
              direito ao esquecimento em conformidade com o Código Civil e a LGPD.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Instaurar Processo Ético</span>
            </button>
          </div>
        </div>

        {/* Policy Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-xs">
          <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 p-3 rounded-lg">
            <span className="font-bold text-purple-800 dark:text-purple-300 block mb-1">
              1. Presunção em Favor da Privacidade
            </span>
            <p className="text-[11px] text-purple-700 dark:text-purple-400">
              Informações duvidosas, sensacionalistas ou com potencial difamatório devem ser removidas cautelarmente
              imediatamente.
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-3 rounded-lg">
            <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
              2. Proteção a Figuras Derivadas
            </span>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Familiares, parceiros afetivos e filhos menores que não exercem vida pública não podem ter intimidade
              devassada.
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-3 rounded-lg">
            <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
              3. Fontes de Alta Confiabilidade
            </span>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Exigência absoluta de fontes secundárias idôneas, repelindo boatos de redes sociais e fofocas.
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Eye className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar por nome do biografado, artigo, protocolo ou alegação..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            <option value="todos">Todos os Status</option>
            <option value="aberto">Aberto</option>
            <option value="em_deliberacao">Em Deliberação</option>
            <option value="parecer_emitido">Parecer Emitido</option>
            <option value="artigo_protegido">Artigo Protegido</option>
            <option value="remocao_cautelar">Remoção Cautelar</option>
            <option value="arquivado">Arquivado</option>
          </select>

          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            <option value="todos">Todas Gravidades</option>
            <option value="critica">Crítica (Supressão Urgente)</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>
      </div>

      {/* Case Grid and Deliberation Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {isLoading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-12 text-center text-slate-500 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
              Carregando processos éticos do Firebase Firestore...
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center text-slate-500 text-xs space-y-3">
              <HeartHandshake className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
              <div className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                Nenhum processo ético registrado no Firebase Firestore.
              </div>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Casos instaurados pelo Conselho de Ética são sincronizados diretamente com o banco de dados.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold cursor-pointer"
                >
                  Abrir Processo Ético
                </button>
                <button
                  onClick={handleSeedToFirestore}
                  disabled={isSeeding}
                  className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-xs font-medium cursor-pointer disabled:opacity-50"
                >
                  {isSeeding ? 'Gravando no Firestore...' : 'Cadastrar Casos Modelo'}
                </button>
              </div>
            </div>
          ) : (
            filtered.map(item => {
              const isSelected = selectedCase?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedCase(item)}
                  className={`bg-white dark:bg-slate-900 border rounded-lg p-4 transition-all cursor-pointer text-xs space-y-3 ${
                    isSelected
                      ? 'border-purple-500 ring-2 ring-purple-500/20 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded text-xs">
                        {item.caseNumber}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        Biografado: {item.targetPerson}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          item.severity === 'critica'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                            : item.severity === 'alta'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                        }`}
                      >
                        Gravidade {item.severity}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          item.status === 'parecer_emitido' || item.status === 'artigo_protegido'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                            : item.status === 'em_deliberacao'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                        title="Excluir do Firestore"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Artigo Objeto:</span>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {item.articleTitle} ({item.articleSlug})
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Categoria da Violação:</span>
                      <div className="capitalize">{item.category.replace(/_/g, ' ')}</div>
                    </div>
                  </div>

                  <p className="text-slate-700 dark:text-slate-300 line-clamp-2 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded border border-slate-100 dark:border-slate-800">
                    {item.claims}
                  </p>

                  {item.decisionSummary && (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded border border-emerald-200 dark:border-emerald-800 flex items-start gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{item.decisionSummary}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Selected Case Deliberation Panel */}
        <div>
          {selectedCase ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-4 text-xs sticky top-20">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                  <Scale className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Câmara Deliberativa de Ética</span>
                </h3>
                <span className="font-mono text-[10px] text-slate-400">{selectedCase.caseNumber}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Pessoa Viva Objeto:</span>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-base mt-0.5">
                  {selectedCase.targetPerson}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Artigo: <span className="font-semibold text-purple-600">{selectedCase.articleTitle}</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400">Medida Cautelar Solicitada</span>
                <div className="font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                  {selectedCase.remedyRequested.replace(/_/g, ' ')}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                  Reclamante: <span className="font-medium">{selectedCase.complainant}</span> (
                  {selectedCase.complainantType})
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Alegação de Violação Ética:
                </span>
                <p className="p-2.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                  {selectedCase.claims}
                </p>
              </div>

              {selectedCase.decisionSummary && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Parecer e Acórdão Emitido:
                  </span>
                  <div className="p-2.5 rounded bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300">
                    {selectedCase.decisionSummary}
                  </div>
                </div>
              )}

              {/* Form to issue or update decision */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Emitir Novo Parecer Deontológico
                </span>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Novo Status do Processo:
                  </label>
                  <select
                    value={deliberationStatus}
                    onChange={e => setDeliberationStatus(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2 text-xs text-slate-800 dark:text-slate-100 outline-none"
                  >
                    <option value="em_deliberacao">Em Deliberação</option>
                    <option value="parecer_emitido">Parecer Emitido (Conclusivo)</option>
                    <option value="remocao_cautelar">Remoção Cautelar Imediata</option>
                    <option value="artigo_protegido">Artigo Protegido</option>
                    <option value="arquivado">Arquivado / Improcedente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Justificativa do Parecer (Registrado no Firestore):
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Redija o despacho formal do Conselho de Ética..."
                    value={deliberationVerdict}
                    onChange={e => setDeliberationVerdict(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2 text-xs text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveDeliberation}
                  disabled={!deliberationVerdict.trim()}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Assinar e Gravar Parecer Ético no Firebase
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center text-slate-400 text-xs">
              Selecione um processo na lista ao lado para abrir a câmara deliberativa de ética.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Instaurar Processo Ético */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Instaurar Novo Processo Ético (WP:BLP)</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome da Pessoa Viva Retratada (Biografado ou Derivado)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Nome Completo da pessoa ou figuras familiares derivadas"
                  value={formTargetPerson}
                  onChange={e => setFormTargetPerson(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Slug do Artigo Enciclopédico
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: MediaWiki"
                    value={formArticleSlug}
                    onChange={e => setFormArticleSlug(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Título Exibido do Artigo
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: MediaWiki (Biografias)"
                    value={formArticleTitle}
                    onChange={e => setFormArticleTitle(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tipificação da Violação
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs outline-none"
                  >
                    <option value="difamacao_calunia">Difamação ou Calúnia</option>
                    <option value="invasao_privacidade">Invasão de Privacidade</option>
                    <option value="falta_fontes_secundarias">Falta de Fontes Secundárias Confiáveis</option>
                    <option value="direito_esquecimento">Direito ao Esquecimento / Remissão</option>
                    <option value="conteudo_sensivel_familia">Conteúdo Sensível de Familiares / Menores</option>
                    <option value="outro">Outra Inadequação Deontológica</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Grau de Gravidade
                  </label>
                  <select
                    value={formSeverity}
                    onChange={e => setFormSeverity(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs outline-none"
                  >
                    <option value="critica">Crítica (Supressão Imediata Cautelar)</option>
                    <option value="alta">Alta</option>
                    <option value="media">Média</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Medida Cautelar Solicitada
                </label>
                <select
                  value={formRemedy}
                  onChange={e => setFormRemedy(e.target.value as any)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs outline-none"
                >
                  <option value="exclusao_paragrafo">Exclusão Imediata do Trecho Lesivo</option>
                  <option value="reversao_edicao">Reversão de Edição com Aviso ao Editor</option>
                  <option value="supressao_historico">Supressão Permanente de Histórico (Oversight)</option>
                  <option value="protecao_artigo">Proteção do Artigo contra Novas Edições</option>
                  <option value="eliminacao_completa">Eliminação Completa da Página</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Detalhamento da Denúncia e Violação Ética
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Descreva minuciosamente as alegações ofensivas, links para revisões ou parágrafos impugnados..."
                  value={formClaims}
                  onChange={e => setFormClaims(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-medium text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold text-xs cursor-pointer shadow-xs"
                >
                  Protocolar no Firestore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
