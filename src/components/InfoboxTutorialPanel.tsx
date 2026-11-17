import React, { useState } from 'react';
import { BookOpen, Copy, Check, Plus, Sparkles, User, Code2 } from 'lucide-react';
import { INFOBOX_USER_FIELDS } from '../utils/infoboxUser';
import { INFOBOX_SOFTWARE_FIELDS } from '../utils/infoboxSoftware';

interface InfoboxTutorialPanelProps {
  defaultTab?: 'user' | 'software';
  sampleUserInfobox?: string;
  onInsertSnippet?: (snippet: string) => void;
  insertButtonLabel?: string;
}

const DEFAULT_USER_EXAMPLE = `{{Infobox user
| name = Seu Nome
| tag = #1100
| role = Editor Comunitário
| email = voce@wazzimagiygg.com
| location = Brasil
| languages = Português (BR), Inglês
| joined = 2026-11-17
| specialties = Tecnologia, História, Revisão
| status = Ativo
| website = https://core.wazzimagiygg.com
| github = https://github.com/seu-usuario
}}`;

const DEFAULT_SOFTWARE_EXAMPLE = `{{Infobox software
| name = NotMediaWiki
| developer = Projetos WazzimaGiygg
| author = Equipe Core
| email = contato@wazzimagiygg.com
| latest_release_version = 3.05.3
| initial_release = 2026-01-15
| status = Ativo
| programming_language = TypeScript, Node.js, React
| operating_system = Multiplataforma
| license = Apache-2.0
| website = https://core.wazzimagiygg.com
| support_url = https://support.wazzimagiygg.com/
}}`;

export const InfoboxTutorialPanel: React.FC<InfoboxTutorialPanelProps> = ({
  defaultTab = 'user',
  sampleUserInfobox,
  onInsertSnippet,
  insertButtonLabel = 'Inserir no meu Wikitext',
}) => {
  const [tab, setTab] = useState<'user' | 'software'>(defaultTab);
  const [copied, setCopied] = useState(false);

  const activeSnippet =
    tab === 'user' ? sampleUserInfobox || DEFAULT_USER_EXAMPLE : DEFAULT_SOFTWARE_EXAMPLE;
  const activeFields = tab === 'user' ? INFOBOX_USER_FIELDS : INFOBOX_SOFTWARE_FIELDS;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored if blocked in iframe
    }
  };

  return (
    <div
      data-testid="infobox-tutorial-panel"
      className="bg-slate-50/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 text-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Tutorial: Como usar o Infobox no NotMediaWiki
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              O Infobox exibe um cartão de identificação estruturado no canto direito da página de usuário ou do artigo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0 self-start">
          <button
            type="button"
            onClick={() => setTab('user')}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              tab === 'user'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <User className="w-3 h-3" />
            <span>Infobox de Usuário</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('software')}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              tab === 'software'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Code2 className="w-3 h-3" />
            <span>Infobox Software</span>
          </button>
        </div>
      </div>

      {/* Step-by-step usage guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
          <div className="font-bold text-indigo-700 dark:text-indigo-400 text-[11px]">
            1. Abra e feche o bloco
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            Inicie no topo do Wikitext com <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{`{{Infobox ${tab}}}`}</code> e finalize em uma nova linha com <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{`}}`}</code>.
          </p>
        </div>

        <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
          <div className="font-bold text-indigo-700 dark:text-indigo-400 text-[11px]">
            2. Informe cada campo com |
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            Cada linha segue o formato <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">| chave = valor</code>. Campos deixados vazios são ocultados automaticamente.
          </p>
        </div>

        <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
          <div className="font-bold text-indigo-700 dark:text-indigo-400 text-[11px]">
            3. Links e formatação automática
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            E-mails viram links <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">mailto:</code>, URLs <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">https://</code> viram links externos e <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">[[Artigo]]</code> cria links internos.
          </p>
        </div>
      </div>

      {/* Ready-to-use code example */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70 overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900 flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Exemplo pronto ({`{{Infobox ${tab}}}`})
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded text-[11px] font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
            {onInsertSnippet && (
              <button
                type="button"
                onClick={() => onInsertSnippet(activeSnippet + '\n\n')}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{insertButtonLabel}</span>
              </button>
            )}
          </div>
        </div>
        <pre className="p-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {activeSnippet}
        </pre>
      </div>

      {/* Supported parameters reference table */}
      <div className="space-y-1.5">
        <div className="font-semibold text-slate-700 dark:text-slate-200 text-[11px]">
          Parâmetros suportados em {`{{Infobox ${tab}}}`}:
        </div>
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                <th className="py-1.5 px-2.5 font-semibold">Parâmetro</th>
                <th className="py-1.5 px-2.5 font-semibold">Rótulo exibido</th>
                <th className="py-1.5 px-2.5 font-semibold">Como usar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {activeFields.map(f => (
                <tr key={f.key} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-1.5 px-2.5 font-mono text-indigo-700 dark:text-indigo-400 whitespace-nowrap">
                    | {f.key}
                  </td>
                  <td className="py-1.5 px-2.5 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {f.label}
                  </td>
                  <td className="py-1.5 px-2.5 text-slate-600 dark:text-slate-400">
                    {f.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
