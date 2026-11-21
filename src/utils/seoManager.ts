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
  siteName?: string;
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

export interface BreadcrumbItem {
  position: number;
  label: string;
  href: string;
  slug?: string;
  kind: 'home' | 'category' | 'subpage' | 'article';
}

/**
 * Builds the canonical breadcrumb hierarchy for an article:
 * Home -> Categories (up to 2 levels) -> Subpage parents (if any) -> Article Title.
 */
export function buildBreadcrumbTrail(
  article: Pick<Article, 'slug' | 'title' | 'categories'>,
  extraCategories?: string[],
  subpageCrumbs?: Array<{ label: string; slug: string }>
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    {
      position: 1,
      label: 'Início',
      href: `${PRIMARY_CANONICAL_ORIGIN}/`,
      kind: 'home',
    },
  ];

  const mergedCategories = Array.from(
    new Set(
      [...(extraCategories || []), ...(article.categories || [])]
        .map(c => c.replace(/^(Categoria|Category):/i, '').trim())
        .filter(Boolean)
    )
  );

  if (mergedCategories.length > 0) {
    // Include up to 2 category hierarchy levels (e.g. Primary Category > Subcategory)
    mergedCategories.slice(0, 2).forEach(cat => {
      const catSlug = `Categoria:${cat.replace(/\s+/g, '_')}`;
      items.push({
        position: items.length + 1,
        label: cat,
        href: buildCanonicalUrl(catSlug),
        slug: catSlug,
        kind: 'category',
      });
    });
  } else {
    items.push({
      position: items.length + 1,
      label: 'Enciclopédia',
      href: `${PRIMARY_CANONICAL_ORIGIN}/#/special/AllPages`,
      kind: 'category',
    });
  }

  if (subpageCrumbs && subpageCrumbs.length > 0) {
    subpageCrumbs.forEach(crumb => {
      items.push({
        position: items.length + 1,
        label: crumb.label,
        href: buildCanonicalUrl(crumb.slug),
        slug: crumb.slug,
        kind: 'subpage',
      });
    });
  }

  items.push({
    position: items.length + 1,
    label: article.title,
    href: buildCanonicalUrl(article.slug),
    slug: article.slug,
    kind: 'article',
  });

  return items;
}

/**
 * Builds rich Schema.org JSON-LD (@graph with Article + BreadcrumbList) for an encyclopedia article
 * on core.wazzimagiygg.com.
 */
export function buildArticleJsonLd(
  article: Article,
  extraCategories?: string[],
  subpageCrumbs?: Array<{ label: string; slug: string }>,
  siteTitle = 'NotMediaWiki'
): Record<string, any> {
  const canonicalUrl = buildCanonicalUrl(article.slug);
  const description = buildArticleMetaDescription(article);
  const effectiveCategories = Array.from(
    new Set([...(extraCategories || []), ...(article.categories || [])].filter(Boolean))
  );
  const keywords = Array.from(
    new Set([
      article.title,
      ...effectiveCategories,
      'NotMediaWiki',
      'WazzimaGiygg',
      'core.wazzimagiygg.com',
    ])
  );
  const trail = buildBreadcrumbTrail(article, extraCategories, subpageCrumbs);

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
        articleSection: effectiveCategories[0] || 'Enciclopédia',
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
          name: siteTitle ? `${siteTitle} | Projetos WazzimaGiygg` : SITE_BRAND_NAME,
          url: `${PRIMARY_CANONICAL_ORIGIN}/`,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: trail.map(item => ({
          '@type': 'ListItem',
          position: item.position,
          name: item.kind === 'home' ? `${siteTitle || 'NotMediaWiki'} (core.wazzimagiygg.com)` : item.label,
          item: item.href,
        })),
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
  const effectiveSiteName = options.siteName || SITE_BRAND_NAME;
  upsertMetaTag('meta[property="og:type"]', { property: 'og:type' }, options.ogType || 'website');
  upsertMetaTag('meta[property="og:title"]', { property: 'og:title' }, options.title);
  upsertMetaTag('meta[property="og:description"]', { property: 'og:description' }, options.description);
  upsertMetaTag('meta[property="og:url"]', { property: 'og:url' }, options.canonicalUrl);
  upsertMetaTag('meta[property="og:site_name"]', { property: 'og:site_name' }, effectiveSiteName);

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
export function applyDefaultSiteSeo(siteTitle?: string, siteSubtitle?: string): void {
  const cleanTitle = (siteTitle || '').trim() || 'NotMediaWiki';
  const cleanSubtitle = siteSubtitle !== undefined ? siteSubtitle.trim() : 'Projetos WazzimaGiygg';
  const fullTitle = cleanSubtitle ? `${cleanTitle} | ${cleanSubtitle}` : cleanTitle;
  const dynamicDescription = `${cleanTitle} (core.wazzimagiygg.com) — Enciclopédia colaborativa oficial dos Projetos WazzimaGiygg com artigos verificados em tempo real.`;

  if (typeof document !== 'undefined') {
    upsertMetaTag('meta[name="application-name"]', { name: 'application-name' }, cleanTitle);
    upsertMetaTag('meta[name="apple-mobile-web-app-title"]', { name: 'apple-mobile-web-app-title' }, cleanTitle);
  }

  applyDynamicSeoMeta({
    title: fullTitle,
    siteName: fullTitle,
    description: dynamicDescription,
    canonicalUrl: `${PRIMARY_CANONICAL_ORIGIN}/`,
    ogType: 'website',
    keywords: [
      cleanTitle,
      'WazzimaGiygg',
      'core.wazzimagiygg.com',
      'Projetos WazzimaGiygg',
      'enciclopédia colaborativa',
      'wiki oficial',
    ],
    jsonLd: null,
  });
}
