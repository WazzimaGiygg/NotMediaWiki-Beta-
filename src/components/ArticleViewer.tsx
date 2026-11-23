import React, { useEffect, useMemo, useState } from 'react';
import { Article, UserSession } from '../types';
import { auth } from '../firebase';
import { clientParsoid } from '../services/parsoid';
import { templateService } from '../services/templateService';
import { parseFootnoteTagsInHtml } from '../utils/citationParser';
import { parseTitle } from '../utils/namespaces';
import { ArticleFootnotes } from './ArticleFootnotes';
import { WikiReader } from './WikiReader';
import { useExtensions } from '../context/ExtensionsContext';

export interface ArticleViewerProps {
  /** Slug do artigo (modo leitor completo conectado ao WikiReader + Firestore) */
  slug?: string;
  /** Conteúdo Wikitext bruto (modo visualizador direto com expansão {{Predefinição|parâmetro}}) */
  wikitext?: string;
  /** Título exibido no modo Wikitext direto */
  title?: string;
  /** Lista opcional de predefinições personalizadas (Namespace 10) para transclusão imediata */
  customTemplates?: Article[];
  /** Parâmetros dinâmicos opcionais aplicados em placeholders {{{chave|padrão}}} */
  dynamicParams?: Record<string, string>;
  /** Nome do site utilizado na palavra mágica {{SITENAME}} */
  siteName?: string;
  onNavigate?: (slug: string) => void;
  onEdit?: (slug: string) => void;
  onHistory?: (slug: string) => void;
  onNewArticle?: () => void;
  currentUser?: UserSession | null;
  onProgressChange?: (progress: number) => void;
  onOpenChecklist?: () => void;
  onRandomArticle?: () => void;
  onSearch?: (query: string) => void;
  isZenMode?: boolean;
  onZenModeChange?: (enabled: boolean) => void;
  className?: string;
}

/**
 * ArticleViewer — Visualizador de artigos Wikitext integrado ao templateService.
 * Expande pré-definições {{Nome|parâmetro}} com suporte a parâmetros dinâmicos
 * antes da renderização final do conteúdo pelo Parsoid.
 */
