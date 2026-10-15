import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock,
  GitCompare,
  RotateCcw,
  ArrowLeft,
  Check,
  AlertCircle,
  Columns,
  AlignJustify,
  ChevronUp,
  ChevronDown,
  ArrowLeftRight,
  Eye,
  Filter,
  Hash,
  User,
  Calendar,
  FileCode,
  WrapText,
} from 'lucide-react';
import { Revision, UserSession } from '../types';
import { api } from '../api';
import {
  computeSideBySideDiff,
  SideBySideRow,
  UnifiedRow,
  DiffWordChunk,
} from '../utils/diffHelper';

interface HistoryDiffProps {
  slug: string;
  currentUser: UserSession | null;
  onNavigate: (slug: string) => void;
  onBackToReader: () => void;
}

export const HistoryDiff: React.FC<HistoryDiffProps> = ({
  slug,
  currentUser,
  onNavigate,
  onBackToReader,
}) => {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected revision IDs for comparison
  const [revOldId, setRevOldId] = useState<string>('');
  const [revNewId, setRevNewId] = useState<string>('');

  // View preferences
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');
  const [filterMode, setFilterMode] = useState<'all' | 'changes-only'>('all');
  const [wordWrap, setWordWrap] = useState<boolean>(true);

  // Rollback feedback
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Jump to change tracking
  const [currentChangeIndex, setCurrentChangeIndex] = useState<number>(0);
  const diffContainerRef = useRef<HTMLDivElement>(null);

  // Load revisions for the article
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api.getRevisions(slug)
      .then(revs => {
        if (!isMounted) return;
        setRevisions(revs);
        if (revs.length >= 2) {
          setRevNewId(revs[0].id);
          setRevOldId(revs[1].id);
        } else if (revs.length === 1) {
          setRevNewId(revs[0].id);
          setRevOldId(revs[0].id);
        }
        setLoading(false);
      })
      .catch(err => {
        if (isMounted) {
          setError(err.message || 'Falha ao buscar histórico de revisões');
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [slug]);

  // Find corresponding revision objects
  const revOld = useMemo(() => revisions.find(r => r.id === revOldId) || null, [revisions, revOldId]);
  const revNew = useMemo(() => revisions.find(r => r.id === revNewId) || null, [revisions, revNewId]);

  // Compute side-by-side and unified diff
  const diffResult = useMemo(() => {
    if (!revOld || !revNew) return null;
    return computeSideBySideDiff(revOld.wikitext || '', revNew.wikitext || '');
  }, [revOld, revNew]);

  // Indices of modified/added/removed rows for jump-to-change feature
  const changeRowIndices = useMemo(() => {
    if (!diffResult) return [];
    const indices: number[] = [];
    diffResult.rows.forEach((row, idx) => {
      if (row.type !== 'unchanged') {
        indices.push(idx);
      }
    });
    return indices;
  }, [diffResult]);

  // Filtered rows for "changes-only" mode (include 3 lines of context around modifications)
  const displayRows = useMemo(() => {
    if (!diffResult) return [];
    if (filterMode === 'all') return diffResult.rows;

    const contextRadius = 3;
    const includeSet = new Set<number>();

    diffResult.rows.forEach((row, idx) => {
      if (row.type !== 'unchanged') {
        for (let offset = -contextRadius; offset <= contextRadius; offset++) {
          const target = idx + offset;
          if (target >= 0 && target < diffResult.rows.length) {
            includeSet.add(target);
          }
        }
      }
    });

    return diffResult.rows.filter((_, idx) => includeSet.has(idx));
  }, [diffResult, filterMode]);

  // Filtered unified rows for "changes-only" mode
  const displayUnifiedRows = useMemo(() => {
    if (!diffResult) return [];
    if (filterMode === 'all') return diffResult.unifiedRows;

    const contextRadius = 3;
    const includeSet = new Set<number>();

    diffResult.unifiedRows.forEach((row, idx) => {
      if (row.type !== 'unchanged') {
        for (let offset = -contextRadius; offset <= contextRadius; offset++) {
          const target = idx + offset;
          if (target >= 0 && target < diffResult.unifiedRows.length) {
            includeSet.add(target);
          }
        }
      }
    });

    return diffResult.unifiedRows.filter((_, idx) => includeSet.has(idx));
  }, [diffResult, filterMode]);

  // Swap comparison (A <-> B)
  const handleSwap = () => {
    setRevOldId(revNewId);
    setRevNewId(revOldId);
  };

  // Jump to next change
  const handleNextChange = () => {
    if (changeRowIndices.length === 0) return;
    const nextIdx = (currentChangeIndex + 1) % changeRowIndices.length;
    setCurrentChangeIndex(nextIdx);
    scrollToChange(changeRowIndices[nextIdx]);
  };

  // Jump to previous change
  const handlePrevChange = () => {
    if (changeRowIndices.length === 0) return;
    const prevIdx = (currentChangeIndex - 1 + changeRowIndices.length) % changeRowIndices.length;
    setCurrentChangeIndex(prevIdx);
    scrollToChange(changeRowIndices[prevIdx]);
  };

  const scrollToChange = (rowIndex: number) => {
    const el = document.getElementById(`diff-row-${rowIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleRollback = async (targetRevId: string) => {
    if (!window.confirm(`Tem certeza que deseja reverter o artigo "${slug}" para a revisão ${targetRevId}? Uma nova revisão será adicionada com o conteúdo daquela versão.`)) {
      return;
    }

    setRollbackLoading(true);
    setActionMessage(null);
    try {
      const res = await api.rollbackArticle(slug, targetRevId);
      setActionMessage(`Artigo revertido com sucesso para ${targetRevId}! Nova revisão gerada: ${res.revision?.id || 'ok'}`);
      
      const updatedRevs = await api.getRevisions(slug);
      setRevisions(updatedRevs);
      if (updatedRevs.length >= 2) {
        setRevNewId(updatedRevs[0].id);
        setRevOldId(updatedRevs[1].id);
      }
    } catch (err: any) {
      setActionMessage(`Falha ao realizar reversão: ${err.message}`);
    } finally {
      setRollbackLoading(false);
    }
  };

  // Render inline word chunks with authentic MediaWiki highlights
  const renderWordChunks = (chunks?: DiffWordChunk[], fallbackContent?: string, type?: string) => {
    if (!chunks || chunks.length === 0) {
      return <span>{fallbackContent || ''}</span>;
    }

    return (
      <>
        {chunks.map((chunk, idx) => {
          if (chunk.type === 'removed') {
            return (
              <del
                key={idx}
                className="bg-rose-200/90 text-rose-950 font-bold px-0.5 rounded-2xs no-underline inline"
                title="Texto removido nesta revisão"
              >
                {chunk.text}
              </del>
            );
          }
          if (chunk.type === 'added') {
            return (
              <ins
                key={idx}
                className="bg-emerald-200/90 text-emerald-950 font-bold px-0.5 rounded-2xs no-underline inline"
                title="Texto adicionado nesta revisão"
              >
                {chunk.text}
              </ins>
            );
          }
          return <span key={idx}>{chunk.text}</span>;
        })}
      </>
    );
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-12 text-center shadow-xs">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">Consultando serviço de revisões e histórico criptográfico...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg p-6 text-rose-900 dark:text-rose-200 text-sm">
        <div className="font-semibold mb-1">Erro ao carregar histórico:</div>
        <div>{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner and Navigation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToReader}
              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
              title="Voltar para a leitura do artigo"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Comparação de Revisões (Diff): <span className="font-serif italic font-normal text-slate-700 dark:text-slate-300">{slug.replace(/_/g, ' ')}</span>
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-sans">
                Visualizador lado a lado no estilo oficial da MediaWiki/Wikipedia com rastreamento a nível de palavra (Myers LCS).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onBackToReader}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 rounded text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>Ver Artigo Publicado</span>
            </button>
          </div>
        </div>

        {/* Action feedback message */}
        {actionMessage && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 text-blue-900 text-xs rounded-md flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-blue-600" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Toolbar: Comparison Selection & Controls */}
        <div className="pt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Quick Selectors for Rev A & Rev B */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2.5 py-1">
              <span className="font-semibold text-rose-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Versão Base (A):
              </span>
              <select
                value={revOldId}
                onChange={e => setRevOldId(e.target.value)}
                className="bg-transparent font-mono text-slate-800 font-medium outline-none cursor-pointer"
              >
                {revisions.map((rev, idx) => (
                  <option key={rev.id} value={rev.id}>
                    {rev.id} {idx === 0 ? '(Atual)' : ''} — {new Date(rev.timestamp).toLocaleDateString()} {rev.author.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSwap}
              className="p-1.5 border border-slate-200 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              title="Inverter comparação (A ⇄ B)"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2.5 py-1">
              <span className="font-semibold text-emerald-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Versão Comparada (B):
              </span>
              <select
                value={revNewId}
                onChange={e => setRevNewId(e.target.value)}
                className="bg-transparent font-mono text-slate-800 font-medium outline-none cursor-pointer"
              >
                {revisions.map((rev, idx) => (
                  <option key={rev.id} value={rev.id}>
                    {rev.id} {idx === 0 ? '(Atual)' : ''} — {new Date(rev.timestamp).toLocaleDateString()} {rev.author.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* View Mode & Filter Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle: Side-by-Side vs Unified */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
              <button
                onClick={() => setViewMode('side-by-side')}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'side-by-side'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Visualização comparativa lado a lado (estilo MediaWiki)"
              >
                <Columns className="w-3.5 h-3.5 text-blue-600" />
                <span>Lado a Lado</span>
              </button>
              <button
                onClick={() => setViewMode('unified')}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'unified'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Visualização unificada em linha única"
              >
                <AlignJustify className="w-3.5 h-3.5 text-blue-600" />
                <span>Unificado</span>
              </button>
            </div>

            {/* Filter Toggle: All Lines vs Changes Only */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Documento Completo
              </button>
              <button
                onClick={() => setFilterMode('changes-only')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                  filterMode === 'changes-only'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Exibir apenas linhas alteradas com 3 linhas de contexto"
              >
                Apenas Alterações
              </button>
            </div>

            {/* Word wrap toggle */}
            <button
              onClick={() => setWordWrap(!wordWrap)}
              className={`p-1.5 border rounded transition-colors cursor-pointer ${
                wordWrap
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'border-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
              title={wordWrap ? 'Quebra de linha ativada' : 'Quebra de linha desativada'}
            >
              <WrapText className="w-3.5 h-3.5" />
            </button>

            {/* Jump to change buttons */}
            {changeRowIndices.length > 0 && (
              <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                <span className="text-[11px] font-mono text-slate-500">
                  Alt {currentChangeIndex + 1}/{changeRowIndices.length}
                </span>
                <button
                  onClick={handlePrevChange}
                  className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  title="Pular para alteração anterior"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleNextChange}
                  className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  title="Pular para próxima alteração"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Identical revisions notice */}
      {revOldId === revNewId && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Você selecionou a mesma revisão em ambos os lados ({revOldId}). Selecione duas revisões distintas na barra superior ou na tabela abaixo para ver as diferenças.
          </span>
        </div>
      )}

      {/* MAIN DIFF VISUALIZER CONTAINER */}
      {diffResult && revOld && revNew && revOldId !== revNewId && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          {/* Comparison Header & Stats Bar */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <GitCompare className="w-4 h-4 text-blue-600" />
              <span>Resumo de Alterações Criptográficas</span>
            </div>

            {/* Change Metrics */}
            <div className="flex items-center gap-2 font-mono text-xs text-slate-600">
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                +{diffResult.stats.added} linhas adicionadas
              </span>
              <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                -{diffResult.stats.removed} linhas removidas
              </span>
              <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {diffResult.stats.unchanged} inalteradas
              </span>
              <span className={`px-2 py-0.5 rounded border font-bold ${
                diffResult.stats.byteDelta >= 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}>
                Delta: {diffResult.stats.byteDelta >= 0 ? `+${diffResult.stats.byteDelta}` : diffResult.stats.byteDelta} bytes
              </span>
            </div>
          </div>

          {/* Comparative Column Headers */}
          <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-200 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            {/* Left Header: Revision A (Base/Older) */}
            <div className="p-3 bg-rose-50/40 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-900 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  Revisão A (Versão Anterior / Base)
                </span>
                <span className="font-mono text-[11px] text-slate-500">{revOld.id}</span>
              </div>
              <div className="text-slate-700 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {new Date(revOld.timestamp).toLocaleString()}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-medium">
                  <User className="w-3 h-3 text-slate-400" />
                  {revOld.author.name}
                  {revOld.author.isBot && (
                    <span className="text-[10px] text-purple-700 bg-purple-50 px-1 py-0.2 rounded border border-purple-200">bot</span>
                  )}
                </span>
                <span>•</span>
                <span className="font-mono">{revOld.byteSize.toLocaleString()} bytes</span>
              </div>
              <div className="text-[11px] text-slate-600 italic truncate" title={revOld.comment}>
                "{revOld.comment || 'Sem resumo de edição'}"
              </div>
              <div className="pt-1 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 truncate max-w-xs">
                  SHA: {revOld.sha256.substring(0, 16)}...
                </span>
                <button
                  onClick={() => handleRollback(revOld.id)}
                  disabled={rollbackLoading}
                  className="px-2 py-0.5 text-[11px] font-medium bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Reverter artigo para esta versão"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reverter para A
                </button>
              </div>
            </div>

            {/* Right Header: Revision B (Target/Newer) */}
            <div className="p-3 bg-emerald-50/40 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Revisão B (Versão Comparada)
                </span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[11px] text-slate-500">{revNew.id}</span>
                  {revisions[0]?.id === revNew.id && (
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-medium px-1.5 py-0.2 rounded font-sans">
                      (atual)
                    </span>
                  )}
                </div>
              </div>
              <div className="text-slate-700 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {new Date(revNew.timestamp).toLocaleString()}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-medium">
                  <User className="w-3 h-3 text-slate-400" />
                  {revNew.author.name}
                  {revNew.author.isBot && (
                    <span className="text-[10px] text-purple-700 bg-purple-50 px-1 py-0.2 rounded border border-purple-200">bot</span>
                  )}
                </span>
                <span>•</span>
                <span className="font-mono">{revNew.byteSize.toLocaleString()} bytes</span>
              </div>
              <div className="text-[11px] text-slate-600 italic truncate" title={revNew.comment}>
                "{revNew.comment || 'Sem resumo de edição'}"
              </div>
              <div className="pt-1 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 truncate max-w-xs">
                  SHA: {revNew.sha256.substring(0, 16)}...
                </span>
                {revisions[0]?.id !== revNew.id && (
                  <button
                    onClick={() => handleRollback(revNew.id)}
                    disabled={rollbackLoading}
                    className="px-2 py-0.5 text-[11px] font-medium bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="Reverter artigo para esta versão"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reverter para B
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* MAIN DIFF BODY: SIDE-BY-SIDE VIEW */}
          {viewMode === 'side-by-side' && (
            <div
              ref={diffContainerRef}
              className="max-h-[580px] overflow-y-auto divide-y divide-slate-100 font-mono text-xs select-text"
            >
              {displayRows.map((row, rIdx) => {
                const isModified = row.type === 'modified';
                const isAdded = row.type === 'added';
                const isRemoved = row.type === 'removed';
                const isUnchanged = row.type === 'unchanged';

                return (
                  <div
                    key={row.id}
                    id={`diff-row-${rIdx}`}
                    className={`grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 text-xs transition-colors ${
                      isModified
                        ? 'bg-amber-50/20'
                        : isAdded
                        ? 'bg-emerald-50/15'
                        : isRemoved
                        ? 'bg-rose-50/15'
                        : 'hover:bg-slate-50/60'
                    }`}
                  >
                    {/* LEFT COLUMN: Revision A */}
                    <div className={`flex items-start ${
                      row.left.type === 'removed'
                        ? 'bg-rose-50/70 text-rose-950 border-l-4 border-rose-500'
                        : row.left.type === 'empty'
                        ? 'bg-slate-50/30 text-transparent'
                        : 'text-slate-700 border-l-4 border-transparent'
                    } py-1 px-2 gap-2`}>
                      {/* Line Number Gutter */}
                      <span className="w-8 shrink-0 select-none text-right font-mono text-[11px] text-slate-400">
                        {row.left.lineNumber || ''}
                      </span>
                      {/* Operation Symbol Marker */}
                      <span className={`w-3.5 shrink-0 select-none font-bold text-center ${
                        row.left.type === 'removed' ? 'text-rose-600' : 'text-slate-300'
                      }`}>
                        {row.left.type === 'removed' ? '-' : ''}
                      </span>
                      {/* Line Content with Word Highlights */}
                      <div className={`flex-1 ${wordWrap ? 'break-words whitespace-pre-wrap' : 'whitespace-pre overflow-x-auto no-scrollbar'}`}>
                        {row.left.type !== 'empty' && renderWordChunks(row.left.wordChunks, row.left.content, row.left.type)}
                      </div>
                    </div>

                    {/* RIGHT COLUMN: Revision B */}
                    <div className={`flex items-start ${
                      row.right.type === 'added'
                        ? 'bg-emerald-50/70 text-emerald-950 border-l-4 border-emerald-500'
                        : row.right.type === 'empty'
                        ? 'bg-slate-50/30 text-transparent'
                        : 'text-slate-700 border-l-4 border-transparent'
                    } py-1 px-2 gap-2`}>
                      {/* Line Number Gutter */}
                      <span className="w-8 shrink-0 select-none text-right font-mono text-[11px] text-slate-400">
                        {row.right.lineNumber || ''}
                      </span>
                      {/* Operation Symbol Marker */}
                      <span className={`w-3.5 shrink-0 select-none font-bold text-center ${
                        row.right.type === 'added' ? 'text-emerald-600' : 'text-slate-300'
                      }`}>
                        {row.right.type === 'added' ? '+' : ''}
                      </span>
                      {/* Line Content with Word Highlights */}
                      <div className={`flex-1 ${wordWrap ? 'break-words whitespace-pre-wrap' : 'whitespace-pre overflow-x-auto no-scrollbar'}`}>
                        {row.right.type !== 'empty' && renderWordChunks(row.right.wordChunks, row.right.content, row.right.type)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ALTERNATIVE: UNIFIED VIEW */}
          {viewMode === 'unified' && (
            <div
              className="max-h-[580px] overflow-y-auto divide-y divide-slate-100 font-mono text-xs select-text"
            >
              {displayUnifiedRows.map(row => {
                if (row.type === 'added') {
                  return (
                    <div
                      key={row.id}
                      className="bg-emerald-50/70 text-emerald-950 px-3 py-1 border-l-4 border-emerald-500 flex items-start gap-2"
                    >
                      <span className="w-8 shrink-0 select-none text-slate-300 text-right text-[11px]"></span>
                      <span className="w-8 shrink-0 select-none text-emerald-700 text-right text-[11px] font-bold">
                        {row.lineNumberNew}
                      </span>
                      <span className="w-4 select-none text-emerald-600 font-bold text-center">+</span>
                      <div className={`flex-1 ${wordWrap ? 'break-words whitespace-pre-wrap' : 'whitespace-pre overflow-x-auto'}`}>
                        {row.content}
                      </div>
                    </div>
                  );
                }
                if (row.type === 'removed') {
                  return (
                    <div
                      key={row.id}
                      className="bg-rose-50/70 text-rose-950 px-3 py-1 border-l-4 border-rose-500 flex items-start gap-2"
                    >
                      <span className="w-8 shrink-0 select-none text-rose-700 text-right text-[11px] font-bold">
                        {row.lineNumberOld}
                      </span>
                      <span className="w-8 shrink-0 select-none text-slate-300 text-right text-[11px]"></span>
                      <span className="w-4 select-none text-rose-600 font-bold text-center">-</span>
                      <div className={`flex-1 ${wordWrap ? 'break-words whitespace-pre-wrap' : 'whitespace-pre overflow-x-auto'}`}>
                        {row.content}
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={row.id}
                    className="text-slate-700 hover:bg-slate-50 px-3 py-0.5 flex items-start gap-2"
                  >
                    <span className="w-8 shrink-0 select-none text-slate-400 text-right text-[11px]">
                      {row.lineNumberOld}
                    </span>
                    <span className="w-8 shrink-0 select-none text-slate-400 text-right text-[11px]">
                      {row.lineNumberNew}
                    </span>
                    <span className="w-4 select-none text-slate-300 text-center"> </span>
                    <div className={`flex-1 text-slate-800 ${wordWrap ? 'break-words whitespace-pre-wrap' : 'whitespace-pre overflow-x-auto'}`}>
                      {row.content}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Footer Details */}
          <div className="bg-slate-50 border-t border-slate-200 p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-2xs bg-rose-200 border border-rose-400" />
                <span className="font-semibold text-rose-900">Removido / Substituído</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-2xs bg-emerald-200 border border-emerald-400" />
                <span className="font-semibold text-emerald-900">Adicionado / Novo</span>
              </span>
            </div>
            <div>
              Algoritmo Myers LCS com divisão de tokens e realce intra-linha
            </div>
          </div>
        </div>
      )}

      {/* REVISION HISTORY TIMELINE TABLE */}
      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-xs">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-600" />
            <span className="font-bold text-slate-800">
              Linha do Tempo de Revisões ({revisions.length} commits)
            </span>
          </div>
          <span className="text-slate-500 font-mono text-[11px]">
            Selecione Diff A (Base) e Diff B (Comparação) nos botões de rádio
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-medium">
                <th className="py-2.5 px-3 w-16 text-center font-bold text-rose-700">Diff A</th>
                <th className="py-2.5 px-3 w-16 text-center font-bold text-emerald-700">Diff B</th>
                <th className="py-2.5 px-3 font-semibold">Data & Hora</th>
                <th className="py-2.5 px-3 font-semibold">Autor / Editor</th>
                <th className="py-2.5 px-3 font-semibold">Tamanho</th>
                <th className="py-2.5 px-3 font-semibold">Resumo de Edição</th>
                <th className="py-2.5 px-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {revisions.map((rev, index) => {
                const dateFormatted = new Date(rev.timestamp).toLocaleString();
                const isLatest = index === 0;
                const isSelectedA = revOldId === rev.id;
                const isSelectedB = revNewId === rev.id;

                return (
                  <tr
                    key={rev.id}
                    className={`transition-colors ${
                      isSelectedA && isSelectedB
                        ? 'bg-amber-50/40'
                        : isSelectedA
                        ? 'bg-rose-50/30'
                        : isSelectedB
                        ? 'bg-emerald-50/30'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Diff Radio Old (A) */}
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="radio"
                        name="revOld"
                        value={rev.id}
                        checked={revOldId === rev.id}
                        onChange={() => setRevOldId(rev.id)}
                        className="text-rose-600 focus:ring-rose-500 cursor-pointer accent-rose-600"
                        title="Definir como Revisão A (Base)"
                      />
                    </td>

                    {/* Diff Radio New (B) */}
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="radio"
                        name="revNew"
                        value={rev.id}
                        checked={revNewId === rev.id}
                        onChange={() => setRevNewId(rev.id)}
                        className="text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                        title="Definir como Revisão B (Comparação)"
                      />
                    </td>

                    {/* Timestamp & Revision ID */}
                    <td className="py-2.5 px-3 font-mono text-slate-800 whitespace-nowrap">
                      <span>{dateFormatted}</span>
                      {isLatest && (
                        <span className="ml-2 text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-sans font-medium">
                          (atual)
                        </span>
                      )}
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {rev.id}
                      </div>
                    </td>

                    {/* Author */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-900">{rev.author.name}</span>
                        {rev.author.isBot && (
                          <span className="text-[10px] text-purple-700 bg-purple-50 px-1 py-0.2 rounded border border-purple-200">bot</span>
                        )}
                      </div>
                    </td>

                    {/* Size */}
                    <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                      {rev.byteSize.toLocaleString()} bytes
                    </td>

                    {/* Summary */}
                    <td className="py-2.5 px-3 text-slate-700">
                      <div className="flex items-center gap-1">
                        <span className="italic">{rev.comment || 'Sem resumo de edição'}</span>
                        {rev.isMinor && (
                          <span className="text-[10px] text-slate-500 font-mono font-semibold bg-slate-100 px-1 rounded">
                            [menor]
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-xs">
                        SHA-256: {rev.sha256}
                      </div>
                    </td>

                    {/* Actions: Revert */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {!isLatest && (
                        <button
                          onClick={() => handleRollback(rev.id)}
                          disabled={rollbackLoading}
                          className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title="Reverter artigo para esta versão exata"
                        >
                          <RotateCcw className="w-3 h-3 text-slate-500" />
                          Reverter
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
