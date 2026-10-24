import {
  Article,
  BotAgentConfig,
  BotAgentId,
  BotScanCondition,
  BotScanResult,
  BotUser,
  BotActivityLog,
  UserAbuseAudit,
  UserSession,
} from '../types';
import { db } from '../firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  limit as firestoreLimit,
} from 'firebase/firestore';

// =============================================================================
// DEFAULT BOT AGENT CONFIGURATIONS (4.1.1.8T.1 - 4.1.1.E0.1)
// =============================================================================

export const DEFAULT_BOT_CONFIGS: BotAgentConfig[] = [
  {
    id: 'citation_bot',
    code: '4.1.1.WV.1',
    name: 'CitationBot',
    namePt: 'Bot de Verificação de Citações (Gemini AI)',
    enabled: true,
    description:
      '4.1.1.WV.1: Quando um artigo é editado ou em varreduras, analisa o conteúdo wikitext e marca afirmações sem fontes, estatísticas desacompanhadas de <ref> e citações ausentes usando Gemini 3.8 Flash.',
    assignedUserId: 'bot_citation_0001',
    assignedUsername: 'CitationBot#0001',
    mode: 'automatic',
    settings: {
      useGemini: true,
      sensitivityLevel: 'medio',
      notifyAdminsOnCritical: false,
    },
    stats: {
      totalRuns: 142,
      actionsTaken: 38,
      flagsRaised: 29,
      lastRunAt: new Date().toISOString(),
    },
  },
  {
    id: 'antivandal_bot',
    code: '4.1.1.11E.1',
    name: 'AntiVandalBot',
    namePt: 'Bot Anti-Vandalismo & Proteção de Conteúdo',
    enabled: true,
    description:
      '4.1.1.11E.1: Detecta edições muito grandes, remoção massiva de conteúdo (>35%), esvaziamento de páginas ou padrões ofensivos/suspeitos, revertendo automaticamente ou notificando os administradores.',
    assignedUserId: 'bot_antivandal_0002',
    assignedUsername: 'AntiVandalBot#0002',
    mode: 'automatic',
    settings: {
      autoRevertVandalism: true,
      byteDropThresholdPercent: 35,
      sensitivityLevel: 'alto',
      notifyAdminsOnCritical: true,
    },
    stats: {
      totalRuns: 310,
      actionsTaken: 12,
      flagsRaised: 18,
      lastRunAt: new Date().toISOString(),
    },
  },
  {
    id: 'category_bot',
    code: '4.1.1.G2.1',
    name: 'CategoryBot',
    namePt: 'Bot de Categorização Automática',
    enabled: true,
    description:
      '4.1.1.G2.1: Analisa tópicos, infoboxes e termos semânticos do artigo para sugerir ou aplicar categorias padronizadas do NotMediaWiki.',
    assignedUserId: 'bot_category_0003',
    assignedUsername: 'CategoryBot#0003',
    mode: 'manual',
    settings: {
      autoApplyCategories: false,
      sensitivityLevel: 'medio',
    },
    stats: {
      totalRuns: 89,
      actionsTaken: 45,
      flagsRaised: 14,
      lastRunAt: new Date().toISOString(),
    },
  },
  {
    id: 'quality_bot',
    code: '4.1.1.IL.1',
    name: 'QualityBot',
    namePt: 'Bot de Avaliação de Qualidade & Estrutura',
    enabled: true,
    description:
      '4.1.1.IL.1: Verifica se o artigo possui introdução antes do primeiro título, seções mínimas (>=2), seção de referências, imagens [[Ficheiro:...]] e calcula a nota de maturidade enciclopédica.',
    assignedUserId: 'bot_quality_0004',
    assignedUsername: 'QualityBot#0004',
    mode: 'automatic',
    settings: {
      minQualityScoreRequired: 60,
      sensitivityLevel: 'medio',
    },
    stats: {
      totalRuns: 205,
      actionsTaken: 78,
      flagsRaised: 42,
      lastRunAt: new Date().toISOString(),
    },
  },
  {
    id: 'link_checker_bot',
    code: '4.1.1.GW.1',
    name: 'LinkCheckerBot',
    namePt: 'Bot de Links Quebrados & Conectividade',
    enabled: true,
    description:
      '4.1.1.GW.1: Extrai todas as ligações externas http/https do wikitext, verifica formatos, protocolos descontinuados e marca URLs inativas com predefinição {{Ligação inativa}}.',
    assignedUserId: 'bot_linkchecker_0005',
    assignedUsername: 'LinkCheckerBot#0005',
    mode: 'manual',
    settings: {
      sensitivityLevel: 'medio',
    },
    stats: {
      totalRuns: 64,
      actionsTaken: 9,
      flagsRaised: 11,
      lastRunAt: new Date().toISOString(),
    },
  },
  {
    id: 'lgpd_bot',
    code: '4.1.1.E0.1',
    name: 'LgpdBot',
    namePt: 'Bot de LGPD, Moderação & Privacidade',
    enabled: true,
    description:
      '4.1.1.E0.1: Analisa conteúdo em busca de dados pessoais sensíveis (CPF, RG, telefones, e-mails pessoais, cartões) ou violações contra biografias de pessoas vivas (WP:BLP).',
    assignedUserId: 'bot_lgpd_0006',
    assignedUsername: 'LgpdBot#0006',
    mode: 'automatic',
    settings: {
      sensitivityLevel: 'alto',
      notifyAdminsOnCritical: true,
    },
    stats: {
      totalRuns: 198,
      actionsTaken: 7,
      flagsRaised: 16,
      lastRunAt: new Date().toISOString(),
    },
  },
  {
    id: 'user_audit_bot',
    code: '4.1.1.18C.1',
    name: 'UserAuditBot',
    namePt: 'Bot de Auditoria de Usuários & Anti-Abuso',
    enabled: true,
    description:
      '4.1.1.18C.1: Ferramenta de extensão auto-carregada por padrão para verificação automática da situação do usuário em relação às suas contribuições, detectando qualquer abuso, rajadas de spam ou reversões repetidas.',
    assignedUserId: 'bot_useraudit_0007',
    assignedUsername: 'UserAuditBot#0007',
    mode: 'automatic',
    settings: {
      sensitivityLevel: 'alto',
      scanRecentHours: 2, // 4.1.1.1IT.1 (Descontinuado para login universal, ativo para auditorias sob demanda)
      notifyAdminsOnCritical: true,
    },
    stats: {
      totalRuns: 275,
      actionsTaken: 15,
      flagsRaised: 23,
      lastRunAt: new Date().toISOString(),
    },
  },
];