export const ArticleViewer: React.FC<ArticleViewerProps> = ({
  slug,
  wikitext,
  title = 'Artigo',
  customTemplates,
  dynamicParams,
  siteName,
  onNavigate = target => {
    window.location.hash = `#/wiki/${encodeURIComponent(target.replace(/\s+/g, '_'))}`;
  },
  onEdit = target => {
    window.location.hash = `#/edit/${encodeURIComponent(target.replace(/\s+/g, '_'))}`;
  },
  onHistory = target => {
    window.location.hash = `#/history/${encodeURIComponent(target.replace(/\s+/g, '_'))}`;
  },
  onNewArticle,
  currentUser,
  onProgressChange,
  onOpenChecklist,
  onRandomArticle,
  onSearch,
  isZenMode,
  onZenModeChange,
  className = '',
}) => {
  const { isExtensionEnabled } = useExtensions();
  const isParsoidEnabled = isExtensionEnabled ? isExtensionEnabled('ParsoidCompiler', true) : true;
  const isTemplatesEnabled = isExtensionEnabled ? isExtensionEnabled('MediaWikiTemplates', true) : true;
  const isCiteEnabled = isExtensionEnabled ? isExtensionEnabled('Cite', true) : true;
  const isInfoboxEnabled = isExtensionEnabled ? isExtensionEnabled('InfoboxBuilder', true) : true;

  const [liveTemplates, setLiveTemplates] = useState<Article[]>(() =>
    customTemplates && customTemplates.length > 0
      ? customTemplates
      : templateService.getCachedCustomTemplates()
  );

  // Hidrata e sincroniza pré-definições do Firestore via templateService antes da renderização
  useEffect(() => {
    if (wikitext === undefined || !isTemplatesEnabled) return;
    if (customTemplates && customTemplates.length > 0) {
      setLiveTemplates(customTemplates);
      return;
    }

    let mounted = true;
    templateService
      .getAllTemplates()
      .then(list => {
        if (mounted && list.length > 0) {
          setLiveTemplates(list);
        }
      })
      .catch(() => {});

    let unsubscribe: (() => void) | undefined;
    if (auth.currentUser) {
      unsubscribe = templateService.subscribeTemplates(
        list => {
          if (mounted) {
            setLiveTemplates(list);
          }
        },
        () => {}
      );
    }

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [wikitext, customTemplates, isTemplatesEnabled]);

  // Processa o wikitexto via templateService expandindo {{Nome|params}} antes da renderização Parsoid
  const directParsed = useMemo(() => {
    if (wikitext === undefined) return null;

    if (!isParsoidEnabled) {
      return clientParsoid.parse(wikitext, title, {
        parsoidEnabled: false,
        citeEnabled: isCiteEnabled,
        templatesEnabled: isTemplatesEnabled,
        infoboxEnabled: isInfoboxEnabled,
      });
    }

    const isTemplatePage = parseTitle(title).namespaceId === 10;
    const expanded = isTemplatesEnabled
      ? templateService.expandTemplates(wikitext, {
          customTemplates: customTemplates || liveTemplates,
          pageTitle: title,
          siteName,
          isTemplatePage,
          dynamicParams,
        })
      : {
          wikitext,
          usedTemplates: [],
          missingTemplates: [],
        };

    const parsed = clientParsoid.parse(expanded.wikitext, title, {
      customTemplates: customTemplates || liveTemplates,
      siteName,
      isTemplatePage,
      skipTemplateExpansion: true,
      parsoidEnabled: isParsoidEnabled,
      citeEnabled: isCiteEnabled,
      templatesEnabled: isTemplatesEnabled,
      infoboxEnabled: isInfoboxEnabled,
      preExpandedTemplates: {
        usedTemplates: expanded.usedTemplates,
        missingTemplates: expanded.missingTemplates,
      },
    });

    const htmlWithFootnotes = isCiteEnabled
      ? parseFootnoteTagsInHtml(parsed.html).html
      : parsed.html;

    return {
      ...parsed,
      usedTemplates: expanded.usedTemplates,
      missingTemplates: expanded.missingTemplates,
      html: htmlWithFootnotes,
    };
  }, [
    wikitext,
    title,
    customTemplates,
    liveTemplates,
    siteName,
    dynamicParams,
    isParsoidEnabled,
    isTemplatesEnabled,
    isCiteEnabled,
    isInfoboxEnabled,
  ]);

  // Modo A: Leitor enciclopédico completo conectado ao Firestore via slug
  if (wikitext === undefined && slug) {
    return (
      <WikiReader
        slug={slug}
        onNavigate={onNavigate}
        onEdit={onEdit}
        onHistory={onHistory}
        onNewArticle={onNewArticle}
        currentUser={currentUser}
        onProgressChange={onProgressChange}
        onOpenChecklist={onOpenChecklist}
        onRandomArticle={onRandomArticle}
        onSearch={onSearch}
        isZenMode={isZenMode}
        onZenModeChange={onZenModeChange}
      />
    );
  }

  // Modo B: Visualizador direto de Wikitext com expansão prévia via templateService
  const handleContentClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href) return;

    if (href.startsWith('#/wiki/')) {
      e.preventDefault();
      onNavigate(decodeURIComponent(href.replace('#/wiki/', '')));
    } else if (href.startsWith('#/edit/')) {
      e.preventDefault();
      onEdit(decodeURIComponent(href.replace('#/edit/', '')));
    }
  };

  return (
    <div data-testid="article-viewer" className={`article-viewer ${className}`.trim()}>
      <article
        className="wiki-content prose max-w-none text-slate-800 dark:text-slate-200 font-serif text-base leading-relaxed"
        onClick={handleContentClick}
        dangerouslySetInnerHTML={{ __html: directParsed?.html || '' }}
      />
      {wikitext && isParsoidEnabled && isCiteEnabled && (
        <ArticleFootnotes
          ast={directParsed?.ast}
          references={directParsed?.references}
          wikitext={wikitext}
          articleTitle={title}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
};

export default ArticleViewer;
