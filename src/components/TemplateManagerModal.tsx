import React, { useMemo, useState, useEffect } from 'react';
import {
  X,
  Search,
  Blocks,
  Plus,
  Copy,
  Check,
  Eye,
  Code2,
  ExternalLink,
  Save,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Article, UserSession } from '../types';
import {
  BUILTIN_MEDIAWIKI_TEMPLATES,
  TEMPLATE_CATEGORY_LABELS,
  WikiTemplateCategory,
  WikiTemplateDefinition,
  buildDefaultTemplatePageSkeleton,
  buildTemplateInvocationWikitext,
} from '../data/defaultTemplates';
import { clientParsoid } from '../services/parsoid';
import { templateService } from '../services/templateService';
import { parseTitle } from '../utils/namespaces';
import {
  applyIncludeDirectives,
  extractTemplateDeclaredParams,
  normalizeTemplateKey,
} from '../utils/templateEngine';

interface TemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertTemplate: (wikitext: string) => void;
  customTemplates?: Article[];
  pageTitle?: string;
  currentUser?: UserSession | null;
  onTemplatesChanged?: (templates: Article[]) => void;
  onOpenCreateTemplate?: (templateSlug: string) => void;
}

type CategoryFilter = 'all' | WikiTemplateCategory | 'custom';

interface CatalogEntry {
  id: string;
  name: string;
  isCustom: boolean;
  category: WikiTemplateCategory | 'custom';
  description: string;
  aliases?: string[];
  definition?: WikiTemplateDefinition;
  customArticle?: Article;
  declaredParams: string[];
}

