import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BookOpen, Copy, Check, Search, ExternalLink, ArrowUp, Hash } from 'lucide-react';
import { CitationFootnote } from '../types';
import { extractCitationsFromAst, copyCitationToClipboard } from '../utils/citationParser';

export interface ArticleFootnotesProps {
  ast?: any[];
  references?: string[];
  wikitext?: string;
  className?: string;
  onNavigate?: (slug: string) => void;
}

export const ArticleFootnotes: React.FC<ArticleFootnotesProps> = ({
  ast,
  wikitext,
  className = '',
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [targetedNoteId, setTargetedNoteId] = useState<string | null>(null);

  // Extract structured citations from Parsoid AST (with fallback to wikitext)
  const citations = useMemo<CitationFootnote[]>(() => {
    return extractCitationsFromAst(ast, wikitext);
  }, [ast, wikitext]);

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

  // Clear targeted pulse after 3 seconds
  useEffect(() => {
    if (targetedNoteId) {
      const timer = setTimeout(() => {
        setTargetedNoteId(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [targetedNoteId]);

  // Filter citations by query if provided
  const filteredCitations = useMemo(() => {
    if (!searchQuery.trim()) return citations;
    const q = searchQuery.toLowerCase();
    return citations.filter(c =>
      c.rawText.toLowerCase().includes(q) ||
      c.index.toString() === q ||
      (c.domain && c.domain.toLowerCase().includes(q)) ||
      (c.author && c.author.toLowerCase().includes(q)) ||
      (c.year && c.year.includes(q))
    );
  }, [citations, searchQuery]);

  // Jump smoothly back to the in-text citation and flash a glow pulse
  const handleBacklinkClick = useCallback((e: React.MouseEvent, backlinkId: string) => {
    e.preventDefault();
    const targetEl = document.getElementById(backlinkId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add animated pulse ring to the in-text <sup> element
      targetEl.classList.add('ring-2', 'ring-amber-400', 'bg-amber-100', 'dark:bg-amber-950/60', 'rounded', 'px-1', 'transition-all', 'duration-500');
      setTimeout(() => {
        targetEl.classList.remove('ring-2', 'ring-amber-400', 'bg-amber-100', 'dark:bg-amber-950/60', 'rounded', 'px-1');
      }, 2500);
    }
  }, []);

  // Copy single citation
  const handleCopyCitation = useCallback(async (citation: CitationFootnote) => {
    const success = await copyCitationToClipboard(citation);
    if (success) {
      setCopiedIndex(citation.index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  }, []);

  // Copy all citations
  const handleCopyAll = useCallback(async () => {
    if (citations.length === 0) return;
    const fullText = citations.map(c => `[${c.index}] ${c.rawText.replace(/'''?/g, '').trim()}`).join('\n\n');
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  }, [citations]);

  // Handle internal wiki link clicks inside citation HTML
  const handleContentClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
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
  }, [onNavigate]);

  // If article has no references, do not render footnotes
  if (citations.length === 0) {
    return null;
  }

  return (
    <section
      id="references"
      aria-label="Fontes e Referências"
      className={`mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 ${className}`}
    >
      {/* Section Header with unboxed metadata discipline */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <h2 className="text-xl font-serif font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Fontes & Referências
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">
            · {citations.length} {citations.length === 1 ? 'item' : 'itens'}
          </span>
        </div>

        {/* Action toolbar */}
        <div className="flex items-center gap-2">
          {citations.length >= 3 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filtrar fontes..."
                className="pl-8 pr-3 py-1 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          <button
            onClick={handleCopyAll}
            className="text-xs font-sans text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Copiar todas as referências"
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
        </div>
      </div>

      {/* Numbered Footnotes List */}
      <ol className="space-y-3 font-sans text-xs" onClick={handleContentClick}>
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

                {/* Backlink jump anchors */}
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

              {/* Footnote Content & Domain Metadata */}
              <div className="flex-1 leading-relaxed text-slate-700 dark:text-slate-300 min-w-0">
                <span
                  className="citation-content"
                  dangerouslySetInnerHTML={{ __html: cite.formattedHtml }}
                />

                {/* Clean unboxed domain metadata */}
                {cite.domain && (
                  <span className="inline-flex items-center gap-1 ml-2 text-[11px] text-slate-400 dark:text-slate-500 font-mono select-none">
                    <span>·</span>
                    <span>{cite.domain}</span>
                  </span>
                )}
              </div>

              {/* Quick Copy Footnote Button */}
              <button
                onClick={() => handleCopyCitation(cite)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
                title="Copiar esta citação"
                aria-label={`Copiar citação ${cite.index}`}
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
      {filteredCitations.length === 0 && searchQuery && (
        <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500">
          Nenhuma citação encontrada correspondente a "{searchQuery}".
        </div>
      )}
    </section>
  );
};
