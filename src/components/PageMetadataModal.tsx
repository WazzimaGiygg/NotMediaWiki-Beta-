import React, { useMemo, useState } from 'react';
import {
  Blocks,
  Globe,
  Plus,
  Settings,
  SlidersHorizontal,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { clientParsoid } from '../services/parsoid';

export type PageMetadataTab =
  | 'categories'
  | 'page-settings'
  | 'advanced'
  | 'languages'
  | 'templates';

export interface WikitextMetadataSnapshot {
  categories: string[];
  interwikiLinks: Array<{ lang: string; title: string }>;
  magicWords: {
    noToc: boolean;
    forceToc: boolean;
    noEditSection: boolean;
    noGallery: boolean;
    disambig: boolean;
    noIndex: boolean;
  };
  displayTitle: string;
  defaultSort: string;
}

export function extractWikitextMetadata(wikitext: string): WikitextMetadataSnapshot {
  const categories: string[] = [];
  const catRegex = /\[\[(?:Category|Categoria):([^\]]+)\]\]/gi;
  let match: RegExpExecArray | null;
  while ((match = catRegex.exec(wikitext)) !== null) {
    const val = (match[1].split('|')[0] || '').replace(/_/g, ' ').trim();
    if (val && !categories.includes(val)) categories.push(val);
  }

  const interwikiLinks: Array<{ lang: string; title: string }> = [];
  const iwRegex = /\[\[(en|es|fr|de|it|pt|ja|zh|ru|ar|nl|pl|sv|uk):([^\]]+)\]\]/gi;
  while ((match = iwRegex.exec(wikitext)) !== null) {
    const lang = match[1].toLowerCase();
    const title = match[2].trim();
    if (!interwikiLinks.some(l => l.lang === lang && l.title === title)) {
      interwikiLinks.push({ lang, title });
    }
  }

  const displayTitleMatch = wikitext.match(/\{\{DISPLAYTITLE:([^}]+)\}\}/i);
  const defaultSortMatch = wikitext.match(/\{\{DEFAULTSORT:([^}]+)\}\}/i);

  return {
    categories,
    interwikiLinks,
    magicWords: {
      noToc: /__NOTOC__/.test(wikitext),
      forceToc: /__FORCETOC__/.test(wikitext),
      noEditSection: /__NOEDITSECTION__/.test(wikitext),
      noGallery: /__NOGALLERY__/.test(wikitext),
      disambig: /__DISAMBIG__/.test(wikitext),
      noIndex: /__NOINDEX__/.test(wikitext),
    },
    displayTitle: displayTitleMatch ? displayTitleMatch[1].trim() : '',
    defaultSort: defaultSortMatch ? defaultSortMatch[1].trim() : '',
  };
}

export function toggleWikitextMagicWord(wikitext: string, magicWord: string, enable: boolean): string {
  const escaped = magicWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cleaned = wikitext
    .replace(new RegExp(`\\n?${escaped}\\n?`, 'g'), '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
  if (!enable) return cleaned;
  return cleaned ? `${cleaned}\n${magicWord}` : magicWord;
}

export function addWikitextCategory(wikitext: string, category: string): string {
  const clean = category.trim();
  if (!clean) return wikitext;
  const existing = extractWikitextMetadata(wikitext).categories;
  if (existing.some(c => c.toLowerCase() === clean.toLowerCase())) return wikitext;
  const trimmed = wikitext.trimEnd();
  const tag = `[[Category:${clean}]]`;
  return trimmed ? `${trimmed}\n${tag}` : tag;
}

export function removeWikitextCategory(wikitext: string, category: string): string {
  const escaped = category.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\ /g, '[ _]+');
  return wikitext
    .replace(new RegExp(`\\n?\\[\\[(?:Category|Categoria):\\s*${escaped}(?:\\|[^\\]]*)?\\s*\\]\\]`, 'gi'), '')
    .replace(/^\n+/, '')
    .trimEnd();
}

export function addInterwikiLink(wikitext: string, lang: string, targetTitle: string): string {
  const cleanLang = lang.trim().toLowerCase();
  const cleanTitle = targetTitle.trim();
  if (!cleanLang || !cleanTitle) return wikitext;
  const tag = `[[${cleanLang}:${cleanTitle}]]`;
  const existing = extractWikitextMetadata(wikitext).interwikiLinks;
  if (existing.some(l => l.lang === cleanLang)) {
    return wikitext.replace(new RegExp(`\\[\\[${cleanLang}:[^\\]]+\\]\\]`, 'i'), tag);
  }
  const trimmed = wikitext.trimEnd();
  return trimmed ? `${trimmed}\n${tag}` : tag;
}

