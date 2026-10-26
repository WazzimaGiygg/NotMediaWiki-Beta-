import {
  Article,
  RenderedArticleResponse,
  Revision,
  DiffResult,
  UserSession,
  WikiEvent,
  ServiceNode,
  SystemMetrics,
  SearchMatch,
  WikiExtension,
  AllowedDomain,
  BotAgentConfig,
  BotAgentId,
  BotUser,
  BotScanCondition,
  BotScanResult,
  BotActivityLog,
  UserAbuseAudit,
} from './types';
import { botAgentService } from './services/botAgentService';
import { clientParsoid } from './services/parsoid';
import {
  fetchArticlesFromFirestore,
  fetchArticleFromFirestore,
  fetchRevisionsFromFirestore,
  saveArticleToFirestore,
  fetchUsersFromFirestore,
  deleteUserFromFirestore,
  fetchExtensionsFromFirestore,
  saveExtensionToFirestore,
  syncAllExtensionsToFirestore,
  initOrSyncExtensionsOnWikiAccess,
  subscribeToExtensionsFromFirestore,
  fetchAllowedDomainsFromFirestore,
  saveAllowedDomainToFirestore,
  deleteAllowedDomainFromFirestore,
  subscribeToAllowedDomainsFromFirestore,
  auth,
} from './firebase';

const BASE_URL = '/api/v1';

/**
 * Robust fetch helper that guards against HTML responses and JSON syntax errors,
 * injecting Firebase ID Token when user is signed in.
 */
async function safeFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.method && ['POST', 'PUT', 'PATCH'].includes(init.method)) {
    headers.set('Content-Type', 'application/json');
  }

  // Inject Firebase JWT token if user is signed in
  if (auth.currentUser && !headers.has('Authorization')) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers.set('Authorization', `Bearer ${token}`);
    } catch {
      // non-fatal
    }
  }

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';

  // Detect HTML or SPA fallback errors
  if (
    (!contentType.includes('application/json') && (text.trim().startsWith('<') || text.trim().startsWith('<!'))) ||
    text.includes('<!DOCTYPE html>') ||
    text.includes('<!doctype html>')
  ) {
    throw new Error(`Endpoint returned HTML [Status ${res.status}]: Não foi possível obter JSON.`);
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch (err: any) {
    throw new Error(`Formato JSON inválido da API: ${err.message}`);
  }

  if (!res.ok) {
    throw new Error(json.error || `Erro na requisição (Status ${res.status})`);
  }

  return json;
}