export const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({
  isOpen,
  onClose,
  onInsertTemplate,
  customTemplates = [],
  pageTitle = 'Artigo',
  currentUser = null,
  onTemplatesChanged,
  onOpenCreateTemplate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [localCustomTemplates, setLocalCustomTemplates] = useState<Article[]>(customTemplates);
  const [selectedId, setSelectedId] = useState<string>(BUILTIN_MEDIAWIKI_TEMPLATES[0].id);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  // Inline create/reuse Predefinição state
  const [showNewTplForm, setShowNewTplForm] = useState(false);
  const [newTplName, setNewTplName] = useState('');
  const [newTplSummary, setNewTplSummary] = useState('');
  const [newTplWikitext, setNewTplWikitext] = useState(() =>
    buildDefaultTemplatePageSkeleton('MinhaPredefinicao')
  );
  const [savingNewTpl, setSavingNewTpl] = useState(false);
  const [newTplError, setNewTplError] = useState<string | null>(null);

  useEffect(() => {
    setLocalCustomTemplates(customTemplates);
  }, [customTemplates]);

  const catalogEntries = useMemo<CatalogEntry[]>(() => {
    const builtins: CatalogEntry[] = BUILTIN_MEDIAWIKI_TEMPLATES.map(tpl => ({
      id: tpl.id,
      name: tpl.name,
      isCustom: false,
      category: tpl.category,
      description: tpl.description,
      aliases: tpl.aliases,
      definition: tpl,
      declaredParams: tpl.params.map(p => p.name),
    }));

    const customs: CatalogEntry[] = localCustomTemplates
      .filter(art => art.namespace === 10 || parseTitle(art.title || art.slug).namespaceId === 10)
      .map(art => {
        const parsed = parseTitle(art.title || art.slug);
        const baseName = parsed.baseTitle || art.title;
        const body = applyIncludeDirectives(art.wikitext || '', true);
        const declared = extractTemplateDeclaredParams(body);
        return {
          id: `custom-${art.slug}`,
          name: baseName,
          isCustom: true,
          category: 'custom',
          description: art.summary || `Predefinição personalizada do wiki (${art.title}).`,
          customArticle: art,
          declaredParams: declared,
        };
      });

    return [...customs, ...builtins];
  }, [localCustomTemplates]);

  const filteredEntries = useMemo(() => {
    const q = normalizeTemplateKey(searchQuery);
    return catalogEntries.filter(entry => {
      if (categoryFilter !== 'all' && entry.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      const inName = normalizeTemplateKey(entry.name).includes(q);
      const inAlias = (entry.aliases || []).some(a => normalizeTemplateKey(a).includes(q));
      const inDesc = entry.description.toLowerCase().includes(searchQuery.toLowerCase().trim());
      return inName || inAlias || inDesc;
    });
  }, [catalogEntries, categoryFilter, searchQuery]);

  const selectedEntry = useMemo(
    () => catalogEntries.find(e => e.id === selectedId) || filteredEntries[0] || catalogEntries[0],
    [catalogEntries, selectedId, filteredEntries]
  );

  // Initialize parameter defaults whenever selected template changes
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

  const generatedWikitext = useMemo(() => {
    if (!selectedEntry) return '';
    return buildTemplateInvocationWikitext(
      selectedEntry.name,
      paramValues,
      selectedEntry.definition
    );
  }, [selectedEntry, paramValues]);

  const livePreviewHtml = useMemo(() => {
    if (!generatedWikitext) return '';
    try {
      return clientParsoid.parse(generatedWikitext, pageTitle, { customTemplates: localCustomTemplates }).html;
    } catch {
      return '<p class="text-xs text-slate-400">Não foi possível gerar a pré-visualização.</p>';
    }
  }, [generatedWikitext, pageTitle, localCustomTemplates]);

  const newTemplateLivePreviewHtml = useMemo(() => {
    if (!showNewTplForm || !newTplWikitext.trim()) return '';
    const tempName = (newTplName.trim() || 'MinhaPredefinicao').replace(/^(?:Predefinição|Predef|Template):/i, '');
    const tempArticle: Article = {
      id: 'preview-custom-tpl',
      slug: `Predefinição:${tempName.replace(/\s+/g, '_')}`,
      title: `Predefinição:${tempName}`,
      namespace: 10,
      wikitext: newTplWikitext,
      summary: newTplSummary,
      latestRevisionId: 'preview',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      categories: ['Predefinições'],
      views: 1,
    };
    try {
      return clientParsoid.parse(`{{${tempName}}}`, pageTitle, {
        customTemplates: [tempArticle, ...localCustomTemplates],
      }).html;
    } catch {
      return '';
    }
  }, [showNewTplForm, newTplName, newTplSummary, newTplWikitext, pageTitle, localCustomTemplates]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedWikitext);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleSaveNewTemplateInline = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newTplName.trim().replace(/^(?:Predefinição|Predef|Template):/i, '').trim();
    if (!cleaned) {
      setNewTplError('Informe o nome da nova predefinição.');
      return;
    }

    setSavingNewTpl(true);
    setNewTplError(null);
    try {
      const saved = await templateService.saveTemplate({
        name: cleaned,
        wikitext: newTplWikitext,
        summary: newTplSummary.trim() || `Predefinição personalizada ${cleaned}`,
        authorUser: currentUser,
      });

      const updatedList = [
        saved.article,
        ...localCustomTemplates.filter(t => t.slug !== saved.article.slug),
      ];
      setLocalCustomTemplates(updatedList);
      onTemplatesChanged?.(updatedList);

      setSelectedId(`custom-${saved.article.slug}`);
      setCategoryFilter('all');
      setNewTplName('');
      setNewTplSummary('');
      setShowNewTplForm(false);
    } catch (err: any) {
      setNewTplError(err.message || 'Falha ao salvar predefinição no Firestore.');
    } finally {
      setSavingNewTpl(false);
    }
  };

  const handleOpenFullTemplateEditor = () => {
    const cleaned = (newTplName.trim() || 'NovaPredefinicao')
      .replace(/^(?:Predefinição|Predef|Template):/i, '')
      .trim();
    const slug = `Predefinição:${cleaned.replace(/\s+/g, '_')}`;
    setNewTplName('');
    setShowNewTplForm(false);
    onClose();
    if (onOpenCreateTemplate) {
      onOpenCreateTemplate(slug);
    } else {
      window.location.hash = `#/edit/${encodeURIComponent(slug)}`;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Inserir Predefinição MediaWiki"
      data-testid="template-manager-modal"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
              <Blocks className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                Predefinições MediaWiki (<code className="font-mono text-xs">{'{{Predefinição}}'}</code>)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Escolha uma predefinição padrão ou crie e reutilize modelos personalizados do Namespace 10 (Predefinição:).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setNewTplError(null);
                setShowNewTplForm(prev => !prev);
              }}
              data-testid="toggle-new-template-btn"
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{showNewTplForm ? 'Voltar ao Catálogo' : 'Nova Predefinição'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              aria-label="Fechar janela de predefinições"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Inline creator for reusable Namespace 10 custom template */}
        {showNewTplForm ? (
          <form
            onSubmit={handleSaveNewTemplateInline}
            data-testid="create-template-inline-form"
            className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50 dark:bg-slate-950/30"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Criar Nova Predefinição Reutilizável (Namespace 10)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Use <code className="font-mono">{'{{{parâmetro|padrão}}}'}</code> no Wikitext para definir campos reutilizáveis.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenFullTemplateEditor}
                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir no Editor de Página</span>
              </button>
            </div>

            {newTplError && (
              <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{newTplError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Nome da Predefinição <span className="text-rose-600">*</span>
                </label>
                <div className="flex items-center">
                  <span className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-r-0 border-slate-300 dark:border-slate-700 rounded-l text-xs font-mono text-slate-500">
                    Predefinição:
                  </span>
                  <input
                    type="text"
                    value={newTplName}
                    onChange={e => {
                      const nextName = e.target.value;
                      setNewTplName(nextName);
                      setNewTplError(null);
                      if (!newTplWikitext.trim() || newTplWikitext.includes('MinhaPredefinicao')) {
                        setNewTplWikitext(
                          buildDefaultTemplatePageSkeleton(nextName.trim() || 'MinhaPredefinicao')
                        );
                      }
                    }}
                    placeholder="Ex: AvisoProjeto, FichaLivro..."
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-r px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Descrição curta (opcional)
                </label>
                <input
                  type="text"
                  value={newTplSummary}
                  onChange={e => setNewTplSummary(e.target.value)}
                  placeholder="Ex: Caixa padronizada para documentação de projetos"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Modelo Wikitext da Predefinição
              </label>
              <textarea
                rows={7}
                value={newTplWikitext}
                onChange={e => setNewTplWikitext(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-3 font-mono text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600"
              />
            </div>

            {newTemplateLivePreviewHtml && (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Pré-visualização da Transclusão ({`{{${newTplName.trim() || 'MinhaPredefinicao'}}}`})
                </div>
                <div
                  className="wiki-content p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flow-root"
                  dangerouslySetInnerHTML={{ __html: newTemplateLivePreviewHtml }}
                />
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewTplForm(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={savingNewTpl}
                data-testid="save-new-template-btn"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {savingNewTpl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{savingNewTpl ? 'Salvando no Firestore...' : 'Salvar Predefinição e Usar Agora'}</span>
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Filter bar */}
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar predefinição por nome ou apelido (ex: Aviso, Citar livro, Coord, Infocaixa país, Portal)..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {[
                  { id: 'all' as CategoryFilter, label: 'Todas' },
                  { id: 'wikidot' as CategoryFilter, label: 'Wikidot' },
                  { id: 'avisos' as CategoryFilter, label: 'Avisos' },
                  { id: 'navegacao' as CategoryFilter, label: 'Navegação' },
                  { id: 'infocaixa' as CategoryFilter, label: 'Infocaixas' },
                  { id: 'editorial' as CategoryFilter, label: 'Editorial' },
                  { id: 'dados' as CategoryFilter, label: 'Dados & Ref.' },
                  { id: 'custom' as CategoryFilter, label: `Personalizadas (${localCustomTemplates.length})` },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCategoryFilter(tab.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
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

            {/* Main 2-column body */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 overflow-hidden">
              {/* Template List */}
              <div className="lg:col-span-4 overflow-y-auto p-3 space-y-1.5 max-h-[260px] lg:max-h-none bg-slate-50/40 dark:bg-slate-950/20">
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
                        data-testid={`template-item-${normalizeTemplateKey(entry.name).replace(/\s+/g, '-')}`}
                        className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-slate-900 dark:text-slate-100'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {entry.definition?.syntaxStyle === 'wikidot'
                              ? entry.name
                              : `{{${entry.name}}}`}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                            {entry.isCustom ? 'Custom · NS10' : TEMPLATE_CATEGORY_LABELS[entry.category as WikiTemplateCategory]?.split(' ')[0]}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-snug">
                          {entry.description}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Parameter Builder + Live Preview */}
              <div className="lg:col-span-8 overflow-y-auto p-5 space-y-5">
                {selectedEntry && (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                            {selectedEntry.definition?.syntaxStyle === 'wikidot'
                              ? selectedEntry.name
                              : `{{${selectedEntry.name}}}`}
                          </h3>
                          {selectedEntry.aliases && selectedEntry.aliases.length > 0 && (
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              Aliases: {selectedEntry.aliases.map(a => selectedEntry.definition?.syntaxStyle === 'wikidot' ? a : `{{${a}}}`).join(', ')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          {selectedEntry.description}
                        </p>
                      </div>

                      {selectedEntry.customArticle && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            window.location.hash = `#/wiki/${encodeURIComponent(selectedEntry.customArticle!.slug)}`;
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-400 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Abrir Predefinição</span>
                        </button>
                      )}
                    </div>

                    {/* Parameter Inputs */}
                    {selectedEntry.definition ? (
                      selectedEntry.definition.params.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedEntry.definition.params.map(param => (
                            <div
                              key={param.name}
                              className={`space-y-1 ${param.multiline ? 'sm:col-span-2' : ''}`}
                            >
                              <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                                <span>
                                  {param.label}
                                  {param.required && <span className="text-rose-600 ml-0.5">*</span>}
                                </span>
                                <code className="text-[10px] font-mono text-slate-400">| {param.name}</code>
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
                              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                {param.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                          Esta predefinição não exige parâmetros obrigatórios.
                        </p>
                      )
                    ) : selectedEntry.declaredParams.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedEntry.declaredParams.map(paramName => (
                          <div key={paramName} className="space-y-1">
                            <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                              <span>Parâmetro &ldquo;{paramName}&rdquo;</span>
                              <code className="text-[10px] font-mono text-slate-400">| {paramName}</code>
                            </label>
                            <input
                              type="text"
                              value={paramValues[paramName] ?? ''}
                              onChange={e =>
                                setParamValues(prev => ({ ...prev, [paramName]: e.target.value }))
                              }
                              placeholder={`Valor para {{{${paramName}}}}`}
                              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                        Predefinição sem parâmetros declarados — será transcluída diretamente via{' '}
                        <code>{`{{${selectedEntry.name}}}`}</code>.
                      </p>
                    )}

                    {/* Live Parsoid Rendered Preview */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Pré-visualização Renderizada (Parsoid)</span>
                      </div>
                      <div
                        className="wiki-content p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 overflow-x-auto flow-root"
                        data-testid="template-live-preview"
                        dangerouslySetInnerHTML={{ __html: livePreviewHtml }}
                      />
                    </div>

                    {/* Generated Wikitext Syntax */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <Code2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Wikitext Gerado</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopy}
                          className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
                        >
                          {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                        </button>
                      </div>
                      <pre className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 text-[11px] font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap overflow-x-auto">
                        {generatedWikitext}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        {!showNewTplForm && (
          <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
              Padrão MediaWiki: crie novos modelos no namespace <code>Predefinição:</code> para reutilizar em todo o wiki.
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (generatedWikitext) {
                    onInsertTemplate(generatedWikitext + '\n');
                    onClose();
                  }
                }}
                data-testid="insert-template-confirm-btn"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs whitespace-nowrap"
              >
                Inserir no Wikitext
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
