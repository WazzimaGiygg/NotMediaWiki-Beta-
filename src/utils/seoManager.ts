import { Article } from '../types';

export const PRIMARY_CANONICAL_ORIGIN = 'https://core.wazzimagiygg.com';
export const SITE_BRAND_NAME = 'NotMediaWiki | Projetos WazzimaGiygg';
export const DEFAULT_SITE_DESCRIPTION =
  'NotMediaWiki (core.wazzimagiygg.com) — Enciclopédia colaborativa oficial dos Projetos WazzimaGiygg com artigos verificados em tempo real.';
export const DEFAULT_OG_IMAGE = `${PRIMARY_CANONICAL_ORIGIN}/assets/aistudio/image_370f9ede.png`;

const DYNAMIC_JSONLD_SCRIPT_ID = 'notmediawiki-dynamic-jsonld';

export interface DynamicSeoOptions {
  title: string;
  description: string;
  canonicalUrl: string;
  ogType?: 'website' | 'article';
  keywords?: string[];
  jsonLd?: Record<string, any> | null;
}

/**
 * Resolves the authoritative canonical URL anchored on core.wazzimagiygg.com.
 */
export function buildCanonicalUrl(slug?: string): string {
  if (!slug || !slug.trim()) {
    return `${PRIMARY_CANONICAL_ORIGIN}/`;
  }
  const cleanSlug = slug.trim().replace(/\s+/g, '_');
  return `${PRIMARY_CANONICAL_ORIGIN}/#/wiki/${encodeURIComponent(cleanSlug)}`;
}

/**
 * Strips wikitext markup to generate a clean 120–160 character SEO meta description.
 */
export function buildArticleMetaDescription(article: Pick<Article, 'title' | 'summary' | 'wikitext'>): string {
  const rawSource =
    (article.summary && article.summary.trim()) ||
    (article.wikitext || '')
      .replace(/\{\{[\s\S]*?\}\}/g, ' ')
      .replace(/<ref[\s\S]*?<\/ref>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
      .replace(/={2,}\s*([^=]+?)\s*={2,}/g, '$1')
      .replace(/'''?/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  if (!rawSource) {
    return `Leia o artigo completo sobre ${article.title} no NotMediaWiki oficial (core.wazzimagiygg.com) — Projetos WazzimaGiygg.`;
  }

  const trimmed = rawSource.length > 152 ? `${rawSource.slice(0, 149).trim()}...` : rawSource;
  return trimmed;
}

/**
 * Builds rich Schema.org JSON-LD (@graph with Article + BreadcrumbList) for an encyclopedia article
 * on core.wazzimagiygg.com.
 */
export function buildArticleJsonLd(article: Article): Record<string, any> {
  const canonicalUrl = buildCanonicalUrl(article.slug);
  const description = buildArticleMetaDescription(article);
  const keywords = Array.from(
    new Set([
      article.title,
      ...(article.categories || []),
      'NotMediaWiki',
      'WazzimaGiygg',
      'core.wazzimagiygg.com',
    ])
  );

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${canonicalUrl}#article`,
        headline: article.title,
        name: article.title,
        description,
        url: canonicalUrl,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': canonicalUrl,
        },
        inLanguage: 'pt-BR',
        datePublished: article.createdAt || new Date().toISOString(),
        dateModified: article.updatedAt || article.createdAt || new Date().toISOString(),
        keywords: keywords.join(', '),
        articleSection: article.categories?.[0] || 'Enciclopédia',
        image: DEFAULT_OG_IMAGE,
        author: {
          '@type': 'Organization',
          name: 'Projetos WazzimaGiygg',
          url: PRIMARY_CANONICAL_ORIGIN,
        },
        publisher: {
          '@type': 'Organization',
          name: 'Projetos WazzimaGiygg',
          url: PRIMARY_CANONICAL_ORIGIN,
          logo: {
            '@type': 'ImageObject',
            url: DEFAULT_OG_IMAGE,
          },
        },
        isPartOf: {
          '@type': 'WebSite',
          name: SITE_BRAND_NAME,
          url: `${PRIMARY_CANONICAL_ORIGIN}/`,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'NotMediaWiki (core.wazzimagiygg.com)',
            item: `${PRIMARY_CANONICAL_ORIGIN}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: article.categories?.[0] || 'Artigos',
            item: `${PRIMARY_CANONICAL_ORIGIN}/#/special/AllPages`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: article.title,
            item: canonicalUrl,
          },
        ],
      },
    ],
  };
}

function upsertMetaTag(selector: string, attrs: Record<string, string>, content: string): void {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonicalLink(href: string): void {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/**
 * Applies dynamic SEO tags (title, description, canonical, OpenGraph, Twitter, JSON-LD)
 * in the browser document head as the user navigates across views and articles.
 */
export function applyDynamicSeoMeta(options: DynamicSeoOptions): void {
  if (typeof document === 'undefined') return;

  document.title = options.title;
  upsertMetaTag('meta[name="description"]', { name: 'description' }, options.description);
  if (options.keywords && options.keywords.length > 0) {
    upsertMetaTag('meta[name="keywords"]', { name: 'keywords' }, options.keywords.join(', '));
  }

  upsertCanonicalLink(options.canonicalUrl);

  // OpenGraph
  upsertMetaTag('meta[property="og:type"]', { property: 'og:type' }, options.ogType || 'website');
  upsertMetaTag('meta[property="og:title"]', { property: 'og:title' }, options.title);
  upsertMetaTag('meta[property="og:description"]', { property: 'og:description' }, options.description);
  upsertMetaTag('meta[property="og:url"]', { property: 'og:url' }, options.canonicalUrl);
  upsertMetaTag('meta[property="og:site_name"]', { property: 'og:site_name' }, SITE_BRAND_NAME);

  // Twitter / X
  upsertMetaTag('meta[name="twitter:title"]', { name: 'twitter:title' }, options.title);
  upsertMetaTag('meta[name="twitter:description"]', { name: 'twitter:description' }, options.description);

  // Dynamic JSON-LD structured data
  const existingScript = document.getElementById(DYNAMIC_JSONLD_SCRIPT_ID);
  if (options.jsonLd) {
    const scriptEl = existingScript || document.createElement('script');
    scriptEl.id = DYNAMIC_JSONLD_SCRIPT_ID;
    scriptEl.setAttribute('type', 'application/ld+json');
    scriptEl.textContent = JSON.stringify(options.jsonLd);
    if (!existingScript) {
      document.head.appendChild(scriptEl);
    }
  } else if (existingScript) {
    existingScript.remove();
  }
}

/**
 * Restores default homepage SEO metadata for core.wazzimagiygg.com.
 */
export function applyDefaultSiteSeo(): void {
  applyDynamicSeoMeta({
    title: SITE_BRAND_NAME,
    description: DEFAULT_SITE_DESCRIPTION,
    canonicalUrl: `${PRIMARY_CANONICAL_ORIGIN}/`,
    ogType: 'website',
    keywords: [
      'NotMediaWiki',
      'WazzimaGiygg',
      'core.wazzimagiygg.com',
      'Projetos WazzimaGiygg',
      'enciclopédia colaborativa',
      'wiki oficial',
    ],
    jsonLd: null,
  });
}
