import React, { useEffect, useState, useRef, useMemo } from 'react';
import { BookOpen, Edit3, Clock, Eye, Shield, List, ArrowRight, RefreshCw, MessageSquare, FileText, GitCompare, Printer, Download, HeartHandshake, FolderTree, Database, Zap, Star, Shuffle, Minimize2, Maximize2, Type, X } from 'lucide-react';
import { Article, RenderedArticleResponse, TocItem, Revision, UserSession } from '../types';
import { api } from '../api';
import { wrapExternalUrl } from '../utils/urlHelper';
import { enhanceCodeBlocks } from '../utils/syntaxHighlighter';
import { ArticleCategories } from './ArticleCategories';
import { RelatedArticles } from './RelatedArticles';
import { TableOfContents } from './TableOfContents';
import { ArticleFootnotes } from './ArticleFootnotes';
import { WikiReportModal } from './WikiReportModal';
import { ArticleRatingWidget } from './ArticleRatingWidget';
import { ArticleFeedbackWidget } from './ArticleFeedbackWidget';
import { buildArticleReportData } from '../utils/reportGenerator';
import { MEDIAWIKI_NAMESPACES, parseTitle, getSubpageBreadcrumbs } from '../utils/namespaces';
import { parseSemanticFacts } from '../utils/semanticParser';
import { SemanticFactbox } from './SemanticFactbox';
import { CategoryTreeView } from './CategoryTreeView';
import { subscribeToFirestoreArticle, auth } from '../firebase';
import { parseFootnoteTagsInHtml } from '../utils/citationParser';
import { downloadArticlePdf } from '../utils/pdfDownloader';

interface WikiReaderProps {
  slug: string;
  onNavigate: (slug: string) => void;
  onEdit: (slug: string) => void;
  onHistory: (slug: string) => void;
  onNewArticle?: () => void;
  currentUser?: UserSession | null;
  onProgressChange?: (progress: number) => void;
  onOpenChecklist?: () => void;
  onRandomArticle?: () => void;
}

