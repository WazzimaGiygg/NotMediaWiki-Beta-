import React, { useMemo, useState } from 'react';
import {
  ChevronRight,
  Edit3,
  EyeOff,
  FileText,
  Folder,
  FolderTree,
  Search,
  ChevronDown,
} from 'lucide-react';
import { Article } from '../types';
import {
  getCategoryPageDetails,
  groupByInitialLetter,
} from '../utils/wikiCategories';
import { CategoryTreeView } from './CategoryTreeView';

interface CategoryPageViewProps {
  categoryName: string;
  allArticles: Article[];
  onNavigate: (slug: string) => void;
  onEditCategory?: () => void;
  canEdit?: boolean;
  showCategoryTree?: boolean;
}

export const CategoryPageView: React.FC<CategoryPageViewProps> = ({
  categoryName,
  allArticles,
  onNavigate,
  onEditCategory,
  canEdit = true,
  showCategoryTree = true,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [treeExpanded, setTreeExpanded] = useState(false);

  const details = useMemo(
    () => getCategoryPageDetails(categoryName, allArticles),
    [categoryName, allArticles]
  );

  const filteredSubcategories = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return details.subcategoryGroups;
    const matching = details.subcategories.filter(
      s => s.name.toLowerCase().includes(q) || (s.summary && s.summary.toLowerCase().includes(q))
    );
    return groupByInitialLetter(matching, item => item.sortKey);
  }, [details.subcategoryGroups, details.subcategories, filterQuery]);

  const filteredPages = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return details.pageGroups;
    const matching = details.pages.filter(
      p =>
        p.article.title.toLowerCase().includes(q) ||
        p.sortKey.toLowerCase().includes(q) ||
        (p.article.summary && p.article.summary.toLowerCase().includes(q))
    );
    return groupByInitialLetter(matching, item => item.sortKey);
  }, [details.pageGroups, details.pages, filterQuery]);

  const filteredSubCount = filteredSubcategories.reduce((sum, g) => sum + g.items.length, 0);
  const filteredPageCount = filteredPages.reduce((sum, g) => sum + g.items.length, 0);
  const totalItems = details.totalSubcategories + details.totalPages;

  return (
    <section
      aria-label={`Índice da categoria ${details.categoryName}`}
      data-testid="wikipedia-category-page"
      className="mt-4 space-y-6"
    >
      {/* Hidden category archival note */}
      {details.isHidden && (
        <div className="px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2.5">
          <EyeOff className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
          <span>
            Esta é uma <strong className="text-slate-800 dark:text-slate-200">categoria oculta</strong> (<code>__HIDDENCAT__</code>): os artigos associados só a exibem quando a visualização de categorias ocultas está ativa.
          </span>
        </div>
      )}

      {/* Virtual category prompt when no custom description wikitext exists */}
      {details.isVirtual && (
        <div
          data-testid="virtual-category-notice"
          className="px-4 py-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              Página de categoria gerada automaticamente.
            </span>{' '}
            Esta página ainda não possui uma introdução editorial própria, mas já indexa todas as páginas classificadas em{' '}
            <code className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]">
              [[Categoria:{details.categoryName}]]
            </code>
            .
          </div>
          {canEdit && onEditCategory && (
            <button
              type="button"
              onClick={onEditCategory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Criar descrição</span>
            </button>
          )}
        </div>
      )}

      {/* Search filter within category when multiple items exist */}
      {totalItems > 4 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-sans tabular-nums">
            <span>{details.totalSubcategories} {details.totalSubcategories === 1 ? 'subcategoria' : 'subcategorias'}</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>{details.totalPages} {details.totalPages === 1 ? 'página' : 'páginas'}</span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              placeholder={`Filtrar em ${details.categoryName}...`}
              aria-label={`Filtrar páginas na categoria ${details.categoryName}`}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* SECTION 1: Subcategorias */}
      {details.totalSubcategories > 0 && (
        <div id="mw-subcategories" className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1.5">
            Subcategorias
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            Esta categoria contém{' '}
            {filteredSubCount === 1
              ? 'a seguinte subcategoria'
              : `as seguintes ${filteredSubCount} subcategorias`}{' '}
            (de um total de {details.totalSubcategories}).
          </p>

          {filteredSubcategories.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">
              Nenhuma subcategoria corresponde ao filtro atual.
            </p>
          ) : (
            <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-4">
              {filteredSubcategories.map(group => (
                <div key={group.letter} className="break-inside-avoid mb-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1 mb-2 font-serif">
                    {group.letter}
                  </h3>
                  <ul className="space-y-1.5 text-sm">
                    {group.items.map(sub => (
                      <li key={sub.slug} className="flex items-start gap-1.5 leading-snug">
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onNavigate(sub.slug)}
                            className={`text-left hover:underline font-medium cursor-pointer ${
                              sub.exists || sub.pageCount > 0 || sub.subCount > 0
                                ? 'text-blue-700 dark:text-blue-400'
                                : 'text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {sub.name}
                          </button>
                          <span className="ml-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            ({sub.subCount > 0 ? `${sub.subCount} C, ` : ''}
                            {sub.pageCount} {sub.pageCount === 1 ? 'P' : 'P'})
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: Páginas na categoria */}
      <div id="mw-pages" className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1.5">
          Páginas na categoria &ldquo;{details.categoryName}&rdquo;
        </h2>

        {details.totalPages === 0 ? (
          <div className="py-6 px-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <p>
              Ainda não há páginas classificadas diretamente nesta categoria.
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              Para incluir um artigo aqui, adicione{' '}
              <code className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]">
                [[Categoria:{details.categoryName}]]
              </code>{' '}
              ao wikitexto do artigo ou utilize o botão <strong>+ Adicionar categoria</strong> no rodapé de qualquer página.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              {filteredPageCount === 1
                ? 'Esta categoria contém a seguinte página'
                : `Esta categoria contém as seguintes ${filteredPageCount} páginas`}{' '}
              (de um total de {details.totalPages}).
            </p>

            {filteredPages.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                Nenhuma página corresponde ao filtro &ldquo;{filterQuery}&rdquo;.
              </p>
            ) : (
              <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-4 pt-1">
                {filteredPages.map(group => (
                  <div key={group.letter} className="break-inside-avoid mb-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1 mb-2 font-serif">
                      {group.letter}
                    </h3>
                    <ul className="space-y-1.5 text-sm">
                      {group.items.map(({ article, sortKey }) => (
                        <li key={article.slug} className="flex items-start gap-1.5 leading-snug">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onNavigate(article.slug)}
                              title={
                                sortKey !== article.title
                                  ? `${article.title} (chave de ordenação: ${sortKey})`
                                  : article.summary || article.title
                              }
                              className="text-left text-blue-700 dark:text-blue-400 hover:underline font-normal cursor-pointer"
                            >
                              {article.title}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* SECTION 3: Árvore Hierárquica Interativa (CategoryTree) */}
      {showCategoryTree && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setTreeExpanded(prev => !prev)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <span className="inline-flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>Árvore de Subcategorias &amp; Taxonomia ({details.categoryName})</span>
            </span>
            {treeExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <Folder className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {treeExpanded && (
            <div className="mt-3">
              <CategoryTreeView
                articles={allArticles}
                currentCategory={details.categoryName}
                onNavigateArticle={onNavigate}
                onSelectCategory={cat => onNavigate(`Categoria:${cat.replace(/\s+/g, '_')}`)}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
};
