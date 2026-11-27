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
  Shuffle,
  Star,
  Bell,
  Blocks,
  Plus,
  Edit3,
} from 'lucide-react';
import { Article, Revision, UserSession, WikiEvent, WatchlistSubscription } from '../types';
import { api } from '../api';
import { MEDIAWIKI_NAMESPACES, getAvailableNamespaces, parseTitle } from '../utils/namespaces';
import { generateMediaWikiXmlDump, parseMediaWikiXmlDump } from '../utils/wikiXmlDump';
import { parseSemanticFacts, SemanticPageData } from '../utils/semanticParser';
import { CategoryTreeView } from './CategoryTreeView';
import { CategoryExplorer } from './CategoryExplorer';
import { RecentChangesPage } from './RecentChangesPage';
import { BUILTIN_MEDIAWIKI_TEMPLATES, TEMPLATE_CATEGORY_LABELS } from '../data/defaultTemplates';
import { TEMPLATE_EXAMPLE_SLUG } from '../data/templateExampleArticle';
import { extractTemplateDeclaredParams } from '../utils/templateEngine';
import { useExtensions } from '../context/ExtensionsContext';

function resolveSpecialPageTarget(raw?: string): { page: string; contribFilter?: string } {
  const value = (raw || 'SpecialPages').trim();
  const contribMatch = value.match(/^(?:Contributions|Contribuições|Contribuicoes)[:/](.+)$/i);
  if (contribMatch) {
    return { page: 'Contributions', contribFilter: contribMatch[1].trim() };
  }

  const normalized = value
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const map: Record<string, string> = {
    specialpages: 'SpecialPages',
    paginasespeciais: 'SpecialPages',
    recentchanges: 'RecentChanges',
    mudancasrecentes: 'RecentChanges',
    allpages: 'AllPages',
    todasaspaginas: 'AllPages',
    templates: 'Templates',
    predefinicoes: 'Templates',
    predefinicao: 'Templates',
    categoryexplorer: 'CategoryExplorer',
    exploradordecategorias: 'CategoryExplorer',
    exploradorcategorias: 'CategoryExplorer',
    categories: 'Categories',
    categorias: 'Categories',
    arvoredecategorias: 'Categories',
    semanticdata: 'SemanticData',
    dadosestruturados: 'SemanticData',
    whatlinkshere: 'WhatLinksHere',
    paginasafluentes: 'WhatLinksHere',
    contributions: 'Contributions',
    contribuicoes: 'Contributions',
    import: 'Import',
    importar: 'Import',
    watchlist: 'Watchlist',
    paginasvigiadas: 'Watchlist',
  };

  return { page: map[normalized] || value || 'SpecialPages' };
}

interface SpecialPagesHubProps {
  initialSpecialPage?: string;
  onNavigateArticle: (slug: string) => void;
  onOpenEdit: (slug: string) => void;
  onOpenHistory: (slug: string) => void;
  onOpenUser?: (username: string) => void;
  currentUser?: UserSession | null;
  onRandomArticle?: () => void;
}

