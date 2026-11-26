import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Layers,
  Tag,
  ExternalLink,
  PlusCircle,
  Search,
  Filter,
} from 'lucide-react';
import { Article } from '../types';
import { CATEGORY_HIERARCHY_PARENTS, buildCategoryIndex } from '../utils/wikiCategories';

interface CategoryNode {
  name: string;
  subcategories: Map<string, CategoryNode>;
  articles: Article[];
}

interface CategoryTreeViewProps {
  articles: Article[];
  currentCategory?: string;
  onNavigateArticle: (slug: string) => void;
  onSelectCategory?: (category: string) => void;
}

export const CategoryTreeView: React.FC<CategoryTreeViewProps> = ({
  articles,
  currentCategory,
  onNavigateArticle,
  onSelectCategory,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    if (currentCategory) init[currentCategory] = true;
    return init;
  });
  const [filterQuery, setFilterQuery] = useState('');

  // Constrói árvore de categorias a partir dos artigos e relações explícitas/convencionais
  const categoryTree = useMemo(() => {
    const index = buildCategoryIndex(articles);
    const rootNodes = new Map<string, CategoryNode>();

    const getOrCreateNode = (catName: string): CategoryNode => {
      if (!rootNodes.has(catName)) {
        rootNodes.set(catName, {
          name: catName,
          subcategories: new Map(),
          articles: [],
        });
      }
      return rootNodes.get(catName)!;
    };

    for (const entry of index.values()) {
      const node = getOrCreateNode(entry.displayName);
      node.articles = [...entry.memberArticles];
    }

    for (const entry of index.values()) {
      const childNode = getOrCreateNode(entry.displayName);
      for (const subKey of entry.subcategoryKeys) {
        const subEntry = index.get(subKey);
        if (subEntry) {
          const subNode = getOrCreateNode(subEntry.displayName);
          childNode.subcategories.set(subEntry.displayName, subNode);
        }
      }

      const fallbackParent = CATEGORY_HIERARCHY_PARENTS[entry.displayName];
      if (fallbackParent && entry.parentNames.length === 0) {
        const parentNode = getOrCreateNode(fallbackParent);
        parentNode.subcategories.set(entry.displayName, childNode);
      }
    }

    return Array.from(rootNodes.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    );
  }, [articles]);

  const toggleNode = (name: string) => {
    setExpandedNodes(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    categoryTree.forEach(node => {
      allExpanded[node.name] = true;
      node.subcategories.forEach((_, subName) => {
        allExpanded[subName] = true;
      });
    });
    setExpandedNodes(allExpanded);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  const filteredTree = useMemo(() => {
    if (!filterQuery.trim()) return categoryTree;
    const q = filterQuery.toLowerCase();
    return categoryTree.filter(
      node =>
        node.name.toLowerCase().includes(q) ||
        node.articles.some(a => a.title.toLowerCase().includes(q))
    );
  }, [categoryTree, filterQuery]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Árvore de Categorias (CategoryTree)</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
              MediaWiki Taxonomy
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Navegação taxonômica hierárquica por subcategorias e páginas enciclopédicas relacionadas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer"
          >
            Expandir tudo
          </button>
          <button
            onClick={collapseAll}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer"
          >
            Recolher tudo
          </button>
        </div>
      </div>

      {/* Filter Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="Filtrar por nome de categoria ou verbete..."
          value={filterQuery}
          onChange={e => setFilterQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Interactive Category Tree */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800 font-sans text-xs">
        {filteredTree.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            Nenhuma categoria encontrada para o filtro atual.
          </div>
        ) : (
          filteredTree.map(node => (
            <CategoryTreeNode
              key={node.name}
              node={node}
              isExpanded={!!expandedNodes[node.name]}
              onToggle={() => toggleNode(node.name)}
              onNavigateArticle={onNavigateArticle}
              onSelectCategory={onSelectCategory}
              isCurrent={currentCategory === node.name}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
            />
          ))
        )}
      </div>
    </div>
  );
};

interface CategoryTreeNodeProps {
  node: CategoryNode;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigateArticle: (slug: string) => void;
  onSelectCategory?: (category: string) => void;
  isCurrent?: boolean;
  expandedNodes: Record<string, boolean>;
  toggleNode: (name: string) => void;
  depth?: number;
}

const CategoryTreeNode: React.FC<CategoryTreeNodeProps> = ({
  node,
  isExpanded,
  onToggle,
  onNavigateArticle,
  onSelectCategory,
  isCurrent,
  expandedNodes,
  toggleNode,
  depth = 0,
}) => {
  const hasChildren = node.subcategories.size > 0 || node.articles.length > 0;

  return (
    <div className={`py-1.5 ${depth > 0 ? 'ml-4 pl-2 border-l border-slate-200 dark:border-slate-800' : ''}`}>
      <div className="flex items-center justify-between group py-1 px-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <button
            onClick={onToggle}
            className={`p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer ${
              !hasChildren ? 'opacity-20 cursor-default' : ''
            }`}
            disabled={!hasChildren}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
          )}

          <button
            onClick={() => onSelectCategory?.(node.name)}
            className={`font-medium truncate text-left cursor-pointer hover:underline ${
              isCurrent
                ? 'text-blue-700 dark:text-blue-400 font-bold'
                : 'text-slate-800 dark:text-slate-200'
            }`}
          >
            Categoria:{node.name}
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 shrink-0">
          {node.subcategories.size > 0 && (
            <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              {node.subcategories.size} subcat
            </span>
          )}
          <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {node.articles.length} páginas
          </span>
        </div>
      </div>

      {/* Expanded Children */}
      {isExpanded && (
        <div className="mt-1 space-y-1">
          {/* Subcategories */}
          {Array.from(node.subcategories.values()).map(sub => (
            <CategoryTreeNode
              key={sub.name}
              node={sub}
              isExpanded={!!expandedNodes[sub.name]}
              onToggle={() => toggleNode(sub.name)}
              onNavigateArticle={onNavigateArticle}
              onSelectCategory={onSelectCategory}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              depth={depth + 1}
            />
          ))}

          {/* Member Pages */}
          {node.articles.map(art => (
            <div
              key={art.slug}
              className="ml-6 pl-2 py-0.5 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <button
                onClick={() => onNavigateArticle(art.slug)}
                className="flex items-center gap-1.5 text-left truncate cursor-pointer hover:underline"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{art.title}</span>
              </button>
              <span className="text-[10px] font-mono text-slate-400 shrink-0 hidden sm:inline">
                {art.namespace === 0 ? 'Artigo' : `NS:${art.namespace}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