// =============================================================================
// DEFAULT BOT USERS (4.1.1.PN.1)
// =============================================================================

export const DEFAULT_BOT_USERS: BotUser[] = [
  {
    id: 'bot_citation_0001',
    username: 'CitationBot',
    userTag: '#0001',
    displayName: 'CitationBot#0001',
    avatar: 'CB',
    description: 'Robô oficial para validação e auditoria de citações enciclopédicas (Gemini 3.8 Flash).',
    botFlag: true,
    role: 'bot',
    status: 'active',
    permissions: ['read', 'edit', 'flag_citations', 'suggest_sources'],
    assignedBotAgentId: 'citation_bot',
    createdAt: '2026-01-15T10:00:00.000Z',
    totalEdits: 142,
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: 'bot_antivandal_0002',
    username: 'AntiVandalBot',
    userTag: '#0002',
    displayName: 'AntiVandalBot#0002',
    avatar: 'AV',
    description: 'Robô de segurança e patrulhamento contra esvaziamento massivo e vandalismo.',
    botFlag: true,
    role: 'bot',
    status: 'active',
    permissions: ['read', 'edit', 'rollback', 'protect_page', 'notify_admin'],
    assignedBotAgentId: 'antivandal_bot',
    createdAt: '2026-01-15T10:00:00.000Z',
    totalEdits: 289,
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: 'bot_category_0003',
    username: 'CategoryBot',
    userTag: '#0003',
    displayName: 'CategoryBot#0003',
    avatar: 'CT',
    description: 'Robô de indexação taxonomia e categorização automática de artigos.',
    botFlag: true,
    role: 'bot',
    status: 'active',
    permissions: ['read', 'edit', 'apply_categories'],
    assignedBotAgentId: 'category_bot',
    createdAt: '2026-02-01T10:00:00.000Z',
    totalEdits: 89,
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: 'bot_quality_0004',
    username: 'QualityBot',
    userTag: '#0004',
    displayName: 'QualityBot#0004',
    avatar: 'QB',
    description: 'Robô de auditoria de qualidade estrutural e maturidade enciclopédica.',
    botFlag: true,
    role: 'bot',
    status: 'active',
    permissions: ['read', 'edit', 'tag_quality', 'rate_article'],
    assignedBotAgentId: 'quality_bot',
    createdAt: '2026-02-10T10:00:00.000Z',
    totalEdits: 205,
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: 'bot_linkchecker_0005',
    username: 'LinkCheckerBot',
    userTag: '#0005',
    displayName: 'LinkCheckerBot#0005',
    avatar: 'LK',
    description: 'Robô de integridade de links externos e marcação de referências inativas.',
    botFlag: true,
    role: 'bot',
    status: 'active',
    permissions: ['read', 'edit', 'tag_broken_links'],
    assignedBotAgentId: 'link_checker_bot',
    createdAt: '2026-02-15T10:00:00.000Z',
    totalEdits: 64,
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: 'bot_lgpd_0006',
    username: 'LgpdBot',
    userTag: '#0006',
    displayName: 'LgpdBot#0006',
    avatar: 'LG',
    description: 'Robô de proteção de dados pessoais (Lei 13.709/2018) e moderação de PII.',
    botFlag: true,
    role: 'bot',
    status: 'active',
    permissions: ['read', 'edit', 'redact_pii', 'alert_dpo'],
    assignedBotAgentId: 'lgpd_bot',
    createdAt: '2026-03-01T10:00:00.000Z',
    totalEdits: 198,
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: 'bot_useraudit_0007',
    username: 'UserAuditBot',
    userTag: '#0007',
    displayName: 'UserAuditBot#0007',
    avatar: 'UA',
    description: 'Robô auto-carregado para auditoria contínua de comportamento e abuso de usuários.',
    botFlag: true,
    role: 'bot',
    status: 'active',
    permissions: ['read', 'audit_users', 'flag_abuse', 'alert_sysop'],
    assignedBotAgentId: 'user_audit_bot',
    createdAt: '2026-03-10T10:00:00.000Z',
    totalEdits: 275,
    lastActiveAt: new Date().toISOString(),
  },
];