export function removeInterwikiLink(wikitext: string, lang: string): string {
  const cleanLang = lang.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return wikitext
    .replace(new RegExp(`\\n?\\[\\[${cleanLang}:[^\\]]+\\]\\]`, 'gi'), '')
    .replace(/^\n+/, '')
    .trimEnd();
}

export function upsertMagicDirective(
  wikitext: string,
  directiveName: 'DISPLAYTITLE' | 'DEFAULTSORT',
  value: string
): string {
  const clean = value.trim();
  const regex = new RegExp(`\\n?\\{\\{${directiveName}:[^}]+\\}\\}`, 'gi');
  const stripped = wikitext.replace(regex, '').replace(/^\n+/, '').trimEnd();
  if (!clean) return stripped;
  const snippet = `{{${directiveName}:${clean}}}`;
  return stripped ? `${stripped}\n${snippet}` : snippet;
}

interface PageMetadataModalProps {
  isOpen: boolean;
  wikitext: string;
  pageTitle: string;
  initialTab?: PageMetadataTab;
  onUpdateWikitext: (nextWikitext: string) => void;
  onClose: () => void;
}

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English (en)' },
  { code: 'es', label: 'Español (es)' },
  { code: 'fr', label: 'Français (fr)' },
  { code: 'de', label: 'Deutsch (de)' },
  { code: 'it', label: 'Italiano (it)' },
  { code: 'ja', label: '日本語 (ja)' },
  { code: 'zh', label: '中文 (zh)' },
  { code: 'ru', label: 'Русский (ru)' },
];

