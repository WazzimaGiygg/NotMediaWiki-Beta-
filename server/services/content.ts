import { INITIAL_ARTICLES, Article } from '../data/seedData';
import { parsoidService } from './parsoid';
import { revisionService } from './revisions';
import { searchService } from './search';
import { eventStreamService } from './events';
import { centralAuthService } from './auth';

export class ContentService {
  private articles: Map<string, Article> = new Map();
  private htmlCache: Map<string, { html: string; parseTimeMs: number; toc: any[]; categories: string[] }> = new Map();

  constructor() {
    INITIAL_ARTICLES.forEach(art => {
      this.articles.set(art.slug, art);
      searchService.indexArticle(art);
    });
  }

  public getAllArticles(namespace?: number): Article[] {
    const list = Array.from(this.articles.values());
    if (namespace !== undefined) {
      return list.filter(a => a.namespace === namespace);
    }
    return list.sort((a, b) => b.views - a.views);
  }

  public getArticle(slug: string): Article | undefined {
    return this.articles.get(slug);
  }

  public getRenderedArticle(slug: string): { article: Article; html: string; toc: any[]; categories: string[]; parseTimeMs: number } | undefined {
    const article = this.articles.get(slug);
    if (!article) return undefined;

    // Check parse cache
    const cached = this.htmlCache.get(article.latestRevisionId);
    if (cached) {
      article.views++;
      return { article, ...cached };
    }

    // Parse via Parsoid
    const parsed = parsoidService.parse(article.wikitext, article.title);
    const cacheEntry = {
      html: parsed.html,
      parseTimeMs: parsed.parseTimeMs,
      toc: parsed.toc,
      categories: parsed.categories,
    };
    this.htmlCache.set(article.latestRevisionId, cacheEntry);
    article.views++;

    return { article, ...cacheEntry };
  }

  public saveArticle(params: {
    slug: string;
    title: string;
    wikitext: string;
    summary?: string;
    comment: string;
    isMinor?: boolean;
    namespace?: number;
    traceId?: string;
  }): { article: Article; revision: any; event: any } {
    const currentUser = centralAuthService.getCurrentUser();
    let existing = this.articles.get(params.slug);

    if (existing) {
      // Permission check
      const perm = centralAuthService.checkPermission(currentUser, 'edit', existing.isProtected);
      if (!perm.allowed) {
        throw new Error(perm.reason || 'Permission denied');
      }

      // Create new revision
      const rev = revisionService.createRevision({
        articleSlug: params.slug,
        parentRevisionId: existing.latestRevisionId,
        wikitext: params.wikitext,
        comment: params.comment,
        author: {
          id: currentUser.id,
          name: currentUser.username,
          isBot: currentUser.role === 'bot',
        },
        isMinor: params.isMinor,
      });

      // Parse for categories
      const parsed = parsoidService.parse(params.wikitext, params.title);

      existing.wikitext = params.wikitext;
      existing.latestRevisionId = rev.id;
      existing.updatedAt = new Date().toISOString();
      existing.categories = parsed.categories;
      if (params.summary) existing.summary = params.summary;

      // Update search index
      searchService.indexArticle(existing);
      centralAuthService.incrementEditCount(currentUser.id);

      // Invalidate parse cache
      this.htmlCache.delete(rev.parentRevisionId || '');
      this.htmlCache.set(rev.id, {
        html: parsed.html,
        parseTimeMs: parsed.parseTimeMs,
        toc: parsed.toc,
        categories: parsed.categories,
      });

      // Publish event
      const event = eventStreamService.publish({
        database: 'enwiki',
        page_title: existing.title,
        page_namespace: existing.namespace,
        rev_id: rev.id,
        rev_timestamp: rev.timestamp,
        rev_sha1: rev.sha256.substring(0, 16),
        rev_minor_edit: !!params.isMinor,
        rev_len: rev.byteSize,
        user_text: currentUser.username,
        comment: params.comment,
        type: 'edit',
        traceId: params.traceId,
      });

      return { article: existing, revision: rev, event };
    } else {
      // New article creation
      const perm = centralAuthService.checkPermission(currentUser, 'edit', false);
      if (!perm.allowed) {
        throw new Error(perm.reason || 'Permission denied');
      }

      const parsed = parsoidService.parse(params.wikitext, params.title);
      const rev = revisionService.createRevision({
        articleSlug: params.slug,
        parentRevisionId: null,
        wikitext: params.wikitext,
        comment: params.comment || 'Created new page',
        author: {
          id: currentUser.id,
          name: currentUser.username,
          isBot: currentUser.role === 'bot',
        },
        isMinor: false,
      });

      const newArticle: Article = {
        id: `art-${Date.now().toString(36)}`,
        slug: params.slug,
        title: params.title,
        namespace: params.namespace !== undefined ? params.namespace : 0,
        wikitext: params.wikitext,
        summary: params.summary || params.wikitext.substring(0, 140),
        latestRevisionId: rev.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        categories: parsed.categories,
        views: 1,
        isProtected: false,
      };

      this.articles.set(params.slug, newArticle);
      searchService.indexArticle(newArticle);
      centralAuthService.incrementEditCount(currentUser.id);

      this.htmlCache.set(rev.id, {
        html: parsed.html,
        parseTimeMs: parsed.parseTimeMs,
        toc: parsed.toc,
        categories: parsed.categories,
      });

      const event = eventStreamService.publish({
        database: 'enwiki',
        page_title: newArticle.title,
        page_namespace: newArticle.namespace,
        rev_id: rev.id,
        rev_timestamp: rev.timestamp,
        rev_sha1: rev.sha256.substring(0, 16),
        rev_minor_edit: false,
        rev_len: rev.byteSize,
        user_text: currentUser.username,
        comment: params.comment || 'Created new page',
        type: 'new',
        traceId: params.traceId,
      });

      return { article: newArticle, revision: rev, event };
    }
  }

  public rollbackArticle(slug: string, targetRevId: string): { article: Article; revision: any; event: any } {
    const currentUser = centralAuthService.getCurrentUser();
    const perm = centralAuthService.checkPermission(currentUser, 'rollback');
    if (!perm.allowed) {
      throw new Error(perm.reason || 'Permission denied');
    }

    const article = this.articles.get(slug);
    if (!article) throw new Error(`Article ${slug} not found`);

    const targetRev = revisionService.getRevision(targetRevId);
    if (!targetRev) throw new Error(`Target revision ${targetRevId} not found`);

    const comment = `Reverted edits to revision ${targetRevId} by ${targetRev.author.name}`;
    const res = this.saveArticle({
      slug: article.slug,
      title: article.title,
      wikitext: targetRev.wikitext,
      comment,
      isMinor: true,
      namespace: article.namespace,
    });

    return res;
  }

  public getStats() {
    return {
      totalPages: this.articles.size,
      totalRevisions: revisionService.getAllRevisions().length,
      totalViews: Array.from(this.articles.values()).reduce((sum, a) => sum + a.views, 0),
      cachedPages: this.htmlCache.size,
    };
  }
}

export const contentService = new ContentService();
