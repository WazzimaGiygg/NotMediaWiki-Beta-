import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  RefreshCw,
  Search,
  History,
  User,
  RotateCcw,
  FolderTree,
  Sparkles,
  FilePlus2,
} from 'lucide-react';
import { WikiEvent } from '../types';
import { api } from '../api';
import { getAvailableNamespaces, MEDIAWIKI_NAMESPACES, parseTitle } from '../utils/namespaces';

export interface RecentChangesPageProps {
  onNavigateArticle: (slug: string) => void;
  onOpenHistory: (slug: string) => void;
  onOpenUser?: (username: string) => void;
  onOpenSpecialPages?: () => void;
  onOpenCategoryExplorer?: () => void;
  initialEvents?: WikiEvent[];
  embedded?: boolean;
}

type TimeframeFilter = '24h' | '7d' | '30d' | 'all';

function mergeRecentEvents(primary: WikiEvent[], secondary: WikiEvent[]): WikiEvent[] {
  const byKey = new Map<string, WikiEvent>();
  for (const evt of [...primary, ...secondary]) {
    if (!evt || !evt.page_title) continue;
    const key = evt.rev_id
      ? `rev:${evt.rev_id}`
      : `evt:${evt.page_title}:${(evt.rev_timestamp || '').slice(0, 16)}`;
    const existing = byKey.get(key);
    if (!existing || (!existing.comment && evt.comment)) {
      byKey.set(key, evt);
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) => new Date(b.rev_timestamp).getTime() - new Date(a.rev_timestamp).getTime()
  );
}

function isBotAuthor(userText: string): boolean {
  const lower = (userText || '').toLowerCase();
  return lower.includes('bot') || lower.includes('robô') || lower.includes('robo');
}

