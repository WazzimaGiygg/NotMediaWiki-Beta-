import React, { useState, useMemo } from 'react';
import { BookOpen, Plus, X, Repeat, Copy, Check } from 'lucide-react';
import {
  StructuredCitationFields,
  buildRefMarkup,
  extractCitationsFromWikitext,
} from '../utils/citationParser';

export interface ReferenceManagerModalProps {
  isOpen: boolean;
  wikitext: string;
  onClose: () => void;
  onInsertMarkup: (markup: string) => void;
}

export const ReferenceManagerModal: React.FC<ReferenceManagerModalProps> = ({
  isOpen,
  wikitext,
  onClose,
  onInsertMarkup,
}) => {
  const [activeTab, setActiveTab] = useState<'new' | 'existing'>('new');
  const [fields, setFields] = useState<StructuredCitationFields>({
    type: 'web',
    author: '',
    title: '',
    publisher: '',
    year: new Date().getFullYear().toString(),
    url: '',
    accessDate: new Date().toISOString().slice(0, 10),
    name: '',
    group: '',
  });
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const existingCitations = useMemo(() => {
    return extractCitationsFromWikitext(wikitext).citations;
  }, [wikitext]);

  const previewMarkup = useMemo(() => buildRefMarkup(fields), [fields]);

  if (!isOpen) return null;

  const canInsert = Boolean(fields.title?.trim() || fields.url?.trim() || fields.author?.trim());

  const handleInsertNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInsert) return;
    onInsertMarkup(previewMarkup);
    setFields({
      type: 'web',
      author: '',
      title: '',
      publisher: '',
      year: new Date().getFullYear().toString(),
      url: '',
      accessDate: new Date().toISOString().slice(0, 10),
      name: '',
      group: '',
    });
    onClose();
  };

  const handleReuseNamed = (name: string) => {
    onInsertMarkup(`<ref name="${name}" />`);
    onClose();
  };

  const handleCopyTag = async (index: number, rawText: string, name?: string) => {
    const tag = name ? `<ref name="${name}" />` : `<ref>${rawText}</ref>`;
    try {
      await navigator.clipboard.writeText(tag);
      setCopiedId(index);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Gestor de Referências Bibliográficas"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Gestor de Referências Bibliográficas (&lt;ref&gt;)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar gestor de referências"
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 pt-2 gap-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`pb-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'new'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Nova Referência
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('existing')}
            className={`pb-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'existing'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Referências no Artigo ({existingCitations.length})
          </button>
        </div>

        {/* Tab 1: New Structured Reference */}
        {activeTab === 'new' && (
          <form onSubmit={handleInsertNew} className="p-5 space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tipo de Fonte
                </label>
                <select
                  value={fields.type}
                  onChange={e =>
                    setFields(prev => ({ ...prev, type: e.target.value as 'web' | 'book' | 'journal' }))
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                >
                  <option value="web">Website / Portal</option>
                  <option value="book">Livro</option>
                  <option value="journal">Artigo Acadêmico / Periódico</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nome da Ref (opcional, para reuso)
                </label>
                <input
                  type="text"
                  value={fields.name || ''}
                  onChange={e => setFields(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ex: ibge2025"
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Grupo (opcional)
                </label>
                <input
                  type="text"
                  value={fields.group || ''}
                  onChange={e => setFields(prev => ({ ...prev, group: e.target.value }))}
                  placeholder="ex: notas"
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Autor(es)
                </label>
                <input
                  type="text"
                  value={fields.author || ''}
                  onChange={e => setFields(prev => ({ ...prev, author: e.target.value }))}
                  placeholder="ex: Silva, Maria"
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Título da Obra / Página *
                </label>
                <input
                  type="text"
                  value={fields.title || ''}
                  onChange={e => setFields(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="ex: Arquitetura de Sistemas Distribuídos"
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Editora / Site
                </label>
                <input
                  type="text"
                  value={fields.publisher || ''}
                  onChange={e => setFields(prev => ({ ...prev, publisher: e.target.value }))}
                  placeholder="ex: Editora Técnica"
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ano / Data
                </label>
                <input
                  type="text"
                  value={fields.year || ''}
                  onChange={e => setFields(prev => ({ ...prev, year: e.target.value }))}
                  placeholder="2026"
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Data de Acesso
                </label>
                <input
                  type="text"
                  value={fields.accessDate || ''}
                  onChange={e => setFields(prev => ({ ...prev, accessDate: e.target.value }))}
                  placeholder="2026-11-18"
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                URL da Fonte
              </label>
              <input
                type="url"
                value={fields.url || ''}
                onChange={e => setFields(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://exemplo.org/artigo"
                className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Live Wikitext Preview */}
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Marcação Wikitext Gerada
              </div>
              <code className="block font-mono text-[11px] text-slate-700 dark:text-slate-300 break-all">
                {previewMarkup}
              </code>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!canInsert}
                className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Inserir Referência</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Existing References in Article */}
        {activeTab === 'existing' && (
          <div className="p-5 max-h-[420px] overflow-y-auto space-y-2 text-xs">
            {existingCitations.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                Nenhuma tag <code>&lt;ref&gt;</code> encontrada neste artigo ainda.
              </div>
            ) : (
              existingCitations.map(cite => (
                <div
                  key={cite.noteId}
                  className="flex items-start justify-between gap-3 p-2.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                        [{cite.index}]
                      </span>
                      {cite.name && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                          name="{cite.name}"
                        </span>
                      )}
                      {cite.group && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                          group="{cite.group}"
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 break-words leading-relaxed">
                      {cite.rawText}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {cite.name && (
                      <button
                        type="button"
                        onClick={() => handleReuseNamed(cite.name!)}
                        className="px-2 py-1 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 flex items-center gap-1 cursor-pointer"
                        title={`Inserir <ref name="${cite.name}" />`}
                      >
                        <Repeat className="w-3 h-3" />
                        <span>Reutilizar</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopyTag(cite.index, cite.rawText, cite.name)}
                      className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                      title="Copiar tag <ref>"
                    >
                      {copiedId === cite.index ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