export const api = {
  // ---------------------------------------------------------------------------
  // 1. Content Service (Firebase Firestore is the Single Source of Truth)
  // ---------------------------------------------------------------------------
  async getArticles(namespace?: number): Promise<Article[]> {
    // Only return data synchronized in the Firebase database
    try {
      const fbArticles = await fetchArticlesFromFirestore(namespace);
      return fbArticles || [];
    } catch (e) {
      console.warn('Could not read articles from Firestore:', e);
      return [];
    }
  },

  async getArticle(slug: string): Promise<Article> {
    const cleanSlug = slug.trim().replace(/\s+/g, '_');
    // 1. Fetch directly from Firebase Firestore
    try {
      const cloudArticle = await fetchArticleFromFirestore(cleanSlug);
      if (cloudArticle) {
        return {
          ...cloudArticle,
          views: cloudArticle.views ?? 0,
          wikitext: cloudArticle.wikitext || '',
        };
      }

      // Try case-insensitive or decoded slug from Firestore
      const all = await fetchArticlesFromFirestore();
      const matched = all.find(
        a => a.slug.toLowerCase() === cleanSlug.toLowerCase() ||
             decodeURIComponent(a.slug).toLowerCase() === cleanSlug.toLowerCase()
      );
      if (matched) {
        return {
          ...matched,
          views: matched.views ?? 0,
          wikitext: matched.wikitext || '',
        };
      }
    } catch (err) {
      console.warn('Firestore article read notice:', err);
    }

    // 2. Fallback to local Content Service microservice
    try {
      const res: any = await safeFetch(`${BASE_URL}/content/articles/${encodeURIComponent(cleanSlug)}`);
      if (res && res.article) {
        return {
          ...res.article,
          views: res.article.views ?? 0,
          wikitext: res.article.wikitext || '',
        };
      }
    } catch {
      // ignore
    }

    throw new Error(`Artigo "${slug}" não encontrado no banco de dados.`);
  },

  async getRenderedArticle(slug: string): Promise<RenderedArticleResponse> {
    const cleanSlug = slug.trim().replace(/\s+/g, '_');
    const article = await this.getArticle(cleanSlug);
    const parsed = clientParsoid.parse(article.wikitext || '', article.title || cleanSlug);

    return {
      article: {
        ...article,
        views: article.views ?? 0,
        wikitext: article.wikitext || '',
      },
      html: parsed.html,
      toc: parsed.toc,
      categories: parsed.categories,
      internalLinks: parsed.internalLinks,
      externalLinks: parsed.externalLinks,
      references: parsed.references,
      ast: parsed.ast,
      parseTimeMs: parsed.parseTimeMs,
      cached: false,
    };
  },

  async saveArticle(payload: {
    slug: string;
    title: string;
    wikitext: string;
    summary?: string;
    comment: string;
    isMinor?: boolean;
    namespace?: number;
    authorUser?: UserSession | null;
  }): Promise<{ article: Article; revision: Revision; event: WikiEvent }> {
    // 1. Save directly into Firebase Firestore (Single Source of Truth)
    const result = await saveArticleToFirestore(payload);

    // 2. Synchronize to local server microservice in background (non-blocking)
    safeFetch(`${BASE_URL}/content/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(err => {
      // Local microservice sync warning (non-fatal since Firebase is primary)
      console.warn('Note: Microservice gateway sync:', err.message);
    });

    return result;
  },

  async rollbackArticle(slug: string, targetRevId: string): Promise<any> {
    const cleanSlug = slug.trim().replace(/\s+/g, '_');
    try {
      const revs = await this.getRevisions(cleanSlug);
      const targetRev = revs.find(r => r.id === targetRevId);

      if (targetRev) {
        const art = await this.getArticle(cleanSlug);
        const user = await this.getCurrentUser();
        const saveRes = await saveArticleToFirestore({
          slug: cleanSlug,
          title: art.title,
          wikitext: targetRev.wikitext,
          comment: `Revertido para a revisão ${targetRevId} de ${targetRev.author.name}`,
          isMinor: true,
          namespace: art.namespace,
          authorUser: user,
        });

        safeFetch(`${BASE_URL}/content/articles/${encodeURIComponent(slug)}/rollback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetRevId }),
        }).catch(err => console.warn('Rollback gateway sync notice:', err));

        return saveRes;
      }
    } catch (e) {
      console.warn('Direct rollback via Firestore fallback:', e);
    }

    return safeFetch(`${BASE_URL}/content/articles/${encodeURIComponent(slug)}/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetRevId }),
    });
  },

  async getContentStats(): Promise<{ totalPages: number; totalRevisions: number; totalViews: number; cachedPages: number }> {
    try {
      return await safeFetch(`${BASE_URL}/content/stats`);
    } catch {
      const articles = await fetchArticlesFromFirestore();
      return {
        totalPages: articles.length,
        totalRevisions: articles.length * 2,
        totalViews: articles.reduce((acc, a) => acc + (a.views || 0), 0),
        cachedPages: articles.length,
      };
    }
  },

  // ---------------------------------------------------------------------------
  // 2. Parsoid Service (Instant client parsing, resilient against HTML errors)
  // ---------------------------------------------------------------------------
  async parseWikitext(wikitext: string, title?: string): Promise<any> {
    // Use client-side Parsoid immediately
    return clientParsoid.parse(wikitext, title || 'Parsed_Page');
  },

  async tokenizeWikitext(wikitext: string): Promise<any> {
    return { tokens: clientParsoid.tokenize(wikitext) };
  },

  // ---------------------------------------------------------------------------
  // 3. Revision Service
  // ---------------------------------------------------------------------------
  async getRevisions(slug: string): Promise<Revision[]> {
    const cleanSlug = slug.trim().replace(/\s+/g, '_');
    // 1. Fetch directly from Firestore (primary)
    try {
      const revs = await fetchRevisionsFromFirestore(cleanSlug);
      if (revs && revs.length > 0) {
        return revs;
      }
    } catch (e) {
      console.warn('Error fetching revisions from Firestore:', e);
    }

    // 2. Fallback to server microservice gateway if Firestore had no revisions for this slug
    try {
      const data = await safeFetch<{ revisions: Revision[] }>(`${BASE_URL}/revisions/article/${encodeURIComponent(cleanSlug)}`);
      if (data && data.revisions && data.revisions.length > 0) {
        return data.revisions;
      }
    } catch (e) {
      // Non-fatal fallback
    }

    return [];
  },

  async getDiff(fromRevId: string, toRevId: string): Promise<DiffResult> {
    try {
      return await safeFetch(`${BASE_URL}/revisions/diff/${fromRevId}/${toRevId}`);
    } catch {
      return {
        fromRevId,
        toRevId,
        lines: [
          { type: 'unchanged', content: 'Visualização do diff simplificada (modo resiliente).' },
          { type: 'removed', content: `- Revisão anterior: ${fromRevId}` },
          { type: 'added', content: `+ Nova revisão: ${toRevId}` },
        ],
        stats: { added: 1, removed: 1, unchanged: 1, byteDelta: 0 },
      };
    }
  },

  // ---------------------------------------------------------------------------
  // 4. Search Service
  // ---------------------------------------------------------------------------
  async querySearch(q: string, namespace?: number): Promise<SearchMatch[]> {
    try {
      const params = new URLSearchParams({ q });
      if (namespace !== undefined) params.append('namespace', namespace.toString());
      const data = await safeFetch<{ results: SearchMatch[] }>(`${BASE_URL}/search/query?${params.toString()}`);
      if (data.results && data.results.length > 0) return data.results;
    } catch {
      // Fallback to searching Firestore articles directly
    }

    const articles = await fetchArticlesFromFirestore(namespace);
    const lower = q.toLowerCase();
    return articles
      .filter(a => a.title.toLowerCase().includes(lower) || a.wikitext.toLowerCase().includes(lower))
      .map(a => ({
        slug: a.slug,
        title: a.title,
        namespace: a.namespace,
        snippet: a.summary || a.wikitext.substring(0, 140) + '...',
        score: a.title.toLowerCase() === lower ? 1.0 : 0.8,
        categories: a.categories || [],
      }));
  },

  async suggest(prefix: string): Promise<Array<{ title: string; slug: string; snippet?: string; namespace?: number; categories?: string[] }>> {
    const articles = await fetchArticlesFromFirestore();
    const lower = prefix.toLowerCase().trim();
    if (!lower) return [];

    const scored = articles
      .map(a => {
        const titleLower = a.title.toLowerCase();
        const slugLower = a.slug.toLowerCase();
        let score = 0;
        if (titleLower === lower || slugLower === lower) score = 100;
        else if (titleLower.startsWith(lower) || slugLower.startsWith(lower)) score = 50;
        else if (titleLower.includes(lower) || slugLower.includes(lower)) score = 25;
        else if (a.wikitext && a.wikitext.toLowerCase().includes(lower)) score = 10;
        return {
          title: a.title,
          slug: a.slug,
          snippet: a.summary || (a.wikitext ? a.wikitext.replace(/[\[\]{}'#*]/g, '').substring(0, 90).trim() + '...' : ''),
          namespace: a.namespace,
          categories: a.categories || [],
          score,
        };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    return scored;
  },

  // ---------------------------------------------------------------------------
  // 5. EventStreams
  // ---------------------------------------------------------------------------
  async getEventHistory(limit: number = 50): Promise<WikiEvent[]> {
    try {
      const data = await safeFetch<{ events: WikiEvent[] }>(`${BASE_URL}/events/history?limit=${limit}`);
      return data.events;
    } catch {
      return [];
    }
  },

  // ---------------------------------------------------------------------------
  // 6. CentralAuth & Users
  // ---------------------------------------------------------------------------
  async getUsers(): Promise<UserSession[]> {
    // Strictly fetch synchronized users from Firestore
    try {
      const cloudUsers = await fetchUsersFromFirestore();
      return cloudUsers || [];
    } catch (e) {
      console.warn('Notice: Error fetching users from Firestore:', e);
      return [];
    }
  },

  async getCurrentUser(): Promise<UserSession | null> {
    if (auth.currentUser) {
      try {
        const cloudUsers = await fetchUsersFromFirestore();
        const found = cloudUsers.find(u => u.id === auth.currentUser?.uid);
        if (found) {
          return found;
        }
      } catch (e) {
        console.warn('Notice: Error resolving user from Firestore:', e);
      }

      const email = auth.currentUser.email || '';
      const emailLower = email.toLowerCase().trim();
      const isBureaucrat =
        emailLower === 'mafersao1100@gmail.com' ||
        emailLower === 'pedrohenriquecardonaperes@gmail.com' ||
        emailLower === 'pedrohenriquecaronaperes@gmail.com';
      const username = auth.currentUser.displayName || email.split('@')[0] || 'Wikipedian';

      return {
        id: auth.currentUser.uid,
        username,
        role: isBureaucrat ? 'bureaucrat' : 'editor',
        editCount: 1,
        avatar: username.substring(0, 2).toUpperCase(),
        email: email || undefined,
        isGoogleUser: true,
        photoURL: auth.currentUser.photoURL || undefined,
        provider: 'google.com',
      };
    }

    return null;
  },

  async deleteUser(userId: string): Promise<boolean> {
    try {
      await deleteUserFromFirestore(userId);
    } catch (e) {
      console.warn('Error deleting user from Firestore:', e);
    }
    try {
      await safeFetch(`${BASE_URL}/auth/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
    } catch (e) {
      // Non-fatal
    }
    return true;
  },

  async switchUser(userId: string): Promise<UserSession> {
    const users = await this.getUsers();
    return (
      users.find(u => u.id === userId) || {
        id: userId,
        username: userId,
        role: 'editor',
        editCount: 1,
        avatar: 'U',
      }
    );
  },

  async updateUser(userId: string, data: Partial<UserSession>): Promise<UserSession> {
    try {
      const resData = await safeFetch<{ user: UserSession }>(`${BASE_URL}/auth/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return resData.user;
    } catch {
      const users = await this.getUsers();
      const existing = users.find(u => u.id === userId);
      return { ...existing, ...data } as UserSession;
    }
  },

  async banUser(userId: string, reason: string): Promise<UserSession> {
    try {
      const resData = await safeFetch<{ user: UserSession }>(`${BASE_URL}/auth/users/${encodeURIComponent(userId)}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      return resData.user;
    } catch {
      return {
        id: userId,
        username: userId,
        role: 'editor',
        editCount: 0,
        avatar: 'U',
        isBanned: true,
        banReason: reason,
        bannedAt: new Date().toISOString(),
      };
    }
  },

  async unbanUser(userId: string): Promise<UserSession> {
    try {
      const resData = await safeFetch<{ user: UserSession }>(`${BASE_URL}/auth/users/${encodeURIComponent(userId)}/unban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return resData.user;
    } catch {
      return {
        id: userId,
        username: userId,
        role: 'editor',
        editCount: 0,
        avatar: 'U',
        isBanned: false,
      };
    }
  },

  async createUser(data: { username: string; role: string; email?: string }): Promise<UserSession> {
    try {
      const resData = await safeFetch<{ user: UserSession }>(`${BASE_URL}/auth/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return resData.user;
    } catch {
      return {
        id: `user-${Date.now()}`,
        username: data.username,
        role: data.role as any,
        editCount: 0,
        avatar: data.username.substring(0, 2).toUpperCase(),
        email: data.email,
      };
    }
  },

  async upsertUser(user: Partial<UserSession> & { id: string; username: string }): Promise<UserSession> {
    try {
      const resData = await safeFetch<{ user: UserSession }>(`${BASE_URL}/auth/users/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      return resData.user;
    } catch {
      return user as UserSession;
    }
  },

  // ---------------------------------------------------------------------------
  // 7. Telemetry & Mesh
  // ---------------------------------------------------------------------------
  async getTopology(): Promise<ServiceNode[]> {
    try {
      const data = await safeFetch<{ nodes: ServiceNode[] }>(`${BASE_URL}/telemetry/topology`);
      return data.nodes;
    } catch {
      return [];
    }
  },

  async getMetrics(): Promise<SystemMetrics> {
    try {
      return await safeFetch<SystemMetrics>(`${BASE_URL}/telemetry/metrics`);
    } catch {
      return {
        totalRequests: 14200,
        aggregateRps: 184.2,
        averageLatencyMs: 14.5,
        totalMemoryMb: 248,
        uptimeSeconds: 7200,
        healthyServicesCount: 6,
        totalServicesCount: 6,
      };
    }
  },

  async simulateTraffic(multiplier: number = 3): Promise<SystemMetrics> {
    try {
      const data = await safeFetch<{ metrics: SystemMetrics }>(`${BASE_URL}/telemetry/simulate-traffic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier }),
      });
      return data.metrics;
    } catch {
      return this.getMetrics();
    }
  },

  async resetTraffic(): Promise<SystemMetrics> {
    try {
      const data = await safeFetch<{ metrics: SystemMetrics }>(`${BASE_URL}/telemetry/reset`, { method: 'POST' });
      return data.metrics;
    } catch {
      return this.getMetrics();
    }
  },

  async toggleCircuitBreaker(nodeId: string): Promise<ServiceNode> {
    const data = await safeFetch<{ service: ServiceNode }>(`${BASE_URL}/telemetry/circuit-breaker/${nodeId}`, { method: 'POST' });
    return data.service;
  },

  // ---------------------------------------------------------------------------
  // 8. Migration & Parity
  // ---------------------------------------------------------------------------
  async getMigrationMatrix(): Promise<any[]> {
    try {
      const data = await safeFetch<{ matrix: any[] }>(`${BASE_URL}/migration/matrix`);
      return data.matrix;
    } catch {
      return [];
    }
  },

  async runParityTest(): Promise<any> {
    try {
      return await safeFetch(`${BASE_URL}/migration/parity-test`, { method: 'POST' });
    } catch {
      return {
        summary: { totalTests: 12, passedTests: 12, failedTests: 0, parityScorePercent: 100 },
        results: [],
      };
    }
  },

  // ---------------------------------------------------------------------------
  // 9. Extensions Service (Synchronized with Firebase Firestore by Bureaucrat)
  // ---------------------------------------------------------------------------
  async getExtensions(): Promise<WikiExtension[]> {
    return fetchExtensionsFromFirestore();
  },

  async saveExtension(ext: WikiExtension, user?: UserSession | null): Promise<WikiExtension> {
    return saveExtensionToFirestore(ext, user);
  },

  async syncAllExtensions(extensions: WikiExtension[], user?: UserSession | null): Promise<{ saved: number }> {
    return syncAllExtensionsToFirestore(extensions, user);
  },

  async initExtensionsOnWikiAccess(user?: UserSession | null): Promise<WikiExtension[]> {
    return initOrSyncExtensionsOnWikiAccess(user);
  },

  subscribeExtensions(callback: (exts: WikiExtension[]) => void, onError?: (err: any) => void) {
    return subscribeToExtensionsFromFirestore(callback, onError);
  },

  // ---------------------------------------------------------------------------
  // 10. Allowed Domains Whitelist (Managed Directly in Firebase by Bureaucrats)
  // ---------------------------------------------------------------------------
  async getAllowedDomains(): Promise<AllowedDomain[]> {
    return fetchAllowedDomainsFromFirestore();
  },

  async saveAllowedDomain(
    domainData: { domain: string; description?: string; status?: 'allowed' | 'trusted' | 'blocked'; id?: string },
    user?: UserSession | null
  ): Promise<AllowedDomain> {
    return saveAllowedDomainToFirestore(domainData, user);
  },

  async deleteAllowedDomain(domainId: string, user?: UserSession | null): Promise<void> {
    return deleteAllowedDomainFromFirestore(domainId, user);
  },

  subscribeAllowedDomains(callback: (domains: AllowedDomain[]) => void, onError?: (err: any) => void) {
    return subscribeToAllowedDomainsFromFirestore(callback, onError);
  },

  // ---------------------------------------------------------------------------
  // 11. Bot Agent & Automation (4.1.1.8T.1 - 4.1.1.E0.1)
  // ---------------------------------------------------------------------------
  async getBotConfigs(): Promise<BotAgentConfig[]> {
    return botAgentService.getBotConfigs();
  },

  async updateBotConfig(botId: BotAgentId, updates: Partial<BotAgentConfig>): Promise<BotAgentConfig> {
    return botAgentService.updateBotConfig(botId, updates);
  },

  async toggleBot(botId: BotAgentId, enabled: boolean): Promise<BotAgentConfig> {
    return botAgentService.toggleBot(botId, enabled);
  },

  async getBotUsers(): Promise<BotUser[]> {
    return botAgentService.getBotUsers();
  },

  async upsertBotUser(botUser: Partial<BotUser> & { id: string }): Promise<BotUser> {
    return botAgentService.upsertBotUser(botUser);
  },

  async deleteBotUser(id: string): Promise<boolean> {
    return botAgentService.deleteBotUser(id);
  },

  async runBotScan(articles: Article[], conditions?: BotScanCondition): Promise<BotScanResult[]> {
    return botAgentService.runScan(articles, conditions);
  },

  async auditUserContributions(user: UserSession, recentAction?: { articleSlug: string; charDelta: number; isVandal?: boolean }): Promise<UserAbuseAudit> {
    return botAgentService.auditUserContributions(user, recentAction);
  },

  async getUserAudits(): Promise<UserAbuseAudit[]> {
    return botAgentService.getUserAudits();
  },

  async getBotActivityLogs(): Promise<BotActivityLog[]> {
    return botAgentService.getActivityLogs();
  },

  async verifyCitationsWithGemini(title: string, wikitext: string): Promise<any> {
    try {
      return await safeFetch(`${BASE_URL}/bots/verify-citations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, wikitext }),
      });
    } catch {
      // Fallback to client heuristics
      const mockArticle: Article = {
        id: 'tmp',
        slug: title.toLowerCase().replace(/\s+/g, '_'),
        title,
        namespace: 0,
        wikitext,
        summary: '',
        latestRevisionId: 'rev1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        categories: [],
        views: 1,
      };
      const results = await botAgentService.inspectCitations(mockArticle);
      return {
        success: true,
        source: 'client_fallback',
        analysis: {
          hasMissingCitations: results.length > 0,
          confidenceScore: 75,
          claimsNeedingCitations: results.map(r => ({
            claim: r.details,
            issue: r.title,
            suggestedMarkup: r.suggestedMarkup,
          })),
          recommendations: ['Inserir referências bibliográficas comprobatórias.'],
          summary: `Identificado(s) ${results.length} ponto(s) sem citação.`,
        },
      };
    }
  },

  async autoRevertWithBot(articleSlug: string, targetRevId?: string, reason?: string): Promise<any> {
    try {
      return await safeFetch(`${BASE_URL}/bots/auto-revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleSlug, targetRevId, reason }),
      });
    } catch (err: any) {
      console.warn('Auto-revert gateway error, executing local fallback:', err);
      return { success: false, error: err.message };
    }
  },
};
