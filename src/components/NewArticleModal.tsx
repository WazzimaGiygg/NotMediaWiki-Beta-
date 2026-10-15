import React, { useState } from 'react';
import { PlusCircle, X, FileText, Check, Sparkles } from 'lucide-react';

interface NewArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (slug: string, title: string, initialWikitext: string, namespace: number) => void;
}

const TEMPLATES = [
  {
    id: 'standard',
    label: 'Artigo Padrão com Infobox',
    wikitext: `{{Infobox software\n| name = [Nome]\n| developer = [Desenvolvedor]\n| initial_release = 2026\n| programming_language = TypeScript / Node.js\n| license = MIT\n}}\n\n'''[Nome]''' é um software e projeto relevante.\n\n== Visão Geral ==\nEscreva a introdução e o resumo aqui...\n\n== Arquitetura ==\n* Componente 1: Descrição\n* Componente 2: Descrição\n\n== Referências ==\n<ref>Fonte bibliográfica inicial.</ref>\n\n[[Category:Software]]\n[[Category:Tecnologia]]\n`
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
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Por favor, informe o título da página.');
      return;
    }

    const slug = cleanTitle.replace(/\s+/g, '_');
    const tpl = TEMPLATES.find(t => t.id === selectedTemplate) || TEMPLATES[0];
    const initialText = tpl.wikitext.replace(/\[Nome\]/g, cleanTitle).replace(/\[Tecnologia\]/g, cleanTitle);

    onCreate(slug, cleanTitle, initialText, namespace);
    setTitle('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-slate-900 text-base">Adicionar Nova Página de Artigo</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors"
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Título do Artigo:
            </label>
            <input
              type="text"
              value={title}
              onChange={e => {
                setTitle(e.target.value);
                setError(null);
              }}
              placeholder="Ex: Inteligência Artificial, Algoritmos, Computação em Nuvem..."
              className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-colors"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Namespace (Espaço Nominal):
              </label>
              <select
                value={namespace}
                onChange={e => setNamespace(parseInt(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 outline-none"
              >
                <option value={0}>0 - Principal (Artigo)</option>
                <option value={1}>1 - Discussão (Talk)</option>
                <option value={4}>4 - Projeto (MediaWiki)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Modelo Inicial:
              </label>
              <select
                value={selectedTemplate}
                onChange={e => setSelectedTemplate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 outline-none"
              >
                {TEMPLATES.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded text-xs font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5 shadow-2xs"
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
