import React, { useState } from 'react';
import { Database, Table, ExternalLink, ChevronDown, ChevronRight, Tag, Hash, Calendar, CheckSquare, Layers } from 'lucide-react';
import { SemanticFact } from '../utils/semanticParser';

interface SemanticFactboxProps {
  facts: SemanticFact[];
  articleTitle: string;
  onNavigateArticle: (slug: string) => void;
}

export const SemanticFactbox: React.FC<SemanticFactboxProps> = ({
  facts,
  articleTitle,
  onNavigateArticle,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  if (!facts || facts.length === 0) {
    return null;
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Number':
        return <Hash className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />;
      case 'Date':
        return <Calendar className="w-3 h-3 text-purple-600 dark:text-purple-400" />;
      case 'Boolean':
        return <CheckSquare className="w-3 h-3 text-amber-600 dark:text-amber-400" />;
      default:
        return <Tag className="w-3 h-3 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <div className="mt-8 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
      {/* Factbox Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Dados Estruturados & Fatos Semânticos (Semantic MediaWiki / Cargo)
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            {facts.length} {facts.length === 1 ? 'fato' : 'fatos'}
          </span>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <span className="text-[11px] hidden sm:inline text-slate-500 dark:text-slate-400">
            {isOpen ? 'Recolher fatos' : 'Expandir tabela de propriedades'}
          </span>
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {/* Table of Facts */}
      {isOpen && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-slate-50/50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="py-2 px-4 w-1/3">Propriedade</th>
                <th className="py-2 px-4">Valor</th>
                <th className="py-2 px-4 w-28 text-right">Tipo de Dado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {facts.map((fact, index) => (
                <tr
                  key={`${fact.propertyKey}-${index}`}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="py-2 px-4 font-mono font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    {getTypeIcon(fact.type)}
                    <span>{fact.property}</span>
                  </td>
                  <td className="py-2 px-4 text-slate-900 dark:text-slate-100">
                    {fact.type === 'Page' || fact.isLink ? (
                      <button
                        onClick={() => onNavigateArticle(fact.rawValue.replace(/\[\[|\]\]/g, ''))}
                        className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>{fact.rawValue.replace(/\[\[|\]\]/g, '')}</span>
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </button>
                    ) : fact.type === 'URL' ? (
                      <a
                        href={fact.rawValue}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>{fact.rawValue}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="font-sans">{String(fact.parsedValue)}</span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-right">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {fact.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