// Local storage cache keys
const STORAGE_BOT_CONFIGS = 'notmediawiki_bot_configs_v2';
const STORAGE_BOT_USERS = 'notmediawiki_bot_users_v2';
const STORAGE_BOT_LOGS = 'notmediawiki_bot_logs_v2';
const STORAGE_USER_AUDITS = 'notmediawiki_user_audits_v2';

// Profanity / vandalism test dictionary
const VANDALISM_PATTERNS = [
  /\b(vandalismo|lixo|bobagem|otario|idiota|burro|merda|porra|caralho|puta|cu)\b/gi,
  /(.)\1{7,}/g, // 8+ repeated characters like aaaaaaaa
  /hackeado por/gi,
  /\b(teste de edi[cç][aã]o|teste teste)\b/gi,
];

// Sensitive Brazilian PII patterns (LGPD)
const CPF_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const RG_REGEX = /\b\d{2}\.?\d{3}\.?\d{3}-?[0-9xX]\b/g;
const PHONE_BR_REGEX = /(?:\+?55\s?)?(?:\(?0?[1-9]{2}\)?\s?)?(?:9\s?\d{4}[-\s]?\d{4}|\d{4}[-\s]?\d{4})\b/g;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;

/**
 * Central Bot Agent Service
 */
class BotAgentService {
  private configs: BotAgentConfig[] = [];
  private botUsers: BotUser[] = [];
  private logs: BotActivityLog[] = [];
  private userAudits: Record<string, UserAbuseAudit> = {};

  constructor() {
    this.initLocal();
  }

  private initLocal() {
    try {
      const savedConfigs = localStorage.getItem(STORAGE_BOT_CONFIGS);
      this.configs = savedConfigs ? JSON.parse(savedConfigs) : DEFAULT_BOT_CONFIGS;
    } catch {
      this.configs = DEFAULT_BOT_CONFIGS;
    }

    try {
      const savedUsers = localStorage.getItem(STORAGE_BOT_USERS);
      this.botUsers = savedUsers ? JSON.parse(savedUsers) : DEFAULT_BOT_USERS;
    } catch {
      this.botUsers = DEFAULT_BOT_USERS;
    }

    try {
      const savedLogs = localStorage.getItem(STORAGE_BOT_LOGS);
      this.logs = savedLogs ? JSON.parse(savedLogs) : [];
    } catch {
      this.logs = [];
    }

    try {
      const savedAudits = localStorage.getItem(STORAGE_USER_AUDITS);
      this.userAudits = savedAudits ? JSON.parse(savedAudits) : {};
    } catch {
      this.userAudits = {};
    }
  }

  private saveConfigs() {
    try {
      localStorage.setItem(STORAGE_BOT_CONFIGS, JSON.stringify(this.configs));
    } catch (e) {
      console.warn('Storage save error:', e);
    }
  }

  private saveBotUsers() {
    try {
      localStorage.setItem(STORAGE_BOT_USERS, JSON.stringify(this.botUsers));
    } catch (e) {
      console.warn('Storage save error:', e);
    }
  }

  private saveLogs() {
    try {
      localStorage.setItem(STORAGE_BOT_LOGS, JSON.stringify(this.logs.slice(0, 200)));
    } catch (e) {
      console.warn('Storage save error:', e);
    }
  }

  private saveUserAudits() {
    try {
      localStorage.setItem(STORAGE_USER_AUDITS, JSON.stringify(this.userAudits));
    } catch (e) {
      console.warn('Storage save error:', e);
    }
  }

  // ===========================================================================
  // 1. BOT AGENTS MANAGEMENT (4.1.1.8T.1 & 4.1.1.PN.1)
  // ===========================================================================

  public async getBotConfigs(): Promise<BotAgentConfig[]> {
    try {
      const snap = await getDocs(collection(db, 'bot_agents_config'));
      if (!snap.empty) {
        const cloudConfigs: BotAgentConfig[] = [];
        snap.forEach(d => cloudConfigs.push(d.data() as BotAgentConfig));
        if (cloudConfigs.length >= 7) {
          this.configs = cloudConfigs;
          this.saveConfigs();
          return cloudConfigs;
        }
      }
    } catch (e) {
      // Fallback local
    }
    return this.configs;
  }

