import React, { useState } from 'react';
import { PlusCircle, X, FileText, Blocks, Code, PanelRight, ChevronDown, ChevronUp } from 'lucide-react';
import { buildDefaultTemplatePageSkeleton } from '../data/defaultTemplates';
import { RichFormattedEditor } from './RichFormattedEditor';
import type { EditorViewMode } from './WikiEditor';

interface NewArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    slug: string,
    title: string,
    initialWikitext: string,
    namespace: number,
    editorMode?: EditorViewMode
  ) => void;
}

const TEMPLATES = [
  {
    id: 'standard',
    label: 'Artigo Padrão com Infobox Software',
    wikitext: `{{Infobox software
| name = [Nome]
| developer = [Desenvolvedor]
| author = [Autor ou Equipe]
| email = contato@wazzimagiygg.com
| latest_release_version = 1.0.0
| initial_release = 2026
| status = Ativo
| programming_language = TypeScript / Node.js
| operating_system = Multiplataforma (Web, Linux, Windows, macOS)
| platform = Web / Cloud
| genre = Software / Aplicação Web
| license = MIT
| repository = https://github.com/wazzimagiygg
| website = https://core.wazzimagiygg.com
| support_url = https://support.wazzimagiygg.com/
}}

'''[Nome]''' é um software e projeto relevante.

== Visão Geral ==
Escreva a introdução e o resumo aqui...

== Arquitetura ==
* Componente 1: Descrição
* Componente 2: Descrição

== Referências ==
<ref>Fonte bibliográfica inicial.</ref>

[[Category:Software]]
[[Category:Tecnologia]]
`
  },
  {
    id: 'tech',
    label: 'Tecnologia / Conceito Distribuído',
    wikitext: `{{Infobox technology\n| name = [Tecnologia]\n| category = Computação Distribuída\n| key_characteristics = Escalabilidade, Baixa Latência\n}}\n\n'''[Tecnologia]''' é um paradigma em sistemas distribuídos.\n\n== Fundamentos ==\nDetalhes sobre os princípios fundamentais...\n\n== Implementação em Node.js ==\nExemplo de implementação em microserviços...\n\n== Referências ==\n<ref>Documentação técnica e relatórios de arquitetura.</ref>\n\n[[Category:Sistemas distribuídos]]\n[[Category:Arquitetura de software]]\n`
  },
  {
    id: 'blank',
    label: 'Página em Branco',
    wikitext: `'''[Nome]''' é um novo artigo.\n\n== Seção 1 ==\nConteúdo aqui...\n\n[[Category:Artigos gerais]]\n`
  },
  {
    id: 'predefinicao',
    label: 'Predefinição Reutilizável (Namespace 10)',
    wikitext: ''
  }
];

function resolveTemplateSkeleton(templateId: string, namespace: number, rawTitle: string): string {
  const displayTitle = rawTitle.trim() || 'Novo Artigo';
  if (namespace === 10 || templateId === 'predefinicao') {
    const cleanTplName = displayTitle.replace(/^(?:Predefinição|Predef|Template):/i, '') || 'NovaPredefinicao';
    return buildDefaultTemplatePageSkeleton(`Predefinição:${cleanTplName}`);
  }
  const tpl = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
  return tpl.wikitext
    .replace(/\[Nome\]/g, rawTitle.trim() ? displayTitle : '[Nome]')
    .replace(/\[Tecnologia\]/g, rawTitle.trim() ? displayTitle : '[Tecnologia]');
}

