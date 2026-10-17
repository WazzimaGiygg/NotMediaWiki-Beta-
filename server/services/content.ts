import { INITIAL_ARTICLES, Article, UserSession } from '../data/seedData';
import { parsoidService } from './parsoid';
import { revisionService } from './revisions';
import { searchService } from './search';
import { eventStreamService } from './events';
import { centralAuthService } from './auth';
import { getFirebaseAdmin } from '../firebaseAdmin';

export class ContentService {
  private articles: Map<string, Article> = new Map();
  private htmlCache: Map<string, { html: string; parseTimeMs: number; toc: any[]; categories: string[] }> = new Map();

  constructor() {
    INITIAL_ARTICLES.forEach(art => {
      this.articles.set(art.slug, { ...art });
      searchService.indexArticle(art);
    });

    this.hydrateFromFirestore().catch(err => {
      console.warn('[ContentService] Firestore hydration notice:', err.message);
    });
  }

  private async hydrateFromFirestore(): Promise<void> {
    const { db } = getFirebaseAdmin();
    if (!db) return;

    try {
      const snap = await db.collection('articles').get();
      snap.forEach((docSnap: any) => {
        const data = docSnap.data() as Article;
        this.articles.set(docSnap.id, data);
        searchService.indexArticle(data);
      });
    } catch (err: any) {
      console.warn('[ContentService] Hydration fallback to memory seed:', err.message);
    }
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

    const cached = this.htmlCache.get(article.latestRevisionId);
    if (cached) {
      article.views++;
      return { article, ...cached };
    }

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
    user: UserSession;
  }): { article: Article; revision: any; event: any } {
    const currentUser = params.user;
    let existing = this.articles.get(params.slug);

    if (existing) {
      // Permission check based on authenticated user
      const perm = centralAuthService.checkPermission(currentUser, 'edit', existing.isProtected);
      if (!perm.allowed) {
        throw new Error(perm.reason || 'Permissão negada para editar este artigo');
      }

      // Create new immutable revision
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

      const parsed = parsoidService.parse(params.wikitext, params.title);

      existing.wikitext = params.wikitext;
      existing.latestRevisionId = rev.id;
      existing.updatedAt = new Date().toISOString();
      existing.categories = parsed.categories;
      if (params.summary) existing.summary = params.summary;

      searchService.indexArticle(existing);
      centralAuthService.incrementEditCount(currentUser.id);

      // Invalidate and set cache
      this.htmlCache.delete(rev.parentRevisionId || '');
      this.htmlCache.set(rev.id, {
        html: parsed.html,
        parseTimeMs: parsed.parseTimeMs,
        toc: parsed.toc,
        categories: parsed.categories,
      });

      // Publish EventStream
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

      // Persist to Firestore asynchronously
      const { db } = getFirebaseAdmin();
      if (db) {
        db.collection('articles').doc(params.slug).set(existing, { merge: true }).catch(() => {});
        db.collection('revisions').doc(rev.id).set(rev).catch(() => {});
      }

      return { article: existing, revision: rev, event };
    } else {
      // New article creation
      const perm = centralAuthService.checkPermission(currentUser, 'edit', false);
      if (!perm.allowed) {
        throw new Error(perm.reason || 'Permissão negada para criar novo artigo');
      }

      const parsed = parsoidService.parse(params.wikitext, params.title);
      const rev = revisionService.createRevision({
        articleSlug: params.slug,
        parentRevisionId: null,
        wikitext: params.wikitext,
        comment: params.comment || 'Página criada',
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
        comment: params.comment || 'Página criada',
        type: 'new',
        traceId: params.traceId,
      });

      const { db } = getFirebaseAdmin();
      if (db) {
        db.collection('articles').doc(params.slug).set(newArticle).catch(() => {});
        db.collection('revisions').doc(rev.id).set(rev).catch(() => {});
      }

      return { article: newArticle, revision: rev, event };
    }
  }

  public rollbackArticle(slug: string, targetRevId: string, user: UserSession): { article: Article; revision: any; event: any } {
    const perm = centralAuthService.checkPermission(user, 'rollback');
    if (!perm.allowed) {
      throw new Error(perm.reason || 'Permissão insuficiente para rollback');
    }

    const article = this.articles.get(slug);
    if (!article) throw new Error(`Artigo "${slug}" não encontrado`);

    const targetRev = revisionService.getRevision(targetRevId);
    if (!targetRev) throw new Error(`Revisão alvo "${targetRevId}" não encontrada`);

    const comment = `Reversão para revisão ${targetRevId} de ${targetRev.author.name}`;
    const res = this.saveArticle({
      slug: article.slug,
      title: article.title,
      wikitext: targetRev.wikitext,
      comment,
      isMinor: true,
      namespace: article.namespace,
      user,
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