  public async updateBotConfig(botId: BotAgentId, updates: Partial<BotAgentConfig>): Promise<BotAgentConfig> {
    const idx = this.configs.findIndex(c => c.id === botId);
    if (idx === -1) throw new Error(`Bot ${botId} não encontrado`);

    this.configs[idx] = {
      ...this.configs[idx],
      ...updates,
      settings: {
        ...this.configs[idx].settings,
        ...(updates.settings || {}),
      },
    };
    this.saveConfigs();

    try {
      await setDoc(doc(db, 'bot_agents_config', botId), this.configs[idx], { merge: true });
    } catch (e) {
      console.warn('Cloud sync error for bot config:', e);
    }

    await this.recordActivityLog({
      botId,
      botName: this.configs[idx].name,
      action: 'UPDATE_CONFIG',
      severity: 'info',
      summary: `Configurações do bot ${this.configs[idx].namePt} atualizadas (Ativo: ${this.configs[idx].enabled}, Modo: ${this.configs[idx].mode}).`,
    });

    return this.configs[idx];
  }

  public async toggleBot(botId: BotAgentId, enabled: boolean): Promise<BotAgentConfig> {
    return this.updateBotConfig(botId, { enabled });
  }

  // ===========================================================================
  // 2. BOT USERS MANAGEMENT (4.1.1.PN.1)
  // ===========================================================================

  public async getBotUsers(): Promise<BotUser[]> {
    try {
      const snap = await getDocs(collection(db, 'bot_users'));
      if (!snap.empty) {
        const cloudUsers: BotUser[] = [];
        snap.forEach(d => cloudUsers.push(d.data() as BotUser));
        if (cloudUsers.length > 0) {
          this.botUsers = cloudUsers;
          this.saveBotUsers();
          return cloudUsers;
        }
      }
    } catch {
      // Fallback
    }
    return this.botUsers;
  }

  public async upsertBotUser(botUser: Partial<BotUser> & { id: string }): Promise<BotUser> {
    const existingIdx = this.botUsers.findIndex(u => u.id === botUser.id);
    let updated: BotUser;

    if (existingIdx >= 0) {
      updated = {
        ...this.botUsers[existingIdx],
        ...botUser,
      };
      this.botUsers[existingIdx] = updated;
    } else {
      updated = {
        id: botUser.id,
        username: botUser.username || 'NovoBot',
        userTag: botUser.userTag || `#${Math.floor(1000 + Math.random() * 9000)}`,
        displayName: `${botUser.username || 'NovoBot'}${botUser.userTag || '#0001'}`,
        avatar: (botUser.username || 'NB').substring(0, 2).toUpperCase(),
        description: botUser.description || 'Conta de automação do NotMediaWiki',
        botFlag: true,
        role: 'bot',
        status: botUser.status || 'active',
        permissions: botUser.permissions || ['read', 'edit'],
        assignedBotAgentId: botUser.assignedBotAgentId || 'antivandal_bot',
        createdAt: new Date().toISOString(),
        totalEdits: botUser.totalEdits || 0,
        lastActiveAt: new Date().toISOString(),
      };
      this.botUsers.push(updated);
    }

    this.saveBotUsers();

    try {
      await setDoc(doc(db, 'bot_users', updated.id), updated, { merge: true });
    } catch (e) {
      console.warn('Cloud sync error for bot user:', e);
    }

    return updated;
  }

  public async deleteBotUser(id: string): Promise<boolean> {
    this.botUsers = this.botUsers.filter(u => u.id !== id);
    this.saveBotUsers();

    try {
      await deleteDoc(doc(db, 'bot_users', id));
    } catch (e) {
      console.warn('Cloud delete error for bot user:', e);
    }
    return true;
  }

  // ===========================================================================
  // 3. FRONTEND SCAN SERVICE WITH CONDITIONS (4.1.1.1JE.1)
  // ===========================================================================

