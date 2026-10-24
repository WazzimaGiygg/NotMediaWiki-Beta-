import {
  Article,
  BotScanCondition,
  BotScanResult,
  BotActivityLog,
  UserAbuseAudit,
  UserSession,
} from '../types';
import { db } from '../firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { antiVandalismBot } from '../extensions/bots/bots/AntiVandalismBot';
import { citationCheckerBot } from '../extensions/bots/bots/CitationCheckerBot';
import { qualityBot } from '../extensions/bots/bots/QualityBot';
import { categorizationBot } from '../extensions/bots/bots/CategorizationBot';
import { brokenLinksBot } from '../extensions/bots/bots/BrokenLinksBot';
import { lgpdModerationBot } from '../extensions/bots/bots/LgpdModerationBot';

const STORAGE_LOGS_KEY = 'notmediawiki_bot_execution_logs';
const STORAGE_USER_AUDITS_KEY = 'notmediawiki_user_audits_execution';

export class BotExecutionService {
  private logs: BotActivityLog[] = [];
  private userAudits: Record<string, UserAbuseAudit> = {};

  constructor() {
    try {
      const stored = localStorage.getItem(STORAGE_LOGS_KEY);
      this.logs = stored ? JSON.parse(stored) : [];
    } catch {
      this.logs = [];
    }

    try {
      const storedAudits = localStorage.getItem(STORAGE_USER_AUDITS_KEY);
      this.userAudits = storedAudits ? JSON.parse(storedAudits) : {};
    } catch {
      this.userAudits = {};
    }
  }