function formatDateHeading(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Data desconhecida';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfTarget) / 86400000);

  if (dayDiff === 0) return 'Hoje';
  if (dayDiff === 1) return 'Ontem';

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getDateGroupKey(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayTitle(slug: string): string {
  try {
    return decodeURIComponent(slug).replace(/_/g, ' ');
  } catch {
    return slug.replace(/_/g, ' ');
  }
}

export const RecentChangesPage: React.FC<RecentChangesPageProps> = ({
  onNavigateArticle,
  onOpenHistory,
  onOpenUser,
  onOpenSpecialPages,
  onOpenCategoryExplorer,
  initialEvents,
  embedded = false,
}) => {
  const [events, setEvents] = useState<WikiEvent[]>(() => initialEvents || []);
  const [loading, setLoading] = useState<boolean>(() => !initialEvents);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedNamespace, setSelectedNamespace] = useState<number | 'all'>('all');
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('all');
  const [hideBots, setHideBots] = useState<boolean>(false);
  const [hideMinor, setHideMinor] = useState<boolean>(false);
  const [onlyNewPages, setOnlyNewPages] = useState<boolean>(false);

  const loadRecentChanges = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const merged = await api.getRecentChanges(150);
      setEvents(prev => mergeRecentEvents(merged, prev));
    } catch {
      // Keep current list on transient error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!initialEvents) {
      loadRecentChanges(false);
    }

    const unsubscribe = api.subscribeRecentChanges(
      liveEvents => {
        setEvents(prev => mergeRecentEvents(liveEvents, prev));
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedNamespace !== 'all' ||
    timeframe !== 'all' ||
    hideBots ||
    hideMinor ||
    onlyNewPages;

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedNamespace('all');
    setTimeframe('all');
    setHideBots(false);
    setHideMinor(false);
    setOnlyNewPages(false);
  };

  const filteredEvents = useMemo(() => {
    const queryLower = searchQuery.trim().toLowerCase();
    const nowMs = Date.now();
    const maxAgeMs =
      timeframe === '24h'
        ? 24 * 3600 * 1000
        : timeframe === '7d'
          ? 7 * 24 * 3600 * 1000
          : timeframe === '30d'
            ? 30 * 24 * 3600 * 1000
            : null;

    return events.filter(evt => {
      const parsed = parseTitle(evt.page_title || '');
      const nsId = typeof evt.page_namespace === 'number' ? evt.page_namespace : parsed.namespaceId;

      if (selectedNamespace !== 'all' && nsId !== selectedNamespace) return false;
      if (hideMinor && evt.rev_minor_edit) return false;
      if (hideBots && isBotAuthor(evt.user_text)) return false;
      if (onlyNewPages && evt.type !== 'new') return false;

      if (maxAgeMs !== null) {
        const evtTime = new Date(evt.rev_timestamp).getTime();
        if (!Number.isNaN(evtTime) && nowMs - evtTime > maxAgeMs) {
          return false;
        }
      }

      if (queryLower) {
        const titleText = formatDisplayTitle(evt.page_title || '').toLowerCase();
        const authorText = (evt.user_text || '').toLowerCase();
        const commentText = (evt.comment || '').toLowerCase();
        if (
          !titleText.includes(queryLower) &&
          !authorText.includes(queryLower) &&
          !commentText.includes(queryLower)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [events, searchQuery, selectedNamespace, timeframe, hideBots, hideMinor, onlyNewPages]);

  const groupedByDate = useMemo(() => {
    const groups: Array<{ key: string; label: string; items: WikiEvent[] }> = [];
    const byKey = new Map<string, { key: string; label: string; items: WikiEvent[] }>();

    for (const evt of filteredEvents) {
      const key = getDateGroupKey(evt.rev_timestamp);
      let group = byKey.get(key);
      if (!group) {
        group = {
          key,
          label: formatDateHeading(evt.rev_timestamp),
          items: [],
        };
        byKey.set(key, group);
        groups.push(group);
      }
      group.items.push(evt);
    }

    return groups;
  }, [filteredEvents]);

  const stats = useMemo(() => {
    let newPages = 0;
    let minorEdits = 0;
    const contributors = new Set<string>();
    for (const evt of filteredEvents) {
      if (evt.type === 'new') newPages++;
      if (evt.rev_minor_edit) minorEdits++;
      if (evt.user_text) contributors.add(evt.user_text);
    }
    return {
      total: filteredEvents.length,
      newPages,
      minorEdits,
      contributorsCount: contributors.size,
    };
  }, [filteredEvents]);

  const outerClass = embedded
    ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-5'
    : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 font-sans';

  const cardSurfaceClass = embedded
    ? 'space-y-4'
    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs space-y-5';

  return (
    <div data-testid="recent-changes-page" className={outerClass}>
      <div className={cardSurfaceClass}>
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Especial</span>
              <span>·</span>
              <span>EventStreams &amp; Cloud Firestore</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Especial:MudançasRecentes (Special:RecentChanges)</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Acompanhe em tempo real todas as edições, criações de verbetes, revisões menores e atualizações de predefinições registradas na enciclopédia.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => loadRecentChanges(true)}
              disabled={refreshing}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>Atualizar</span>
            </button>

            {!embedded && onOpenCategoryExplorer && (
              <button
                type="button"
                onClick={onOpenCategoryExplorer}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FolderTree className="w-3.5 h-3.5 text-slate-500" />
                <span>Categorias</span>
              </button>
            )}

            {!embedded && onOpenSpecialPages && (
              <button
                type="button"
                onClick={onOpenSpecialPages}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-500" />
                <span>Páginas Especiais</span>
              </button>
            )}
          </div>
        </div>

        {/* Summary Line & Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {stats.total}
              </strong>{' '}
              alterações exibidas
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span>
              <strong className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                {stats.newPages}
              </strong>{' '}
              páginas novas
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span>
              <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {stats.contributorsCount}
              </strong>{' '}
              editores ativos
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              <strong className="font-mono text-emerald-700 dark:text-emerald-400">N</strong> página nova
            </span>
            <span>·</span>
            <span>
              <strong className="font-mono text-slate-700 dark:text-slate-300">m</strong> edição menor
            </span>
            <span>·</span>
            <span>
              <strong className="font-mono text-amber-700 dark:text-amber-400">b</strong> edição por robô
            </span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-lg space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filtrar por página, autor ou resumo de edição..."
                aria-label="Filtrar mudanças recentes"
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div className="md:col-span-4">
              <select
                value={selectedNamespace}
                onChange={e =>
                  setSelectedNamespace(e.target.value === 'all' ? 'all' : Number(e.target.value))
                }
                aria-label="Filtrar por namespace"
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

            <div className="md:col-span-3">
              <select
                value={timeframe}
                onChange={e => setTimeframe(e.target.value as TimeframeFilter)}
                aria-label="Filtrar por período"
                className="w-full border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
              >
                <option value="all">Todo o histórico</option>
                <option value="24h">Últimas 24 horas</option>
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={hideBots}
                  onChange={e => setHideBots(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Ocultar robôs (bots)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={hideMinor}
                  onChange={e => setHideMinor(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Ocultar edições menores (m)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={onlyNewPages}
                  onChange={e => setOnlyNewPages(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Apenas páginas novas (N)</span>
              </label>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Limpar filtros</span>
              </button>
            )}
          </div>
        </div>

        {/* Recent Changes Feed */}
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
            Carregando registro de mudanças recentes...
          </div>
        ) : groupedByDate.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
            <FilePlus2 className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Nenhuma alteração registrada com os filtros selecionados.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ajuste o namespace, o período ou os critérios de busca para visualizar edições anteriores.
            </p>
          </div>
        ) : (
          <div data-testid="recent-changes-list" className="space-y-6">
            {groupedByDate.map(group => (
              <section key={group.key} className="space-y-1.5">
                <div className="flex items-baseline justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  <h2 className="text-sm font-serif font-bold text-slate-800 dark:text-slate-200">
                    {group.label}
                  </h2>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                    {group.items.length} {group.items.length === 1 ? 'edição' : 'edições'}
                  </span>
                </div>

                <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {group.items.map(evt => {
                    const parsed = parseTitle(evt.page_title || '');
                    const nsId =
                      typeof evt.page_namespace === 'number'
                        ? evt.page_namespace
                        : parsed.namespaceId;
                    const nsInfo = MEDIAWIKI_NAMESPACES[nsId];
                    const isNew = evt.type === 'new';
                    const isBot = isBotAuthor(evt.user_text);
                    const displayTitle = formatDisplayTitle(evt.page_title || '');
                    const evtDate = new Date(evt.rev_timestamp);
                    const timeLabel = Number.isNaN(evtDate.getTime())
                      ? '--:--:--'
                      : evtDate.toLocaleTimeString('pt-BR');

                    return (
                      <li
                        key={evt.id}
                        className="py-2.5 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded transition-colors flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5 text-xs"
                      >
                        <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                          <button
                            type="button"
                            onClick={() => onOpenHistory(evt.page_title)}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-[11px] shrink-0 inline-flex items-center gap-1 cursor-pointer"
                            title="Ver histórico de revisões desta página"
                          >
                            <History className="w-3 h-3" />
                            <span>histórico</span>
                          </button>

                          <span className="text-slate-300 dark:text-slate-700">·</span>

                          <time
                            dateTime={evt.rev_timestamp}
                            className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400 shrink-0"
                          >
                            {timeLabel}
                          </time>

                          {(isNew || evt.rev_minor_edit || isBot) && (
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-[11px] shrink-0">
                              {isNew && (
                                <abbr
                                  title="Página nova"
                                  className="no-underline text-emerald-700 dark:text-emerald-400"
                                >
                                  N
                                </abbr>
                              )}
                              {evt.rev_minor_edit && (
                                <abbr
                                  title="Edição menor"
                                  className="no-underline text-slate-500 dark:text-slate-400"
                                >
                                  m
                                </abbr>
                              )}
                              {isBot && (
                                <abbr
                                  title="Edição automatizada por robô"
                                  className="no-underline text-amber-700 dark:text-amber-400"
                                >
                                  b
                                </abbr>
                              )}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => onNavigateArticle(evt.page_title)}
                            className="font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-left cursor-pointer break-words"
                          >
                            {displayTitle}
                          </button>

                          {nsId !== 0 && nsInfo && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              · {nsInfo.localized || nsInfo.canonical}
                            </span>
                          )}

                          <span className="text-slate-300 dark:text-slate-700">·</span>

                          <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                            {(evt.rev_len || 0).toLocaleString('pt-BR')} bytes
                          </span>

                          <span className="text-slate-300 dark:text-slate-700">·</span>

                          {onOpenUser ? (
                            <button
                              type="button"
                              onClick={() => onOpenUser(evt.user_text)}
                              className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                              title={`Ver página e contribuições de ${evt.user_text}`}
                            >
                              <User className="w-3 h-3 shrink-0" />
                              <span>{evt.user_text}</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                              <User className="w-3 h-3 shrink-0 text-slate-400" />
                              <span>{evt.user_text}</span>
                            </span>
                          )}
                        </div>

                        {evt.comment && (
                          <div className="text-slate-500 dark:text-slate-400 italic sm:text-right sm:max-w-md truncate pl-4 sm:pl-0">
                            ({evt.comment})
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