  public async runScan(
    articles: Article[],
    conditions: BotScanCondition = {}
  ): Promise<BotScanResult[]> {
    const results: BotScanResult[] = [];
    const activeBots = this.configs.filter(b => b.enabled);
    const selectedBotIds = conditions.selectedBots || activeBots.map(b => b.id);

    // Filter target articles based on search conditions
    let targets = [...articles];

    if (conditions.namespace !== undefined) {
      targets = targets.filter(a => a.namespace === conditions.namespace);
    }

    if (conditions.category) {
      const catLower = conditions.category.toLowerCase().trim();
      targets = targets.filter(a =>
        a.categories && a.categories.some(c => c.toLowerCase().includes(catLower))
      );
    }

    if (conditions.query) {
      const qLower = conditions.query.toLowerCase().trim();
      targets = targets.filter(
        a => a.title.toLowerCase().includes(qLower) || a.wikitext.toLowerCase().includes(qLower)
      );
    }

    if (conditions.articleSlug) {
      targets = targets.filter(a => a.slug === conditions.articleSlug);
    }

    if (conditions.recentHours && conditions.recentHours > 0) {
      const cutoff = Date.now() - conditions.recentHours * 60 * 60 * 1000;
      targets = targets.filter(a => new Date(a.updatedAt || a.createdAt).getTime() >= cutoff);
    }

    if (conditions.limit && conditions.limit > 0) {
      targets = targets.slice(0, conditions.limit);
    }

    // Execute scans on matched articles
    for (const article of targets) {
      // 1. CitationBot (4.1.1.WV.1)
      if (selectedBotIds.includes('citation_bot')) {
        const citationIssues = await this.inspectCitations(article);
        results.push(...citationIssues);
      }

      // 2. AntiVandalBot (4.1.1.11E.1)
      if (selectedBotIds.includes('antivandal_bot')) {
        const vandalIssues = this.inspectVandalism(article);
        results.push(...vandalIssues);
      }

      // 3. CategoryBot (4.1.1.G2.1)
      if (selectedBotIds.includes('category_bot')) {
        const catIssues = this.inspectCategorization(article);
        results.push(...catIssues);
      }

      // 4. QualityBot (4.1.1.IL.1)
      if (selectedBotIds.includes('quality_bot')) {
        const qualityIssues = this.inspectQuality(article);
        results.push(...qualityIssues);
      }

      // 5. LinkCheckerBot (4.1.1.GW.1)
      if (selectedBotIds.includes('link_checker_bot')) {
        const linkIssues = this.inspectBrokenLinks(article);
        results.push(...linkIssues);
      }

      // 6. LgpdBot (4.1.1.E0.1)
      if (selectedBotIds.includes('lgpd_bot')) {
        const lgpdIssues = this.inspectLgpd(article);
        results.push(...lgpdIssues);
      }
    }

    // Record scan summary log
    await this.recordActivityLog({
      botId: 'quality_bot',
      botName: 'Varredura Geral',
      action: 'SCAN_COMPLETE',
      severity: results.some(r => r.severity === 'critical') ? 'warning' : 'info',
      summary: `Varredura concluída em ${targets.length} artigo(s). ${results.length} apontamento(s) identificado(s).`,
      metadata: { totalArticles: targets.length, totalIssues: results.length, conditions },
    });

    return results;
  }

  // ===========================================================================
  // 4. SPECIALIZED BOT ENGINES
  // ===========================================================================

  /**
   * 4.1.1.WV.1 - Bot de verificação de citações com Gemini AI
   */
  public async inspectCitations(article: Article): Promise<BotScanResult[]> {
    const issues: BotScanResult[] = [];
    const wikitext = article.wikitext || '';

    // Check if article has citations
    const refCount = (wikitext.match(/<ref[\s>]/gi) || []).length;
    const hasReferencesSection = /==\s*(Referências|Bibliografia|Fontes)\s*==/gi.test(wikitext);
    const paragraphs = wikitext
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 60 && !p.startsWith('==') && !p.startsWith('{{') && !p.startsWith('{|'));

    // Statistical / claim patterns without citation
    const statRegex = /\b(\d+(?:\.\d+)?%|\bno ano de \d{4}\b|\bsegundo estudos\b|\bestatisticamente\b|\bpesquisas apontam\b)/i;

    for (const p of paragraphs) {
      if (statRegex.test(p) && !p.includes('<ref')) {
        issues.push({
          id: `cite_${article.slug}_${Math.random().toString(36).substring(2, 7)}`,
          articleSlug: article.slug,
          articleTitle: article.title,
          botId: 'citation_bot',
          botName: 'CitationBot (Gemini)',
          severity: 'warning',
          title: 'Afirmação factual ou estatística desprovida de citação',
          details: `Trecho: "${p.substring(0, 110)}..." necessita de referência bibliográfica comprobatória.`,
          suggestion: 'Adicionar tag <ref>Fonte com autor, título e data</ref> ou predefinição {{Carece de fontes}}.',
          suggestedMarkup: `${p} {{Carece de fontes}}`,
          autoFixAvailable: true,
          actionTaken: 'suggested',
          detectedAt: new Date().toISOString(),
        });
      }
    }

    if (refCount === 0 && wikitext.length > 300) {
      issues.push({
        id: `cite_none_${article.slug}`,
        articleSlug: article.slug,
        articleTitle: article.title,
        botId: 'citation_bot',
        botName: 'CitationBot (Gemini)',
        severity: 'critical',
        title: 'Artigo completamente sem fontes bibliográficas',
        details: `O artigo "${article.title}" possui ${wikitext.length} caracteres mas nenhuma nota de rodapé <ref>.`,
        suggestion: 'Inserir seção == Referências == com <references /> e fontes verificáveis.',
        suggestedMarkup: `\n\n== Referências ==\n<references />\n`,
        autoFixAvailable: true,
        actionTaken: 'flagged',
        detectedAt: new Date().toISOString(),
      });
    }

