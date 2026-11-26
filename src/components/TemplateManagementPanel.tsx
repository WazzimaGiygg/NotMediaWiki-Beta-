import React, { useEffect, useMemo, useState } from 'react';
import {
  Blocks,
  Check,
  Code2,
  Copy,
  Eye,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { Article } from '../types';
import {
  BUILTIN_MEDIAWIKI_TEMPLATES,
  TEMPLATE_CATEGORY_LABELS,
  WikiTemplateCategory,
  WikiTemplateDefinition,
  buildTemplateInvocationWikitext,
} from '../data/defaultTemplates';
import { clientParsoid } from '../services/parsoid';
import { parseTitle } from '../utils/namespaces';
import {
  applyIncludeDirectives,
  extractTemplateDeclaredParams,
  normalizeTemplateKey,
} from '../utils/templateEngine';

export interface TemplateManagementPanelProps {
  onInsertCode: (snippet: string) => void;
  onClose?: () => void;
  onOpenFullCatalog?: () => void;
  customTemplates?: Article[];
  pageTitle?: string;
}

type PanelCategoryFilter = 'all' | WikiTemplateCategory | 'custom';

interface ManagementEntry {
  id: string;
  name: string;
  isCustom: boolean;
  category: WikiTemplateCategory | 'custom';
  syntaxStyle: 'mediawiki' | 'wikidot';
  description: string;
  aliases?: string[];
  definition?: WikiTemplateDefinition;
  customArticle?: Article;
  declaredParams: string[];
}

export const TemplateManagementPanel: React.FC<TemplateManagementPanelProps> = ({
  onInsertCode,
  onClose,
  onOpenFullCatalog,
  customTemplates = [],
  pageTitle = 'Artigo',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PanelCategoryFilter>('wikidot');
  const [selectedId, setSelectedId] = useState<string>('tpl-wikidot-infobox');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const catalogEntries = useMemo<ManagementEntry[]>(() => {
    const builtins: ManagementEntry[] = BUILTIN_MEDIAWIKI_TEMPLATES.map(tpl => ({
      id: tpl.id,
      name: tpl.name,
      isCustom: false,
      category: tpl.category,
      syntaxStyle: tpl.syntaxStyle === 'wikidot' ? 'wikidot' : 'mediawiki',
      description: tpl.description,
      aliases: tpl.aliases,
      definition: tpl,
      declaredParams: tpl.params.map(p => p.name),
    }));

    const customs: ManagementEntry[] = customTemplates
      .filter(art => art.namespace === 10 || parseTitle(art.title || art.slug).namespaceId === 10)
      .map(art => {
        const parsed = parseTitle(art.title || art.slug);
        const baseName = parsed.baseTitle || art.title;
        const body = applyIncludeDirectives(art.wikitext || '', true);
        return {
          id: `custom-${art.slug}`,
          name: baseName,
          isCustom: true,
          category: 'custom',
          syntaxStyle: 'mediawiki',
          description: art.summary || `Predefinição personalizada do wiki (${art.title}).`,
          customArticle: art,
          declaredParams: extractTemplateDeclaredParams(body),
        };
      });

    return [...builtins, ...customs];
  }, [customTemplates]);

  const filteredEntries = useMemo(() => {
    const q = normalizeTemplateKey(searchQuery);
    const rawQ = searchQuery.toLowerCase().trim();
    return catalogEntries.filter(entry => {
      if (categoryFilter !== 'all' && entry.category !== categoryFilter) {
        return false;
      }
      if (!q && !rawQ) return true;
      const inName = normalizeTemplateKey(entry.name).includes(q) || entry.name.toLowerCase().includes(rawQ);
      const inAlias = (entry.aliases || []).some(
        a => normalizeTemplateKey(a).includes(q) || a.toLowerCase().includes(rawQ)
      );
      const inDesc = entry.description.toLowerCase().includes(rawQ);
      return inName || inAlias || inDesc;
    });
  }, [catalogEntries, categoryFilter, searchQuery]);

  const selectedEntry = useMemo(
    () =>
      filteredEntries.find(e => e.id === selectedId) ||
      catalogEntries.find(e => e.id === selectedId) ||
      filteredEntries[0] ||
      catalogEntries[0],
    [catalogEntries, filteredEntries, selectedId]
  );

  useEffect(() => {
    if (!selectedEntry) return;
    const defaults: Record<string, string> = {};
    if (selectedEntry.definition) {
      for (const p of selectedEntry.definition.params) {
        if (p.defaultValue !== undefined) {
          defaults[p.name] = p.defaultValue;
        }
      }
    } else {
      for (const key of selectedEntry.declaredParams) {
        defaults[key] = '';
      }
    }
    setParamValues(defaults);
  }, [selectedEntry?.id]);

  const generatedCode = useMemo(() => {
    if (!selectedEntry) return '';
    return buildTemplateInvocationWikitext(
      selectedEntry.name,
      paramValues,
      selectedEntry.definition
    );
  }, [selectedEntry, paramValues]);

  const previewHtml = useMemo(() => {
    if (!generatedCode) return '';
    try {
      return clientParsoid.parse(generatedCode, pageTitle, { customTemplates }).html;
    } catch {
      return '<p class="text-xs text-slate-400">Não foi possível pré-visualizar esta predefinição.</p>';
    }
  }, [generatedCode, pageTitle, customTemplates]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable
    }
  };

  const categoryTabs: Array<{ id: PanelCategoryFilter; label: string }> = [
    { id: 'wikidot', label: 'Wikidot' },
    { id: 'all', label: `Todas (${catalogEntries.length})` },
    { id: 'infocaixa', label: 'Infoboxes' },
    { id: 'avisos', label: 'Alertas' },
    { id: 'navegacao', label: 'Navegação' },
    { id: 'editorial', label: 'Editorial' },
    { id: 'dados', label: 'Dados & Ref.' },
    { id: 'custom', label: `Personalizadas (${customTemplates.length})` },
  ];

  return (
    <section
      role="region"
      aria-label="Gestão de Predefinições"
      data-testid="template-management-panel"
      className="mb-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden font-sans"
    >
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/85 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center shrink-0">
            <Blocks className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              Gestão de Predefinições
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Selecione, personalize, visualize e insira blocos Wikidot (<code>[[callout]]</code>, <code>[[div class="infobox"]]</code>) e modelos Wikipédia no editor.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenFullCatalog && (
            <button
              type="button"
              onClick={onOpenFullCatalog}
              data-testid="management-open-full-catalog-btn"
              className="px-2.5 py-1 text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span>Criar / Gerir NS10</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar Gestão de Predefinições"
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 flex flex-col lg:flex-row lg:items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filtrar predefinições (ex: Wikidot, Infobox, Callout, Navbox, Citar livro, Coord)..."
            aria-label="Filtrar predefinições"
            data-testid="management-search-input"
            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {categoryTabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setCategoryFilter(tab.id);
                const firstMatching = catalogEntries.find(e => tab.id === 'all' || e.category === tab.id);
                if (firstMatching) setSelectedId(firstMatching.id);
              }}
              data-testid={`management-cat-${tab.id}`}
              className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                categoryFilter === tab.id
                  ? 'bg-slate-900 dark:bg-blue-600 text-white font-semibold'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Workspace: List | Config + Live Preview + Snippet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
        {/* Left column: Preset Selector */}
        <div className="lg:col-span-4 max-h-72 lg:max-h-[410px] overflow-y-auto p-2.5 space-y-1.5 bg-slate-50/30 dark:bg-slate-950/20">
          {filteredEntries.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Nenhuma predefinição encontrada para &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            filteredEntries.map(entry => {
              const isSelected = selectedEntry?.id === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  data-testid={`management-item-${entry.id}`}
                  className={`w-full text-left p-2.5 rounded-md border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-slate-900 dark:text-slate-100'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {entry.syntaxStyle === 'wikidot' ? entry.name : `{{${entry.name}}}`}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                      {entry.syntaxStyle === 'wikidot'
                        ? 'Wikidot'
                        : entry.isCustom
                        ? 'NS10'
                        : TEMPLATE_CATEGORY_LABELS[entry.category as WikiTemplateCategory]?.split(' ')[0]}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                    {entry.description}
                  </p>
                </button>
              );
            })
          )}
        </div>

        {/* Right column: Parameters, Live Preview & Insert */}
        <div className="lg:col-span-8 p-4 space-y-4 max-h-[520px] lg:max-h-[410px] overflow-y-auto">
          {selectedEntry && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                      {selectedEntry.syntaxStyle === 'wikidot'
                        ? selectedEntry.name
                        : `{{${selectedEntry.name}}}`}
                    </h4>
                    {selectedEntry.aliases && selectedEntry.aliases.length > 0 && (
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        Sintaxe:{' '}
                        {selectedEntry.aliases
                          .slice(0, 3)
                          .map(a => (selectedEntry.syntaxStyle === 'wikidot' ? a : `{{${a}}}`))
                          .join(', ')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {selectedEntry.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (generatedCode) {
                      onInsertCode(generatedCode);
                    }
                  }}
                  data-testid="management-insert-btn"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Inserir no Markdown / Editor</span>
                </button>
              </div>

              {/* Parameter Inputs */}
              {selectedEntry.definition && selectedEntry.definition.params.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {selectedEntry.definition.params.map(param => (
                    <div
                      key={param.name}
                      className={`space-y-1 ${param.multiline ? 'sm:col-span-2' : ''}`}
                    >
                      <label className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        <span>
                          {param.label}
                          {param.required && <span className="text-rose-600 ml-0.5">*</span>}
                        </span>
                        <code className="text-[10px] font-mono text-slate-400">{param.name}</code>
                      </label>
                      {param.multiline ? (
                        <textarea
                          rows={2}
                          value={paramValues[param.name] ?? ''}
                          onChange={e =>
                            setParamValues(prev => ({ ...prev, [param.name]: e.target.value }))
                          }
                          placeholder={param.placeholder}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600"
                        />
                      ) : (
                        <input
                          type="text"
                          value={paramValues[param.name] ?? ''}
                          onChange={e =>
                            setParamValues(prev => ({ ...prev, [param.name]: e.target.value }))
                          }
                          placeholder={param.placeholder}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : selectedEntry.declaredParams.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {selectedEntry.declaredParams.map(paramName => (
                    <div key={paramName} className="space-y-1">
                      <label className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        <span>{paramName}</span>
                        <code className="text-[10px] font-mono text-slate-400">{paramName}</code>
                      </label>
                      <input
                        type="text"
                        value={paramValues[paramName] ?? ''}
                        onChange={e =>
                          setParamValues(prev => ({ ...prev, [paramName]: e.target.value }))
                        }
                        placeholder={`Valor para ${paramName}`}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Esta predefinição não requer parâmetros adicionais.
                </p>
              )}

              {/* Live Preview + Code side by side */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Pré-visualização</span>
                  </div>
                  <div
                    data-testid="management-live-preview"
                    className="wiki-content p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 overflow-x-auto flow-root min-h-[96px]"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <Code2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Código Gerado</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                  <pre
                    data-testid="management-generated-code"
                    className="p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 text-[11px] font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap overflow-x-auto min-h-[96px]"
                  >
                    {generatedCode}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