export const SpecialPagesHub: React.FC<SpecialPagesHubProps> = ({
  initialSpecialPage = 'SpecialPages',
  onNavigateArticle,
  onOpenEdit,
  onOpenHistory,
  onOpenUser,
  currentUser,
  onRandomArticle,
}) => {
  const { isExtensionEnabled } = useExtensions();
  const isTemplatesEnabled = isExtensionEnabled ? isExtensionEnabled('MediaWikiTemplates', true) : true;
  const isCategoriesEnabled = isExtensionEnabled ? isExtensionEnabled('CategoryTree', true) : true;
  const isCargoEnabled = isExtensionEnabled ? isExtensionEnabled('Cargo', true) : true;
  const isWatchlistEnabled = isExtensionEnabled ? isExtensionEnabled('WatchlistSubscriptions', true) : true;
  const isRecentChangesEnabled = isExtensionEnabled ? isExtensionEnabled('EventStreams', true) : true;
  const isRandomEnabled = isExtensionEnabled ? isExtensionEnabled('RandomArticle', true) : true;

  const initialResolved = resolveSpecialPageTarget(initialSpecialPage);
  const [activePage, setActivePage] = useState<string>(initialResolved.page);
  const [articles, setArticles] = useState<Article[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [events, setEvents] = useState<WikiEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters for Special:AllPages
  const [allPagesNamespace, setAllPagesNamespace] = useState<number>(0);
  const [allPagesPrefix, setAllPagesPrefix] = useState<string>('');

  // WhatLinksHere state
  const [whatLinksTarget, setWhatLinksTarget] = useState<string>('MediaWiki');

  // Contributions state
  const [contribUser, setContribUser] = useState<string>(initialResolved.contribFilter || '');

  // XML Import state
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  // Watchlist (Special:Watchlist) state
  const [watchlist, setWatchlist] = useState<WatchlistSubscription[]>([]);
  const [pushFeedback, setPushFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pushPermission, setPushPermission] = useState<string>(() => api.getWebPushPermissionState());

  // New Namespace 10 template quick-create input
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = api.subscribeUserWatchlist(currentUser.id, list => {
      setWatchlist(list);
    });
    return () => unsub();
  }, [currentUser?.id]);

  useEffect(() => {
    const resolved = resolveSpecialPageTarget(initialSpecialPage);
    setActivePage(resolved.page);
    if (resolved.contribFilter !== undefined) {
      setContribUser(resolved.contribFilter);
    }
  }, [initialSpecialPage]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getArticles(),
      api.getRecentChanges(120).catch(() => []),
    ]).then(([arts, evts]) => {
      setArticles(arts);
      setEvents(evts);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

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

  const handleRandomPage = async () => {
    if (!isRandomEnabled) return;
    if (onRandomArticle) {
      onRandomArticle();
      return;
    }
    try {
      const random = await api.getRandomArticle();
      if (random && random.slug) {
        onNavigateArticle(random.slug);
      }
    } catch (err) {
      console.warn('Erro ao abrir página aleatória:', err);
    }
  };

  // Namespace 10 Custom Templates
  const customTemplatePages = useMemo(() => {
    return articles
      .filter(art => art.namespace === 10 || parseTitle(art.title || art.slug).namespaceId === 10)
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [articles]);

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
            { id: 'SpecialPages', label: 'Índice de Especiais', icon: Layers, visible: true },
            { id: 'RecentChanges', label: 'Mudanças Recentes (RecentChanges)', icon: Clock, visible: isRecentChangesEnabled },
            { id: 'AllPages', label: 'Todas as Páginas (AllPages)', icon: FileText, visible: true },
            { id: 'Templates', label: 'Predefinições (Templates)', icon: Blocks, visible: isTemplatesEnabled },
            { id: 'CategoryExplorer', label: 'Explorador de Categorias', icon: Tag, visible: isCategoriesEnabled },
            { id: 'Categories', label: 'Árvore de Categorias', icon: FolderTree, visible: isCategoriesEnabled },
            { id: 'SemanticData', label: 'Dados Estruturados (SMW / Cargo)', icon: Database, visible: isCargoEnabled },
            { id: 'WhatLinksHere', label: 'Páginas afluentes (WhatLinksHere)', icon: Link2, visible: true },
            { id: 'Contributions', label: 'Contribuições de Usuário', icon: Users, visible: true },
            { id: 'Import', label: 'Importar Dump XML', icon: Upload, visible: true },
          ]
            .filter(tab => tab.visible)
            .map(tab => {
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
                {isRecentChangesEnabled && (
                  <li>
                    <button onClick={() => setActivePage('RecentChanges')} className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                      Especial:MudançasRecentes
                    </button>
                    <p className="text-[11px] text-slate-400">Acompanhamento de edições, deltas e bots em tempo real.</p>
                  </li>
                )}
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
                {isTemplatesEnabled && (
                  <li>
                    <button onClick={() => setActivePage('Templates')} className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1 font-semibold">
                      <Blocks className="w-3 h-3 text-indigo-500" />
                      <span>Especial:Predefinições (Namespace 10)</span>
                    </button>
                    <p className="text-[11px] text-slate-400">Catálogo de predefinições padrão e modelos reutilizáveis criados no Firebase.</p>
                  </li>
                )}
                {isCategoriesEnabled && (
                  <>
                    <li>
                      <button onClick={() => setActivePage('CategoryExplorer')} className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-semibold">
                        Especial:ExploradorDeCategorias (CategoryExplorer)
                      </button>
                      <p className="text-[11px] text-slate-400">Listagem de todas as categorias existentes com painel de artigos associados.</p>
                    </li>
                    <li>
                      <button onClick={() => setActivePage('Categories')} className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                        Especial:ÁrvoreDeCategorias
                      </button>
                      <p className="text-[11px] text-slate-400">Taxonomia hierárquica e subcategorias expansíveis.</p>
                    </li>
                  </>
                )}
                {isCargoEnabled && (
                  <li>
                    <button onClick={() => setActivePage('SemanticData')} className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                      Especial:DadosEstruturados
                    </button>
                    <p className="text-[11px] text-slate-400">Semantic MediaWiki / Cargo factboxes e consultas.</p>
                  </li>
                )}
                {isRandomEnabled && (
                  <li>
                    <button onClick={handleRandomPage} className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1 font-semibold">
                      <Shuffle className="w-3 h-3 text-indigo-500" />
                      <span>Especial:PáginaAleatória (Special:Random)</span>
                    </button>
                    <p className="text-[11px] text-slate-400">Navega imediatamente para um verbete enciclopédico sorteado ao acaso.</p>
                  </li>
                )}
                {isWatchlistEnabled && (
                  <li>
                    <button onClick={() => setActivePage('Watchlist')} className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1 font-semibold">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span>Especial:PáginasVigiadas (Special:Watchlist)</span>
                    </button>
                    <p className="text-[11px] text-slate-400">Artigos que você segue com notificações push e registro de edições recentes.</p>
                  </li>
                )}
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
                <li>
                  <button
                    onClick={() => {
                      window.location.hash = '#/burocratas';
                    }}
                    className="text-purple-700 dark:text-purple-400 hover:underline cursor-pointer font-semibold"
                  >
                    Especial:Burocratas (Gerenciador de Extensões)
                  </button>
                  <p className="text-[11px] text-slate-400">Página oficial dos burocratas com configuração de extensões no Firebase.</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: SPECIAL:RECENTCHANGES */}
      {activePage === 'RecentChanges' && !isRecentChangesEnabled && (
        <DisabledSpecialExtensionNotice
          extensionName="EventStreams"
          title="Mudanças Recentes (Special:RecentChanges)"
          onBackToIndex={() => setActivePage('SpecialPages')}
        />
      )}
      {activePage === 'RecentChanges' && isRecentChangesEnabled && (
        <RecentChangesPage
          embedded
          initialEvents={events.length > 0 ? events : undefined}
          onNavigateArticle={onNavigateArticle}
          onOpenHistory={onOpenHistory}
          onOpenUser={
            onOpenUser ||
            (username => {
              setContribUser(username);
              setActivePage('Contributions');
            })
          }
        />
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

      {/* VIEW: SPECIAL:CATEGORYEXPLORER */}
      {activePage === 'CategoryExplorer' && !isCategoriesEnabled && (
        <DisabledSpecialExtensionNotice
          extensionName="CategoryTree"
          title="Explorador de Categorias (CategoryExplorer)"
          onBackToIndex={() => setActivePage('SpecialPages')}
        />
      )}
      {activePage === 'CategoryExplorer' && isCategoriesEnabled && (
        <CategoryExplorer
          articles={articles}
          onNavigateArticle={onNavigateArticle}
          onOpenHistory={onOpenHistory}
        />
      )}

      {/* VIEW: SPECIAL:CATEGORIES (CategoryTree) */}
      {activePage === 'Categories' && !isCategoriesEnabled && (
        <DisabledSpecialExtensionNotice
          extensionName="CategoryTree"
          title="Árvore de Categorias (Special:Categories)"
          onBackToIndex={() => setActivePage('SpecialPages')}
        />
      )}
      {activePage === 'Categories' && isCategoriesEnabled && (
        <CategoryTreeView
          articles={articles}
          onNavigateArticle={onNavigateArticle}
        />
      )}

      {/* VIEW: SPECIAL:SEMANTICDATA (SMW / Cargo) */}
      {activePage === 'SemanticData' && !isCargoEnabled && (
        <DisabledSpecialExtensionNotice
          extensionName="Cargo"
          title="Dados Estruturados (SMW / Cargo)"
          onBackToIndex={() => setActivePage('SpecialPages')}
        />
      )}
      {activePage === 'SemanticData' && isCargoEnabled && (
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

      {/* VIEW: SPECIAL:WATCHLIST (Páginas Vigiadas) */}
      {activePage === 'Watchlist' && !isWatchlistEnabled && (
        <DisabledSpecialExtensionNotice
          extensionName="WatchlistSubscriptions"
          title="Páginas Vigiadas (Special:Watchlist)"
          onBackToIndex={() => setActivePage('SpecialPages')}
        />
      )}
      {activePage === 'Watchlist' && isWatchlistEnabled && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <span>Especial:PáginasVigiadas (Special:Watchlist)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Monitore os artigos de seu interesse. Quando um artigo sofrer alterações, notificações push via Firebase Cloud Messaging e alertas internos serão disparados.
              </p>
            </div>
            {currentUser?.id && (
              <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                <span
                  className={`px-2 py-1 rounded text-[10px] font-mono border ${
                    pushPermission === 'granted'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : pushPermission === 'denied'
                        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {pushPermission === 'granted'
                    ? 'Web Push: Ativo'
                    : pushPermission === 'denied'
                      ? 'Web Push: Bloqueado'
                      : pushPermission === 'unsupported'
                        ? 'Web Push: Indisponível'
                        : 'Web Push: Aguardando permissão'}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await api.requestWebPushPermission(currentUser.id);
                    setPushPermission(res.permission);
                    setPushFeedback({
                      type: res.permission === 'granted' ? 'success' : 'error',
                      text: res.message,
                    });
                  }}
                  className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5 text-blue-600" />
                  <span>{pushPermission === 'granted' ? 'Sincronizar Token FCM' : 'Ativar Notificações Push'}</span>
                </button>
              </div>
            )}
          </div>

          {pushFeedback && (
            <div
              className={`p-3 rounded text-xs flex items-center justify-between gap-2 border ${
                pushFeedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
              }`}
            >
              <span>{pushFeedback.text}</span>
              <button
                type="button"
                onClick={() => setPushFeedback(null)}
                className="text-[11px] underline cursor-pointer shrink-0"
              >
                Fechar
              </button>
            </div>
          )}

          {!currentUser ? (
            <div className="p-5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
              <p className="font-semibold mb-1">Identificação Necessária</p>
              <p>É necessário estar autenticado com uma Conta Google para vigiar artigos e receber notificações push.</p>
            </div>
          ) : watchlist.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs space-y-2">
              <Star className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <div className="font-semibold text-slate-600 dark:text-slate-400">
                Você ainda não está vigiando nenhuma página
              </div>
              <p className="max-w-md mx-auto text-[11px] text-slate-400">
                Ao ler qualquer verbete no NotMediaWiki, clique no botão <strong>Vigiar</strong> na barra superior para acompanhar alterações em tempo real.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              {watchlist.map(sub => (
                <div
                  key={sub.id}
                  className="p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                      <button
                        onClick={() => onNavigateArticle(sub.articleSlug)}
                        className="font-bold text-sm text-blue-600 dark:text-blue-400 hover:underline text-left truncate cursor-pointer"
                      >
                        {sub.articleTitle || sub.articleSlug}
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-2">
                      <span>Vigiando desde: {new Date(sub.createdAt).toLocaleDateString('pt-BR')}</span>
                      <span>•</span>
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Bell className="w-3 h-3" /> Push Ativo
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onNavigateArticle(sub.articleSlug)}
                      className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded cursor-pointer"
                    >
                      Ler
                    </button>
                    <button
                      onClick={() => onOpenEdit(sub.articleSlug)}
                      className="px-2.5 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded cursor-pointer"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onOpenHistory(sub.articleSlug)}
                      className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded cursor-pointer"
                    >
                      Histórico
                    </button>
                    <button
                      onClick={async () => {
                        await api.toggleWatchArticle(currentUser.id, {
                          slug: sub.articleSlug,
                          title: sub.articleTitle,
                        });
                      }}
                      className="px-2.5 py-1 text-xs font-medium bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 rounded cursor-pointer"
                      title="Deixar de vigiar este artigo"
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: SPECIAL:TEMPLATES (Predefinições MediaWiki - Namespace 10) */}
      {activePage === 'Templates' && !isTemplatesEnabled && (
        <DisabledSpecialExtensionNotice
          extensionName="MediaWikiTemplates"
          title="Predefinições MediaWiki (Namespace 10)"
          onBackToIndex={() => setActivePage('SpecialPages')}
        />
      )}
      {activePage === 'Templates' && isTemplatesEnabled && (
        <div
          data-testid="special-templates-view"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 shadow-xs space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Blocks className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>Especial:Predefinições (MediaWiki Templates · Namespace 10)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Predefinições permitem transcluir caixas de aviso, infocaixas, navegações e modelos padronizados via sintaxe{' '}
                <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{'{{Nome|parâmetro=valor}}'}</code>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigateArticle(TEMPLATE_EXAMPLE_SLUG)}
                className="px-3 py-1.5 border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Ver Artigo de Exemplo</span>
              </button>
              <form
                onSubmit={e => {
                  e.preventDefault();
                  const cleaned = newTemplateName.trim().replace(/^(?:Predefinição|Predef|Template):/i, '').trim();
                  if (!cleaned) return;
                  const slug = `Predefinição:${cleaned.replace(/\s+/g, '_')}`;
                  setNewTemplateName('');
                  onOpenEdit(slug);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  placeholder="Nova predefinição (ex: CaixaProjeto)..."
                  className="border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-600"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Criar Predefinição</span>
                </button>
              </form>
            </div>
          </div>

          {/* Custom Namespace 10 Templates in Firestore */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Predefinições da Comunidade no Firebase (Namespace 10 · {customTemplatePages.length})
              </h3>
            </div>
            {customTemplatePages.length === 0 ? (
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 text-xs text-slate-500 dark:text-slate-400">
                Nenhuma página personalizada foi criada no namespace <code>Predefinição:</code> ainda. Use o campo acima para criar sua primeira predefinição reutilizável.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {customTemplatePages.map(tpl => {
                  const parsed = parseTitle(tpl.title || tpl.slug);
                  const declared = extractTemplateDeclaredParams(tpl.wikitext || '');
                  return (
                    <div
                      key={tpl.slug}
                      className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onNavigateArticle(tpl.slug)}
                            className="font-mono font-bold text-xs text-blue-700 dark:text-blue-400 hover:underline text-left cursor-pointer"
                          >
                            {tpl.title}
                          </button>
                          <code className="text-[11px] font-mono text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {'{{'}{parsed.baseTitle}{'}}'}
                          </code>
                        </div>
                        {tpl.summary && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{tpl.summary}</p>
                        )}
                        {declared.length > 0 && (
                          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1.5">
                            Parâmetros: {declared.join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                        <button
                          type="button"
                          onClick={() => onNavigateArticle(tpl.slug)}
                          className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          Visualizar
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenEdit(tpl.slug)}
                          className="px-2.5 py-1 text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Editar código</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Built-in Standard MediaWiki Templates */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Predefinições Padrão Integradas ({BUILTIN_MEDIAWIKI_TEMPLATES.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {BUILTIN_MEDIAWIKI_TEMPLATES.map(tpl => (
                <div
                  key={tpl.id}
                  className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                      {'{{'}{tpl.name}{'}}'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      {TEMPLATE_CATEGORY_LABELS[tpl.category]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {tpl.description}
                  </p>
                  <pre className="p-2.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap">
                    {tpl.exampleWikitext}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface DisabledSpecialExtensionNoticeProps {
  extensionName: string;
  title: string;
  onBackToIndex: () => void;
}

const DisabledSpecialExtensionNotice: React.FC<DisabledSpecialExtensionNoticeProps> = ({
  extensionName,
  title,
  onBackToIndex,
}) => (
  <div
    data-testid={`disabled-special-${extensionName}`}
    className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-lg p-6 text-center space-y-3 shadow-xs"
  >
    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
      Extensão Desativada • {title}
    </h3>
    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
      O recurso <code className="font-mono text-amber-700 dark:text-amber-300">{extensionName}</code> está desativado nas configurações de extensões do Wiki.
    </p>
    <div className="flex items-center justify-center gap-2 pt-1">
      <button
        type="button"
        onClick={onBackToIndex}
        className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded cursor-pointer"
      >
        Voltar ao Índice de Especiais
      </button>
      <button
        type="button"
        onClick={() => {
          window.location.hash = '#/burocratas';
        }}
        className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer"
      >
        Gerenciar Extensões
      </button>
    </div>
  </div>
);
