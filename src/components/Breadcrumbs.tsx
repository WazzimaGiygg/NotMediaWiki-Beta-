import React, { useMemo } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Article } from '../types';
import { buildBreadcrumbTrail, BreadcrumbItem } from '../utils/seoManager';

export interface BreadcrumbsProps {
  article: Pick<Article, 'slug' | 'title' | 'categories'>;
  categories?: string[];
  subpageCrumbs?: Array<{ label: string; slug: string }>;
  onNavigate: (slug: string) => void;
  onNavigateHome?: () => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  article,
  categories,
  subpageCrumbs,
  onNavigate,
  onNavigateHome,
}) => {
  const trail = useMemo<BreadcrumbItem[]>(
    () => buildBreadcrumbTrail(article, categories, subpageCrumbs),
    [article.slug, article.title, article.categories, categories, subpageCrumbs]
  );

  const handleItemClick = (e: React.MouseEvent<HTMLAnchorElement>, item: BreadcrumbItem) => {
    e.preventDefault();
    if (item.kind === 'home') {
      if (onNavigateHome) {
        onNavigateHome();
      } else {
        window.location.hash = '#/home';
      }
      return;
    }

    if (item.slug) {
      onNavigate(item.slug);
      return;
    }

    if (item.href.includes('#/special/')) {
      window.location.hash = '#/special/AllPages';
    }
  };

  return (
    <nav
      aria-label="Breadcrumb"
      data-testid="wiki-breadcrumbs"
      className="mb-3 pb-2 border-b border-slate-100 dark:border-slate-800/80 text-xs font-sans text-slate-500 dark:text-slate-400"
    >
      <ol
        itemScope
        itemType="https://schema.org/BreadcrumbList"
        className="flex flex-wrap items-center gap-1"
      >
        {trail.map((item, idx) => {
          const isLast = idx === trail.length - 1;
          return (
            <li
              key={`${item.kind}-${item.position}-${item.label}`}
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
              className="inline-flex items-center gap-1 min-w-0"
            >
              {idx > 0 && (
                <ChevronRight
                  className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0"
                  aria-hidden="true"
                />
              )}

              {isLast ? (
                <span
                  aria-current="page"
                  className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[260px] sm:max-w-md"
                  title={item.label}
                >
                  <span itemProp="name">{item.label}</span>
                  <link itemProp="item" href={item.href} />
                </span>
              ) : (
                <a
                  href={item.href}
                  itemProp="item"
                  onClick={e => handleItemClick(e, item)}
                  className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors truncate max-w-[180px] sm:max-w-[240px]"
                  title={item.kind === 'home' ? 'Página Inicial — NotMediaWiki' : item.label}
                >
                  {item.kind === 'home' && (
                    <Home className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
                  )}
                  <span itemProp="name">{item.label}</span>
                </a>
              )}

              <meta itemProp="position" content={String(item.position)} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
