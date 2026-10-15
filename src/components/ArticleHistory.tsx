import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock,
  GitCompare,
  ArrowLeft,
  RotateCcw,
  Check,
  AlertCircle,
  Columns,
  AlignJustify,
  ChevronUp,
  ChevronDown,
  ArrowLeftRight,
  Eye,
  Search,
  Filter,
  User,
  Calendar,
  MessageSquare,
  Edit3,
  FileText,
  Shield,
  WrapText,
  ExternalLink,
  Printer,
} from 'lucide-react';
import { Revision, Article, UserSession } from '../types';
import { api } from '../api';
import { clientParsoid } from '../services/parsoid';
import { computeSideBySideDiff, DiffWordChunk } from '../utils/diffHelper';
import { WikiReportModal } from './WikiReportModal';
import { buildHistoryReportData } from '../utils/reportGenerator';

export interface ArticleHistoryProps {
  slug: string;
  currentUser: UserSession | null;
  onNavigateArticle: (slug: string) => void;
  onBackToReader: () => void;
  onEditArticle: (slug: string) => void;
}

export const ArticleHistory: React.FC<ArticleHistoryProps> = ({
  slug,
  currentUser,
  onNavigateArticle,
  onBackToReader,
  onEditArticle,
}) => {
  const [article, setArticle] = useState<Article | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Diff comparison states
  const [revOldId, setRevOldId] = useState<string>('');
  const [revNewId, setRevNewId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');
  const [filterMode, setFilterMode] = useState<'all' | 'changes-only'>('all');
  const [wordWrap, setWordWrap] = useState<boolean>(true);
  const [currentChangeIndex, setCurrentChangeIndex] = useState<number>(0);
  const diffSectionRef = useRef<HTMLDivElement>(null);

  // Filters for revision list
  const [searchFilter, setSearchFilter] = useState('');
  const [showMinorOnly, setShowMinorOnly] = useState(false);

  // Preview historical version mode
  const [previewRevId, setPreviewRevId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Rollback state
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [rollbackConfirmRevId, setRollbackConfirmRevId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Fetch article and revisions
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      api.getArticle(slug),
      api.getRevisions(slug),
    ])
      .then(([art, revs]) => {
        if (!isMounted) return;
        setArticle(art);
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
        if (!isMounted) return;
        setError(err.message || 'Falha ao carregar histórico de edições');
        setLoading(false);
      });

    return () => { isMounted = false; };
  }, [slug]);

  // When preview revision changes, parse wikitext using clientParsoid
  useEffect(() => {
    if (!previewRevId) {
      setPreviewHtml('');
      return;
    }
    const target = revisions.find(r => r.id === previewRevId);
    if (target && target.wikitext) {
      setPreviewLoading(true);
      try {
        const parsed = clientParsoid.parse(target.wikitext, article?.title || slug);
        setPreviewHtml(parsed.html);
      } catch (err) {
        console.error('Error parsing preview revision:', err);
      } finally {
        setPreviewLoading(false);
      }
    }
  }, [previewRevId, revisions, article?.title, slug]);

  // Find revision objects for comparison
  const revOld = useMemo(() => revisions.find(r => r.id === revOldId) || null, [revisions, revOldId]);
  const revNew = useMemo(() => revisions.find(r => r.id === revNewId) || null, [revisions, revNewId]);

  // Compute diff
  const diffResult = useMemo(() => {
    if (!revOld || !revNew) return null;
    return computeSideBySideDiff(revOld.wikitext || '', revNew.wikitext || '');
  }, [revOld, revNew]);

  // Change row indices for navigation
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

  // Filtered rows for diff
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

  // Filtered unified rows
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

  // Filtered revisions list
  const filteredRevisions = useMemo(() => {
    return revisions.filter(rev => {
      if (showMinorOnly && !rev.isMinor) return false;
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        rev.author.name.toLowerCase().includes(q) ||
        rev.comment.toLowerCase().includes(q) ||
        rev.id.toLowerCase().includes(q)
      );
    });
  }, [revisions, searchFilter, showMinorOnly]);

  // Compare helpers
  const handleCompareWithCurrent = (targetRevId: string) => {
    if (revisions.length === 0) return;
    setRevNewId(revisions[0].id);
    setRevOldId(targetRevId);
    setPreviewRevId(null);
    diffSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCompareWithPrevious = (index: number) => {
    if (index >= revisions.length - 1) return;
    setRevNewId(revisions[index].id);
    setRevOldId(revisions[index + 1].id);
    setPreviewRevId(null);
    diffSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSwap = () => {
    setRevOldId(revNewId);
    setRevNewId(revOldId);
  };

  // Rollback execution
  const handleExecuteRollback = async (targetRevId: string) => {
    setRollbackLoading(true);
    setActionMessage(null);
    try {
      await api.rollbackArticle(slug, targetRevId);
      setActionMessage({
        text: `Artigo restaurado com sucesso para a revisão ${targetRevId}!`,
        type: 'success',
      });
      setRollbackConfirmRevId(null);
      // Refresh revisions list
      const updatedRevs = await api.getRevisions(slug);
      setRevisions(updatedRevs);
      if (updatedRevs.length >= 2) {
        setRevNewId(updatedRevs[0].id);
        setRevOldId(updatedRevs[1].id);
      }
    } catch (err: any) {
      setActionMessage({
        text: `Falha ao reverter artigo: ${err.message}`,
        type: 'error',
      });
    } finally {
      setRollbackLoading(false);
    }
  };

  // Word chunks renderer
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
                className="bg-rose-200 dark:bg-rose-950/80 text-rose-950 dark:text-rose-200 font-bold px-0.5 rounded-2xs no-underline inline"
              >
                {chunk.text}
              </del>
            );
          }
          if (chunk.type === 'added') {
            return (
              <ins
                key={idx}
                className="bg-emerald-200 dark:bg-emerald-950/80 text-emerald-950 dark:text-emerald-200 font-bold px-0.5 rounded-2xs no-underline inline"
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

  const isTalk = slug.startsWith('Talk:');
  const mainSlug = isTalk ? slug.replace('Talk:', '') : slug;
  const talkSlug = isTalk ? slug : `Talk:${slug}`;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-slate-300 dark:border-slate-700 border-t-slate-800 dark:border-t-slate-200 rounded-full animate-spin mb-4" />
        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Carregando histórico de revisões...
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-1">
          GET /api/v1/revisions/article/{slug}
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg p-6 text-rose-900 dark:text-rose-200 text-sm">
          <div className="font-semibold mb-1">Erro ao carregar histórico:</div>
          <div>{error || 'Artigo não encontrado'}</div>
          <button
            onClick={onBackToReader}
            className="mt-4 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
          >
            ← Voltar para a leitura
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 font-sans">
      {/* Sub-header Tabs & Action Bar (MediaWiki Vector Style) */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-2 mb-6 flex flex-wrap items-center justify-between gap-4">
        {/* Namespace tabs: Article / Talk */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onNavigateArticle(mainSlug)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
              !isTalk
                ? 'border-blue-600 text-blue-800 dark:text-blue-400 font-semibold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Artigo
          </button>
          <button
            onClick={() => onNavigateArticle(talkSlug)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              isTalk
                ? 'border-blue-600 text-blue-800 dark:text-blue-400 font-semibold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Discussão
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onBackToReader}
            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            Leitura
          </button>
          <button
            onClick={() => onEditArticle(slug)}
            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            Editar código-fonte
          </button>
          <div className="px-3 py-1.5 text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Ver histórico
          </div>
          <button
            onClick={() => setIsReportOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 rounded border border-purple-200 dark:border-purple-800 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Gerar Relatório de Auditoria de Revisões em PDF no padrão do Wiki"
          >
            <Printer className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Relatório PDF</span>
          </button>
        </div>
      </div>

      {/* Page Title & Unboxed Metadata */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              <span>Histórico de edições de «{article.title}»</span>
              {article.isProtected && (
                <span className="text-xs font-sans font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Protegido
                </span>
              )}
            </h1>
            {/* Zero-Pill Unboxed Metadata */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2 font-sans">
              <span>Wikipedia, the free encyclopedia</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                {revisions.length} {revisions.length === 1 ? 'edição registrada' : 'edições registradas'}
              </span>
              <span aria-hidden="true">·</span>
              <span>Última revisão: {revisions[0] ? new Date(revisions[0].timestamp).toLocaleDateString('pt-BR') : 'Hoje'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-400 dark:text-slate-500">rev: {article.latestRevisionId}</span>
            </div>
          </div>

          <button
            onClick={onBackToReader}
            className="self-start sm:self-auto text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para o artigo
          </button>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionMessage && (
        <div
          className={`mb-6 p-3.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-mono text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* HISTORICAL REVISION PREVIEW MODE */}
      {previewRevId && (
        <div className="mb-8 border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/30 rounded-lg p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200 dark:border-amber-800">
            <div>
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold text-sm">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>
                  Visualizando versão antiga de{' '}
                  {new Date(revisions.find(r => r.id === previewRevId)?.timestamp || '').toLocaleString('pt-BR')}
                </span>
              </div>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                Editado por{' '}
                <strong className="font-semibold text-amber-900 dark:text-amber-100">
                  {revisions.find(r => r.id === previewRevId)?.author.name}
                </strong>{' '}
                — Resumo: "{revisions.find(r => r.id === previewRevId)?.comment || 'Sem resumo'}"
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setRollbackConfirmRevId(previewRevId)}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar esta versão
              </button>
              <button
                onClick={() => setPreviewRevId(null)}
                className="px-3 py-1.5 text-xs font-medium border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer"
              >
                Fechar pré-visualização
              </button>
            </div>
          </div>

          <div className="mt-4 bg-white dark:bg-slate-900 p-6 rounded border border-slate-200 dark:border-slate-800">
            {previewLoading ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Renderizando versão histórica na AST...
              </div>
            ) : (
              <article
                className="wiki-content prose max-w-none text-slate-800 dark:text-slate-200 leading-relaxed font-serif text-sm"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            )}
          </div>
        </div>
      )}

      {/* Rollback confirmation modal */}
      {rollbackConfirmRevId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-md w-full p-5 shadow-xl">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-base mb-2">
              <AlertCircle className="w-5 h-5" />
              <span>Confirmar Reversão de Edição</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              Você tem certeza de que deseja reverter o artigo para o estado exato da revisão{' '}
              <strong className="font-mono text-slate-900 dark:text-slate-100">{rollbackConfirmRevId}</strong>? Uma nova revisão será gravada no histórico registrando a ação de rollback.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setRollbackConfirmRevId(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleExecuteRollback(rollbackConfirmRevId)}
                disabled={rollbackLoading}
                className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {rollbackLoading ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Revertendo...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Confirmar Reversão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT GRID */}
      <div className="space-y-6">
        {/* REVISION LIST & COMPARISON TABLE */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
          {/* Header & Controls Toolbar */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Lista de Revisões do Artigo ({revisions.length} versões)
              </span>
            </div>

            {/* Filter toolbar */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  placeholder="Filtrar por autor ou resumo..."
                  className="pl-8 pr-3 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showMinorOnly}
                  onChange={e => setShowMinorOnly(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>Apenas menores</span>
              </label>

              <button
                onClick={() => diffSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                disabled={!revOldId || !revNewId || revOldId === revNewId}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-xs flex items-center gap-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Comparar selecionadas</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="bg-slate-100/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                  <th className="py-2.5 px-3 w-14 text-center font-bold text-rose-700 dark:text-rose-400" title="Revisão base mais antiga">
                    Base
                  </th>
                  <th className="py-2.5 px-3 w-14 text-center font-bold text-emerald-700 dark:text-emerald-400" title="Revisão mais recente comparada">
                    Comp
                  </th>
                  <th className="py-2.5 px-3 font-semibold">Data & Hora</th>
                  <th className="py-2.5 px-3 font-semibold">Autor</th>
                  <th className="py-2.5 px-3 font-semibold">Tamanho / Delta</th>
                  <th className="py-2.5 px-3 font-semibold">Resumo de Edição</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredRevisions.map((rev, index) => {
                  const dateObj = new Date(rev.timestamp);
                  const isLatest = index === 0;
                  const isSelectedOld = revOldId === rev.id;
                  const isSelectedNew = revNewId === rev.id;

                  // Compute byte delta relative to previous revision
                  const nextOlder = revisions[index + 1];
                  const byteDelta = nextOlder ? rev.byteSize - nextOlder.byteSize : 0;

                  return (
                    <tr
                      key={rev.id}
                      className={`transition-colors ${
                        isSelectedOld && isSelectedNew
                          ? 'bg-amber-50/50 dark:bg-amber-950/30'
                          : isSelectedOld
                          ? 'bg-rose-50/40 dark:bg-rose-950/20'
                          : isSelectedNew
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Diff Radio Old (Base) */}
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="radio"
                          name="revOld"
                          value={rev.id}
                          checked={isSelectedOld}
                          onChange={() => setRevOldId(rev.id)}
                          className="text-rose-600 focus:ring-rose-500 cursor-pointer accent-rose-600"
                          title="Definir como versão Base (A)"
                        />
                      </td>

                      {/* Diff Radio New (Compare) */}
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="radio"
                          name="revNew"
                          value={rev.id}
                          checked={isSelectedNew}
                          onChange={() => setRevNewId(rev.id)}
                          className="text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                          title="Definir como versão Comparada (B)"
                        />
                      </td>

                      {/* Date & Time + Diff shortcuts (atu | ant) */}
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {/* (atu) compare with current */}
                          {!isLatest ? (
                            <button
                              onClick={() => handleCompareWithCurrent(rev.id)}
                              className="text-blue-600 dark:text-blue-400 hover:underline text-[11px] cursor-pointer"
                              title="Comparar com a versão atual"
                            >
                              atu
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">atu</span>
                          )}
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          {/* (ant) compare with previous */}
                          {index < revisions.length - 1 ? (
                            <button
                              onClick={() => handleCompareWithPrevious(index)}
                              className="text-blue-600 dark:text-blue-400 hover:underline text-[11px] cursor-pointer"
                              title="Comparar com a versão imediatamente anterior"
                            >
                              ant
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">ant</span>
                          )}

                          <span className="text-slate-300 dark:text-slate-600">·</span>

                          {/* Timestamp button (opens preview) */}
                          <button
                            onClick={() => setPreviewRevId(rev.id)}
                            className="font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer text-left"
                            title="Visualizar o artigo nesta data exata"
                          >
                            {dateObj.toLocaleDateString('pt-BR')} {dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </button>

                          {isLatest && (
                            <span className="ml-1 text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800 font-sans font-medium">
                              atual
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                          ID: {rev.id}
                        </div>
                      </td>

                      {/* Author */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {rev.author.name}
                          </span>
                          {rev.author.isBot && (
                            <span className="text-[10px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-1 py-0.2 rounded border border-purple-200 dark:border-purple-800">
                              bot
                            </span>
                          )}
                          {rev.author.role === 'bureaucrat' && (
                            <span className="text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1 py-0.2 rounded border border-blue-200 dark:border-blue-800">
                              burocrata
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Size & Delta */}
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                        <span className="text-slate-700 dark:text-slate-300">
                          {rev.byteSize.toLocaleString()} bytes
                        </span>
                        {index < revisions.length - 1 && (
                          <span
                            className={`ml-2 font-bold ${
                              byteDelta > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : byteDelta < 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {byteDelta > 0 ? `+${byteDelta}` : byteDelta}
                          </span>
                        )}
                      </td>

                      {/* Edit summary */}
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-sm">
                        <div className="flex items-center gap-1.5">
                          {rev.isMinor && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-semibold bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded" title="Edição menor">
                              m
                            </span>
                          )}
                          <span className="italic truncate">{rev.comment || 'Sem resumo de edição'}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setPreviewRevId(rev.id)}
                            className="px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Ver conteúdo desta versão"
                          >
                            Ver
                          </button>
                          {!isLatest && (
                            <button
                              onClick={() => setRollbackConfirmRevId(rev.id)}
                              disabled={rollbackLoading}
                              className="px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Reverter artigo para esta versão"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Reverter
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* VISUAL DIFF SECTION */}
        <div ref={diffSectionRef} className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
          {/* Diff Controls Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Comparação de Versões (Diff)
              </h2>
            </div>

            {/* Revision Selectors A & B */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1">
                <span className="font-semibold text-rose-700 dark:text-rose-400">Base (A):</span>
                <select
                  value={revOldId}
                  onChange={e => setRevOldId(e.target.value)}
                  className="bg-transparent font-mono text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                >
                  {revisions.map((rev, idx) => (
                    <option key={rev.id} value={rev.id} className="dark:bg-slate-900">
                      {rev.id} {idx === 0 ? '(Atual)' : ''} — {new Date(rev.timestamp).toLocaleDateString()} {rev.author.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleSwap}
                className="p-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
                title="Inverter comparação (A ⇄ B)"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1">
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">Comparação (B):</span>
                <select
                  value={revNewId}
                  onChange={e => setRevNewId(e.target.value)}
                  className="bg-transparent font-mono text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                >
                  {revisions.map((rev, idx) => (
                    <option key={rev.id} value={rev.id} className="dark:bg-slate-900">
                      {rev.id} {idx === 0 ? '(Atual)' : ''} — {new Date(rev.timestamp).toLocaleDateString()} {rev.author.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* View mode toggle */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setViewMode('side-by-side')}
                  className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                    viewMode === 'side-by-side'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Lado a Lado</span>
                </button>
                <button
                  onClick={() => setViewMode('unified')}
                  className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                    viewMode === 'unified'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <AlignJustify className="w-3.5 h-3.5" />
                  <span>Unificado</span>
                </button>
              </div>

              {/* Word wrap toggle */}
              <button
                onClick={() => setWordWrap(!wordWrap)}
                className={`p-1.5 border rounded transition-colors cursor-pointer ${
                  wordWrap
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
                title="Quebra de linha automática"
              >
                <WrapText className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          {diffResult && (
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-mono">
              <div className="flex items-center gap-3">
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                  +{diffResult.stats.added} linhas adicionadas
                </span>
                <span className="text-rose-700 dark:text-rose-400 font-bold">
                  -{diffResult.stats.removed} linhas removidas
                </span>
                <span>{diffResult.stats.totalRows} linhas analisadas</span>
              </div>
              <div>
                Delta: {diffResult.stats.byteDelta > 0 ? `+${diffResult.stats.byteDelta}` : diffResult.stats.byteDelta} bytes
              </div>
            </div>
          )}

          {/* Diff Content Container */}
          {revOldId === revNewId ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 font-sans">
              As revisões selecionadas são idênticas ({revOldId}). Selecione duas versões diferentes para ver as alterações.
            </div>
          ) : !diffResult || diffResult.rows.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 font-sans">
              Nenhuma alteração detectada entre estas duas versões.
            </div>
          ) : viewMode === 'side-by-side' ? (
            /* SIDE BY SIDE DIFF */
            <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs select-text">
              {displayRows.map(row => (
                <div key={row.id} className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800">
                  {/* Left Column (Old) */}
                  <div
                    className={`flex items-start ${
                      row.left.type === 'removed'
                        ? 'bg-rose-50/80 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 border-l-4 border-rose-500'
                        : row.left.type === 'empty'
                        ? 'bg-slate-50/40 dark:bg-slate-900/40 text-transparent'
                        : 'text-slate-700 dark:text-slate-300 border-l-4 border-transparent'
                    } py-1 px-2 gap-2`}
                  >
                    <span className="w-8 shrink-0 select-none text-right font-mono text-[11px] text-slate-400">
                      {row.left.lineNumber || ''}
                    </span>
                    <span className="w-3.5 shrink-0 select-none font-bold text-center text-rose-600">
                      {row.left.type === 'removed' ? '-' : ''}
                    </span>
                    <div className={`flex-1 ${wordWrap ? 'break-words whitespace-pre-wrap' : 'whitespace-pre overflow-x-auto'}`}>
                      {row.left.type !== 'empty' && renderWordChunks(row.left.wordChunks, row.left.content, row.left.type)}
                    </div>
                  </div>

                  {/* Right Column (New) */}
                  <div
                    className={`flex items-start ${
                      row.right.type === 'added'
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 border-l-4 border-emerald-500'
                        : row.right.type === 'empty'
                        ? 'bg-slate-50/40 dark:bg-slate-900/40 text-transparent'
                        : 'text-slate-700 dark:text-slate-300 border-l-4 border-transparent'
                    } py-1 px-2 gap-2`}
                  >
                    <span className="w-8 shrink-0 select-none text-right font-mono text-[11px] text-slate-400">
                      {row.right.lineNumber || ''}
                    </span>
                    <span className="w-3.5 shrink-0 select-none font-bold text-center text-emerald-600">
                      {row.right.type === 'added' ? '+' : ''}
                    </span>
                    <div className={`flex-1 ${wordWrap ? 'break-words whitespace-pre-wrap' : 'whitespace-pre overflow-x-auto'}`}>
                      {row.right.type !== 'empty' && renderWordChunks(row.right.wordChunks, row.right.content, row.right.type)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* UNIFIED DIFF */
            <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs select-text">
              {displayUnifiedRows.map(row => {
                if (row.type === 'added') {
                  return (
                    <div key={row.id} className="bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 px-3 py-1 border-l-4 border-emerald-500 flex items-start gap-2">
                      <span className="w-8 shrink-0 select-none text-slate-300 dark:text-slate-600 text-right text-[11px]"></span>
                      <span className="w-8 shrink-0 select-none text-emerald-700 dark:text-emerald-400 text-right text-[11px] font-bold">
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
                    <div key={row.id} className="bg-rose-50/80 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 px-3 py-1 border-l-4 border-rose-500 flex items-start gap-2">
                      <span className="w-8 shrink-0 select-none text-rose-700 dark:text-rose-400 text-right text-[11px] font-bold">
                        {row.lineNumberOld}
                      </span>
                      <span className="w-8 shrink-0 select-none text-slate-300 dark:text-slate-600 text-right text-[11px]"></span>
                      <span className="w-4 select-none text-rose-600 font-bold text-center">-</span>
                      <div className={`flex-1 ${wordWrap ? 'break-words whitespace-pre-wrap' : 'whitespace-pre overflow-x-auto'}`}>
                        {row.content}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={row.id} className="text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-0.5 flex items-start gap-2">
                    <span className="w-8 shrink-0 select-none text-slate-400 text-right text-[11px]">
                      {row.lineNumberOld}
                    </span>
                    <span className="w-8 shrink-0 select-none text-slate-400 text-right text-[11px]">
                      {row.lineNumberNew}
                    </span>
                    <span className="w-4 select-none text-slate-300 text-center"> </span>
                    <div className={`flex-1 text-slate-800 dark:text-slate-200 ${wordWrap ? 'break-words whitespace-pre-wrap' : 'whitespace-pre overflow-x-auto'}`}>
                      {row.content}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer note */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 p-2.5 px-4 flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-2xs bg-rose-200 dark:bg-rose-900 border border-rose-400 dark:border-rose-700" />
                <span>Removido</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-2xs bg-emerald-200 dark:bg-emerald-900 border border-emerald-400 dark:border-emerald-700" />
                <span>Adicionado</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Official Standard PDF Report Modal */}
      {isReportOpen && article && (
        <WikiReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          metadata={buildHistoryReportData(article, revisions, currentUser).metadata}
          article={article}
          revisions={revisions}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
