import React, { useState, useEffect } from 'react';
import { Search, ArrowRight, BookOpen } from 'lucide-react';
import { SearchMatch } from '../types';
import { api } from '../api';

interface SearchResultsProps {
  initialQuery: string;
  onNavigateArticle: (slug: string) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  initialQuery,
  onNavigateArticle,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [loading, setLoading] = useState(false);

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
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-serif font-bold text-slate-900">
          Search Results: <span className="font-sans italic font-normal text-slate-700">&ldquo;{query}&rdquo;</span>
        </h1>
        <div className="text-xs text-slate-500 font-sans mt-1">
          CirrusSearch BM25 Inverted-Index Matching
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search wiki content..."
          className="flex-1 bg-white border border-slate-300 rounded px-4 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
        />
        <button
          type="submit"
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors cursor-pointer"
        >
          Search
        </button>
      </form>

      {loading ? (
        <div className="py-12 text-center text-xs font-mono text-slate-400">
          Scanning CirrusSearch inverted index...
        </div>
      ) : results.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-200 rounded text-slate-500 text-sm">
          No matches found for &ldquo;{query}&rdquo;. Try another keyword or create a new article!
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-slate-500 font-sans">
            Found {results.length} article matches in database
          </div>

          <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded shadow-xs">
            {results.map(match => (
              <div key={match.slug} className="p-4 hover:bg-slate-50/70 transition-colors">
                <button
                  onClick={() => onNavigateArticle(match.slug)}
                  className="text-base font-semibold text-blue-700 hover:underline text-left block"
                >
                  {match.title}
                </button>
                <div className="text-xs text-slate-600 font-serif mt-1 leading-relaxed">
                  {match.snippet}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-sans mt-2">
                  <span>Match score: {match.score}</span>
                  <span aria-hidden="true">·</span>
                  <span>Namespace {match.namespace === 0 ? 'Main' : 'Discussion'}</span>
                  {match.categories.length > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Categories: {match.categories.join(', ')}</span>
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