export const WikiReader: React.FC<WikiReaderProps> = ({
  slug,
  onNavigate,
  onEdit,
  onHistory,
  onNewArticle,
  currentUser,
  onProgressChange,
  onOpenChecklist,
  onRandomArticle,
}) => {
  const [data, setData] = useState<RenderedArticleResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isWatched, setIsWatched] = useState<boolean>(false);
  const [watchLoading, setWatchLoading] = useState<boolean>(false);

  useEffect(() => {
    if (currentUser?.id && slug) {
      api.isArticleWatched(currentUser.id, slug)
        .then(watched => setIsWatched(watched))
        .catch(() => setIsWatched(false));
    } else {
      setIsWatched(false);
    }
  }, [currentUser?.id, slug]);

  const handleToggleWatch = async () => {
    if (!currentUser?.id) {
      alert('Faça login para vigiar artigos e receber notificações.');
      return;
    }
    setWatchLoading(true);
    try {
      const newStatus = await api.toggleWatchArticle(currentUser.id, {
        slug,
        title: data?.article?.title || slug,
      }, true);
      setIsWatched(newStatus.isWatched);
      if (newStatus.isWatched) {
        api.initializeFCM(currentUser.id).catch(() => {});
      }
    } catch (err) {
      console.error('Erro ao alterar status de vigia:', err);
    } finally {
      setWatchLoading(false);
    }
  };

  const [randomLoading, setRandomLoading] = useState(false);

  const handleRandomClick = async () => {
    if (onRandomArticle) {
      onRandomArticle();
      return;
    }
    setRandomLoading(true);
    try {
      const random = await api.getRandomArticle(slug);
      if (random && random.slug) {
        onNavigate(random.slug);
      }
    } catch (err) {
      console.warn('Erro ao carregar artigo aleatório:', err);
    } finally {
      setRandomLoading(false);
    }
  };

  // Focus / Reader Mode state (Distraction-Free)
  const [isReaderMode, setIsReaderMode] = useState<boolean>(false);
  const [readerFontSize, setReaderFontSize] = useState<'base' | 'lg' | 'xl'>('lg');
  const [readerFontFamily, setReaderFontFamily] = useState<'serif' | 'sans'>('serif');

  // PDF Generation & Download state
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  const handleDownloadPdf = async () => {
    if (!data?.article) return;
    setIsGeneratingPdf(true);
    try {
      const referencesEl = document.getElementById('references');
      await downloadArticlePdf({
        article: data.article,
        htmlContent: renderedHtml || data.html,
        footnotesRef: referencesEl,
      });
    } catch (err) {
      console.error('Erro ao gerar PDF do artigo:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Keyboard shortcut: Esc to exit reader mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isReaderMode) {
        setIsReaderMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReaderMode]);

  // Real-time Firestore onSnapshot subscription state
  const loadedRevIdRef = useRef<string | null>(null);
  const loadedWikitextRef = useRef<string | null>(null);
  const [realtimeToast, setRealtimeToast] = useState<{
    visible: boolean;
    editorName: string;
    summary: string;
    timestamp: string;
    revId: string;
  } | null>(null);
  const [refreshingRealtime, setRefreshingRealtime] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setRealtimeToast(null);

    api.getRenderedArticle(slug)
      .then(res => {
        if (isMounted) {
          setData(res);
          loadedRevIdRef.current = res.article.latestRevisionId || null;
          loadedWikitextRef.current = res.article.wikitext || null;
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err.message || 'Article not found');
          setLoading(false);
        }
      });

    api.getArticles().then(arts => {
      if (isMounted) setAllArticles(arts);
    }).catch(console.error);

    api.getRevisions(slug).then(revs => {
      if (isMounted) setRevisions(revs);
    }).catch(console.error);

    return () => { isMounted = false; };
  }, [slug]);

  // Real-time Firestore onSnapshot subscription for the currently viewed article
  useEffect(() => {
    if (!slug) return;
    setRealtimeToast(null);

    const unsubscribe = subscribeToFirestoreArticle(
      slug,
      (liveArticle) => {
        const currentRev = loadedRevIdRef.current;
        const currentWikitext = loadedWikitextRef.current;

        // Verify if revision ID or wikitext content changed in Firestore
        const isNewRev = liveArticle.latestRevisionId && currentRev && liveArticle.latestRevisionId !== currentRev;
        const isNewWikitext = liveArticle.wikitext && currentWikitext && liveArticle.wikitext !== currentWikitext;

        if (isNewRev || isNewWikitext) {
          const editorUid = (liveArticle as any).authorUid || (liveArticle as any).author?.id;
          const currentUserId = currentUser?.id || auth.currentUser?.uid;

          // Alert only if the edit was made by another user while this page is open
          if (!currentUserId || !editorUid || editorUid !== currentUserId) {
            const editorName = (liveArticle as any).lastEditedBy || (liveArticle as any).author?.name || 'Outro usuário';
            const summary = liveArticle.summary || (liveArticle as any).comment || 'Edição no conteúdo';

            setRealtimeToast({
              visible: true,
              editorName,
              summary,
              timestamp: liveArticle.updatedAt || new Date().toISOString(),
              revId: liveArticle.latestRevisionId || 'nova',
            });
          }
        }
      },
      (err) => {
        console.warn('Realtime article subscription notice:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [slug, currentUser]);

  const handleReloadArticle = async () => {
    if (!slug) return;
    setRefreshingRealtime(true);
    try {
      const res = await api.getRenderedArticle(slug);
      setData(res);
      loadedRevIdRef.current = res.article.latestRevisionId || null;
      loadedWikitextRef.current = res.article.wikitext || null;
      setRealtimeToast(null);
      api.getRevisions(slug).then(setRevisions).catch(console.error);
    } catch (err) {
      console.warn('Erro ao atualizar artigo em tempo real:', err);
    } finally {
      setRefreshingRealtime(false);
    }
  };

  const contentRef = useRef<HTMLElement>(null);

  // Lightweight syntax highlighting on code blocks inside .wiki-content
  useEffect(() => {
    if (!contentRef.current || !data?.html) return;
    enhanceCodeBlocks(contentRef.current);
  }, [data?.html]);

  // Ensure all <ref> tags in the HTML are parsed into clickable, accessible superscripts
  const renderedHtml = useMemo(() => {
    if (!data?.html) return '';
    const { html: parsed } = parseFootnoteTagsInHtml(data.html);
    return parsed;
  }, [data?.html]);

  // Handle clicking links rendered in Parsoid HTML (with interactive footnote backlinks and jumping)
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor) {
      const href = anchor.getAttribute('href');
      if (href && href.startsWith('#/wiki/')) {
        e.preventDefault();
        const targetSlug = decodeURIComponent(href.replace('#/wiki/', ''));
        onNavigate(targetSlug);
      } else if (href && href.startsWith('#')) {
        // Anchor link within page (e.g. section headings or #cite_note-X / #cite_ref-X)
        const elementId = href.substring(1);
        const el = document.getElementById(elementId);
        if (el) {
          e.preventDefault();
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          if (elementId.startsWith('cite_note-')) {
            window.location.hash = elementId;
            el.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-950/50', 'rounded', 'p-1', 'transition-all');
            setTimeout(() => {
              el.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-950/50');
            }, 3000);
          } else if (elementId.startsWith('cite_ref-')) {
            el.classList.add('ring-2', 'ring-amber-400', 'bg-amber-100', 'dark:bg-amber-950/60', 'rounded', 'px-1', 'transition-all');
            setTimeout(() => {
              el.classList.remove('ring-2', 'ring-amber-400', 'bg-amber-100', 'dark:bg-amber-950/60', 'rounded', 'px-1');
            }, 3000);
          }
        }
      } else if (href && (/^https?:\/\//i.test(href) || href.startsWith('//'))) {
        e.preventDefault();
        const safeUrl = wrapExternalUrl(href);
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  // Read progress bar state (0% to 100%) - MUST be before any conditional returns
  const [scrollProgress, setScrollProgress] = useState<number>(0);

  // Calculate accurate article word count based on rendered text and wikitext
  const wordCount = useMemo(() => {
    let text = '';
    if (typeof document !== 'undefined' && data?.html) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.html, 'text/html');
        doc.querySelectorAll('script, style').forEach(el => el.remove());
        text = doc.body.textContent || '';
      } catch {
        text = '';
      }
    }
    if (!text.trim() && data?.article?.wikitext) {
      text = data.article.wikitext
        .replace(/\{\{[\s\S]*?\}\}/g, ' ')
        .replace(/\{\|[\s\S]*?\|\}/g, ' ')
        .replace(/<ref[\s\S]*?<\/ref>/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
        .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1')
        .replace(/['*=~_#]/g, ' ');
    }
    const words = text.trim().match(/[\p{L}\p{N}]+/gu);
    return words ? words.length : 0;
  }, [data?.html, data?.article?.wikitext]);

  // Estimated reading time in minutes (standard ~200 wpm)
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  // Update scroll reading progress based on position within article content
  useEffect(() => {
    const handleScroll = () => {
      const articleEl = contentRef.current;
      if (!articleEl) return;

      const rect = articleEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Start tracking when article top enters reading zone (offset for sticky headers)
      const topOffset = 110;
      const totalDistance = rect.height - viewportHeight + topOffset;

      if (totalDistance <= 0) {
        setScrollProgress(100);
        onProgressChange?.(100);
        return;
      }

      const scrolled = topOffset - rect.top;

      if (scrolled <= 0) {
        setScrollProgress(0);
        onProgressChange?.(0);
      } else if (scrolled >= totalDistance) {
        setScrollProgress(100);
        onProgressChange?.(100);
      } else {
        const pct = Math.min(100, Math.max(0, (scrolled / totalDistance) * 100));
        const rounded = Math.round(pct);
        setScrollProgress(rounded);
        onProgressChange?.(rounded);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initial calculation
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      onProgressChange?.(0);
    };
  }, [data?.html, onProgressChange]);

  const parsedTitle = useMemo(() => parseTitle(slug), [slug]);
  const breadcrumbs = useMemo(() => getSubpageBreadcrumbs(parsedTitle), [parsedTitle]);
  const isTalk = parsedTitle.isTalk;
  const subjectSlug = parsedTitle.subjectTitle;
  const talkSlug = parsedTitle.talkTitle;

  const subjectLabel = useMemo(() => {
    if (parsedTitle.namespaceId === 0 || parsedTitle.namespaceId === 1) return 'Artigo';
    if (parsedTitle.isTalk) {
      const subjectDef = MEDIAWIKI_NAMESPACES[parsedTitle.subjectNamespaceId];
      return subjectDef?.localized || subjectDef?.canonical || 'Página';
    }
    return parsedTitle.namespaceDef.localized || parsedTitle.namespaceDef.canonical || 'Página';
  }, [parsedTitle]);

  const semanticData = useMemo(() => {
    if (!data?.article?.wikitext) return { facts: [] };
    return parseSemanticFacts(slug, data.article.title, data.article.wikitext);
  }, [slug, data?.article?.title, data?.article?.wikitext]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mb-4" />
        <div className="text-sm font-medium text-slate-600">
          Querying Content Service & Parsoid AST Cache...
        </div>
        <div className="text-xs text-slate-400 font-mono mt-1">
          GET /api/v1/content/articles/{slug}/rendered
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="p-6 bg-rose-50 border border-rose-200 rounded">
          <h2 className="text-lg font-semibold text-rose-900 mb-2">Artigo Não Encontrado</h2>
          <p className="text-sm text-rose-700 mb-4">
            O artigo &ldquo;{slug}&rdquo; não existe no repositório do NotMediaWiki (Projetos WazzimaGiygg).
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => onEdit(slug)}
              className="px-4 py-2 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Criar ou Editar Artigo
            </button>
            <button
              onClick={() => onNavigate(allArticles[0]?.slug || 'Teste')}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Ir para Artigo Sincronizado ({allArticles[0]?.title || 'Teste'})
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { article, html, toc, categories, parseTimeMs } = data;

  return (
    <div className="relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Floating Sticky Reader Mode Header Controls when active */}
      {isReaderMode && (
        <div className="sticky top-3 z-30 mb-8 p-3.5 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-lg flex flex-wrap items-center justify-between gap-3 animate-fade-in transition-all">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60">
              <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Modo de Leitura Focado</span>
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
              {wordCount.toLocaleString()} palavras · ~{readingTimeMin} min de leitura
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Typography Controls: Serif vs Sans */}
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
              <button
                onClick={() => setReaderFontFamily('serif')}
                className={`px-2.5 py-1 text-xs font-serif transition-colors cursor-pointer rounded ${
                  readerFontFamily === 'serif'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Tipografia Serifada clássica"
              >
                Serif
              </button>
              <button
                onClick={() => setReaderFontFamily('sans')}
                className={`px-2.5 py-1 text-xs font-sans transition-colors cursor-pointer rounded ${
                  readerFontFamily === 'sans'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Tipografia Sem Serifa moderna"
              >
                Sans
              </button>
            </div>

            {/* Font Size controls */}
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
              <button
                onClick={() => setReaderFontSize('base')}
                className={`px-2.5 py-1 text-xs transition-colors cursor-pointer rounded ${
                  readerFontSize === 'base'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Tamanho padrão de fonte"
              >
                A
              </button>
              <button
                onClick={() => setReaderFontSize('lg')}
                className={`px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer rounded ${
                  readerFontSize === 'lg'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Tamanho médio de fonte (+)"
              >
                A+
              </button>
              <button
                onClick={() => setReaderFontSize('xl')}
                className={`px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer rounded ${
                  readerFontSize === 'xl'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Tamanho grande de fonte (++)"
              >
                A++
              </button>
            </div>

            {/* Download PDF button in reader mode */}
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
              title="Baixar artigo em PDF"
            >
              {isGeneratingPdf ? (
                <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              )}
              <span className="hidden sm:inline">{isGeneratingPdf ? 'Baixando...' : 'PDF'}</span>
            </button>

            {/* Exit Reader Mode */}
            <button
              onClick={() => setIsReaderMode(false)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Sair do Modo de Leitura (Esc)"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Sair (Esc)</span>
            </button>
          </div>
        </div>
      )}

      {/* Article Sub-header Tabs & Action Bar */}
      {!isReaderMode && (
        <div className="border-b border-slate-200 dark:border-slate-800 pb-2 mb-6 flex flex-wrap items-center justify-between gap-4">
          {/* Dynamic MediaWiki Namespace tabs: Subject / Talk */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onNavigate(subjectSlug)}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
                !isTalk
                  ? 'border-blue-600 text-blue-800 dark:text-blue-400 font-semibold'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {subjectLabel}
            </button>
            {talkSlug && (
              <button
                onClick={() => onNavigate(talkSlug)}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  isTalk
                    ? 'border-blue-600 text-blue-800 dark:text-blue-400 font-semibold'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Discussão
              </button>
            )}
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsReaderMode(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Ativar Modo de Leitura focado (esconde barras e painéis laterais)"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Modo de Leitura</span>
            </button>
            <button
              onClick={handleToggleWatch}
              disabled={watchLoading}
              className={`px-3 py-1.5 text-xs font-medium rounded border flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs ${
                isWatched
                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-750 hover:bg-amber-100'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
              title={
                isWatched
                  ? 'Você está vigiando este artigo. Clique para parar de receber notificações.'
                  : 'Vigiar este artigo para receber notificações push quando houver alterações.'
              }
            >
              <Star className={`w-3.5 h-3.5 ${isWatched ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} />
              <span>{isWatched ? 'Vigiando' : 'Vigiar'}</span>
            </button>
            <button
              onClick={() => onEdit(slug)}
              className="px-3 py-1.5 text-xs font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Editar código-fonte
            </button>
            <button
              onClick={() => onHistory(slug)}
              className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Ver histórico de edições e comparar versões (Diff)"
            >
              <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Histórico de edições</span>
              {revisions.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  {revisions.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 rounded border border-purple-200 dark:border-purple-800 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Gerar Relatório Oficial em PDF deste artigo no padrão institucional"
            >
              <Printer className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Relatório PDF</span>
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Imprimir artigo diretamente (formatação otimizada para papel/impressora)"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
              title="Gerar e baixar o artigo em formato PDF (respeitando as regras de estilização de impressão do index.css)"
            >
              {isGeneratingPdf ? (
                <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              )}
              <span>{isGeneratingPdf ? 'Baixando PDF...' : 'Baixar PDF'}</span>
            </button>
            <button
              onClick={handleRandomClick}
              disabled={randomLoading}
              className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
              title="Sortear e abrir outro artigo aleatório da enciclopédia"
            >
              <Shuffle className={`w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 ${randomLoading ? 'animate-spin' : ''}`} />
              <span>Artigo Aleatório</span>
            </button>
          </div>
        </div>
      )}

      <div className={isReaderMode ? "max-w-3xl mx-auto py-2" : "grid grid-cols-1 lg:grid-cols-12 gap-8"}>
        {/* Left Column: Article Directory / Quick Switcher (Hidden in Reader Mode) */}
        {!isReaderMode && (
          <div className="hidden lg:block lg:col-span-3 space-y-6">
          {/* Dynamic Table of Contents Sidebar Component */}
          <TableOfContents
            contentRef={contentRef}
            html={html}
            initialToc={toc}
          />

          {/* Quick Wiki Article Directory */}
          <div className="border border-slate-200 dark:border-slate-800 rounded p-4 bg-white dark:bg-slate-900 text-xs">
            <div className="font-semibold text-slate-800 dark:text-slate-200 mb-2.5 pb-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span>Artigos na Malha</span>
              {onNewArticle ? (
                <button
                  onClick={onNewArticle}
                  className="text-[11px] text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  + Nova Página
                </button>
              ) : (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{allArticles.length} páginas</span>
              )}
            </div>
            <ul className="space-y-1">
              {allArticles.map(a => (
                <li key={a.slug}>
                  <button
                    onClick={() => onNavigate(a.slug)}
                    className={`w-full text-left px-2 py-1.5 rounded transition-colors truncate flex items-center justify-between cursor-pointer ${
                      a.slug === slug
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <span className="truncate">{a.title}</span>
                    {a.isProtected && <Shield className="w-3 h-3 text-amber-500 shrink-0 ml-1" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Related Articles Sidebar Component */}
          <RelatedArticles
            currentSlug={slug}
            currentArticle={article}
            categories={categories && categories.length > 0 ? categories : (article.categories || [])}
            allArticles={allArticles}
            onNavigate={onNavigate}
          />

          {/* Recent Edits / Histórico Recente Widget */}
          <div className="border border-slate-200 dark:border-slate-800 rounded p-4 bg-white dark:bg-slate-900 text-xs">
            <div className="font-semibold text-slate-800 dark:text-slate-200 mb-2.5 pb-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Histórico de Edições</span>
              </span>
              <button
                onClick={() => onHistory(slug)}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                title="Ver histórico completo"
              >
                Ver tudo ({revisions.length})
              </button>
            </div>
            {revisions.length === 0 ? (
              <div className="text-slate-400 dark:text-slate-500 text-[11px] py-1">Carregando edições...</div>
            ) : (
              <ul className="space-y-2">
                {revisions.slice(0, 3).map((rev, idx) => (
                  <li key={rev.id} className="pb-2 border-b border-slate-100 dark:border-slate-800/60 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                        {rev.author.name}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px]">
                        {new Date(rev.timestamp).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate italic mt-0.5">
                      {rev.comment || (idx === 0 ? 'Versão atual' : 'Edição')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => onHistory(slug)}
              className="mt-3 w-full py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-center text-[11px] font-medium transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5"
            >
              <GitCompare className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span>Comparar versões (Diff)</span>
            </button>
            </div>
          </div>
        )}

        {/* Right / Main Column: Article Content */}
        <main className={isReaderMode ? "w-full" : "lg:col-span-9"}>
          {/* Article Title */}
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
            {/* Subpage Breadcrumbs Hierarchy */}
            {breadcrumbs.length > 0 && (
              <nav aria-label="Subpáginas" className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5 flex-wrap font-sans">
                <span className="text-slate-400 dark:text-slate-500 font-medium">&lt;</span>
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.slug}>
                    {idx > 0 && <span className="text-slate-300 dark:text-slate-600">/</span>}
                    <button
                      onClick={() => onNavigate(crumb.slug)}
                      className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      {crumb.label}
                    </button>
                  </React.Fragment>
                ))}
              </nav>
            )}

            <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center justify-between">
              <span>{article.title}</span>
              {article.isProtected && (
                <span className="text-xs font-sans font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Protected
                </span>
              )}
            </h1>

            {/* Zero-Pill Unboxed Metadata (strict adherence to frontend-design constitution) */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2 font-sans">
              <span>Wikipedia, the free encyclopedia</span>
              <span aria-hidden="true">·</span>
              <span>Namespace {article.namespace === 0 ? 'Main' : article.namespace === 1 ? 'Talk' : article.namespace}</span>
              <span aria-hidden="true">·</span>
              <span>{(article.views ?? 0).toLocaleString()} views</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5" title="Total word count and estimated reading time">
                <FileText className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span>{wordCount.toLocaleString()} words</span>
                <span className="text-slate-400 dark:text-slate-500 font-normal">({readingTimeMin} min read)</span>
              </span>
              <span aria-hidden="true">·</span>
              <button
                onClick={() => onHistory(slug)}
                className="hover:underline text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 font-mono cursor-pointer transition-colors"
                title="Ver histórico de edições deste artigo"
              >
                <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span>{revisions.length} {revisions.length === 1 ? 'edição' : 'edições'}</span>
              </button>
              {revisions[0]?.author && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    onClick={() => onNavigate(`Usuario:${revisions[0].author.username || revisions[0].author.name}`)}
                    className="hover:underline text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 font-sans cursor-pointer transition-colors"
                    title={`Ver perfil e Karma de ${revisions[0].author.name}`}
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Último editor: <strong>{revisions[0].author.name}</strong></span>
                  </button>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-mono">Parsoid: {parseTimeMs}ms</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-400 dark:text-slate-500">rev: {article.latestRevisionId}</span>
            </div>

            {/* BLP Ethics Council Compliance Badge & Trigger (Standard mode only) */}
            {!isReaderMode && (
              <div className="mt-3 p-2.5 rounded-lg bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-purple-900 dark:text-purple-300">
                <div className="flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span>
                    <strong>Conselho de Ética (WP:BLP):</strong> Artigo com biografias de pessoas vivas ou derivados sujeito a rigorosa conformidade com fontes secundárias confiáveis e direitos da personalidade.
                  </span>
                </div>
                <a
                  href="#/etica"
                  className="self-start sm:self-auto shrink-0 px-2.5 py-1 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/60 dark:hover:bg-purple-800/60 rounded text-[11px] font-semibold text-purple-800 dark:text-purple-200 transition-colors whitespace-nowrap"
                >
                  Conselho de Ética
                </a>
              </div>
            )}
          </div>

          {/* Mobile Collapsible TOC for small viewports (Standard mode only) */}
          {!isReaderMode && (
            <TableOfContents
              contentRef={contentRef}
              html={html}
              initialToc={toc}
              className="mb-6 lg:hidden"
            />
          )}

          {/* Rendered HTML Container */}
          <article
            id="wiki-article-container"
            ref={contentRef}
            className={`wiki-content prose max-w-none text-slate-800 dark:text-slate-200 ${
              readerFontFamily === 'serif' ? 'font-serif' : 'font-sans'
            } ${
              readerFontSize === 'base'
                ? 'text-base leading-relaxed'
                : readerFontSize === 'lg'
                ? 'text-lg leading-loose'
                : 'text-xl leading-loose'
            }`}
            onClick={handleContentClick}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />

          {/* Numbered Citations & Footnotes Component parsed from Parsoid AST (Preserved in Reader Mode) */}
          <ArticleFootnotes
            ast={data?.ast}
            references={data?.references}
            wikitext={article.wikitext}
            onNavigate={onNavigate}
          />

          {/* Reader Mode End Banner & Quick Exit Button */}
          {isReaderMode && (
            <div className="mt-12 py-8 border-t border-slate-200 dark:border-slate-800 text-center space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400 font-serif italic">
                Fim do artigo · {wordCount.toLocaleString()} palavras lidas
              </p>
              <button
                onClick={() => {
                  setIsReaderMode(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Sair do Modo de Leitura e voltar à visão padrão</span>
              </button>
            </div>
          )}

          {/* Article Voting & Feedback Component (Standard mode only) */}
          {!isReaderMode && (
            <ArticleFeedbackWidget
              articleSlug={slug}
              articleTitle={article.title}
              authorUid={revisions[0]?.author?.id}
              authorName={revisions[0]?.author?.name || revisions[0]?.author?.username || 'Wikipedian'}
              currentUser={currentUser || null}
              onNavigateUser={(userSlug) => onNavigate(`Usuario:${userSlug}`)}
            />
          )}

          {/* 3.05.8.b.c - Article Evaluation Widget (Daily Checklist Mission +1.00 pt) (Standard mode only) */}
          {!isReaderMode && (
            <ArticleRatingWidget
              articleSlug={slug}
              articleTitle={article.title}
              currentUser={currentUser || null}
              onOpenChecklist={onOpenChecklist}
            />
          )}

          {/* Article Categories & Interactive Filter UI Component (Standard mode only) */}
          {!isReaderMode && (
            <ArticleCategories
              categories={categories && categories.length > 0 ? categories : (article.categories || [])}
              allArticles={allArticles}
              currentSlug={slug}
              onNavigate={onNavigate}
            />
          )}

          {/* Semantic MediaWiki & Cargo Structured Factbox (Standard mode only) */}
          {!isReaderMode && semanticData.facts && semanticData.facts.length > 0 && (
            <SemanticFactbox
              facts={semanticData.facts}
              articleTitle={article.title}
              onNavigateArticle={onNavigate}
            />
          )}

          {/* Canonical MediaWiki CategoryTree (Embedded for Namespace 14 - Categoria) (Standard mode only) */}
          {!isReaderMode && parsedTitle.namespaceId === 14 && (
            <div className="mt-8 border border-slate-200 dark:border-slate-800 rounded-lg p-5 bg-white dark:bg-slate-900 shadow-xs">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                <FolderTree className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Árvore de Subcategorias & Artigos Membros ({parsedTitle.baseTitle})
                </h2>
              </div>
              <CategoryTreeView
                articles={allArticles}
                currentCategory={parsedTitle.baseTitle}
                onNavigateArticle={onNavigate}
                onSelectCategory={(cat) => onNavigate(`Categoria:${cat}`)}
              />
            </div>
          )}

          {/* Related Articles Component (Visible on mobile/tablet viewports where sidebar is hidden) (Standard mode only) */}
          {!isReaderMode && (
            <RelatedArticles
              currentSlug={slug}
              currentArticle={article}
              categories={categories && categories.length > 0 ? categories : (article.categories || [])}
              allArticles={allArticles}
              onNavigate={onNavigate}
              className="mt-6 lg:hidden"
              initialCollapsed={false}
            />
          )}

          {/* Microservices Execution & Article Reader Footer (Standard mode only) */}
          {!isReaderMode && (
            <div className="mt-8 p-4 rounded-lg bg-slate-100/80 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 font-medium font-sans shadow-xs" title="Total de palavras no artigo">
                  <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>
                    <strong className="font-semibold text-slate-900 dark:text-white">{wordCount.toLocaleString()}</strong> palavras
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 font-normal">({readingTimeMin} min de leitura)</span>
                </span>
                <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">|</span>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  Rev: <span className="text-slate-700 dark:text-slate-300 font-semibold">{article.latestRevisionId}</span>
                </span>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                NotMediaWiki · Projeto <a href={wrapExternalUrl("https://wazzimagiygg.com")} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">WazzimaGiygg</a> (wazzimagiygg.com)
              </div>
            </div>
          )}
        </main>
      </div>
    </div>

    {/* Official Standard PDF Report Modal */}
    {isReportModalOpen && data && (
      <WikiReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        metadata={buildArticleReportData(data.article, revisions, currentUser, data.html).metadata}
        article={data.article}
        revisions={revisions}
        htmlContent={data.html}
        currentUser={currentUser}
      />
    )}

    {/* Real-time Firestore onSnapshot update toast notification */}
    {realtimeToast && realtimeToast.visible && (
      <aside
        role="alert"
        aria-live="polite"
        className="fixed bottom-6 right-6 z-50 max-w-sm sm:max-w-md w-full bg-white dark:bg-slate-900 border-2 border-blue-500/80 dark:border-blue-500/60 rounded-xl shadow-2xl p-4 transition-all duration-300 animate-slide-up"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 shrink-0 mt-0.5">
            <RefreshCw className={`w-4 h-4 ${refreshingRealtime ? 'animate-spin' : ''}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span>Artigo editado por outro usuário</span>
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              </h4>
              <button
                onClick={() => setRealtimeToast(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Fechar notificação"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              O editor <strong>{realtimeToast.editorName}</strong> acabou de salvar alterações neste artigo.
            </p>

            {realtimeToast.summary && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 truncate">
                "{realtimeToast.summary}"
              </p>
            )}

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleReloadArticle}
                disabled={refreshingRealtime}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingRealtime ? 'animate-spin' : ''}`} />
                <span>{refreshingRealtime ? 'Atualizando...' : 'Atualizar conteúdo'}</span>
              </button>
              <button
                onClick={() => setRealtimeToast(null)}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                Continuar lendo
              </button>
            </div>
          </div>
        </div>
      </aside>
    )}
  </div>
);
};