export const NewArticleModal: React.FC<NewArticleModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [namespace, setNamespace] = useState<number>(0);
  const [selectedTemplate, setSelectedTemplate] = useState('standard');
  const [editorMode, setEditorMode] = useState<EditorViewMode>('split-formatted');
  const [showInitialContentEditor, setShowInitialContentEditor] = useState(false);
  const [initialComposerMode, setInitialComposerMode] = useState<'split-formatted' | 'formatted' | 'edit'>('split-formatted');
  const [customWikitext, setCustomWikitext] = useState('');
  const [hasEditedInitialContent, setHasEditedInitialContent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleInitialEditor = () => {
    setShowInitialContentEditor(prev => {
      const nextOpen = !prev;
      if (nextOpen && !hasEditedInitialContent) {
        setCustomWikitext(resolveTemplateSkeleton(selectedTemplate, namespace, title));
      }
      return nextOpen;
    });
  };

  const handleTemplateChange = (nextTemplate: string) => {
    setSelectedTemplate(nextTemplate);
    const nextNs = nextTemplate === 'predefinicao' ? 10 : namespace;
    if (nextTemplate === 'predefinicao') {
      setNamespace(10);
    }
    if (showInitialContentEditor && !hasEditedInitialContent) {
      setCustomWikitext(resolveTemplateSkeleton(nextTemplate, nextNs, title));
    }
  };

  const handleNamespaceChange = (ns: number) => {
    setNamespace(ns);
    let nextTpl = selectedTemplate;
    if (ns === 10) {
      nextTpl = 'predefinicao';
      setSelectedTemplate('predefinicao');
    } else if (selectedTemplate === 'predefinicao') {
      nextTpl = 'standard';
      setSelectedTemplate('standard');
    }
    if (showInitialContentEditor && !hasEditedInitialContent) {
      setCustomWikitext(resolveTemplateSkeleton(nextTpl, ns, title));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Por favor, informe o título da página.');
      return;
    }

    const effectiveNamespace =
      /^(?:Predefinição|Predef|Template):/i.test(cleanTitle) ? 10 : namespace;

    if (effectiveNamespace === 10 && !/^(?:Predefinição|Predef|Template):/i.test(cleanTitle)) {
      cleanTitle = `Predefinição:${cleanTitle}`;
    }

    const slug = cleanTitle.replace(/\s+/g, '_');
    let initialText = '';
    if (hasEditedInitialContent && customWikitext.trim()) {
      initialText = customWikitext
        .replace(/\[Nome\]/g, cleanTitle)
        .replace(/\[Tecnologia\]/g, cleanTitle);
    } else {
      initialText = resolveTemplateSkeleton(selectedTemplate, effectiveNamespace, cleanTitle);
    }

    onCreate(slug, cleanTitle, initialText, effectiveNamespace, editorMode);
    setTitle('');
    setNamespace(0);
    setSelectedTemplate('standard');
    setEditorMode('split-formatted');
    setShowInitialContentEditor(false);
    setCustomWikitext('');
    setHasEditedInitialContent(false);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div
        className={`bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xl w-full overflow-hidden my-auto transition-all ${
          showInitialContentEditor ? 'max-w-5xl' : 'max-w-xl'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-base">Adicionar Nova Página de Artigo</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
              {namespace === 10 ? 'Nome da Predefinição:' : 'Título do Artigo:'}
            </label>
            <input
              type="text"
              value={title}
              onChange={e => {
                setTitle(e.target.value);
                setError(null);
              }}
              placeholder={
                namespace === 10
                  ? 'Ex: AvisoProjeto (criará Predefinição:AvisoProjeto)'
                  : 'Ex: Inteligência Artificial, Algoritmos, Computação em Nuvem...'
              }
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 focus:bg-white dark:focus:bg-slate-900 transition-colors"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Namespace (Espaço Nominal):
              </label>
              <select
                value={namespace}
                onChange={e => handleNamespaceChange(parseInt(e.target.value, 10))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none"
              >
                <option value={0}>0 - Principal (Artigo)</option>
                <option value={1}>1 - Discussão (Talk)</option>
                <option value={4}>4 - Projeto (MediaWiki)</option>
                <option value={10}>10 - Predefinição (Template)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Modelo Inicial:
              </label>
              <select
                value={selectedTemplate}
                onChange={e => handleTemplateChange(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none"
              >
                {TEMPLATES.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Editor Opening Mode Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Modo de Abertura no Editor:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { id: 'split-formatted' as const, label: 'Código + Formatado', icon: PanelRight },
                { id: 'formatted' as const, label: 'Edição Formatada', icon: FileText },
                { id: 'split' as const, label: 'Dual Split Preview', icon: Blocks },
                { id: 'edit' as const, label: 'Somente Código', icon: Code },
              ].map(modeOption => {
                const Icon = modeOption.icon;
                const active = editorMode === modeOption.id;
                return (
                  <button
                    key={modeOption.id}
                    type="button"
                    data-testid={`new-article-mode-${modeOption.id}`}
                    onClick={() => setEditorMode(modeOption.id)}
                    className={`px-2.5 py-2 rounded border text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      active
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-semibold'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{modeOption.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggle to insert/compose initial content right inside the modal */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <button
              type="button"
              data-testid="toggle-new-article-formatted-composer"
              onClick={handleToggleInitialEditor}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2">
                <PanelRight className="w-4 h-4 text-emerald-600" />
                <span>Inserir / Redigir Conteúdo Inicial Agora (Formatado &amp; Código Lado a Lado)</span>
              </span>
              {showInitialContentEditor ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showInitialContentEditor && (
              <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded">
                    <button
                      type="button"
                      onClick={() => setInitialComposerMode('split-formatted')}
                      className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer ${
                        initialComposerMode === 'split-formatted'
                          ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-2xs font-semibold'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <PanelRight className="w-3 h-3" />
                      Lado a Lado
                    </button>
                    <button
                      type="button"
                      onClick={() => setInitialComposerMode('formatted')}
                      className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer ${
                        initialComposerMode === 'formatted'
                          ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-2xs font-semibold'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <FileText className="w-3 h-3" />
                      Formatado
                    </button>
                    <button
                      type="button"
                      onClick={() => setInitialComposerMode('edit')}
                      className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer ${
                        initialComposerMode === 'edit'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Code className="w-3 h-3" />
                      Código
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCustomWikitext(resolveTemplateSkeleton(selectedTemplate, namespace, title));
                      setHasEditedInitialContent(false);
                    }}
                    className="text-[11px] text-blue-600 hover:underline cursor-pointer"
                  >
                    Restaurar do modelo
                  </button>
                </div>

                <div
                  className={`grid ${
                    initialComposerMode === 'split-formatted'
                      ? 'grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800'
                      : 'grid-cols-1'
                  }`}
                >
                  {(initialComposerMode === 'split-formatted' || initialComposerMode === 'edit') && (
                    <div className="flex flex-col">
                      <div className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Código Wikitexto
                      </div>
                      <textarea
                        data-testid="new-article-wikitext-input"
                        value={customWikitext}
                        onChange={e => {
                          setCustomWikitext(e.target.value);
                          setHasEditedInitialContent(true);
                        }}
                        rows={11}
                        className="w-full min-h-[240px] p-3 font-mono text-xs text-slate-800 dark:text-slate-100 bg-transparent outline-none resize-y"
                        placeholder="Escreva ou ajuste o Wikitexto inicial aqui..."
                      />
                    </div>
                  )}

                  {(initialComposerMode === 'split-formatted' || initialComposerMode === 'formatted') && (
                    <div className="flex flex-col min-w-0">
                      <div className="px-3 py-1.5 border-b border-emerald-200/70 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        Edição Formatada (use &quot;Inserir Formatado&quot; acima)
                      </div>
                      <RichFormattedEditor
                        wikitext={customWikitext}
                        compact
                        minHeightClass="min-h-[220px] max-h-[280px]"
                        onChange={next => {
                          setCustomWikitext(next);
                          setHasEditedInitialContent(true);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {(namespace === 10 || selectedTemplate === 'predefinicao') && (
            <div className="p-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2">
              <Blocks className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                Será criada no Namespace <strong>10 (Predefinição:)</strong>. Depois de salvar no Firebase, você poderá transcluí-la em qualquer página com{' '}
                <code className="font-mono bg-white/80 dark:bg-slate-900 px-1 py-0.5 rounded">
                  {'{{'}{(title.trim() || 'Nome').replace(/^(?:Predefinição|Predef|Template):/i, '')}{'}}'}
                </code>.
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-xs font-medium transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              Criar e Abrir no Editor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
