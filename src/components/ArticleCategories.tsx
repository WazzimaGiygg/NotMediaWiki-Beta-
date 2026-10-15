import React, { useState, useMemo } from 'react';
import { Tag, Filter, X, BookOpen, Eye, Calendar, ArrowRight, Layers, Check, Search, Hash } from 'lucide-react';
import { Article } from '../types';

interface ArticleCategoriesProps {
  categories: string[];
  allArticles: Article[];
  currentSlug: string;
  onNavigate: (slug: string) => void;
}

export const ArticleCategories: React.FC<ArticleCategoriesProps> = ({
  categories,
  allArticles,
  currentSlug,
  onNavigate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAllWikiCategories, setShowAllWikiCategories] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // Map of all categories in the wiki with their matching articles
  const categoryMap = useMemo(() => {
    const map = new Map<string, Article[]>();

    allArticles.forEach(art => {
      const artCategories = art.categories || [];
      artCategories.forEach(cat => {
        const trimmed = cat.trim();
        if (!trimmed) return;
        if (!map.has(trimmed)) {
          map.set(trimmed, []);
        }
        map.get(trimmed)!.push(art);
      });
    });

    return map;
  }, [allArticles]);

  // List of all unique categories in the entire wiki
  const allWikiCategories = useMemo(() => {
    return Array.from(categoryMap.keys()).sort();
  }, [categoryMap]);

  // Articles filtered by the currently selected category
  const filteredArticles = useMemo(() => {
    if (!selectedCategory) return [];
    const list = categoryMap.get(selectedCategory) || [];
    if (!categorySearchQuery.trim()) return list;

    const query = categorySearchQuery.toLowerCase();
    return list.filter(
      a =>
        a.title.toLowerCase().includes(query) ||
        (a.summary && a.summary.toLowerCase().includes(query))
    );
  }, [selectedCategory, categoryMap, categorySearchQuery]);

  // Toggle selection
  const handleTagClick = (categoryName: string) => {
    if (selectedCategory === categoryName) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(categoryName);
      setCategorySearchQuery('');
    }
  };

  const handleClearFilter = () => {
    setSelectedCategory(null);
    setCategorySearchQuery('');
  };

  // If there are no categories on this article and wiki has none
  if (categories.length === 0 && allWikiCategories.length === 0) {
    return null;
  }

  return (
    <div className="mt-10 pt-4 border-t border-slate-200 text-xs">
      {/* Category Container Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Categorias deste Artigo:
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              ({categories.length} {categories.length === 1 ? 'tag' : 'tags'})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAllWikiCategories(!showAllWikiCategories)}
              className="text-[11px] font-medium text-blue-700 hover:text-blue-900 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Layers className="w-3 h-3" />
              <span>
                {showAllWikiCategories
                  ? 'Ocultar catálogo geral'
                  : `Explorar todas as categorias (${allWikiCategories.length})`}
              </span>
            </button>
          </div>
        </div>

        {/* Current Article Tags List */}
        <div className="flex flex-wrap items-center gap-2">
          {categories.length > 0 ? (
            categories.map(cat => {
              const count = categoryMap.get(cat)?.length || 0;
              const isSelected = selectedCategory === cat;

              return (
                <button
                  key={cat}
                  onClick={() => handleTagClick(cat)}
                  className={`px-2.5 py-1 rounded text-xs transition-all flex items-center gap-1.5 cursor-pointer font-medium border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-blue-700 border-slate-300'
                  }`}
                  title={`Filtrar artigos da categoria "${cat}" (${count} disponíveis)`}
                >
                  <Hash className={`w-3 h-3 ${isSelected ? 'text-blue-200' : 'text-slate-400'}`} />
                  <span>{cat}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                      isSelected
                        ? 'bg-blue-700 text-blue-100'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                  {isSelected && <X className="w-3 h-3 ml-0.5 text-blue-200 hover:text-white" />}
                </button>
              );
            })
          ) : (
            <span className="text-slate-400 italic">
              Nenhuma categoria associada a este artigo ainda.
            </span>
          )}
        </div>

        {/* Expanded All Wiki Categories view */}
        {showAllWikiCategories && (
          <div className="pt-2 border-t border-slate-200/80 mt-2">
            <div className="text-[11px] font-bold text-slate-600 mb-2 flex items-center gap-1">
              <span>Catálogo Geral de Categorias da Wiki:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {allWikiCategories.map(cat => {
                const count = categoryMap.get(cat)?.length || 0;
                const isSelected = selectedCategory === cat;
                const isCurrentArticleCat = categories.includes(cat);

                return (
                  <button
                    key={cat}
                    onClick={() => handleTagClick(cat)}
                    className={`px-2 py-0.5 rounded text-[11px] transition-all flex items-center gap-1 cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-700'
                        : isCurrentArticleCat
                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className="text-[10px] font-mono opacity-80">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* FILTERED ARTICLES DRAWER / PANEL */}
      {selectedCategory && (
        <div className="mt-4 bg-white border border-blue-200 rounded-lg p-4 shadow-sm space-y-4 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Artigos na Categoria: <span className="text-blue-700 font-serif italic text-base">"{selectedCategory}"</span>
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Exibindo {filteredArticles.length} artigo(s) indexado(s) nesta categoria.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={categorySearchQuery}
                  onChange={e => setCategorySearchQuery(e.target.value)}
                  placeholder="Pesquisar nesta tag..."
                  className="bg-slate-50 border border-slate-200 pl-8 pr-2.5 py-1 rounded text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-500 w-44 sm:w-56"
                />
              </div>

              <button
                onClick={handleClearFilter}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors flex items-center gap-1 cursor-pointer"
                title="Fechar e limpar filtro"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpar filtro</span>
              </button>
            </div>
          </div>

          {/* List of articles in category */}
          {filteredArticles.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 font-sans">
              Nenhum artigo encontrado com o termo pesquisado na categoria "{selectedCategory}".
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredArticles.map(art => {
                const isCurrent = art.slug === currentSlug;

                return (
                  <div
                    key={art.slug}
                    className={`border rounded-lg p-3.5 transition-all flex flex-col justify-between ${
                      isCurrent
                        ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-300'
                        : 'bg-white hover:bg-slate-50/80 border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <button
                          onClick={() => onNavigate(art.slug)}
                          className="text-left font-serif font-bold text-sm text-blue-700 hover:underline hover:text-blue-900 truncate cursor-pointer flex items-center gap-1.5"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate">{art.title}</span>
                        </button>

                        {isCurrent ? (
                          <span className="text-[10px] font-sans font-medium text-blue-800 bg-blue-100 px-1.5 py-0.2 rounded shrink-0">
                            (Artigo atual)
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {art.namespace === 0 ? 'Artigo' : 'Discussão'}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2 font-serif leading-relaxed mb-2.5">
                        {art.summary || 'Sem resumo cadastrado para esta página.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-sans">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 font-mono">
                          <Eye className="w-3 h-3 text-slate-400" />
                          {art.views?.toLocaleString() || 0}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(art.updatedAt || art.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {!isCurrent && (
                        <button
                          onClick={() => onNavigate(art.slug)}
                          className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-0.5 hover:underline cursor-pointer"
                        >
                          <span>Ler artigo</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
