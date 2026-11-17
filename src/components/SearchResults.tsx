import React, { useState, useEffect } from 'react';
import { Search, Shuffle, Loader2, Globe, ExternalLink, Sparkles, AlertCircle } from 'lucide-react';
import { SearchMatch } from '../types';
import { api } from '../api';
import { PRIMARY_CANONICAL_ORIGIN } from '../utils/seoManager';

interface SearchResultsProps {
  initialQuery: string;
  onNavigateArticle: (slug: string) => void;
  onRandomArticle?: () => void;
}

interface GroundedSearchResult {
  answer: string;
  sources: Array<{ title: string; uri: string; isPrimaryDomain?: boolean }>;
  webSearchQueries: string[];
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

  // Google Search Grounding state
  const [groundedData, setGroundedData] = useState<GroundedSearchResult | null>(null);
  const [groundingLoading, setGroundingLoading] = useState(false);
  const [groundingError, setGroundingError] = useState<string | null>(null);

  const performSearch = (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setGroundedData(null);
    setGroundingError(null);
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

  const handleGroundedSearch = async (targetQuery?: string) => {
    const q = (targetQuery ?? query).trim();
    if (q.length < 2) return;
    setGroundingLoading(true);
    setGroundingError(null);
    try {
      const res = await api.querySearchGrounding(q);
      setGroundedData({
        answer: res.answer,
        sources: res.sources || [],
        webSearchQueries: res.webSearchQueries || [],
      });
    } catch (err: any) {
      setGroundingError(err?.message || 'Não foi possível consultar dados atualizados na web.');
    } finally {
      setGroundingLoading(false);
    }
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
            CirrusSearch BM25 • Domínio Canônico Oficial: <span className="font-mono text-blue-600 dark:text-blue-400">core.wazzimagiygg.com</span>
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

      <form onSubmit={handleSubmit} className="flex flex-wrap sm:flex-nowrap gap-2">
        <div className="relative flex-1 min-w-52">
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
          onClick={() => handleGroundedSearch()}
          disabled={groundingLoading || query.trim().length < 2}
          className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs whitespace-nowrap disabled:opacity-50"
          title="Consultar informações atualizadas na Web via Google Search"
        >
          {groundingLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Globe className="w-4 h-4" />
          )}
          <span className="hidden md:inline">Verificar na Web</span>
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
              Nenhum resultado encontrado em core.wazzimagiygg.com para &ldquo;<span className="italic">{query}</span>&rdquo;.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Verifique a ortografia, consulte dados atualizados via Google Search ou descubra um artigo aleatório.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => handleGroundedSearch()}
              disabled={groundingLoading || query.trim().length < 2}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Pesquisar Referências no Google Search</span>
            </button>
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
            <span>Encontrado(s) {results.length} artigo(s) oficial(is) em core.wazzimagiygg.com</span>
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
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => onNavigateArticle(match.slug)}
                    className="text-base font-semibold text-blue-700 dark:text-blue-400 hover:underline text-left block cursor-pointer"
                  >
                    {match.title}
                  </button>
                  <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 shrink-0">
                    {PRIMARY_CANONICAL_ORIGIN}/#/wiki/{match.slug}
                  </span>
                </div>
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

      {/* Google Search Grounding Panel (Up-to-date verified external context) */}
      {(groundingLoading || groundedData || groundingError) && (
        <section
          aria-label="Resumo Verificado via Google Search"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Referências Atualizadas via Google Search
              </h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Search Grounding
            </span>
          </div>

          {groundingLoading ? (
            <div className="py-4 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Consultando informações atualizadas no Google Search...</span>
            </div>
          ) : groundingError ? (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{groundingError}</span>
            </div>
          ) : groundedData ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line font-serif">
                {groundedData.answer}
              </p>

              {groundedData.sources.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Fontes consultadas:
                  </div>
                  <ul className="space-y-1">
                    {groundedData.sources.map((src, idx) => (
                      <li key={`${src.uri}-${idx}`} className="text-xs flex items-center gap-1.5">
                        <ExternalLink className="w-3 h-3 text-blue-500 shrink-0" />
                        <a
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`hover:underline truncate ${
                            src.isPrimaryDomain
                              ? 'font-bold text-emerald-700 dark:text-emerald-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {src.title}
                        </a>
                        {src.isPrimaryDomain && (
                          <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.2 rounded shrink-0">
                            Oficial WazzimaGiygg
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
};
