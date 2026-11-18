import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BookOpen, Copy, Check, Search, Download } from 'lucide-react';
import { CitationFootnote } from '../types';
import {
  CitationStyle,
  extractCitationsFromAst,
  copyCitationToClipboard,
  formatCitationByStyle,
  exportCitationsAsBibtex,
} from '../utils/citationParser';

export interface ArticleFootnotesProps {
  ast?: any[];
  references?: string[];
  wikitext?: string;
  articleTitle?: string;
  className?: string;
  onNavigate?: (slug: string) => void;
}

const STYLE_LABELS: { id: CitationStyle; label: string }[] = [
  { id: 'wiki', label: 'Wiki' },
  { id: 'abnt', label: 'ABNT' },
  { id: 'apa', label: 'APA' },
  { id: 'bibtex', label: 'BibTeX' },
];

export const ArticleFootnotes: React.FC<ArticleFootnotesProps> = ({
  ast,
  references,
  wikitext,
  articleTitle,
  className = '',
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('wiki');
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [targetedNoteId, setTargetedNoteId] = useState<string | null>(null);

  // Automatically collect all <ref> tags from Parsoid AST, wikitext, or references array
  const citations = useMemo<CitationFootnote[]>(() => {
    return extractCitationsFromAst(ast, wikitext, references);
  }, [ast, wikitext, references]);

  // Discover distinct reference groups if <ref group="..."> is used
  const availableGroups = useMemo<string[]>(() => {
    const set = new Set<string>();
    citations.forEach(c => {
      if (c.group && c.group.trim()) {
        set.add(c.group.trim());
      }
    });
    return Array.from(set);
  }, [citations]);

  // Listen to window location hash to highlight targeted footnote if navigated via anchor
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#cite_note-')) {
        const id = hash.replace('#', '');
        setTargetedNoteId(id);
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Clear targeted pulse after 3.5 seconds
  useEffect(() => {
    if (targetedNoteId) {
      const timer = setTimeout(() => {
        setTargetedNoteId(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [targetedNoteId]);

  // Filter citations by group and search query
  const filteredCitations = useMemo(() => {
    let list = citations;
    if (activeGroup === 'default') {
      list = list.filter(c => !c.group);
    } else if (activeGroup !== 'all') {
      list = list.filter(c => c.group === activeGroup);
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      c =>
        c.rawText.toLowerCase().includes(q) ||
        c.index.toString() === q ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.domain && c.domain.toLowerCase().includes(q)) ||
        (c.author && c.author.toLowerCase().includes(q)) ||
        (c.year && c.year.includes(q))
    );
  }, [citations, activeGroup, searchQuery]);

  // Jump smoothly back to the in-text citation and flash a glow pulse
  const handleBacklinkClick = useCallback((e: React.MouseEvent, backlinkId: string) => {
    e.preventDefault();
    const targetEl = document.getElementById(backlinkId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetEl.classList.add(
        'ring-2',
        'ring-amber-400',
        'bg-amber-100',
        'dark:bg-amber-950/60',
        'rounded',
        'px-1',
        'transition-all',
        'duration-500'
      );
      setTimeout(() => {
        targetEl.classList.remove(
          'ring-2',
          'ring-amber-400',
          'bg-amber-100',
          'dark:bg-amber-950/60',
          'rounded',
          'px-1'
        );
      }, 2500);
    }
  }, []);

  // Copy single citation in the currently selected style
  const handleCopyCitation = useCallback(
    async (citation: CitationFootnote) => {
      const success = await copyCitationToClipboard(citation, citationStyle);
      if (success) {
        setCopiedIndex(citation.index);
        setTimeout(() => setCopiedIndex(null), 2000);
      }
    },
    [citationStyle]
  );

  // Copy all visible citations in the currently selected style
  const handleCopyAll = useCallback(async () => {
    if (filteredCitations.length === 0) return;
    const fullText = filteredCitations
      .map(c => formatCitationByStyle(c, citationStyle))
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  }, [filteredCitations, citationStyle]);

  // Download all citations as a .bib (BibTeX) bibliography file
  const handleDownloadBibtex = useCallback(() => {
    if (citations.length === 0 || typeof document === 'undefined') return;
    const bibContent = exportCitationsAsBibtex(citations, articleTitle);
    const blob = new Blob([bibContent], { type: 'application/x-bibtex;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (articleTitle || 'referencias')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_|_$/g, '');
    a.href = url;
    a.download = `${safeName || 'referencias'}.bib`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [citations, articleTitle]);

  // Handle internal wiki link clicks inside citation HTML
  const handleContentClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor && onNavigate) {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('#/wiki/')) {
          e.preventDefault();
          const slug = decodeURIComponent(href.replace('#/wiki/', ''));
          onNavigate(slug);
        }
      }
    },
    [onNavigate]
  );

  // If article has no <ref> tags, do not render the footer
  if (citations.length === 0) {
    return null;
  }

  const useTwoColumns = citationStyle !== 'bibtex' && filteredCitations.length >= 6;

  return (
    <section
      id="references"
      aria-label="Referências"
      data-testid="article-references-footer"
      className={`article-footnotes mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 ${className}`}
    >
      {/* Section Header & Bibliographic Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" />
          <h2 className="text-xl font-serif font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Referências
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">
            · {citations.length} {citations.length === 1 ? 'fonte' : 'fontes'}
          </span>
        </div>

        {/* Style Switcher & Export Toolbar */}
        <div className="flex flex-wrap items-center gap-2 no-print">
          {/* Citation Format Selector */}
          <div
            role="group"
            aria-label="Formato de citação"
            className="inline-flex items-center rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-0.5 text-[11px] font-sans"
          >
            {STYLE_LABELS.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCitationStyle(item.id)}
                aria-pressed={citationStyle === item.id}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  citationStyle === item.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {citations.length >= 3 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filtrar fontes..."
                aria-label="Filtrar referências"
                className="pl-8 pr-3 py-1 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleCopyAll}
            className="text-xs font-sans text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            title={`Copiar todas as referências (${citationStyle.toUpperCase()})`}
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-400">Copiadas</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copiar todas</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadBibtex}
            className="text-xs font-sans text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Exportar bibliografia em arquivo BibTeX (.bib)"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>.bib</span>
          </button>
        </div>
      </div>

      {/* Group Tabs (rendered only when <ref group="..."> tags exist) */}
      {availableGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4 text-xs font-sans no-print">
          <button
            type="button"
            onClick={() => setActiveGroup('all')}
            className={`px-2.5 py-1 rounded border transition-colors cursor-pointer ${
              activeGroup === 'all'
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100 font-medium'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Todas ({citations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveGroup('default')}
            className={`px-2.5 py-1 rounded border transition-colors cursor-pointer ${
              activeGroup === 'default'
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100 font-medium'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Principais ({citations.filter(c => !c.group).length})
          </button>
          {availableGroups.map(grp => (
            <button
              key={grp}
              type="button"
              onClick={() => setActiveGroup(grp)}
              className={`px-2.5 py-1 rounded border transition-colors cursor-pointer capitalize ${
                activeGroup === grp
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100 font-medium'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {grp} ({citations.filter(c => c.group === grp).length})
            </button>
          ))}
        </div>
      )}

      {/* Numbered Footnotes List */}
      <ol
        className={`font-sans text-xs ${
          useTwoColumns ? 'grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5' : 'space-y-2.5'
        }`}
        onClick={handleContentClick}
      >
        {filteredCitations.map(cite => {
          const isTargeted = targetedNoteId === cite.noteId;

          return (
            <li
              key={cite.noteId}
              id={cite.noteId}
              className={`group flex items-start gap-2.5 p-2 rounded transition-all duration-300 ${
                isTargeted
                  ? 'bg-amber-50/90 dark:bg-amber-950/40 ring-1 ring-amber-300 dark:ring-amber-700'
                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/60'
              }`}
            >
              {/* Footnote Number & In-text Backlinks */}
              <div className="flex items-center gap-1 shrink-0 font-mono text-slate-400 dark:text-slate-500 select-none pt-0.5">
                <span className="font-semibold text-slate-600 dark:text-slate-400">
                  {cite.index}.
                </span>

                {cite.backlinks.length === 1 ? (
                  <a
                    href={`#${cite.backlinks[0].id}`}
                    onClick={e => handleBacklinkClick(e, cite.backlinks[0].id)}
                    title={cite.backlinks[0].title}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline px-0.5 font-bold cursor-pointer"
                  >
                    ↑
                  </a>
                ) : (
                  <span className="flex items-center gap-0.5">
                    <span className="text-slate-400 select-none">^</span>
                    {cite.backlinks.map(bl => (
                      <a
                        key={bl.id}
                        href={`#${bl.id}`}
                        onClick={e => handleBacklinkClick(e, bl.id)}
                        title={bl.title}
                        className="text-blue-600 dark:text-blue-400 hover:underline px-0.5 font-mono cursor-pointer"
                      >
                        {bl.label}
                      </a>
                    ))}
                  </span>
                )}
              </div>

              {/* Footnote Body in Selected Bibliographic Style */}
              <div className="flex-1 leading-relaxed text-slate-700 dark:text-slate-300 min-w-0">
                {citationStyle === 'wiki' && (
                  <>
                    <span
                      className="citation-content"
                      dangerouslySetInnerHTML={{ __html: cite.formattedHtml }}
                    />
                    {cite.domain && (
                      <span className="inline-flex items-center gap-1 ml-2 text-[11px] text-slate-400 dark:text-slate-500 font-mono select-none">
                        <span>·</span>
                        <span>{cite.domain}</span>
                      </span>
                    )}
                    {cite.group && (
                      <span className="ml-2 text-[10px] font-mono text-slate-400 dark:text-slate-500">
                        [{cite.group}]
                      </span>
                    )}
                  </>
                )}

                {(citationStyle === 'abnt' || citationStyle === 'apa') && (
                  <span className="citation-content font-serif text-[13px] text-slate-800 dark:text-slate-200">
                    {formatCitationByStyle(cite, citationStyle)}
                  </span>
                )}

                {citationStyle === 'bibtex' && (
                  <pre className="p-2.5 rounded bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed">
                    {formatCitationByStyle(cite, 'bibtex')}
                  </pre>
                )}
              </div>

              {/* Quick Copy Footnote Button */}
              <button
                type="button"
                onClick={() => handleCopyCitation(cite)}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 cursor-pointer no-print"
                title={`Copiar esta referência (${citationStyle.toUpperCase()})`}
                aria-label={`Copiar referência ${cite.index}`}
              >
                {copiedIndex === cite.index ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {/* Empty search results state */}
      {filteredCitations.length === 0 && (searchQuery || activeGroup !== 'all') && (
        <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500">
          Nenhuma referência encontrada para os filtros selecionados.
        </div>
      )}
    </section>
  );
};
