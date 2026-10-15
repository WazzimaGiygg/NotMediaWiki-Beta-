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
  Layers,
  Sparkles,
} from 'lucide-react';
import { TocItem } from '../types';

export interface TableOfContentsProps {
  contentRef: React.RefObject<HTMLElement | null>;
  html?: string;
  initialToc?: TocItem[];
  className?: string;
  onNavigateSection?: (id: string) => void;
  defaultAutoCollapse?: boolean;
}

export interface DynamicHeading {
  id: string;
  level: number;
  text: string;
  number: string;
}

export interface TocGroup {
  parent: DynamicHeading;
  subSections: DynamicHeading[];
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({
  contentRef,
  html,
  initialToc = [],
  className = '',
  onNavigateSection,
  defaultAutoCollapse = true,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [headings, setHeadings] = useState<DynamicHeading[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [filterQuery, setFilterQuery] = useState('');

  // Auto-collapse preference: stored in localStorage, defaults to true for mobile readability
  const [autoCollapseEnabled, setAutoCollapseEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('wiki_toc_autocollapse');
      if (saved !== null) {
        return saved === 'true';
      }
    } catch {
      // ignore localStorage error
    }
    return defaultAutoCollapse;
  });

  // Track manual expand/collapse actions per parent ID
  const [manualExpandedParents, setManualExpandedParents] = useState<Set<string>>(new Set());
  const [manualCollapsedParents, setManualCollapsedParents] = useState<Set<string>>(new Set());

  const headingElementsRef = useRef<Map<string, HTMLElement>>(new Map());

  // Helper to slugify text into valid DOM ID
  const slugify = (text: string): string => {
    return (
      text
        .toLowerCase()
        .replace(/<[^>]+>/g, '') // remove HTML tags
        .replace(/[^\p{L}\p{N}]+/gu, '-') // replace non-alphanumeric with dash
        .replace(/(^-|-$)/g, '') || 'section'
    );
  };

  // Toggle auto-collapse mode and persist to localStorage
  const handleToggleAutoCollapse = () => {
    setAutoCollapseEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('wiki_toc_autocollapse', String(next));
      } catch {
        // ignore storage write errors
      }
      return next;
    });
    // Reset manual overrides so auto-collapse applies cleanly
    setManualExpandedParents(new Set());
    setManualCollapsedParents(new Set());
  };

  // 1. Dynamic parser: Extract H2, H3 (and H4) elements from article DOM or HTML
  useEffect(() => {
    let timer: NodeJS.Timeout;

    const parseFromDom = () => {
      const container = contentRef.current;
      if (!container) return null;

      const headingNodes = container.querySelectorAll<HTMLHeadingElement>('h2, h3, h4');
      if (headingNodes.length === 0) return null;

      const map = new Map<string, HTMLElement>();
      const parsed: DynamicHeading[] = [];
      let h2Count = 0;
      let h3Count = 0;
      let h4Count = 0;
      const seenIds = new Set<string>();

      headingNodes.forEach(node => {
        let rawText = node.innerText || node.textContent || '';
        // Remove trailing '#' permalink anchors or whitespace
        rawText = rawText.replace(/#\s*$/, '').trim();
        if (!rawText) return;

        const tagName = node.tagName.toLowerCase();
        const level = tagName === 'h2' ? 2 : tagName === 'h3' ? 3 : 4;

        // Ensure element has a solid ID for anchor jumping
        let id = node.id;
        if (!id) {
          const generated = slugify(rawText);
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
        seenIds.add(id);
        map.set(id, node);

        // Compute hierarchical section numbering (e.g. 1, 1.1, 1.1.1, 2)
        let numberStr = '';
        if (level === 2) {
          h2Count++;
          h3Count = 0;
          h4Count = 0;
          numberStr = `${h2Count}`;
        } else if (level === 3) {
          h3Count++;
          h4Count = 0;
          numberStr = h2Count > 0 ? `${h2Count}.${h3Count}` : `${h3Count}`;
        } else {
          h4Count++;
          numberStr =
            h2Count > 0
              ? `${h2Count}.${h3Count > 0 ? h3Count : 1}.${h4Count}`
              : `${h3Count}.${h4Count}`;
        }

        parsed.push({
          id,
          level,
          text: rawText,
          number: numberStr,
        });
      });

      // Also detect and include Footnotes / References section if present on page
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
        setActiveId(prev => prev || domHeadings[0]?.id || '');
        return true;
      }
      return false;
    };

    // Run immediately
    const extracted = runExtraction();

    // If not found yet (e.g. DOM still mounting dangerouslySetInnerHTML), retry on next tick
    if (!extracted) {
      timer = setTimeout(() => {
        const retryResult = runExtraction();
        if (!retryResult && html) {
          try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const nodes = doc.querySelectorAll('h2, h3, h4');
            const parsed: DynamicHeading[] = [];
            let h2Count = 0;
            let h3Count = 0;
            let h4Count = 0;

            nodes.forEach(node => {
              let text = (node.textContent || '').replace(/#\s*$/, '').trim();
              if (!text) return;
              const tagName = node.tagName.toLowerCase();
              const level = tagName === 'h2' ? 2 : tagName === 'h3' ? 3 : 4;
              const id = node.id || slugify(text);

              let numberStr = '';
              if (level === 2) {
                h2Count++;
                h3Count = 0;
                h4Count = 0;
                numberStr = `${h2Count}`;
              } else if (level === 3) {
                h3Count++;
                h4Count = 0;
                numberStr = h2Count > 0 ? `${h2Count}.${h3Count}` : `${h3Count}`;
              } else {
                h4Count++;
                numberStr = `${h2Count}.${h3Count}.${h4Count}`;
              }

              parsed.push({ id, level, text, number: numberStr });
            });

            if (parsed.length > 0) {
              setHeadings(parsed);
              setActiveId(prev => prev || parsed[0]?.id || '');
              return;
            }
          } catch (err) {
            console.warn('Fallback HTML parser failed in TOC:', err);
          }

          if (initialToc && initialToc.length > 0) {
            const filtered = initialToc.map(t => ({
              id: t.id,
              level: t.level || 2,
              text: t.text,
              number: t.number,
            }));
            setHeadings(filtered);
            setActiveId(prev => prev || filtered[0]?.id || '');
          }
        }
      }, 50);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [html, contentRef, initialToc]);

  // 2. ScrollSpy: Track active heading dynamically as the user scrolls
  useEffect(() => {
    if (headings.length === 0) return;

    const handleScroll = () => {
      const topOffset = 140; // Header + progress bar offset
      const scrollPosition = window.scrollY + topOffset;

      let currentActive = headings[0]?.id || '';

      for (let i = 0; i < headings.length; i++) {
        const item = headings[i];
        const el = document.getElementById(item.id);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY;
          if (scrollPosition >= top) {
            currentActive = item.id;
          } else {
            break;
          }
        }
      }

      if (currentActive && currentActive !== activeId) {
        setActiveId(currentActive);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [headings, activeId]);

  // Group flat headings into Hierarchical Parent Groups
  const groups = useMemo<TocGroup[]>(() => {
    const result: TocGroup[] = [];
    let currentGroup: TocGroup | null = null;

    headings.forEach(heading => {
      if (heading.level <= 2) {
        currentGroup = {
          parent: heading,
          subSections: [],
        };
        result.push(currentGroup);
      } else {
        if (currentGroup) {
          currentGroup.subSections.push(heading);
        } else {
          // Orphan sub-heading before any H2
          currentGroup = {
            parent: heading,
            subSections: [],
          };
          result.push(currentGroup);
        }
      }
    });

    return result;
  }, [headings]);

  // Total count of sub-sections across all groups
  const totalSubSections = useMemo(() => {
    return groups.reduce((acc, g) => acc + g.subSections.length, 0);
  }, [groups]);

  // Determine which parent sections should have their sub-sections expanded
  const isGroupExpanded = (group: TocGroup): boolean => {
    // If search filter is active, automatically expand any group that matches
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      const parentMatches =
        group.parent.text.toLowerCase().includes(q) || group.parent.number.includes(q);
      const childMatches = group.subSections.some(
        s => s.text.toLowerCase().includes(q) || s.number.includes(q)
      );
      return parentMatches || childMatches;
    }

    // If auto-collapse is globally disabled by user, show all sub-sections
    if (!autoCollapseEnabled) {
      return true;
    }

    const parentId = group.parent.id;

    // Explicit manual toggle overrides
    if (manualCollapsedParents.has(parentId)) {
      return false;
    }
    if (manualExpandedParents.has(parentId)) {
      return true;
    }

    // Auto-collapse behavior:
    // Automatically expand the group if the user is currently reading/scrolling inside it!
    const isActiveInGroup =
      activeId === parentId || group.subSections.some(s => s.id === activeId);

    return isActiveInGroup;
  };

  // Toggle manual expansion of a specific parent group
  const handleToggleParent = (parentId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    const group = groups.find(g => g.parent.id === parentId);
    if (!group) return;

    const currentlyExpanded = isGroupExpanded(group);

    if (currentlyExpanded) {
      // Collapse it
      setManualCollapsedParents(prev => new Set(prev).add(parentId));
      setManualExpandedParents(prev => {
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
    } else {
      // Expand it
      setManualExpandedParents(prev => new Set(prev).add(parentId));
      setManualCollapsedParents(prev => {
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
    }
  };

  // Quick action: Expand All / Collapse All sub-sections
  const handleToggleAllSubsections = () => {
    const parentWithSubs = groups.filter(g => g.subSections.length > 0);
    const areAllCurrentlyExpanded = parentWithSubs.every(g => isGroupExpanded(g));

    if (areAllCurrentlyExpanded) {
      // Collapse all
      const allIds = new Set(parentWithSubs.map(g => g.parent.id));
      setManualCollapsedParents(allIds);
      setManualExpandedParents(new Set());
    } else {
      // Expand all
      const allIds = new Set(parentWithSubs.map(g => g.parent.id));
      setManualExpandedParents(allIds);
      setManualCollapsedParents(new Set());
    }
  };

  // 3. Quick navigation smooth-scroll action
  const handleScrollToHeading = (id: string, parentId?: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }

    const targetEl = document.getElementById(id);
    if (targetEl) {
      const yOffset = -125; // Margin below sticky reading bar
      const y = targetEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      setActiveId(id);

      // If user jumped to a parent heading, make sure its sub-sections expand so they are accessible
      const targetParentId = parentId || id;
      setManualExpandedParents(prev => new Set(prev).add(targetParentId));
      setManualCollapsedParents(prev => {
        const next = new Set(prev);
        next.delete(targetParentId);
        return next;
      });

      // Update URL hash without full page jump reload
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', `#${id}`);
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

  // Filter groups based on search query
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

  // Active section index for progress stats
  const activeIndex = headings.findIndex(h => h.id === activeId);

  // Check if all sub-sections are expanded for the toggle all button
  const parentsWithSubs = groups.filter(g => g.subSections.length > 0);
  const areAllExpanded =
    parentsWithSubs.length > 0 && parentsWithSubs.every(g => isGroupExpanded(g));

  return (
    <nav
      aria-label="Tabela de Conteúdo"
      className={`border border-slate-200 dark:border-slate-800 rounded bg-slate-50/70 dark:bg-slate-900/70 text-xs shadow-2xs transition-all ${className}`}
    >
      {/* Header Bar */}
      <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
            <List className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-xs tracking-tight flex items-center gap-1.5">
              <span>Conteúdo</span>
              <span
                className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium"
                title={`${headings.length} seções totais (${totalSubSections} subseções)`}
              >
                {headings.length}
              </span>
            </h2>
            {activeIndex !== -1 && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate max-w-[170px]">
                Seção {activeIndex + 1} de {headings.length}
              </p>
            )}
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-1">
          {/* Auto-collapse Mode Toggle Button */}
          {totalSubSections > 0 && (
            <button
              onClick={handleToggleAutoCollapse}
              className={`p-1 px-1.5 rounded text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1 border ${
                autoCollapseEnabled
                  ? 'bg-blue-50/80 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title={
                autoCollapseEnabled
                  ? 'Auto-recolhimento ativo: subseções profundas minimizadas para otimizar leitura em telas pequenas/mobile. Clique para desativar.'
                  : 'Auto-recolhimento desativado: todas as subseções exibidas. Clique para ativar auto-recolher.'
              }
              aria-label="Alternar auto-recolhimento de subseções"
            >
              <ChevronsDownUp className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">
                {autoCollapseEnabled ? 'Auto-recolher' : 'Expandido'}
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  autoCollapseEnabled ? 'bg-blue-600 dark:bg-blue-400' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              />
            </button>
          )}

          {/* Quick Expand All / Collapse All Sub-sections */}
          {totalSubSections > 0 && (
            <button
              onClick={handleToggleAllSubsections}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
              title={
                areAllExpanded
                  ? 'Recolher todas as subseções'
                  : 'Expandir todas as subseções'
              }
              aria-label={areAllExpanded ? 'Recolher subseções' : 'Expandir subseções'}
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Quick jump to article top */}
          <button
            onClick={handleScrollToTop}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Voltar ao topo da página"
            aria-label="Ir para o topo"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>

          {/* Main TOC Collapse/Expand Toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium px-1.5 py-0.5 rounded hover:bg-blue-50/60 dark:hover:bg-blue-950/50 transition-colors cursor-pointer flex items-center gap-0.5"
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Ocultar tabela de conteúdo' : 'Mostrar tabela de conteúdo'}
          >
            <span>{isOpen ? 'ocultar' : 'mostrar'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable Navigation Body */}
      {isOpen && (
        <div className="p-3 space-y-2.5">
          {/* Quick search filter for long articles (shows if 5+ headings) */}
          {headings.length >= 5 && (
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                placeholder="Filtrar seções e subseções..."
                className="w-full bg-white dark:bg-slate-800 text-[11px] text-slate-800 dark:text-slate-200 pl-7 pr-7 py-1 rounded border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:outline-hidden transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                  aria-label="Limpar filtro"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Hierarchical Headings Tree */}
          <div className="max-h-[380px] overflow-y-auto pr-1 text-slate-600 dark:text-slate-300 font-sans custom-scrollbar space-y-1">
            {filteredGroups.map(group => {
              const hasSubSections = group.subSections.length > 0;
              const isExpanded = isGroupExpanded(group);
              const isParentActive = activeId === group.parent.id;
              const hasActiveChild = group.subSections.some(s => s.id === activeId);

              return (
                <div key={group.parent.id} className="rounded transition-all">
                  {/* Parent Section Row */}
                  <div
                    className={`group/row flex items-center justify-between rounded text-[11.5px] transition-all leading-snug ${
                      isParentActive
                        ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-900 dark:text-blue-200 font-semibold border-l-2 border-blue-600 dark:border-blue-400 shadow-2xs'
                        : hasActiveChild
                        ? 'bg-blue-50/40 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 font-medium'
                        : 'hover:bg-slate-200/50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {/* Expand/Collapse Chevron for parents with sub-sections */}
                    {hasSubSections ? (
                      <button
                        onClick={e => handleToggleParent(group.parent.id, e)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-100/40 dark:hover:bg-blue-900/40 rounded transition-transform cursor-pointer shrink-0 self-center"
                        title={
                          isExpanded
                            ? `Recolher ${group.subSections.length} subseções de ${group.parent.text}`
                            : `Expandir ${group.subSections.length} subseções de ${group.parent.text}`
                        }
                        aria-label={
                          isExpanded
                            ? `Recolher subseções de ${group.parent.text}`
                            : `Expandir subseções de ${group.parent.text}`
                        }
                        aria-expanded={isExpanded}
                      >
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            isExpanded ? 'rotate-90 text-blue-600 dark:text-blue-400' : ''
                          }`}
                        />
                      </button>
                    ) : (
                      <span className="w-5 shrink-0" aria-hidden="true" />
                    )}

                    {/* Section Navigation Link */}
                    <a
                      href={`#${group.parent.id}`}
                      onClick={e => handleScrollToHeading(group.parent.id, group.parent.id, e)}
                      className="flex-1 py-1 pr-1.5 flex items-center gap-1.5 min-w-0 cursor-pointer"
                      title={`${group.parent.number} ${group.parent.text}`}
                    >
                      {/* Section Number Badge */}
                      <span
                        className={`font-mono text-[10px] shrink-0 select-none ${
                          isParentActive
                            ? 'text-blue-600 dark:text-blue-400 font-bold'
                            : 'text-slate-400 dark:text-slate-500 group-hover/row:text-slate-600 dark:group-hover/row:text-slate-400'
                        }`}
                      >
                        {group.parent.number}
                      </span>

                      {/* Section Title */}
                      <span className="truncate flex-1 font-medium">{group.parent.text}</span>

                      {/* Active indicator dot */}
                      {isParentActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0 self-center" />
                      )}
                    </a>

                    {/* Sub-sections Counter Chip / Quick Toggle Pill */}
                    {hasSubSections && (
                      <button
                        onClick={e => handleToggleParent(group.parent.id, e)}
                        className={`mr-1.5 text-[9.5px] font-mono px-1.5 py-0.2 rounded-full transition-all cursor-pointer shrink-0 border ${
                          isExpanded
                            ? 'bg-blue-100/60 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/80'
                            : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300/60 dark:border-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300'
                        }`}
                        title={
                          isExpanded
                            ? `${group.subSections.length} subseções (clique para recolher)`
                            : `+${group.subSections.length} subseções recolhidas (clique para expandir)`
                        }
                      >
                        {isExpanded ? (
                          <span>{group.subSections.length}</span>
                        ) : (
                          <span className="font-semibold">+{group.subSections.length}</span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Collapsible Sub-Sections Tree */}
                  {hasSubSections && isExpanded && (
                    <ul className="ml-5 pl-2.5 my-1 border-l-2 border-slate-200 dark:border-slate-800/80 space-y-0.5 animate-fadeIn">
                      {group.subSections.map(subItem => {
                        const isSubActive = activeId === subItem.id;
                        const isLevel4 = subItem.level >= 4;

                        return (
                          <li key={subItem.id} className={isLevel4 ? 'pl-2' : ''}>
                            <a
                              href={`#${subItem.id}`}
                              onClick={e =>
                                handleScrollToHeading(subItem.id, group.parent.id, e)
                              }
                              className={`flex items-start gap-1.5 py-1 px-1.5 rounded text-[11px] transition-all cursor-pointer leading-snug ${
                                isSubActive
                                  ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-900 dark:text-blue-200 font-semibold border-l-2 border-blue-600 dark:border-blue-400'
                                  : 'hover:bg-slate-200/40 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100 text-slate-600 dark:text-slate-400'
                              }`}
                              title={`${subItem.number} ${subItem.text}`}
                            >
                              {/* Sub-section Number */}
                              <span
                                className={`font-mono text-[9.5px] shrink-0 pt-0.5 select-none ${
                                  isSubActive
                                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}
                              >
                                {subItem.number}
                              </span>

                              {/* Sub-section Title */}
                              <span className="truncate flex-1">{subItem.text}</span>

                              {/* Active indicator dot */}
                              {isSubActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0 self-center" />
                              )}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {filteredGroups.length === 0 && (
            <div className="py-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
              Nenhuma seção encontrada para &ldquo;{filterQuery}&rdquo;
            </div>
          )}

          {/* Footer Bar: Auto-collapse Mobile Notice & Quick Action */}
          <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
            <span className="truncate flex items-center gap-1">
              {autoCollapseEnabled ? (
                <>
                  <Sparkles className="w-2.5 h-2.5 text-blue-500 dark:text-blue-400 shrink-0" />
                  <span className="font-sans">Auto-recolhimento ativo</span>
                </>
              ) : (
                <span className="font-mono">H2, H3 & H4</span>
              )}
            </span>

            <button
              onClick={handleScrollToTop}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer font-sans shrink-0"
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
