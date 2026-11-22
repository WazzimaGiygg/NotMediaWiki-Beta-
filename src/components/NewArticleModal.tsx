import React, { useState } from 'react';
import { PlusCircle, X, FileText, Blocks } from 'lucide-react';
import { buildDefaultTemplatePageSkeleton } from '../data/defaultTemplates';

interface NewArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (slug: string, title: string, initialWikitext: string, namespace: number) => void;
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

export const NewArticleModal: React.FC<NewArticleModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [namespace, setNamespace] = useState<number>(0);
  const [selectedTemplate, setSelectedTemplate] = useState('standard');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

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
    if (effectiveNamespace === 10 || selectedTemplate === 'predefinicao') {
      initialText = buildDefaultTemplatePageSkeleton(cleanTitle);
    } else {
      const tpl = TEMPLATES.find(t => t.id === selectedTemplate) || TEMPLATES[0];
      initialText = tpl.wikitext.replace(/\[Nome\]/g, cleanTitle).replace(/\[Tecnologia\]/g, cleanTitle);
    }

    onCreate(slug, cleanTitle, initialText, effectiveNamespace);
    setTitle('');
    setNamespace(0);
    setSelectedTemplate('standard');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-base">Adicionar Nova Página de Artigo</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
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
                onChange={e => {
                  const ns = parseInt(e.target.value, 10);
                  setNamespace(ns);
                  if (ns === 10) {
                    setSelectedTemplate('predefinicao');
                  } else if (selectedTemplate === 'predefinicao') {
                    setSelectedTemplate('standard');
                  }
                }}
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
                onChange={e => {
                  const next = e.target.value;
                  setSelectedTemplate(next);
                  if (next === 'predefinicao') {
                    setNamespace(10);
                  }
                }}
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

