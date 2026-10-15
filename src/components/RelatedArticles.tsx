import React, { useState, useMemo } from 'react';
import { Sparkles, Layers, BookOpen, ArrowRight, Tag, ExternalLink, Hash, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { Article } from '../types';

export interface RelatedArticlesProps {
  currentSlug: string;
  currentArticle?: Article | null;
  categories: string[];
  allArticles: Article[];
  onNavigate: (slug: string) => void;
  className?: string;
  initialCollapsed?: boolean;
}

interface ScoredArticle {
  article: Article;
  overlappingCategories: string[];
  overlapScore: number;
}

export const RelatedArticles: React.FC<RelatedArticlesProps> = ({
  currentSlug,
  currentArticle,
  categories,
  allArticles,
  onNavigate,
  className = '',
  initialCollapsed = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

  // Active article's normalized categories
  const activeCategories = useMemo(() => {
    const list = categories && categories.length > 0 
      ? categories 
      : (currentArticle?.categories || []);
    return Array.from(new Set(list.map(c => c.trim()).filter(Boolean)));
  }, [categories, currentArticle]);

  // Compute all articles with overlapping categories and their match scores
  const relatedArticles: ScoredArticle[] = useMemo(() => {
    if (activeCategories.length === 0 || allArticles.length === 0) {
      return [];
    }

    const lowerActiveCategories = activeCategories.map(c => c.toLowerCase());

    const matches: ScoredArticle[] = [];

    allArticles.forEach(art => {
      // Exclude currently active article
      if (art.slug === currentSlug) return;

      const artCats = art.categories || [];
      const shared: string[] = [];

      artCats.forEach(cat => {
        const trimmed = cat.trim();
        if (!trimmed) return;
        const lower = trimmed.toLowerCase();
        const activeMatch = activeCategories.find(ac => ac.toLowerCase() === lower);
        if (activeMatch && !shared.includes(activeMatch)) {
          shared.push(activeMatch);
        }
      });

      if (shared.length > 0) {
        // Overlap score: primarily number of shared categories, weighted by views as tie-breaker
        const overlapScore = shared.length * 1000 + Math.min(999, Math.floor((art.views || 0) / 100));
        matches.push({
          article: art,
          overlappingCategories: shared,
          overlapScore,
        });
      }
    });

    // Sort descending by match score (most overlapping categories first)
    return matches.sort((a, b) => b.overlapScore - a.overlapScore);
  }, [activeCategories, allArticles, currentSlug]);

  // All distinct overlapping categories found across matches
  const availableOverlapCategories = useMemo(() => {
    const set = new Set<string>();
    relatedArticles.forEach(item => {
      item.overlappingCategories.forEach(cat => set.add(cat));
    });
    return Array.from(set).sort();
  }, [relatedArticles]);

  // Filtered list based on user selecting a specific category chip
  const displayedArticles = useMemo(() => {
    if (!selectedCategoryFilter) return relatedArticles;
    return relatedArticles.filter(item =>
      item.overlappingCategories.some(
        c => c.toLowerCase() === selectedCategoryFilter.toLowerCase()
      )
    );
  }, [relatedArticles, selectedCategoryFilter]);

  return (
    <aside
      aria-label="Artigos Relacionados"
      className={`border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 text-xs shadow-2xs transition-colors ${className}`}
    >
      {/* Header Bar */}
      <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-xs tracking-tight flex items-center gap-1.5">
              <span>Artigos Relacionados</span>
              {relatedArticles.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                  {relatedArticles.length}
                </span>
              )}
            </h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-sans leading-tight">
              Sugestões por categorias em comum
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title={isCollapsed ? 'Expandir artigos relacionados' : 'Recolher artigos relacionados'}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {!isCollapsed && (
        <div className="p-3 space-y-3">
          {/* Active Article Category Context / Chips Filter */}
          {activeCategories.length > 0 && availableOverlapCategories.length > 1 && (
            <div className="space-y-1.5 pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                <span className="flex items-center gap-1">
                  <Filter className="w-2.5 h-2.5" /> Filtrar por categoria:
                </span>
                {selectedCategoryFilter && (
                  <button
                    onClick={() => setSelectedCategoryFilter(null)}
                    className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    limpar filtro
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setSelectedCategoryFilter(null)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-sans transition-colors cursor-pointer ${
                    selectedCategoryFilter === null
                      ? 'bg-blue-600 text-white font-medium shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Todas ({relatedArticles.length})
                </button>
                {availableOverlapCategories.map(cat => {
                  const countForCat = relatedArticles.filter(item =>
                    item.overlappingCategories.some(c => c.toLowerCase() === cat.toLowerCase())
                  ).length;
                  const isActive = selectedCategoryFilter === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategoryFilter(isActive ? null : cat)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-sans flex items-center gap-1 transition-colors cursor-pointer truncate max-w-[140px] ${
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                      title={cat}
                    >
                      <span className="truncate">{cat}</span>
                      <span className={`text-[9px] font-mono ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                        {countForCat}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* List of Suggested Articles */}
          {displayedArticles.length > 0 ? (
            <div className="space-y-2">
              {displayedArticles.map(({ article, overlappingCategories }) => (
                <div
                  key={article.slug}
                  className="group p-2.5 rounded border border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 hover:border-blue-200 dark:hover:border-blue-800/60 transition-all"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <button
                      onClick={() => onNavigate(article.slug)}
                      className="text-left font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors cursor-pointer truncate flex items-center gap-1.5 text-xs"
                      title={article.title}
                    >
                      <BookOpen className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0" />
                      <span className="truncate">{article.title}</span>
                    </button>

                    <span
                      className="shrink-0 text-[10px] font-sans font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/50 border border-blue-200/80 dark:border-blue-800/70 px-1.5 py-0.2 rounded"
                      title={`${overlappingCategories.length} ${
                        overlappingCategories.length === 1 ? 'categoria coincidente' : 'categorias coincidentes'
                      }`}
                    >
                      {overlappingCategories.length}{' '}
                      {overlappingCategories.length === 1 ? 'comum' : 'comuns'}
                    </span>
                  </div>

                  {/* Summary snippet */}
                  {article.summary && (
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {article.summary}
                    </p>
                  )}

                  {/* Overlapping Tags list */}
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans flex items-center gap-0.5">
                      <Hash className="w-2.5 h-2.5" />
                    </span>
                    {overlappingCategories.map(cat => (
                      <span
                        key={cat}
                        className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 truncate max-w-[150px]"
                        title={`Categoria em comum: ${cat}`}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>

                  {/* Action Link */}
                  <div className="mt-2 pt-1.5 border-t border-slate-200/50 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
                    <span className="font-mono">
                      {article.views.toLocaleString()} views
                    </span>
                    <button
                      onClick={() => onNavigate(article.slug)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-0.5 cursor-pointer hover:underline"
                    >
                      <span>Ler artigo</span>
                      <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="py-4 px-2 text-center text-slate-500 dark:text-slate-400 space-y-2">
              <Layers className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
              {activeCategories.length === 0 ? (
                <div className="space-y-1">
                  <p className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                    Sem categorias atribuídas
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal">
                    Este artigo não possui categorias para calcular correspondências com outros verbetes.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                    Nenhum artigo coincidente
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal">
                    Nenhum outro artigo compartilha as categorias deste documento no momento.
                  </p>
                  <div className="pt-1 flex flex-wrap justify-center gap-1">
                    {activeCategories.slice(0, 3).map(c => (
                      <span
                        key={c}
                        className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