  private saveLogs() {
    try {
      localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(this.logs.slice(0, 200)));
    } catch (e) {
      console.warn('Storage log save error:', e);
    }
  }

  private saveAudits() {
    try {
      localStorage.setItem(STORAGE_USER_AUDITS_KEY, JSON.stringify(this.userAudits));
    } catch (e) {
      console.warn('Storage audit save error:', e);
    }
  }

  /**
   * 4.1.1.1JE.1: Executa varredura com condições de busca
   */
  public async executeScan(
    articles: Article[],
    conditions: BotScanCondition = {}
  ): Promise<BotScanResult[]> {
    const results: BotScanResult[] = [];
    let targets = [...articles];

    // 1. Filtrar namespace
    if (conditions.namespace !== undefined) {
      targets = targets.filter(a => a.namespace === conditions.namespace);
    }

    // 2. Filtrar categoria
    if (conditions.category) {
      const catLower = conditions.category.toLowerCase().trim();
      targets = targets.filter(
        a => a.categories && a.categories.some(c => c.toLowerCase().includes(catLower))
      );
    }

    // 3. Filtrar termo de busca (query)
    if (conditions.query) {
      const qLower = conditions.query.toLowerCase().trim();
      targets = targets.filter(
        a => a.title.toLowerCase().includes(qLower) || a.wikitext.toLowerCase().includes(qLower)
      );
    }

    // 4. Filtrar slug específico
    if (conditions.articleSlug) {
      targets = targets.filter(a => a.slug === conditions.articleSlug);
    }

    // 5. Filtrar modificações recentes (ex: últimas 2 horas - ref. 4.1.1.1IT.1)
    if (conditions.recentHours && conditions.recentHours > 0) {
      const cutoff = Date.now() - conditions.recentHours * 60 * 60 * 1000;
      targets = targets.filter(a => new Date(a.updatedAt || a.createdAt).getTime() >= cutoff);
    }

    // 6. Limite de páginas
    if (conditions.limit && conditions.limit > 0) {
      targets = targets.slice(0, conditions.limit);
    }

    const selected = conditions.selectedBots || [
      'citation_bot',
      'antivandal_bot',
      'category_bot',
      'quality_bot',
      'link_checker_bot',
      'lgpd_bot',
    ];

    // 7. Backend Cloud Functions (Fase 2 / Fase 3) -> Executa lógica pesada no servidor
    try {
      const res = await fetch('/api/v1/bots/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articles: targets.map(t => ({ slug: t.slug, title: t.title, wikitext: t.wikitext })),
          selectedBots: selected,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.findings) && data.findings.length > 0) {
          await this.logActivity({
            botId: 'antivandal_bot',
            botName: 'Cloud Functions Bot Cluster',
            action: 'BACKEND_SCAN_COMPLETE',
            severity: data.findings.some((r: any) => r.severity === 'critical') ? 'warning' : 'info',
            summary: `Varredura backend executada em ${targets.length} artigo(s). ${data.findings.length} achado(s) reportado(s).`,
          });
          return data.findings;
        }
      }
    } catch (e) {
      console.warn('Backend Cloud Functions unavailable, falling back to local inspection:', e);
    }

    // Fallback: Local Client-side inspection
    for (const article of targets) {
      if (selected.includes('antivandal_bot')) {
        results.push(...antiVandalismBot.inspect(article));
      }
      if (selected.includes('citation_bot')) {
        results.push(...citationCheckerBot.inspect(article));
      }
      if (selected.includes('quality_bot')) {
        results.push(...qualityBot.inspect(article));
      }
      if (selected.includes('category_bot')) {
        results.push(...categorizationBot.inspect(article));
      }
      if (selected.includes('link_checker_bot')) {
        results.push(...brokenLinksBot.inspect(article));
      }
      if (selected.includes('lgpd_bot')) {
        results.push(...lgpdModerationBot.inspect(article));
      }
    }

    await this.logActivity({
      botId: 'quality_bot',
      botName: 'Varredura de Sistema',
      action: 'BATCH_SCAN_COMPLETE',
      severity: results.some(r => r.severity === 'critical') ? 'warning' : 'info',
      summary: `Varredura processada em ${targets.length} artigo(s). ${results.length} apontamento(s) gerado(s).`,
      metadata: { targetCount: targets.length, issuesFound: results.length, conditions },
    });

    return results;
  }

  /**
   * 4.1.1.18C.1: Auditoria contínua de contribuições de usuário
   */
  public async auditUserContributions(
    user: UserSession,
    action?: { articleSlug: string; charDelta: number; isVandal?: boolean }
  ): Promise<UserAbuseAudit> {
    const existing = this.userAudits[user.id] || {
      id: `audit_${user.id}`,
      userId: user.id,
      username: user.username,
      riskScore: 0,
      status: 'clean',
      flags: [],
      recentEditsCount: 0,
      revertCount: 0,
      burstEditsCount: 0,
      massDeletionsCount: 0,
      profanityDetections: 0,
      lastAuditAt: new Date().toISOString(),
      details: 'Histórico de edições íntegro e em conformidade.',
    };

    if (action) {
      existing.recentEditsCount += 1;
      if (action.charDelta < -400) {
        existing.massDeletionsCount += 1;
        existing.flags.push(`Esvaziamento (${action.charDelta} chars) em ${action.articleSlug}`);
      }
      if (action.isVandal) {
        existing.profanityDetections += 1;
        existing.flags.push(`Termo abusivo em ${action.articleSlug}`);
      }
    }

    let risk = 0;
    risk += existing.massDeletionsCount * 30;
    risk += existing.profanityDetections * 40;
    risk += existing.revertCount * 25;
    if (user.editCount > 50 && risk > 0) risk = Math.max(0, risk - 20);
    existing.riskScore = Math.min(100, Math.max(0, risk));

    existing.status = existing.riskScore >= 70 ? 'flagged' : existing.riskScore >= 35 ? 'suspicious' : 'clean';
    existing.lastAuditAt = new Date().toISOString();
    this.userAudits[user.id] = existing;
    this.saveAudits();

    try {
      const res = await fetch('/api/v1/bots/audit-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          username: user.username,
          action,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          this.userAudits[user.id] = data.report;
          this.saveAudits();
          return data.report;
        }
      }
    } catch {}

    try {
      await setDoc(doc(db, 'user_abuse_audits', user.id), existing, { merge: true });
    } catch {}

    return existing;
  }

  public async logActivity(log: Omit<BotActivityLog, 'id' | 'timestamp'>): Promise<BotActivityLog> {
    const entry: BotActivityLog = {
      id: `bot_exec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 200) this.logs = this.logs.slice(0, 200);
    this.saveLogs();

    try {
      await setDoc(doc(db, 'bot_activity_logs', entry.id), entry);
    } catch {}

    return entry;
  }

  public getLogs(): BotActivityLog[] {
    return this.logs;
  }

  public getUserAudits(): UserAbuseAudit[] {
    return Object.values(this.userAudits);
  }
}

export const botExecutionService = new BotExecutionService();
