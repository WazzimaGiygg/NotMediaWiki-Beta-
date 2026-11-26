import React, { useState, useMemo } from 'react';
import {
  Tag,
  Filter,
  X,
  BookOpen,
  Eye,
  EyeOff,
  Calendar,
  ArrowRight,
  Layers,
  Search,
  Plus,
  Check,
} from 'lucide-react';
import { Article } from '../types';
import {
  buildCategoryIndex,
  buildCategorySlug,
  normalizeCategoryName,
} from '../utils/wikiCategories';

interface ArticleCategoriesProps {
  categories: string[];
  allArticles: Article[];
  currentSlug: string;
  onNavigate: (slug: string) => void;
  canEdit?: boolean;
  onAddCategory?: (categoryName: string) => Promise<void> | void;
  onRemoveCategory?: (categoryName: string) => Promise<void> | void;
}

export const ArticleCategories: React.FC<ArticleCategoriesProps> = ({
  categories,
  allArticles,
  currentSlug,
  onNavigate,
  canEdit = false,
  onAddCategory,
  onRemoveCategory,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAllWikiCategories, setShowAllWikiCategories] = useState(false);
  const [showHiddenCategories, setShowHiddenCategories] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // HotCat-style quick category adder state
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryActionError, setCategoryActionError] = useState<string | null>(null);

  const categoryIndex = useMemo(() => buildCategoryIndex(allArticles), [allArticles]);

  // Normalized unique categories for this article, split into visible vs hidden (__HIDDENCAT__)
  const { visibleCategories, hiddenCategories } = useMemo(() => {
    const visible: string[] = [];
    const hidden: string[] = [];
    const seen = new Set<string>();

    for (const raw of categories) {
      const clean = normalizeCategoryName(raw);
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const entry = categoryIndex.get(key);
      if (entry?.isHidden) {
        hidden.push(entry.displayName);
      } else {
        visible.push(entry?.displayName || clean);
      }
    }

    return { visibleCategories: visible, hiddenCategories: hidden };
  }, [categories, categoryIndex]);

  // List of all unique visible categories in the entire wiki (for Explorer & autocomplete)
  const allWikiCategories = useMemo(() => {
    return Array.from(categoryIndex.values())
      .filter(entry => !entry.isHidden && (entry.memberArticles.length > 0 || entry.categoryArticle))
      .map(entry => entry.displayName)
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [categoryIndex]);

  const autocompleteSuggestions = useMemo(() => {
    const q = newCategoryInput.trim().toLowerCase();
    const existingKeys = new Set(
      [...visibleCategories, ...hiddenCategories].map(c => c.toLowerCase())
    );
    return allWikiCategories
      .filter(c => !existingKeys.has(c.toLowerCase()))
      .filter(c => !q || c.toLowerCase().includes(q))
      .slice(0, 6);
  }, [allWikiCategories, visibleCategories, hiddenCategories, newCategoryInput]);

  // Articles filtered by the currently selected category in quick drawer
  const filteredArticles = useMemo(() => {
    if (!selectedCategory) return [];
    const entry = categoryIndex.get(selectedCategory.toLowerCase());
    const list = entry?.memberArticles || [];
    if (!categorySearchQuery.trim()) return list;

    const query = categorySearchQuery.toLowerCase();
    return list.filter(
      a =>
        a.title.toLowerCase().includes(query) ||
        (a.summary && a.summary.toLowerCase().includes(query))
    );
  }, [selectedCategory, categoryIndex, categorySearchQuery]);

  const handleToggleQuickFilter = (categoryName: string) => {
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

  const handleSubmitNewCategory = async (catToAdd?: string) => {
    if (!onAddCategory) return;
    const clean = normalizeCategoryName(catToAdd ?? newCategoryInput);
    if (!clean) return;

    setSavingCategory(true);
    setCategoryActionError(null);
    try {
      await onAddCategory(clean);
      setNewCategoryInput('');
      setIsAddingCategory(false);
    } catch (err: any) {
      setCategoryActionError(err?.message || 'Não foi possível adicionar a categoria.');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleRemove = async (cat: string) => {
    if (!onRemoveCategory) return;
    setSavingCategory(true);
    setCategoryActionError(null);
    try {
      await onRemoveCategory(cat);
    } catch (err: any) {
      setCategoryActionError(err?.message || 'Não foi possível remover a categoria.');
    } finally {
      setSavingCategory(false);
    }
  };

  if (
    visibleCategories.length === 0 &&
    hiddenCategories.length === 0 &&
    allWikiCategories.length === 0 &&
    !(canEdit && onAddCategory)
  ) {
    return null;
  }

  const renderCategoryItem = (cat: string, idx: number, listLength: number) => {
    const entry = categoryIndex.get(cat.toLowerCase());
    const count = entry?.memberArticles.length || 0;
    const hasCategoryDoc = Boolean(entry?.categoryArticle);
    const isPopulated = hasCategoryDoc || count > 0;
    const isFiltered = selectedCategory?.toLowerCase() === cat.toLowerCase();

    return (
      <React.Fragment key={cat}>
        {idx > 0 && (
          <span className="text-slate-300 dark:text-slate-600 select-none" aria-hidden="true">
            |
          </span>
        )}
        <span className="inline-flex items-center gap-1 group">
          <a
            href={`#/wiki/${encodeURIComponent(buildCategorySlug(cat))}`}
            onClick={e => {
              e.preventDefault();
              onNavigate(buildCategorySlug(cat));
            }}
            title={
              hasCategoryDoc
                ? `Categoria:${cat} (${count} página(s))`
                : `Categoria:${cat} (${count} página(s) · página descritiva ainda não criada)`
            }
            className={`hover:underline font-medium transition-colors ${
              isPopulated
                ? 'text-blue-700 dark:text-blue-400'
                : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {cat}
          </a>

          <button
            type="button"
            onClick={() => handleToggleQuickFilter(cat)}
            aria-label={`Pré-visualizar páginas da categoria ${cat}`}
            title={`Pré-visualizar ${count} página(s) de "${cat}" nesta tela`}
            className={`inline-flex items-center gap-0.5 text-[11px] font-mono tabular-nums px-1 py-0.5 rounded transition-colors cursor-pointer ${
              isFiltered
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>({count})</span>
            <Filter className="w-2.5 h-2.5" aria-hidden="true" />
          </button>

          {canEdit && onRemoveCategory && (
            <button
              type="button"
              disabled={savingCategory}
              onClick={() => handleRemove(cat)}
              aria-label={`Remover categoria ${cat}`}
              title={`Remover categoria "${cat}"`}
              className="p-0.5 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-40"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </span>
        {idx === listLength - 1 ? null : null}
      </React.Fragment>
    );
  };

  return (
    <div id="catlinks" data-testid="article-catlinks" className="mt-10 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
      {/* Wikipedia-style Category Container Box */}
      <nav
        aria-label="Categorias da página"
        className="bg-stone-50/75 dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 space-y-2.5"
      >
        {/* Visible Categories Row (Wikipedia #mw-normal-catlinks) */}
        <div id="mw-normal-catlinks" className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 leading-relaxed">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200 shrink-0">
              <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
              <button
                type="button"
                onClick={() => onNavigate('Especial:Categorias')}
                className="hover:underline text-slate-800 dark:text-slate-200 cursor-pointer"
                title="Abrir índice geral de categorias"
              >
                {visibleCategories.length === 1 ? 'Categoria' : 'Categorias'}:
              </button>
            </span>

            {visibleCategories.length > 0 ? (
              visibleCategories.map((cat, idx) =>
                renderCategoryItem(cat, idx, visibleCategories.length)
              )
            ) : (
              <span className="text-slate-500 dark:text-slate-400 italic">
                Nenhuma categoria atribuída a esta página.
              </span>
            )}

            {/* HotCat-style Quick Add (+) trigger */}
            {canEdit && onAddCategory && !isAddingCategory && (
              <button
                type="button"
                onClick={() => {
                  setIsAddingCategory(true);
                  setCategoryActionError(null);
                }}
                data-testid="quick-add-category-btn"
                title="Adicionar categoria rapidamente a esta página"
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ml-1"
              >
                <Plus className="w-3 h-3" />
                <span>Adicionar categoria</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowAllWikiCategories(!showAllWikiCategories)}
            className="text-[11px] font-medium text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Layers className="w-3 h-3" aria-hidden="true" />
            <span>
              {showAllWikiCategories
                ? 'Ocultar catálogo geral'
                : `Explorar categorias (${allWikiCategories.length})`}
            </span>
          </button>
        </div>

        {/* Inline HotCat Quick-Add Form */}
        {isAddingCategory && canEdit && onAddCategory && (
          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSubmitNewCategory();
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                type="text"
                value={newCategoryInput}
                onChange={e => setNewCategoryInput(e.target.value)}
                placeholder="Nome da categoria (ex: Software Livre)..."
                aria-label="Nome da nova categoria"
                autoFocus
                className="flex-1 min-w-[200px] px-2.5 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={savingCategory || !newCategoryInput.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{savingCategory ? 'Salvando...' : 'Salvar'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingCategory(false);
                  setNewCategoryInput('');
                  setCategoryActionError(null);
                }}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </form>

            {autocompleteSuggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span>Sugestões existentes:</span>
                {autocompleteSuggestions.map(sug => (
                  <button
                    key={sug}
                    type="button"
                    disabled={savingCategory}
                    onClick={() => handleSubmitNewCategory(sug)}
                    className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer"
                  >
                    + {sug}
                  </button>
                ))}
              </div>
            )}

            {categoryActionError && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400">{categoryActionError}</p>
            )}
          </div>
        )}

        {/* Hidden Categories Row (Wikipedia #mw-hidden-catlinks) */}
        {hiddenCategories.length > 0 && (
          <div
            id="mw-hidden-catlinks"
            className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400"
          >
            <span className="inline-flex items-center gap-1 font-medium">
              <EyeOff className="w-3 h-3" aria-hidden="true" />
              <span>
                {hiddenCategories.length === 1 ? 'Categoria oculta' : 'Categorias ocultas'}:
              </span>
            </span>

            <button
              type="button"
              onClick={() => setShowHiddenCategories(prev => !prev)}
              className="text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
            >
              [{showHiddenCategories ? 'ocultar' : `mostrar ${hiddenCategories.length}`}]
            </button>

            {showHiddenCategories &&
              hiddenCategories.map((cat, idx) => renderCategoryItem(cat, idx, hiddenCategories.length))}
          </div>
        )}

        {/* Expanded All Wiki Categories Explorer */}
        {showAllWikiCategories && (
          <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-800 mt-1 space-y-2">
            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Catálogo Geral de Categorias da Wiki (clique para abrir ou filtrar):
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {allWikiCategories.map(cat => {
                const count = categoryIndex.get(cat.toLowerCase())?.memberArticles.length || 0;
                const isSelected = selectedCategory?.toLowerCase() === cat.toLowerCase();
                const isCurrentArticleCat = visibleCategories.some(
                  c => c.toLowerCase() === cat.toLowerCase()
                );

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleToggleQuickFilter(cat)}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors flex items-center gap-1 cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-700'
                        : isCurrentArticleCat
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className="text-[10px] font-mono tabular-nums opacity-80">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* FILTERED ARTICLES DRAWER / PANEL */}
      {selectedCategory && (
        <div className="mt-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/70 rounded-lg p-4 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Páginas em:{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate(buildCategorySlug(selectedCategory))}
                    className="text-blue-700 dark:text-blue-400 hover:underline font-serif italic text-base cursor-pointer"
                  >
                    Categoria:{selectedCategory}
                  </button>
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                Exibindo {filteredArticles.length} página(s) ·{' '}
                <button
                  type="button"
                  onClick={() => onNavigate(buildCategorySlug(selectedCategory))}
                  className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Abrir página completa da categoria
                </button>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  type="text"
                  value={categorySearchQuery}
                  onChange={e => setCategorySearchQuery(e.target.value)}
                  placeholder="Pesquisar nesta categoria..."
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-8 pr-2.5 py-1 rounded text-xs text-slate-800 dark:text-slate-200 outline-hidden focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 w-44 sm:w-56"
                />
              </div>

              <button
                type="button"
                onClick={handleClearFilter}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded transition-colors flex items-center gap-1 cursor-pointer"
                title="Fechar pré-visualização"
              >
                <X className="w-3.5 h-3.5" />
                <span>Fechar</span>
              </button>
            </div>
          </div>

          {filteredArticles.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 font-sans">
              Nenhuma página encontrada com o termo pesquisado na categoria &ldquo;{selectedCategory}&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredArticles.map(art => {
                const isCurrent = art.slug === currentSlug;

                return (
                  <div
                    key={art.slug}
                    className={`border rounded-lg p-3.5 transition-colors flex flex-col justify-between ${
                      isCurrent
                        ? 'bg-blue-50/40 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800'
                        : 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <button
                          type="button"
                          onClick={() => onNavigate(art.slug)}
                          className="text-left font-serif font-bold text-sm text-blue-700 dark:text-blue-400 hover:underline truncate cursor-pointer flex items-center gap-1.5"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span className="truncate">{art.title}</span>
                        </button>

                        {isCurrent ? (
                          <span className="text-[10px] font-sans font-medium text-blue-800 dark:text-blue-300 shrink-0">
                            (Página atual)
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {art.namespace === 0 ? 'Artigo' : `NS:${art.namespace}`}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 font-serif leading-relaxed mb-2.5">
                        {art.summary || 'Sem resumo cadastrado para esta página.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-sans tabular-nums">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 font-mono">
                          <Eye className="w-3 h-3 text-slate-400" />
                          {art.views?.toLocaleString() || 0}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(art.updatedAt || art.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => onNavigate(art.slug)}
                          className="text-blue-600 dark:text-blue-400 font-medium inline-flex items-center gap-0.5 hover:underline cursor-pointer"
                        >
                          <span>Abrir</span>
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
