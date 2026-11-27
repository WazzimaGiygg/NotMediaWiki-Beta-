import React, { useEffect, useMemo, useState } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  Search,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  ArrowUpDown,
  Tag,
  ExternalLink,
} from 'lucide-react';
import { Article } from '../types';
import {
  buildCategoryIndex,
  buildCategorySlug,
  CategoryIndexEntry,
  normalizeCategoryName,
  resolvePageSortKey,
} from '../utils/wikiCategories';
import { parseTitle } from '../utils/namespaces';

export interface CategoryExplorerProps {
  articles: Article[];
  onNavigateArticle: (slug: string) => void;
  onOpenHistory?: (slug: string) => void;
  initialCategory?: string;
}

type CategorySortMode = 'alpha' | 'count';

function formatShortDate(iso?: string): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function buildExcerpt(article: Article): string {
  if (article.summary && article.summary.trim()) {
    return article.summary.trim();
  }
  const plain = (article.wikitext || '')
    .replace(/\{\{[\s\S]*?\}\}/g, ' ')
    .replace(/\[\[(?:Category|Categoria):[^\]]+\]\]/gi, ' ')
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
    .replace(/<ref[\s\S]*?<\/ref>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/'''?/g, '')
    .replace(/^=+\s*|\s*=+$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return 'Sem resumo disponível.';
  return plain.length > 140 ? `${plain.slice(0, 140)}...` : plain;
}

export const CategoryExplorer: React.FC<CategoryExplorerProps> = ({
  articles,
  onNavigateArticle,
  onOpenHistory,
  initialCategory,
}) => {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [articleFilter, setArticleFilter] = useState('');
  const [sortMode, setSortMode] = useState<CategorySortMode>('alpha');
  const [showHidden, setShowHidden] = useState(false);

  const categoryIndex = useMemo(() => buildCategoryIndex(articles), [articles]);

  const allCategories = useMemo(() => {
    const entries = Array.from(categoryIndex.values()).filter(entry =>
      showHidden ? true : !entry.isHidden
    );

    const normalizedQuery = categoryFilter.trim().toLowerCase();
    const matching = normalizedQuery
      ? entries.filter(
          entry =>
            entry.displayName.toLowerCase().includes(normalizedQuery) ||
            entry.memberArticles.some(art =>
              (art.title || art.slug).toLowerCase().includes(normalizedQuery)
            )
        )
      : entries;

    return [...matching].sort((a, b) => {
      if (sortMode === 'count') {
        const diff = b.memberArticles.length - a.memberArticles.length;
        if (diff !== 0) return diff;
      }
      return a.displayName.localeCompare(b.displayName, 'pt-BR', { sensitivity: 'base' });
    });
  }, [categoryIndex, categoryFilter, sortMode, showHidden]);

  const hiddenCount = useMemo(
    () => Array.from(categoryIndex.values()).filter(entry => entry.isHidden).length,
    [categoryIndex]
  );

  const [selectedKey, setSelectedKey] = useState<string>(() => {
    if (initialCategory) {
      const normalized = normalizeCategoryName(initialCategory).toLowerCase();
      if (categoryIndex.has(normalized)) return normalized;
    }
    const firstWithArticles = allCategories.find(c => c.memberArticles.length > 0);
    return firstWithArticles?.key || allCategories[0]?.key || '';
  });

  useEffect(() => {
    if (initialCategory) {
      const normalized = normalizeCategoryName(initialCategory).toLowerCase();
      if (categoryIndex.has(normalized)) {
        setSelectedKey(normalized);
        return;
      }
    }
    if (!selectedKey || !categoryIndex.has(selectedKey)) {
      const firstWithArticles = allCategories.find(c => c.memberArticles.length > 0);
      setSelectedKey(firstWithArticles?.key || allCategories[0]?.key || '');
    }
  }, [initialCategory, categoryIndex, allCategories, selectedKey]);

  const selectedEntry: CategoryIndexEntry | undefined = selectedKey
    ? categoryIndex.get(selectedKey)
    : undefined;

  const selectedSubcategories = useMemo(() => {
    if (!selectedEntry) return [];
    const subs: CategoryIndexEntry[] = [];
    for (const subKey of selectedEntry.subcategoryKeys) {
      const found = categoryIndex.get(subKey);
      if (found) subs.push(found);
    }
    return subs.sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'pt-BR', { sensitivity: 'base' })
    );
  }, [selectedEntry, categoryIndex]);

  const sortedMemberArticles = useMemo(() => {
    if (!selectedEntry) return [];
    const q = articleFilter.trim().toLowerCase();
    const filtered = q
      ? selectedEntry.memberArticles.filter(
          art =>
            art.title.toLowerCase().includes(q) ||
            art.slug.toLowerCase().includes(q) ||
            (art.summary || '').toLowerCase().includes(q)
        )
      : selectedEntry.memberArticles;

    return [...filtered].sort((a, b) => {
      const keyA = resolvePageSortKey(a, selectedEntry.displayName);
      const keyB = resolvePageSortKey(b, selectedEntry.displayName);
      return keyA.localeCompare(keyB, 'pt-BR', { sensitivity: 'base', numeric: true });
    });
  }, [selectedEntry, articleFilter]);

  const selectCategoryByName = (name: string) => {
    const key = normalizeCategoryName(name).toLowerCase();
    if (categoryIndex.has(key)) {
      setSelectedKey(key);
      setArticleFilter('');
    }
  };

  return (
    <div
      data-testid="category-explorer"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Explorador de Categorias (CategoryExplorer)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Selecione uma categoria para listar todos os artigos, subcategorias e metadados associados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
            {allCategories.length} {allCategories.length === 1 ? 'categoria' : 'categorias'}
          </span>

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowHidden(prev => !prev)}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              {showHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>
                {showHidden ? 'Ocultar categorias ocultas' : `Mostrar ocultas (${hiddenCount})`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setSortMode(prev => (prev === 'alpha' ? 'count' : 'alpha'))}
            className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title="Alternar ordenação das categorias"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Ordenar: {sortMode === 'alpha' ? 'A–Z' : 'Mais artigos'}</span>
          </button>
        </div>
      </div>

      {/* Master-Detail Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
        {/* Left Column: All Existing Categories */}
        <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-900/60">
          <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                placeholder="Buscar categoria existente..."
                aria-label="Buscar categoria existente"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div
            role="listbox"
            aria-label="Lista de categorias da enciclopédia"
            className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[520px] overflow-y-auto flex-1"
          >
            {allCategories.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhuma categoria encontrada para &ldquo;{categoryFilter}&rdquo;.
              </div>
            ) : (
              allCategories.map(entry => {
                const isSelected = selectedEntry?.key === entry.key;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setSelectedKey(entry.key);
                      setArticleFilter('');
                    }}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100'
                        : 'hover:bg-white dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isSelected ? (
                        <FolderOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      ) : (
                        <Folder className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                          <span className="truncate">{entry.displayName}</span>
                          {entry.isHidden && (
                            <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400">
                              (oculta)
                            </span>
                          )}
                        </div>
                        {entry.subcategoryKeys.size > 0 && (
                          <div className="text-[11px] text-slate-400 tabular-nums">
                            {entry.subcategoryKeys.size}{' '}
                            {entry.subcategoryKeys.size === 1 ? 'subcategoria' : 'subcategorias'}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[11px] font-mono tabular-nums font-semibold px-2 py-0.5 rounded border ${
                          isSelected
                            ? 'bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {entry.memberArticles.length}{' '}
                        {entry.memberArticles.length === 1 ? 'artigo' : 'artigos'}
                      </span>
                      <ChevronRight
                        className={`w-3.5 h-3.5 ${
                          isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'
                        }`}
                      />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Category Articles */}
        <div className="lg:col-span-7 flex flex-col bg-white dark:bg-slate-900">
          {!selectedEntry ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-slate-400 text-xs space-y-2">
              <Folder className="w-8 h-8 text-slate-300 dark:text-slate-700" />
              <p>Selecione uma categoria à esquerda para visualizar seus artigos associados.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Selected Category Banner */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-mono text-slate-400">
                      Namespace 14 · {buildCategorySlug(selectedEntry.displayName)}
                    </div>
                    <h3 className="text-lg font-serif font-bold text-slate-900 dark:text-slate-100">
                      Categoria: {selectedEntry.displayName}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigateArticle(selectedEntry.slug)}
                    className="px-3 py-1.5 text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>Abrir página da categoria</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                {selectedEntry.categoryArticle?.summary && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {selectedEntry.categoryArticle.summary}
                  </p>
                )}

                {/* Hierarchy: Parent & Subcategories */}
                {(selectedEntry.parentNames.length > 0 || selectedSubcategories.length > 0) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] pt-1">
                    {selectedEntry.parentNames.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <span className="font-semibold">Categorias-mãe:</span>
                        {selectedEntry.parentNames.map((parentName, idx) => (
                          <React.Fragment key={parentName}>
                            {idx > 0 && <span>·</span>}
                            <button
                              type="button"
                              onClick={() => selectCategoryByName(parentName)}
                              className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              {parentName}
                            </button>
                          </React.Fragment>
                        ))}
                      </div>
                    )}

                    {selectedSubcategories.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <span className="font-semibold">Subcategorias:</span>
                        {selectedSubcategories.map((sub, idx) => (
                          <React.Fragment key={sub.key}>
                            {idx > 0 && <span>·</span>}
                            <button
                              type="button"
                              onClick={() => selectCategoryByName(sub.displayName)}
                              className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              {sub.displayName} ({sub.memberArticles.length})
                            </button>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Filter within selected category */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={articleFilter}
                      onChange={e => setArticleFilter(e.target.value)}
                      placeholder={`Filtrar entre ${selectedEntry.memberArticles.length} artigos...`}
                      aria-label="Filtrar artigos na categoria selecionada"
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    Exibindo {sortedMemberArticles.length} de {selectedEntry.memberArticles.length}
                  </span>
                </div>
              </div>

              {/* Associated Articles List */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto max-h-[420px] flex-1">
                {sortedMemberArticles.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    {selectedEntry.memberArticles.length === 0
                      ? 'Esta categoria ainda não possui artigos associados diretamente (verifique subcategorias acima).'
                      : `Nenhum artigo corresponde a "${articleFilter}" nesta categoria.`}
                  </div>
                ) : (
                  sortedMemberArticles.map(article => {
                    const nsMeta = parseTitle(article.slug || article.title);
                    return (
                      <div
                        key={article.slug}
                        className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                            <button
                              type="button"
                              onClick={() => onNavigateArticle(article.slug)}
                              className="text-sm font-bold text-blue-700 dark:text-blue-400 hover:underline text-left cursor-pointer"
                            >
                              {article.title}
                            </button>
                            {nsMeta.namespaceId !== 0 && nsMeta.namespacePrefix && (
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                ({nsMeta.namespacePrefix})
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {buildExcerpt(article)}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-0.5 tabular-nums">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Atualizado em {formatShortDate(article.updatedAt || article.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {article.views || 0} leituras
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 text-xs">
                          {onOpenHistory && (
                            <button
                              type="button"
                              onClick={() => onOpenHistory(article.slug)}
                              className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer whitespace-nowrap"
                            >
                              Histórico
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onNavigateArticle(article.slug)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-800 dark:text-slate-200 rounded transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Ler artigo
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
