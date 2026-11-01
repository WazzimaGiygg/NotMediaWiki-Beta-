import React, { useState, useEffect } from 'react';
import { Search, ArrowRight, BookOpen, Shuffle, Loader2 } from 'lucide-react';
import { SearchMatch } from '../types';
import { api } from '../api';

interface SearchResultsProps {
  initialQuery: string;
  onNavigateArticle: (slug: string) => void;
  onRandomArticle?: () => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  initialQuery,
  onNavigateArticle,
  onRandomArticle,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [randomLoading, setRandomLoading] = useState(false);

  const performSearch = (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    api.querySearch(q)
      .then(res => {
        setResults(res);
        setLoading(false);
      })
      .catch(() => {
        setResults([]);
        setLoading(false);
      });
  };

  const handleRandomClick = async () => {
    if (onRandomArticle) {
      onRandomArticle();
      return;
    }
    setRandomLoading(true);
    try {
      const random = await api.getRandomArticle();
      if (random && random.slug) {
        onNavigateArticle(random.slug);
      }
    } catch (err) {
      console.warn('Erro ao carregar artigo aleatório:', err);
    } finally {
      setRandomLoading(false);
    }
  };

  useEffect(() => {
    setQuery(initialQuery);
    performSearch(initialQuery);
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">
            Resultados da Busca: <span className="font-sans italic font-normal text-slate-700 dark:text-slate-300">&ldquo;{query}&rdquo;</span>
          </h1>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-1">
            CirrusSearch BM25 Inverted-Index Matching • NotMediaWiki
          </div>
        </div>

        {/* Quick Random Discovery Button */}
        <button
          type="button"
          onClick={handleRandomClick}
          disabled={randomLoading}
          className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0 disabled:opacity-50"
          title="Buscar e abrir um artigo sorteado aleatoriamente"
        >
          <Shuffle className={`w-3.5 h-3.5 text-blue-600 dark:text-blue-400 ${randomLoading ? 'animate-spin' : ''}`} />
          <span>{randomLoading ? 'Sorteando...' : 'Buscar Artigo Aleatório'}</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Pesquisar artigos, categorias e wikitexto..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-xs"
        >
          Pesquisar
        </button>
        <button
          type="button"
          onClick={handleRandomClick}
          disabled={randomLoading}
          className="px-3 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
          title="Abrir uma página aleatória ao acaso"
        >
          <Shuffle className={`w-4 h-4 ${randomLoading ? 'animate-spin' : ''}`} />
          <span className="hidden md:inline">Aleatório</span>
        </button>
      </form>

      {loading ? (
        <div className="py-12 text-center text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Buscando no índice invertido CirrusSearch...</span>
        </div>
      ) : results.length === 0 ? (
        <div className="py-12 px-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 text-sm space-y-4 bg-slate-50/50 dark:bg-slate-900/30">
          <div>
            <p className="font-medium text-slate-700 dark:text-slate-300">
              Nenhum resultado encontrado para &ldquo;<span className="italic">{query}</span>&rdquo;.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Verifique a ortografia ou experimente descobrir conteúdos novos através de um sorteio aleatório.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleRandomClick}
              disabled={randomLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <Shuffle className={`w-3.5 h-3.5 ${randomLoading ? 'animate-spin' : ''}`} />
              <span>Buscar Artigo Aleatório</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-sans flex items-center justify-between">
            <span>Encontrado(s) {results.length} artigo(s) correspondente(s) no banco de dados</span>
            <button
              onClick={handleRandomClick}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Shuffle className="w-3 h-3" />
              <span>Ou tente um artigo aleatório</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
            {results.map(match => (
              <div key={match.slug} className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                <button
                  onClick={() => onNavigateArticle(match.slug)}
                  className="text-base font-semibold text-blue-700 dark:text-blue-400 hover:underline text-left block cursor-pointer"
                >
                  {match.title}
                </button>
                <div className="text-xs text-slate-600 dark:text-slate-300 font-serif mt-1 leading-relaxed">
                  {match.snippet}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-sans mt-2">
                  <span>Relevância: {match.score}</span>
                  <span aria-hidden="true">·</span>
                  <span>Namespace {match.namespace === 0 ? 'Principal' : 'Discussão'}</span>
                  {match.categories.length > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Categorias: {match.categories.join(', ')}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
