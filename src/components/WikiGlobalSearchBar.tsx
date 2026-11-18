import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, ArrowRight, FileText } from 'lucide-react';
import { SearchMatch } from '../types';
import { api } from '../api';

export interface WikiGlobalSearchBarProps {
  onSearch: (query: string) => void;
  onNavigateArticle: (slug: string) => void;
  placeholder?: string;
  className?: string;
}

export const WikiGlobalSearchBar: React.FC<WikiGlobalSearchBarProps> = ({
  onSearch,
  onNavigateArticle,
  placeholder = 'Pesquisar artigos no Firestore...',
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close suggestions dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced live preview using api.searchArticles(query)
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    const timer = setTimeout(() => {
      api
        .searchArticles(trimmed)
        .then(matches => {
          if (!cancelled) {
            setResults(matches.slice(0, 6));
            setIsOpen(true);
            setIsSearching(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setResults([]);
            setIsSearching(false);
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setIsOpen(false);
    onSearch(trimmed);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full sm:w-72 md:w-80 ${className}`}
      data-testid="wikireader-global-search"
    >
      <form onSubmit={handleSubmit} className="relative flex items-center" role="search">
        <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          aria-label="Pesquisar artigos na base de conhecimento"
          className="w-full pl-8 pr-16 py-1.5 text-xs bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all shadow-2xs"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            aria-label="Limpar pesquisa"
            className="absolute right-12 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        <button
          type="submit"
          aria-label="Buscar"
          className="absolute right-1 px-2 py-1 text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors cursor-pointer flex items-center gap-1"
        >
          {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>Ir</span>}
        </button>
      </form>

      {/* Live Firestore Search Suggestions Dropdown */}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-40 overflow-hidden text-xs">
          {results.length === 0 && !isSearching ? (
            <div className="px-3 py-3 text-slate-500 dark:text-slate-400 text-[11px]">
              Nenhum artigo encontrado para &ldquo;{query.trim()}&rdquo;.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
              {results.map(item => (
                <li key={item.slug}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onNavigateArticle(item.slug);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer flex items-start gap-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.title}
                      </div>
                      {item.snippet && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                          {item.snippet}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onSearch(query.trim());
            }}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer"
          >
            <span>Ver todos os resultados para &ldquo;{query.trim()}&rdquo;</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
};