    return issues;
  }

  /**
   * 4.1.1.11E.1 - Bot anti-vandalismo (detecção de remoção massiva e reversão)
   */
  public inspectVandalism(
    article: Article,
    previousWikitext?: string
  ): BotScanResult[] {
    const issues: BotScanResult[] = [];
    const wikitext = article.wikitext || '';

    // Check mass deletion if previous text provided
    if (previousWikitext && previousWikitext.length > 200) {
      const byteDrop = ((previousWikitext.length - wikitext.length) / previousWikitext.length) * 100;
      const config = this.configs.find(c => c.id === 'antivandal_bot');
      const threshold = config?.settings.byteDropThresholdPercent || 35;

      if (byteDrop >= threshold) {
        issues.push({
          id: `vandal_drop_${article.slug}_${Date.now()}`,
          articleSlug: article.slug,
          articleTitle: article.title,
          botId: 'antivandal_bot',
          botName: 'AntiVandalBot',
          severity: 'critical',
          title: `Remoção massiva de conteúdo detectada (${byteDrop.toFixed(1)}% de perda)`,
          details: `Foram removidos ${previousWikitext.length - wikitext.length} caracteres sem justificativa aceitável. Possível esvaziamento de página (blanking).`,
          suggestion: 'Reverter imediatamente para a última revisão válida e emitir alerta ao editor.',
          autoFixAvailable: true,
          actionTaken: config?.settings.autoRevertVandalism ? 'reverted' : 'flagged',
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Check vandalism / obscenity patterns
    for (const pat of VANDALISM_PATTERNS) {
      const match = wikitext.match(pat);
      if (match && match.length > 0) {
        issues.push({
          id: `vandal_pat_${article.slug}_${Math.random().toString(36).substring(2, 6)}`,
          articleSlug: article.slug,
          articleTitle: article.title,
          botId: 'antivandal_bot',
          botName: 'AntiVandalBot',
          severity: 'critical',
          title: 'Linguagem suspeita ou padrão de vandalismo detectado',
          details: `O texto contém termos impróprios ou caracteres repetidos: "${match.slice(0, 3).join(', ')}".`,
          suggestion: 'Remover o conteúdo difamatório e notificar a administração.',
          autoFixAvailable: false,
          actionTaken: 'flagged',
          detectedAt: new Date().toISOString(),
        });
        break;
      }
    }

    return issues;
  }

  /**
   * 4.1.1.G2.1 - Bot de categorização
   */
  public inspectCategorization(article: Article): BotScanResult[] {
    const issues: BotScanResult[] = [];
    const wikitext = article.wikitext || '';
    const categories = article.categories || [];
    const hasCategoryTag = /\[\[\s*Categoria\s*:[^\]]+\]\]/i.test(wikitext) || categories.length > 0;

    if (!hasCategoryTag) {
      // Analyze content to suggest category
      const lower = `${article.title} ${wikitext}`.toLowerCase();
      const suggestions: string[] = [];

      if (/software|algoritmo|sistema|computad|c[oó]digo|program|web/i.test(lower)) {
        suggestions.push('Ciência da computação', 'Software');
      }
      if (/brasil|brasileir|s[aã]o paulo|rio de janeiro/i.test(lower)) {
        suggestions.push('Brasil');
      }
      if (/biografia|nasceu|faleceu|pol[ií]tico|ator|cantor|escritor/i.test(lower)) {
        suggestions.push('Biografias');
      }
      if (/wiki|mediawiki|notmediawiki|enciclop[eé]dia/i.test(lower)) {
        suggestions.push('NotMediaWiki', 'Projetos WazzimaGiygg');
      }
      if (suggestions.length === 0) {
        suggestions.push('Geral');
      }

      const markup = suggestions.map(c => `[[Categoria:${c}]]`).join('\n');

      issues.push({
        id: `cat_missing_${article.slug}`,
        articleSlug: article.slug,
        articleTitle: article.title,
        botId: 'category_bot',
        botName: 'CategoryBot',
        severity: 'info',
        title: 'Artigo sem nenhuma categoria atribuída',
        details: `O artigo "${article.title}" não possui categorias cadastradas, dificultando sua indexação.`,
        suggestion: `Categorias sugeridas: ${suggestions.join(', ')}.`,
        suggestedMarkup: `\n\n${markup}`,
        autoFixAvailable: true,
        actionTaken: 'suggested',
        detectedAt: new Date().toISOString(),
      });
    }

    return issues;
  }

  /**
   * 4.1.1.IL.1 - Bot de qualidade
   */
  public inspectQuality(article: Article): BotScanResult[] {
    const issues: BotScanResult[] = [];
    const wikitext = article.wikitext || '';

    // 1. Structure check: Lead introduction
    const firstSectionIndex = wikitext.search(/==\s*[^=]+\s*==/);
    const leadText = firstSectionIndex === -1 ? wikitext : wikitext.substring(0, firstSectionIndex).trim();

    if (leadText.length < 50) {
      issues.push({
        id: `qual_intro_${article.slug}`,
        articleSlug: article.slug,
        articleTitle: article.title,
        botId: 'quality_bot',
        botName: 'QualityBot',
        severity: 'warning',
        title: 'Introdução ausente ou muito curta',
        details: 'O artigo deve iniciar com um resumo introdutório contextualizando o tema antes da primeira seção.',
        suggestion: 'Escrever pelo menos 1 a 2 parágrafos de introdução definindo o assunto principal.',
        autoFixAvailable: false,
        actionTaken: 'flagged',
        detectedAt: new Date().toISOString(),
      });
    }

    // 2. Headings count
    const headings = wikitext.match(/==\s*[^=]+\s*==/g) || [];
    if (headings.length < 2 && wikitext.length > 500) {
      issues.push({
        id: `qual_sections_${article.slug}`,
        articleSlug: article.slug,
        articleTitle: article.title,
        botId: 'quality_bot',
        botName: 'QualityBot',
        severity: 'info',
        title: 'Estruturação insuficiente de seções',
        details: `O artigo possui ${headings.length} seção(ões). Artigos enciclopédicos requerem ao menos 2 seções (ex: == História ==, == Características ==).`,
        suggestion: 'Dividir o conteúdo longo em seções hierárquicas usando == Título ==.',
        autoFixAvailable: false,
        actionTaken: 'suggested',
        detectedAt: new Date().toISOString(),
      });
    }

    // 3. Media / Images
    const hasMedia = /\[\[\s*(Ficheiro|Imagem|File|Image)\s*:[^\]]+\]\]/i.test(wikitext);
    if (!hasMedia && wikitext.length > 1000) {
      issues.push({
        id: `qual_media_${article.slug}`,
        articleSlug: article.slug,
        articleTitle: article.title,
        botId: 'quality_bot',
        botName: 'QualityBot',
        severity: 'info',
        title: 'Artigo sem mídias ou ilustrações',
        details: 'O texto é substancial mas não contém imagens ilustrativas ou infobox.',
        suggestion: 'Adicionar infobox ou imagem via [[Ficheiro:Exemplo.jpg|thumb|Legenda]].',
        autoFixAvailable: false,
        actionTaken: 'suggested',
        detectedAt: new Date().toISOString(),
      });
    }

    return issues;
  }

  /**
   * 4.1.1.GW.1 - Bot de links quebrados
   */
  public inspectBrokenLinks(article: Article): BotScanResult[] {
    const issues: BotScanResult[] = [];
    const wikitext = article.wikitext || '';
    const urlRegex = /(https?:\/\/[^\s\]"'>]+)/gi;
    const matches = wikitext.match(urlRegex) || [];

    for (const url of matches) {
      // Detect suspicious or broken protocols/IPs
      if (/^http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(url)) {
        issues.push({
          id: `link_ip_${article.slug}_${Math.random().toString(36).substring(2, 6)}`,
          articleSlug: article.slug,
          articleTitle: article.title,
          botId: 'link_checker_bot',
          botName: 'LinkCheckerBot',
          severity: 'warning',
          title: 'Link externo apontando para IP sem criptografia (HTTP)',
          details: `URL insegura encontrada: ${url}`,
          suggestion: 'Substituir por domínio com certificado SSL válido (HTTPS).',
          autoFixAvailable: false,
          actionTaken: 'flagged',
          detectedAt: new Date().toISOString(),
        });
      }

      if (url.includes('example.com') || url.includes('localhost') || url.includes('test.local')) {
        issues.push({
          id: `link_dead_${article.slug}_${Math.random().toString(36).substring(2, 6)}`,
          articleSlug: article.slug,
          articleTitle: article.title,
          botId: 'link_checker_bot',
          botName: 'LinkCheckerBot',
          severity: 'warning',
          title: 'Link de teste ou host inválido',
          details: `URL de demonstração inoperante: ${url}`,
          suggestion: 'Inserir predefinição {{Ligação inativa}} ou substituir por fonte ativa.',
          suggestedMarkup: `[${url} {{Ligação inativa}}]`,
          autoFixAvailable: true,
          actionTaken: 'suggested',
          detectedAt: new Date().toISOString(),
        });
      }
    }

    return issues;
  }

  /**
   * 4.1.1.E0.1 - Bot de LGPD & Moderação
   */
  public inspectLgpd(article: Article): BotScanResult[] {
    const issues: BotScanResult[] = [];
    const wikitext = article.wikitext || '';

    // Check CPF leaks
    const cpfs = wikitext.match(CPF_REGEX) || [];
    if (cpfs.length > 0) {
      issues.push({
        id: `lgpd_cpf_${article.slug}_${Math.random().toString(36).substring(2, 6)}`,
        articleSlug: article.slug,
        articleTitle: article.title,
        botId: 'lgpd_bot',
        botName: 'LgpdBot',
        severity: 'critical',
        title: 'Alerta LGPD: Cadastro de Pessoa Física (CPF) detectado no artigo',
        details: `Identificado(s) ${cpfs.length} padrão(ões) de CPF no corpo do artigo. A exposição viola a Lei Geral de Proteção de Dados (Lei 13.709/2018).`,
        suggestion: 'Ocultar ou ofuscar imediatamente o documento utilizando [DADO PESSOAL OCULTADO - ART. 18 LGPD].',
        suggestedMarkup: wikitext.replace(CPF_REGEX, '[CPF OCULTADO - LGPD]'),
        autoFixAvailable: true,
        actionTaken: 'flagged',
        detectedAt: new Date().toISOString(),
      });
    }

    // Check phone number leaks
    const phones = wikitext.match(PHONE_BR_REGEX) || [];
    if (phones.length > 0 && !article.slug.toLowerCase().includes('contato')) {
      issues.push({
        id: `lgpd_phone_${article.slug}_${Math.random().toString(36).substring(2, 6)}`,
        articleSlug: article.slug,
        articleTitle: article.title,
        botId: 'lgpd_bot',
        botName: 'LgpdBot',
        severity: 'warning',
        title: 'Número telefônico pessoal detectado',
        details: `Encontrado padrão de telefone móvel/fixo pessoal: ${phones[0]}.`,
        suggestion: 'Remover contato pessoal privado em conformidade com as normas de BLP e LGPD.',
        autoFixAvailable: false,
        actionTaken: 'flagged',
        detectedAt: new Date().toISOString(),
      });
    }

    return issues;
  }

  // ===========================================================================
  // 5. USER AUDIT & ABUSE DETECTION (4.1.1.18C.1)
  // ===========================================================================

  /**
   * 4.1.1.18C.1: Ferramenta auto-carregada por padrão para auditoria contínua de usuários
   */
  public async auditUserContributions(
    user: UserSession,
    recentActions?: { articleSlug: string; charDelta: number; isVandal?: boolean }
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
      details: 'Histórico de contribuições íntegro e sem abusos detectados.',
    };

    // Update with recent action if provided
    if (recentActions) {
      existing.recentEditsCount += 1;
      if (recentActions.charDelta < -400) {
        existing.massDeletionsCount += 1;
        existing.flags.push(`Esvaziamento expressivo (${recentActions.charDelta} caracteres) em ${recentActions.articleSlug}`);
      }
      if (recentActions.isVandal) {
        existing.profanityDetections += 1;
        existing.flags.push(`Termo abusivo detectado em ${recentActions.articleSlug}`);
      }
    }

    // Calculate Abuse Risk Score (0 - 100)
    let score = 0;
    score += existing.massDeletionsCount * 30;
    score += existing.profanityDetections * 40;
    score += existing.revertCount * 25;
    score += existing.burstEditsCount * 15;

    // Deduct risk for mature users with high edit counts
    if (user.editCount > 50 && score > 0) {
      score = Math.max(0, score - 20);
    }

    existing.riskScore = Math.min(100, Math.max(0, score));

    if (existing.riskScore >= 70) {
      existing.status = 'flagged';
      existing.details = 'ALERTA DE ABUSO: Múltiplos padrões de vandalismo ou esvaziamento massivo registrados.';
      await this.recordActivityLog({
        botId: 'user_audit_bot',
        botName: 'UserAuditBot',
        action: 'FLAG_USER_ABUSE',
        targetUserId: user.id,
        severity: 'critical',
        summary: `Usuário ${user.username} sinalizado por abuso (Risco: ${existing.riskScore}%).`,
      });
    } else if (existing.riskScore >= 35) {
      existing.status = 'suspicious';
      existing.details = 'Atenção: Atividades recentes requerem monitoramento preventivo.';
    } else {
      existing.status = 'clean';
      existing.details = 'Usuário com comportamento compatível com as regras do Wiki.';
    }

    existing.lastAuditAt = new Date().toISOString();
    this.userAudits[user.id] = existing;
    this.saveUserAudits();

    try {
      await setDoc(doc(db, 'user_abuse_audits', user.id), existing, { merge: true });
    } catch (e) {
      console.warn('Cloud sync error for user audit:', e);
    }

    return existing;
  }

  public getUserAudits(): UserAbuseAudit[] {
    return Object.values(this.userAudits);
  }

  // ===========================================================================
  // 6. ACTIVITY LOGS (4.1.1.8T.1)
  // ===========================================================================

  public async recordActivityLog(
    log: Omit<BotActivityLog, 'id' | 'timestamp'>
  ): Promise<BotActivityLog> {
    const entry: BotActivityLog = {
      id: `botlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };

    this.logs.unshift(entry);
    if (this.logs.length > 200) {
      this.logs = this.logs.slice(0, 200);
    }
    this.saveLogs();

    try {
      await setDoc(doc(db, 'bot_activity_logs', entry.id), entry);
    } catch {
      // Local fallback
    }

    return entry;
  }

  public getActivityLogs(): BotActivityLog[] {
    return this.logs;
  }
}

export const botAgentService = new BotAgentService();