export const PageMetadataModal: React.FC<PageMetadataModalProps> = ({
  isOpen,
  wikitext,
  pageTitle,
  initialTab = 'categories',
  onUpdateWikitext,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<PageMetadataTab>(initialTab);
  const [newCategory, setNewCategory] = useState('');
  const [newLangCode, setNewLangCode] = useState('en');
  const [newLangTitle, setNewLangTitle] = useState('');

  const snapshot = useMemo(() => extractWikitextMetadata(wikitext), [wikitext]);
  const templateUsage = useMemo(() => {
    const parsed = clientParsoid.parse(wikitext, pageTitle);
    return {
      used: parsed.usedTemplates || [],
      missing: parsed.missingTemplates || [],
    };
  }, [wikitext, pageTitle]);

  if (!isOpen) return null;

  const tabs: Array<{ id: PageMetadataTab; label: string; icon: React.ReactNode }> = [
    { id: 'categories', label: 'Categorias', icon: <Tag className="w-3.5 h-3.5" /> },
    { id: 'page-settings', label: 'Configurações da página', icon: <Settings className="w-3.5 h-3.5" /> },
    { id: 'advanced', label: 'Configurações avançadas', icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
    { id: 'languages', label: 'Idiomas', icon: <Globe className="w-3.5 h-3.5" /> },
    { id: 'templates', label: 'Predefinições usadas', icon: <Blocks className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Metadados da Página"
      data-testid="page-metadata-modal"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Metadados e Opções da Página
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Gerencie categorias, comportamento do sumário, diretivas avançadas, interwikis e predefinições.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar metadados da página"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Seções de metadados da página"
          className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900 flex flex-wrap gap-1.5"
        >
          {tabs.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`metadata-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1.5 rounded border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  active
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'categories' && (
            <div className="space-y-4">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (!newCategory.trim()) return;
                  onUpdateWikitext(addWikitextCategory(wikitext, newCategory));
                  setNewCategory('');
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  placeholder="Adicionar categoria (ex.: Enciclopédia, Software, História)"
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar
                </button>
              </form>

              {snapshot.categories.length === 0 ? (
                <div className="p-4 rounded border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-center">
                  Nenhuma categoria associada a este artigo ainda.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {snapshot.categories.map(cat => (
                    <div
                      key={cat}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-100 truncate">
                        [[Category:{cat}]]
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateWikitext(removeWikitextCategory(wikitext, cat))}
                        aria-label={`Remover categoria ${cat}`}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'page-settings' && (
            <div className="space-y-3">
              {[
                {
                  key: 'noToc' as const,
                  word: '__NOTOC__',
                  title: 'Ocultar índice / sumário (__NOTOC__)',
                  desc: 'Impede a exibição automática da tabela de conteúdo nesta página.',
                },
                {
                  key: 'forceToc' as const,
                  word: '__FORCETOC__',
                  title: 'Forçar exibição do sumário (__FORCETOC__)',
                  desc: 'Exibe o sumário mesmo com poucas seções no artigo.',
                },
                {
                  key: 'noEditSection' as const,
                  word: '__NOEDITSECTION__',
                  title: 'Ocultar links de edição por seção (__NOEDITSECTION__)',
                  desc: 'Remove os botões [editar] individuais nos títulos de seção.',
                },
                {
                  key: 'noGallery' as const,
                  word: '__NOGALLERY__',
                  title: 'Desativar miniatura em galerias (__NOGALLERY__)',
                  desc: 'Exibe galerias de categoria apenas como lista de arquivos.',
                },
                {
                  key: 'disambig' as const,
                  word: '__DISAMBIG__',
                  title: 'Marcar como página de desambiguação (__DISAMBIG__)',
                  desc: 'Identifica a página como índice de termos homônimos.',
                },
              ].map(item => (
                <label
                  key={item.word}
                  className="flex items-start gap-3 p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700"
                >
                  <input
                    type="checkbox"
                    checked={snapshot.magicWords[item.key]}
                    onChange={e =>
                      onUpdateWikitext(toggleWikitextMagicWord(wikitext, item.word, e.target.checked))
                    }
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">{item.title}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{item.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-800 dark:text-slate-200">
                  Título de exibição personalizado (DISPLAYTITLE)
                </label>
                <input
                  type="text"
                  value={snapshot.displayTitle}
                  onChange={e =>
                    onUpdateWikitext(upsertMagicDirective(wikitext, 'DISPLAYTITLE', e.target.value))
                  }
                  placeholder="Ex.: eBay ou NotMediaWiki (v2.0)"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-800 dark:text-slate-200">
                  Chave de ordenação em categorias (DEFAULTSORT)
                </label>
                <input
                  type="text"
                  value={snapshot.defaultSort}
                  onChange={e =>
                    onUpdateWikitext(upsertMagicDirective(wikitext, 'DEFAULTSORT', e.target.value))
                  }
                  placeholder="Ex.: Silva, Joao"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600"
                />
              </div>

              <label className="flex items-start gap-3 p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={snapshot.magicWords.noIndex}
                  onChange={e =>
                    onUpdateWikitext(toggleWikitextMagicWord(wikitext, '__NOINDEX__', e.target.checked))
                  }
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100">
                    Desativar indexação por motores de busca (__NOINDEX__)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Solicita que rastreadores externos não indexem esta página.
                  </div>
                </div>
              </label>
            </div>
          )}

          {activeTab === 'languages' && (
            <div className="space-y-4">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (!newLangTitle.trim()) return;
                  onUpdateWikitext(addInterwikiLink(wikitext, newLangCode, newLangTitle));
                  setNewLangTitle('');
                }}
                className="flex flex-wrap gap-2"
              >
                <select
                  value={newLangCode}
                  onChange={e => setNewLangCode(e.target.value)}
                  aria-label="Selecionar idioma interwiki"
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                >
                  {LANGUAGE_OPTIONS.map(opt => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newLangTitle}
                  onChange={e => setNewLangTitle(e.target.value)}
                  placeholder="Título equivalente no idioma selecionado"
                  className="flex-1 min-w-[180px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Vincular Idioma
                </button>
              </form>

              {snapshot.interwikiLinks.length === 0 ? (
                <div className="p-4 rounded border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-center">
                  Nenhum vínculo interlíngua configurado (ex.: [[en:Article]]).
                </div>
              ) : (
                <div className="space-y-2">
                  {snapshot.interwikiLinks.map(iw => (
                    <div
                      key={`${iw.lang}-${iw.title}`}
                      className="flex items-center justify-between px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60"
                    >
                      <span className="font-mono text-slate-800 dark:text-slate-100">
                        [[{iw.lang}:{iw.title}]]
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateWikitext(removeInterwikiLink(wikitext, iw.lang))}
                        aria-label={`Remover idioma ${iw.lang}`}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Predefinições detectadas automaticamente no conteúdo atual da página:
              </div>
              {templateUsage.used.length === 0 && templateUsage.missing.length === 0 ? (
                <div className="p-4 rounded border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-center">
                  Nenhuma predefinição &#123;&#123;...&#125;&#125; está em uso neste artigo.
                </div>
              ) : (
                <div className="space-y-2">
                  {templateUsage.used.map(tpl => (
                    <div
                      key={`used-${tpl}`}
                      className="flex items-center justify-between px-3 py-2 rounded border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200"
                    >
                      <span className="font-mono font-semibold">&#123;&#123;{tpl}&#125;&#125;</span>
                      <span className="text-[11px]">Ativa</span>
                    </div>
                  ))}
                  {templateUsage.missing.map(tpl => (
                    <div
                      key={`missing-${tpl}`}
                      className="flex items-center justify-between px-3 py-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
                    >
                      <span className="font-mono font-semibold">&#123;&#123;{tpl}&#125;&#125;</span>
                      <span className="text-[11px]">Não definida</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded font-semibold cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};

export default PageMetadataModal;
