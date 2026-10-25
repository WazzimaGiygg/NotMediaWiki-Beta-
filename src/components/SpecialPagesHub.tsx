import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Search,
  Filter,
  FileText,
  Clock,
  Link2,
  Users,
  Download,
  Upload,
  ArrowRight,
  Database,
  Layers,
  Shield,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FolderTree,
  ExternalLink,
  ChevronRight,
  Sliders,
  Eye,
  Tag,
  Share2,
} from 'lucide-react';
import { Article, Revision, UserSession, WikiEvent } from '../types';
import { api } from '../api';
import { MEDIAWIKI_NAMESPACES, getAvailableNamespaces, parseTitle } from '../utils/namespaces';
import { generateMediaWikiXmlDump, parseMediaWikiXmlDump } from '../utils/wikiXmlDump';
import { parseSemanticFacts, SemanticPageData } from '../utils/semanticParser';
import { CategoryTreeView } from './CategoryTreeView';

interface SpecialPagesHubProps {
  initialSpecialPage?: string;
  onNavigateArticle: (slug: string) => void;
  onOpenEdit: (slug: string) => void;
  onOpenHistory: (slug: string) => void;
  currentUser?: UserSession | null;
}

export const SpecialPagesHub: React.FC<SpecialPagesHubProps> = ({
  initialSpecialPage = 'SpecialPages',
  onNavigateArticle,
  onOpenEdit,
  onOpenHistory,
  currentUser,
}) => {
  const [activePage, setActivePage] = useState<string>(initialSpecialPage);
  const [articles, setArticles] = useState<Article[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [events, setEvents] = useState<WikiEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters for Special:RecentChanges
  const [rcNamespace, setRcNamespace] = useState<number | 'all'>('all');
  const [rcHideBots, setRcHideBots] = useState<boolean>(false);
  const [rcHideMinor, setRcHideMinor] = useState<boolean>(false);

  // Filters for Special:AllPages
  const [allPagesNamespace, setAllPagesNamespace] = useState<number>(0);
  const [allPagesPrefix, setAllPagesPrefix] = useState<string>('');

  // WhatLinksHere state
  const [whatLinksTarget, setWhatLinksTarget] = useState<string>('MediaWiki');

  // Contributions state
  const [contribUser, setContribUser] = useState<string>('');

  // XML Import state
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  useEffect(() => {
    setActivePage(initialSpecialPage);
  }, [initialSpecialPage]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getArticles(),
      api.getEventHistory(100).catch(() => []),
    ]).then(([arts, evts]) => {
      setArticles(arts);
      setEvents(evts);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Filtered Recent Changes
  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      if (rcNamespace !== 'all' && evt.page_namespace !== rcNamespace) return false;
      if (rcHideMinor && evt.rev_minor_edit) return false;
      if (rcHideBots && evt.user_text.toLowerCase().includes('bot')) return false;
      return true;
    });
  }, [events, rcNamespace, rcHideMinor, rcHideBots]);

  // Filtered AllPages
  const filteredAllPages = useMemo(() => {
    return articles.filter(art => {
      const parsed = parseTitle(art.title);
      if (parsed.namespaceId !== allPagesNamespace) return false;
      if (allPagesPrefix.trim()) {
        const p = allPagesPrefix.toLowerCase().trim();
        return parsed.baseTitle.toLowerCase().startsWith(p) || art.title.toLowerCase().startsWith(p);
      }
      return true;
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [articles, allPagesNamespace, allPagesPrefix]);

  // Semantic Data across all pages
  const semanticDatabase = useMemo(() => {
    return articles.map(art => parseSemanticFacts(art.slug, art.title, art.wikitext));
  }, [articles]);

  // WhatLinksHere calculation
  const whatLinksResults = useMemo(() => {
    const targetClean = whatLinksTarget.toLowerCase().replace(/_/g, ' ');
    return articles.filter(art => {
      if (art.slug === whatLinksTarget) return false;
      const lowerText = art.wikitext.toLowerCase();
      return (
        lowerText.includes(`[[${targetClean}]]`) ||
        lowerText.includes(`[[${targetClean}|`) ||
        lowerText.includes(`{{${targetClean}}}`) ||
        lowerText.includes(targetClean)
      );
    });
  }, [articles, whatLinksTarget]);

  // User Contributions calculation
  const userContributions = useMemo(() => {
    if (!contribUser.trim()) return [];
    const target = contribUser.toLowerCase().trim();
    return events.filter(evt => evt.user_text.toLowerCase().includes(target));
  }, [events, contribUser]);

  // Export XML Dump
  const handleExportXml = () => {
    const xml = generateMediaWikiXmlDump(articles);
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notmediawiki_dump_${new Date().toISOString().substring(0, 10)}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import XML Dump
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const text = event.target?.result as string;
        const imported = parseMediaWikiXmlDump(text);
        if (imported.length === 0) {
          setImportFeedback('Nenhuma página válida encontrada no arquivo XML.');
          return;
        }

        let savedCount = 0;
        for (const page of imported) {
          const latestRev = page.revisions[page.revisions.length - 1];
          if (latestRev) {
            await api.saveArticle({
              slug: page.slug,
              title: page.title,
              wikitext: latestRev.wikitext,
              comment: latestRev.comment || 'Importado via Especial:Importar',
              authorUser: currentUser || null,
              isMinor: false,
              namespace: page.namespace,
            });
            savedCount++;
          }
        }

        setImportFeedback(`Sucesso! ${savedCount} páginas e revisões importadas para o banco.`);
        const freshArts = await api.getArticles();
        setArticles(freshArts);
      } catch (err: any) {
        setImportFeedback(`Erro na importação XML: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Central de Páginas Especiais (Special Pages)
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                MediaWiki Core Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Índice completo de ferramentas administrativas, feeds de alterações em tempo real, taxonomia e interoperabilidade XML.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportXml}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Exportar dump XML completo da enciclopédia"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Dump XML</span>
            </button>
          </div>
        </div>

        {/* Special Pages Navigation Pills */}
        <div className="flex items-center gap-1.5 pt-3 overflow-x-auto no-scrollbar">
          {[
            { id: 'SpecialPages', label: 'Índice de Especiais', icon: Layers },
            { id: 'RecentChanges', label: 'Mudanças Recentes (RecentChanges)', icon: Clock },
            { id: 'AllPages', label: 'Todas as Páginas (AllPages)', icon: FileText },
            { id: 'Categories', label: 'Árvore de Categorias', icon: FolderTree },
            { id: 'SemanticData', label: 'Dados Estruturados (SMW / Cargo)', icon: Database },
            { id: 'WhatLinksHere', label: 'Páginas afluentes (WhatLinksHere)', icon: Link2 },
            { id: 'Contributions', label: 'Contribuições de Usuário', icon: Users },
            { id: 'Import', label: 'Importar Dump XML', icon: Upload },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activePage === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActivePage(tab.id)}
                className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-blue-600 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW: SPECIAL:SPECIALPAGES (INDEX) */}
      {activePage === 'SpecialPages' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Especial:PáginasEspeciais (Special:SpecialPages)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Lista agrupada de todas as páginas especiais integradas do NotMediaWiki.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
            {/* Grupo 1: Mudanças Recentes e Registos */}
            <div className="space-y-2.5 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Mudanças e Registos</span>
              </h3>
              <ul className="space-y-1.5 text-slate-600 dark:text-slate-400">
                <li>
                  <button onClick={() => setActivePage('RecentChanges')} className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                    Especial:MudançasRecentes
                  </button>
                  <p className="text-[11px] text-slate-400">Acompanhamento de edições, deltas e bots em tempo real.</p>
                </li>
                <li>
                  <button onClick={() => setActivePage('WhatLinksHere')} className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                    Especial:PáginasAfluentes
                  </button>
                  <p className="text-[11px] text-slate-400">Verbetes que apontam para uma página específica.</p>
                </li>
                <li>
                  <button onClick={() => setActivePage('Contributions')} className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                    Especial:Contribuições
                  </button>
                  <p className="text-[11px] text-slate-400">Histórico de contribuições por editor ou endereço IP.</p>
                </li>
              </ul>
            </div>

            {/* Grupo 2: Listas de Páginas e Conteúdo */}
            <div className="space-y-2.5 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Páginas e Conteúdo</span>
              </h3>
              <ul className="space-y-1.5 text-slate-600 dark:text-slate-400">
                <li>
                  <button onClick={() => setActivePage('AllPages')} className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                    Especial:TodasAsPáginas
                  </button>
                  <p className="text-[11px] text-slate-400">Lista completa com seletor de namespace e prefixos.</p>
                </li>
                <li>
                  <button onClick={() => setActivePage('Categories')} className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                    Especial:ÁrvoreDeCategorias
                  </button>
                  <p className="text-[11px] text-slate-400">Taxonomia hierárquica e subcategorias expansíveis.</p>
                </li>
                <li>
                  <button onClick={() => setActivePage('SemanticData')} className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                    Especial:DadosEstruturados
                  </button>
                  <p className="text-[11px] text-slate-400">Semantic MediaWiki / Cargo factboxes e consultas.</p>
                </li>
              </ul>
            </div>

            {/* Grupo 3: Interoperabilidade e Migração */}
            <div className="space-y-2.5 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-purple-600" />
                <span>Interoperabilidade & Dump XML</span>
              </h3>
              <ul className="space-y-1.5 text-slate-600 dark:text-slate-400">
                <li>
                  <button onClick={handleExportXml} className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                    Especial:Exportar (XML Dump 0.11)
                  </button>
                  <p className="text-[11px] text-slate-400">Geração de dump XML oficial para backup ou migração.</p>
                </li>
                <li>
                  <button onClick={() => setActivePage('Import')} className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                    Especial:Importar (Dump XML)
                  </button>
                  <p className="text-[11px] text-slate-400">Ingestão de páginas e revisões de arquivos XML da Wikipédia.</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: SPECIAL:RECENTCHANGES */}
      {activePage === 'RecentChanges' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Especial:MudançasRecentes (Special:RecentChanges)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Feed em tempo real com deltas de caracteres, namespaces e sinalização de bots.
              </p>
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Namespace:</label>
              <select
                value={rcNamespace}
                onChange={e => setRcNamespace(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="w-full border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
              >
                <option value="all">Todos os namespaces</option>
                {getAvailableNamespaces().map(ns => (
                  <option key={ns.id} value={ns.id}>
                    {ns.id}: {ns.localized || ns.canonical || '(Principal)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4 pt-4 sm:pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={rcHideBots}
                  onChange={e => setRcHideBots(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Ocultar robôs (bots)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={rcHideMinor}
                  onChange={e => setRcHideMinor(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Ocultar edições menores (m)</span>
              </label>
            </div>
          </div>

          {/* Recent Changes List */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredEvents.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhuma alteração registrada com os filtros selecionados.
              </div>
            ) : (
              filteredEvents.map(evt => {
                const lenDelta = evt.rev_len || 0;
                const isPositive = lenDelta >= 0;

                return (
                  <div
                    key={evt.id}
                    className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-50/60 dark:hover:bg-slate-800/40 px-2 rounded"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(evt.rev_timestamp).toLocaleTimeString('pt-BR')}
                      </span>

                      {evt.rev_minor_edit && (
                        <span className="text-[10px] font-mono font-bold px-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300" title="Edição menor">
                          m
                        </span>
                      )}

                      <button
                        onClick={() => onNavigateArticle(evt.page_title)}
                        className="font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer"
                      >
                        {evt.page_title}
                      </button>

                      <span
                        className={`text-[11px] font-mono font-bold px-1.5 py-0.2 rounded ${
                          isPositive
                            ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400'
                            : 'text-rose-700 bg-rose-50 dark:bg-rose-950 dark:text-rose-400'
                        }`}
                      >
                        {isPositive ? `+${lenDelta}` : `${lenDelta}`}
                      </span>

                      <span className="text-slate-400">·</span>

                      <span className="font-mono text-slate-600 dark:text-slate-300">
                        {evt.user_text}
                      </span>

                      {evt.comment && (
                        <span className="text-slate-500 italic text-[11px]">
                          ({evt.comment})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        onClick={() => onOpenHistory(evt.page_title)}
                        className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        histórico
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW: SPECIAL:ALLPAGES */}
      {activePage === 'AllPages' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Especial:TodasAsPáginas (Special:AllPages)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Navegação alfabética e filtragem por namespace.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Total: {filteredAllPages.length} páginas
            </span>
          </div>

          {/* Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Namespace:</label>
              <select
                value={allPagesNamespace}
                onChange={e => setAllPagesNamespace(Number(e.target.value))}
                className="w-full border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
              >
                {getAvailableNamespaces().map(ns => (
                  <option key={ns.id} value={ns.id}>
                    {ns.id}: {ns.localized || ns.canonical || '(Principal)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Filtrar por prefixo:</label>
              <input
                type="text"
                placeholder="Ex: Med..."
                value={allPagesPrefix}
                onChange={e => setAllPagesPrefix(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
              />
            </div>
          </div>

          {/* Pages Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2">
            {filteredAllPages.map(page => (
              <div
                key={page.slug}
                className="p-2.5 rounded border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between"
              >
                <button
                  onClick={() => onNavigateArticle(page.slug)}
                  className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline text-left truncate cursor-pointer flex-1"
                >
                  {page.title}
                </button>
                <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">
                  {page.wikitext.length} B
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW: SPECIAL:CATEGORIES (CategoryTree) */}
      {activePage === 'Categories' && (
        <CategoryTreeView
          articles={articles}
          onNavigateArticle={onNavigateArticle}
        />
      )}

      {/* VIEW: SPECIAL:SEMANTICDATA (SMW / Cargo) */}
      {activePage === 'SemanticData' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-600" />
                <span>Especial:DadosEstruturados (Semantic MediaWiki / Cargo Explorer)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Propriedades tipadas e dados queryáveis extraídos automaticamente das anotações <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">[[Propriedade::Valor]]</code>.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {semanticDatabase.map(page => {
              if (page.facts.length === 0) return null;
              return (
                <div key={page.slug} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => onNavigateArticle(page.slug)}
                      className="font-bold text-sm text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      {page.title}
                    </button>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                      {page.facts.length} propriedades
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {page.facts.map((fact, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono"
                      >
                        <span className="font-semibold text-purple-700 dark:text-purple-400">{fact.property}:</span>
                        <span>{String(fact.parsedValue)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: SPECIAL:WHATLINKSHERE */}
      {activePage === 'WhatLinksHere' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-4">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-blue-600" />
              <span>Especial:PáginasAfluentes (Special:WhatLinksHere)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Identifica todas as páginas que contêm links internos apontando para este verbete.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label className="font-semibold text-slate-700 dark:text-slate-300">Página de destino:</label>
            <select
              value={whatLinksTarget}
              onChange={e => setWhatLinksTarget(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
            >
              {articles.map(a => (
                <option key={a.slug} value={a.slug}>
                  {a.title} ({a.slug})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 divide-y divide-slate-100 dark:divide-slate-800">
            <div className="text-xs font-semibold text-slate-500 pb-2">
              Páginas que apontam para &ldquo;{whatLinksTarget}&rdquo; ({whatLinksResults.length}):
            </div>
            {whatLinksResults.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Nenhuma página aponta diretamente para este artigo.
              </div>
            ) : (
              whatLinksResults.map(art => (
                <div key={art.slug} className="py-2 flex items-center justify-between text-xs">
                  <button
                    onClick={() => onNavigateArticle(art.slug)}
                    className="text-blue-700 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                  >
                    {art.title}
                  </button>
                  <span className="text-[10px] font-mono text-slate-400">
                    link direto
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW: SPECIAL:CONTRIBUTIONS */}
      {activePage === 'Contributions' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-4">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Especial:Contribuições (Special:Contributions)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Filtre e audite as edições realizadas por um editor específico.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label className="font-semibold text-slate-700 dark:text-slate-300">Editor / IP:</label>
            <input
              type="text"
              placeholder="Digite o nome de usuário (ex: CitationBot, Editor)..."
              value={contribUser}
              onChange={e => setContribUser(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs flex-1 max-w-sm"
            />
          </div>

          <div className="pt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {userContributions.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                {contribUser ? 'Nenhuma edição encontrada para este usuário.' : 'Digite o nome do editor acima para listar as contribuições.'}
              </div>
            ) : (
              userContributions.map(evt => (
                <div key={evt.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(evt.rev_timestamp).toLocaleDateString('pt-BR')} {new Date(evt.rev_timestamp).toLocaleTimeString('pt-BR')}
                    </span>
                    <button
                      onClick={() => onNavigateArticle(evt.page_title)}
                      className="font-bold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      {evt.page_title}
                    </button>
                    {evt.comment && (
                      <span className="text-slate-500 italic text-[11px]">
                        ({evt.comment})
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW: SPECIAL:IMPORT (MediaWiki XML Dump) */}
      {activePage === 'Import' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 shadow-xs space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              <span>Especial:Importar (MediaWiki XML Dump Ingestion)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Carregue dumps XML exportados de qualquer instalação oficial da MediaWiki ou Wikipédia para importar páginas, metadados e histórico de revisões.
            </p>
          </div>

          <div className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-center space-y-3 bg-slate-50/50 dark:bg-slate-800/30">
            <Upload className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-xs text-slate-600 dark:text-slate-300">
              Selecione um arquivo <code className="font-mono bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">.xml</code> de dump da MediaWiki
            </div>
            <input
              type="file"
              accept=".xml"
              onChange={handleFileImport}
              className="text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
          </div>

          {importFeedback && (
            <div className={`p-3 rounded text-xs flex items-center gap-2 ${
              importFeedback.startsWith('Sucesso')
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{importFeedback}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
