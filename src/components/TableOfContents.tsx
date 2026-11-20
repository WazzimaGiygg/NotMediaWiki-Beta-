import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  List,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ArrowUp,
  Search,
} from 'lucide-react';
import { TocItem } from '../types';
import {
  DynamicHeading,
  TocGroup,
  cleanHeadingText,
  extractHeadingsFromHtml,
  groupHeadings,
  slugifyHeading,
} from '../utils/tocParser';

export type { DynamicHeading, TocGroup };

export interface TableOfContentsProps {
  contentRef: React.RefObject<HTMLElement | null>;
  html?: string;
  initialToc?: TocItem[];
  className?: string;
  onNavigateSection?: (id: string) => void;
  defaultAutoCollapse?: boolean;
  variant?: 'sidebar' | 'inline';
  defaultOpen?: boolean;
  title?: string;
}

function buildInitialHeadings(html?: string, initialToc?: TocItem[]): DynamicHeading[] {
  const fromHtml = extractHeadingsFromHtml(html);
  if (fromHtml.length > 0) return fromHtml;

  if (initialToc && initialToc.length > 0) {
    let h2Count = 0;
    let h3Count = 0;
    return initialToc
      .filter(t => (t.level || 2) === 2 || t.level === 3)
      .map(t => {
        const level = (t.level === 3 ? 3 : 2) as 2 | 3;
        if (level === 2) {
          h2Count++;
          h3Count = 0;
        } else {
          h3Count++;
        }
        return {
          id: t.id || slugifyHeading(t.text),
          level,
          text: cleanHeadingText(t.text),
          number: t.number || (level === 2 ? `${h2Count}` : `${h2Count || 1}.${h3Count}`),
        };
      });
  }

  return [];
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({
  contentRef,
  html,
  initialToc = [],
  className = '',
  onNavigateSection,
  defaultAutoCollapse = false,
  variant = 'sidebar',
  defaultOpen,
  title = 'Índice Automático',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(
    defaultOpen !== undefined ? defaultOpen : variant === 'sidebar'
  );
  const [headings, setHeadings] = useState<DynamicHeading[]>(() =>
    buildInitialHeadings(html, initialToc)
  );
  const [activeId, setActiveId] = useState<string>(() => {
    const initial = buildInitialHeadings(html, initialToc);
    return initial[0]?.id || '';
  });
  const [filterQuery, setFilterQuery] = useState('');

  const [autoCollapseEnabled, setAutoCollapseEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('wiki_toc_autocollapse');
      if (saved !== null) return saved === 'true';
    } catch {
      // Ignore storage access errors
    }
    return defaultAutoCollapse;
  });

  const [manualExpandedParents, setManualExpandedParents] = useState<Set<string>>(new Set());
  const [manualCollapsedParents, setManualCollapsedParents] = useState<Set<string>>(new Set());
  const headingElementsRef = useRef<Map<string, HTMLElement>>(new Map());

  const handleToggleAutoCollapse = () => {
    setAutoCollapseEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('wiki_toc_autocollapse', String(next));
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
    setManualExpandedParents(new Set());
    setManualCollapsedParents(new Set());
  };

  // 1. Synchronize H2 & H3 headings from rendered DOM (ensuring every heading has a unique anchor ID)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const parseFromDom = (): DynamicHeading[] | null => {
      const container = contentRef.current;
      if (!container) return null;

      const headingNodes = container.querySelectorAll<HTMLHeadingElement>('h2, h3');
      if (headingNodes.length === 0) return null;

      const map = new Map<string, HTMLElement>();
      const parsed: DynamicHeading[] = [];
      const seenIds = new Set<string>();
      let h2Count = 0;
      let h3Count = 0;

      headingNodes.forEach(node => {
        const rawText = cleanHeadingText(node.innerText || node.textContent || '');
        if (!rawText) return;

        const level = (node.tagName.toLowerCase() === 'h3' ? 3 : 2) as 2 | 3;

        let id = node.id?.trim();
        if (!id || seenIds.has(id)) {
          const generated = id || slugifyHeading(rawText);
          let uniqueId = generated;
          let counter = 1;
          while (
            seenIds.has(uniqueId) ||
            (document.getElementById(uniqueId) && document.getElementById(uniqueId) !== node)
          ) {
            uniqueId = `${generated}-${counter++}`;
          }
          node.id = uniqueId;
          id = uniqueId;
        }

        // Add scroll-margin-top so browser anchor jumps clear the sticky header cleanly
        node.style.scrollMarginTop = '120px';

        seenIds.add(id);
        map.set(id, node);

        let numberStr = '';
        if (level === 2) {
          h2Count++;
          h3Count = 0;
          numberStr = `${h2Count}`;
        } else {
          h3Count++;
          numberStr = h2Count > 0 ? `${h2Count}.${h3Count}` : `${h3Count}`;
        }

        parsed.push({
          id,
          level,
          text: rawText,
          number: numberStr,
        });
      });

      const refSection = document.getElementById('references');
      if (refSection && !seenIds.has('references')) {
        h2Count++;
        parsed.push({
          id: 'references',
          level: 2,
          text: 'Fontes & Referências',
          number: `${h2Count}`,
        });
        map.set('references', refSection);
      }

      headingElementsRef.current = map;
      return parsed;
    };

    const runExtraction = () => {
      const domHeadings = parseFromDom();
      if (domHeadings && domHeadings.length > 0) {
        setHeadings(domHeadings);
        setActiveId(prev =>
          domHeadings.some(h => h.id === prev) ? prev : domHeadings[0]?.id || ''
        );
        return true;
      }
      return false;
    };

    if (!runExtraction()) {
      const fallback = buildInitialHeadings(html, initialToc);
      if (fallback.length > 0) {
        setHeadings(fallback);
        setActiveId(prev =>
          fallback.some(h => h.id === prev) ? prev : fallback[0]?.id || ''
        );
      }
      timer = setTimeout(() => {
        runExtraction();
      }, 60);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [html, contentRef, initialToc]);

  // 2. ScrollSpy: Highlight the currently visible section while scrolling long articles
  useEffect(() => {
    if (headings.length === 0) return;

    const handleScroll = () => {
      const topOffset = 140;
      const scrollPosition = window.scrollY + topOffset;

      let currentActive = headings[0]?.id || '';
      for (let i = 0; i < headings.length; i++) {
        const item = headings[i];
        const el = headingElementsRef.current.get(item.id) || document.getElementById(item.id);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY;
          if (scrollPosition >= top) {
            currentActive = item.id;
          } else {
            break;
          }
        }
      }

      setActiveId(prev => (currentActive && currentActive !== prev ? currentActive : prev));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [headings]);

  const groups = useMemo<TocGroup[]>(() => groupHeadings(headings), [headings]);

  const totalSubSections = useMemo(
    () => groups.reduce((acc, g) => acc + g.subSections.length, 0),
    [groups]
  );

  const isGroupExpanded = (group: TocGroup): boolean => {
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      const parentMatches =
        group.parent.text.toLowerCase().includes(q) || group.parent.number.includes(q);
      const childMatches = group.subSections.some(
        s => s.text.toLowerCase().includes(q) || s.number.includes(q)
      );
      return parentMatches || childMatches;
    }

    if (!autoCollapseEnabled) return true;

    const parentId = group.parent.id;
    if (manualCollapsedParents.has(parentId)) return false;
    if (manualExpandedParents.has(parentId)) return true;

    return activeId === parentId || group.subSections.some(s => s.id === activeId);
  };

  const handleToggleParent = (parentId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    const group = groups.find(g => g.parent.id === parentId);
    if (!group) return;

    if (isGroupExpanded(group)) {
      setManualCollapsedParents(prev => new Set(prev).add(parentId));
      setManualExpandedParents(prev => {
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
    } else {
      setManualExpandedParents(prev => new Set(prev).add(parentId));
      setManualCollapsedParents(prev => {
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
    }
  };

  const handleToggleAllSubsections = () => {
    const parentsWithSubs = groups.filter(g => g.subSections.length > 0);
    const areAllCurrentlyExpanded = parentsWithSubs.every(g => isGroupExpanded(g));
    const allIds = new Set(parentsWithSubs.map(g => g.parent.id));

    if (areAllCurrentlyExpanded) {
      setManualCollapsedParents(allIds);
      setManualExpandedParents(new Set());
    } else {
      setManualExpandedParents(allIds);
      setManualCollapsedParents(new Set());
    }
  };

  // 3. Smooth anchor jump without clobbering the SPA route hash (#/wiki/...)
  const handleScrollToHeading = (id: string, parentId?: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }

    const targetEl = headingElementsRef.current.get(id) || document.getElementById(id);
    if (targetEl) {
      const yOffset = -125;
      const y = targetEl.getBoundingClientRect().top + window.scrollY + yOffset;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      setActiveId(id);

      const targetParentId = parentId || id;
      setManualExpandedParents(prev => new Set(prev).add(targetParentId));
      setManualCollapsedParents(prev => {
        const next = new Set(prev);
        next.delete(targetParentId);
        return next;
      });

      if (variant === 'inline') {
        setIsOpen(false);
      }

      if (onNavigateSection) {
        onNavigateSection(id);
      }
    }
  };

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (headings.length > 0) {
      setActiveId(headings[0].id);
    }
  };

  const filteredGroups = useMemo(() => {
    if (!filterQuery.trim()) return groups;
    const q = filterQuery.toLowerCase();

    return groups
      .map(group => {
        const parentMatches =
          group.parent.text.toLowerCase().includes(q) || group.parent.number.includes(q);
        const matchingSubSections = group.subSections.filter(
          s => s.text.toLowerCase().includes(q) || s.number.includes(q)
        );

        if (parentMatches || matchingSubSections.length > 0) {
          return {
            ...group,
            subSections: parentMatches ? group.subSections : matchingSubSections,
          };
        }
        return null;
      })
      .filter((g): g is TocGroup => g !== null);
  }, [groups, filterQuery]);

  if (headings.length === 0) {
    return null;
  }

  const activeIndex = headings.findIndex(h => h.id === activeId);
  const parentsWithSubs = groups.filter(g => g.subSections.length > 0);
  const areAllExpanded =
    parentsWithSubs.length > 0 && parentsWithSubs.every(g => isGroupExpanded(g));

  return (
    <nav
      aria-label={title}
      data-testid={`wiki-toc-${variant}`}
      className={`border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/80 dark:bg-slate-900/80 text-xs transition-all ${
        variant === 'sidebar' ? 'lg:sticky lg:top-20' : ''
      } ${className}`}
    >
      {/* Header Bar */}
      <div className="px-3.5 py-2.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <List className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-xs tracking-tight flex items-center gap-1.5">
              <span>{title}</span>
              <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 font-normal">
                · {headings.length}
              </span>
            </h2>
            {activeIndex !== -1 && variant === 'sidebar' && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
                Seção {activeIndex + 1} de {headings.length}
              </p>
            )}
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {totalSubSections > 0 && variant === 'sidebar' && (
            <button
              type="button"
              onClick={handleToggleAutoCollapse}
              className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1 border ${
                autoCollapseEnabled
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title={
                autoCollapseEnabled
                  ? 'Auto-recolhimento ativo para subseções H3'
                  : 'Todas as subseções H3 visíveis'
              }
              aria-label="Alternar auto-recolhimento de subseções"
            >
              <ChevronsDownUp className="w-3 h-3 shrink-0" />
            </button>
          )}

          {totalSubSections > 0 && (
            <button
              type="button"
              onClick={handleToggleAllSubsections}
              className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
              title={areAllExpanded ? 'Recolher subseções H3' : 'Expandir subseções H3'}
              aria-label={areAllExpanded ? 'Recolher subseções' : 'Expandir subseções'}
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleScrollToTop}
            className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Voltar ao topo do artigo"
            aria-label="Ir para o topo"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium px-1.5 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-0.5"
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Ocultar tabela de conteúdos' : 'Mostrar tabela de conteúdos'}
          >
            <span>{isOpen ? 'ocultar' : 'mostrar'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable Navigation Body */}
      {isOpen && (
        <div className="p-3 space-y-2.5">
          {headings.length >= 5 && (
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                placeholder="Filtrar seções (H2, H3)..."
                aria-label="Filtrar seções da tabela de conteúdos"
                className="w-full bg-white dark:bg-slate-800 text-[11px] text-slate-800 dark:text-slate-200 pl-7 pr-7 py-1.5 rounded border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:outline-hidden transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  aria-label="Limpar filtro"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          <ol className="max-h-[400px] overflow-y-auto pr-1 text-slate-600 dark:text-slate-300 font-sans custom-scrollbar space-y-0.5">
            {filteredGroups.map(group => {
              const hasSubSections = group.subSections.length > 0;
              const isExpanded = isGroupExpanded(group);
              const isParentActive = activeId === group.parent.id;
              const hasActiveChild = group.subSections.some(s => s.id === activeId);

              return (
                <li key={group.parent.id} className="rounded">
                  <div
                    className={`group/row flex items-center justify-between rounded text-[11.5px] transition-colors leading-snug ${
                      isParentActive
                        ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-900 dark:text-blue-200 font-semibold'
                        : hasActiveChild
                        ? 'bg-blue-50/40 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 font-medium'
                        : 'hover:bg-slate-200/50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {hasSubSections ? (
                      <button
                        type="button"
                        onClick={e => handleToggleParent(group.parent.id, e)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded cursor-pointer shrink-0"
                        aria-label={
                          isExpanded
                            ? `Recolher subseções de ${group.parent.text}`
                            : `Expandir subseções de ${group.parent.text}`
                        }
                        aria-expanded={isExpanded}
                      >
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform duration-150 ${
                            isExpanded ? 'rotate-90 text-blue-600 dark:text-blue-400' : ''
                          }`}
                        />
                      </button>
                    ) : (
                      <span className="w-5 shrink-0" aria-hidden="true" />
                    )}

                    <a
                      href={`#${group.parent.id}`}
                      aria-current={isParentActive ? 'location' : undefined}
                      onClick={e => handleScrollToHeading(group.parent.id, group.parent.id, e)}
                      className="flex-1 py-1.5 pr-2 flex items-center gap-1.5 min-w-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
                      title={`${group.parent.number}. ${group.parent.text}`}
                    >
                      <span
                        className={`font-mono tabular-nums text-[10px] shrink-0 select-none ${
                          isParentActive
                            ? 'text-blue-600 dark:text-blue-400 font-bold'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {group.parent.number}
                      </span>
                      <span className="truncate flex-1">{group.parent.text}</span>
                    </a>
                  </div>

                  {hasSubSections && isExpanded && (
                    <ol className="ml-5 pl-2.5 my-0.5 border-l border-slate-200 dark:border-slate-800 space-y-0.5">
                      {group.subSections.map(subItem => {
                        const isSubActive = activeId === subItem.id;
                        return (
                          <li key={subItem.id}>
                            <a
                              href={`#${subItem.id}`}
                              aria-current={isSubActive ? 'location' : undefined}
                              onClick={e =>
                                handleScrollToHeading(subItem.id, group.parent.id, e)
                              }
                              className={`flex items-start gap-1.5 py-1 px-2 rounded text-[11px] transition-colors cursor-pointer leading-snug focus-visible:outline-2 focus-visible:outline-blue-600 ${
                                isSubActive
                                  ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-900 dark:text-blue-200 font-semibold'
                                  : 'hover:bg-slate-200/40 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100 text-slate-600 dark:text-slate-400'
                              }`}
                              title={`${subItem.number} ${subItem.text}`}
                            >
                              <span
                                className={`font-mono tabular-nums text-[10px] shrink-0 select-none ${
                                  isSubActive
                                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}
                              >
                                {subItem.number}
                              </span>
                              <span className="truncate flex-1">{subItem.text}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </li>
              );
            })}
          </ol>

          {filteredGroups.length === 0 && (
            <div className="py-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
              Nenhuma seção encontrada para &ldquo;{filterQuery}&rdquo;
            </div>
          )}

          <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span className="font-mono">Navegação interna · H2 / H3</span>
            <button
              type="button"
              onClick={handleScrollToTop}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>Topo</span>
              <ArrowUp className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default TableOfContents;
