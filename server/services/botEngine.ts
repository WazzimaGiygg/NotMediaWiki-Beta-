import { GoogleGenAI } from '@google/genai';
import { contentService } from './content';
import { revisionService } from './revisions';
import { UserRole } from './auth';

export interface BotUserAccount {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  description: string;
  isBot: true;
  botFlag: true;
  role: 'bot';
  status: 'active' | 'paused' | 'disabled';
  permissions: string[];
  assignedBotAgentId: string;
  createdAt: string;
  totalEdits: number;
  lastActiveAt: string;
}

export interface BotActivityLogEntry {
  id: string;
  botId: string;
  botName: string;
  action: string;
  targetArticleSlug?: string;
  targetUserId?: string;
  severity: 'info' | 'warning' | 'critical';
  summary: string;
  details?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface BotScanFinding {
  id: string;
  articleSlug: string;
  articleTitle: string;
  botId: string;
  botName: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  details: string;
  suggestion?: string;
  suggestedMarkup?: string;
  autoFixAvailable?: boolean;
  actionTaken?: 'none' | 'flagged' | 'reverted' | 'suggested' | 'fixed';
  detectedAt: string;
  metadata?: Record<string, any>;
}

export interface UserAbuseReport {
  id: string;
  userId: string;
  username: string;
  riskScore: number;
  status: 'clean' | 'suspicious' | 'flagged' | 'restricted';
  flags: string[];
  recentEditsCount: number;
  revertCount: number;
  burstEditsCount: number;
  massDeletionsCount: number;
  profanityDetections: number;
  lastAuditAt: string;
  details: string;
}

class BotEngine {
  private botUsers: BotUserAccount[] = [
    {
      id: 'bot_citation_0001',
      username: 'CitationBot#0001',
      displayName: 'CitationBot (Gemini 3.8 Flash)',
      avatar: 'CB',
      description: 'Robô oficial para validação bibliográfica e marcação de fontes carentes.',
      isBot: true,
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
      username: 'AntiVandalBot#0002',
      displayName: 'AntiVandalBot (Proteção de Conteúdo)',
      avatar: 'AV',
      description: 'Robô de segurança e patrulhamento contra esvaziamentos e vandalismos.',
      isBot: true,
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
      username: 'CategoryBot#0003',
      displayName: 'CategoryBot (Taxonomia Enciclopédica)',
      avatar: 'CT',
      description: 'Robô para indexação e padronização taxonômica de categorias.',
      isBot: true,
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
      username: 'QualityBot#0004',
      displayName: 'QualityBot (Maturidade Estrutural)',
      avatar: 'QB',
      description: 'Robô auditor de qualidade, maturidade e seções mínimas de verbetes.',
      isBot: true,
      botFlag: true,
      role: 'bot',
      status: 'active',
      permissions: ['read', 'edit', 'audit_quality', 'add_maintenance_templates'],
      assignedBotAgentId: 'quality_bot',
      createdAt: '2026-02-10T10:00:00.000Z',
      totalEdits: 215,
      lastActiveAt: new Date().toISOString(),
    },
    {
      id: 'bot_linkchecker_0005',
      username: 'BrokenLinksBot#0005',
      displayName: 'BrokenLinksBot (Sanitizador de Links)',
      avatar: 'BL',
      description: 'Robô de verificação e encapsulamento de links externos inseguros.',
      isBot: true,
      botFlag: true,
      role: 'bot',
      status: 'active',
      permissions: ['read', 'edit', 'wrap_links', 'flag_dead_links'],
      assignedBotAgentId: 'link_checker_bot',
      createdAt: '2026-02-15T10:00:00.000Z',
      totalEdits: 74,
      lastActiveAt: new Date().toISOString(),
    },
    {
      id: 'bot_lgpd_0006',
      username: 'LgpdModerationBot#0006',
      displayName: 'LgpdModerationBot (Conformidade Legal)',
      avatar: 'LG',
      description: 'Robô de detecção de dados sensíveis, CPFs, RGs e conformidade LGPD.',
      isBot: true,
      botFlag: true,
      role: 'bot',
      status: 'active',
      permissions: ['read', 'edit', 'redact_pii', 'notify_dpo'],
      assignedBotAgentId: 'lgpd_bot',
      createdAt: '2026-03-01T10:00:00.000Z',
      totalEdits: 31,
      lastActiveAt: new Date().toISOString(),
    },
  ];

  private logs: BotActivityLogEntry[] = [];
  private userAudits: Map<string, UserAbuseReport> = new Map();

  constructor() {
    this.addLog({
      botId: 'antivandal_bot',
      botName: 'AntiVandalismBot',
      action: 'SERVICE_INITIALIZED',
      severity: 'info',
      summary: 'Backend Bot Engine inicializado com 6 bots e regras de auditoria ativas.',
    });
  }

  public getBotUsers(): BotUserAccount[] {
    return [...this.botUsers];
  }

  public upsertBotUser(userData: Partial<BotUserAccount> & { id: string }): BotUserAccount {
    const existingIdx = this.botUsers.findIndex(u => u.id === userData.id);
    if (existingIdx >= 0) {
      this.botUsers[existingIdx] = {
        ...this.botUsers[existingIdx],
        ...userData,
        isBot: true,
        botFlag: true,
        role: 'bot',
        lastActiveAt: new Date().toISOString(),
      };
      this.addLog({
        botId: this.botUsers[existingIdx].assignedBotAgentId,
        botName: this.botUsers[existingIdx].username,
        action: 'UPDATE_BOT_ACCOUNT',
        severity: 'info',
        summary: `Conta de bot "${this.botUsers[existingIdx].username}" atualizada no backend.`,
      });
      return this.botUsers[existingIdx];
    } else {
      const newUser: BotUserAccount = {
        id: userData.id,
        username: userData.username || `BotUser_${Date.now()}`,
        displayName: userData.displayName || userData.username || 'Bot User',
        avatar: userData.avatar || 'BT',
        description: userData.description || 'Conta de automação do NotMediaWiki',
        isBot: true,
        botFlag: true,
        role: 'bot',
        status: userData.status || 'active',
        permissions: userData.permissions || ['read', 'edit'],
        assignedBotAgentId: userData.assignedBotAgentId || 'antivandal_bot',
        createdAt: new Date().toISOString(),
        totalEdits: 0,
        lastActiveAt: new Date().toISOString(),
      };
      this.botUsers.push(newUser);
      this.addLog({
        botId: newUser.assignedBotAgentId,
        botName: newUser.username,
        action: 'CREATE_BOT_ACCOUNT',
        severity: 'info',
        summary: `Nova conta de bot "${newUser.username}" criada com isBot: true e role: 'bot'.`,
      });
      return newUser;
    }
  }

  public deleteBotUser(id: string): boolean {
    const idx = this.botUsers.findIndex(u => u.id === id);
    if (idx >= 0) {
      const removed = this.botUsers.splice(idx, 1)[0];
      this.addLog({
        botId: removed.assignedBotAgentId,
        botName: removed.username,
        action: 'DELETE_BOT_ACCOUNT',
        severity: 'warning',
        summary: `Conta de bot "${removed.username}" removida do sistema.`,
      });
      return true;
    }
    return false;
  }

  public addLog(entry: Omit<BotActivityLogEntry, 'id' | 'timestamp'>): BotActivityLogEntry {
    const log: BotActivityLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.logs.unshift(log);
    if (this.logs.length > 200) {
      this.logs.pop();
    }
    return log;
  }

  public getLogs(limit = 100): BotActivityLogEntry[] {
    return this.logs.slice(0, limit);
  }

  // ---------------------------------------------------------------------------
  // BOT 1: Anti-Vandalism Engine (4.1.1.11E.1)
  // ---------------------------------------------------------------------------
  public analyzeVandalism(
    oldWikitext: string,
    newWikitext: string,
    author: { id: string; name: string }
  ): { isVandalism: boolean; severity: 'info' | 'warning' | 'critical'; reason: string; byteDelta: number; dropPercent: number } {
    const oldLen = oldWikitext.length;
    const newLen = newWikitext.length;
    const byteDelta = newLen - oldLen;
    const dropPercent = oldLen > 0 && byteDelta < 0 ? Math.round((Math.abs(byteDelta) / oldLen) * 100) : 0;

    const severeTokens = [
      /\b(idiota|otario|fdp|vandalismo|lixo|hackeado|pau no cu|morra)\b/i,
      /(.)\1{12,}/, // repetição excessiva de caractere único: 'aaaaaaaaaaaa'
      /^\s*$/m, // esvaziamento completo
    ];

    let hasSevereToken = false;
    for (const pattern of severeTokens) {
      if (pattern.test(newWikitext)) {
        hasSevereToken = true;
        break;
      }
    }

    if (hasSevereToken) {
      return {
        isVandalism: true,
        severity: 'critical',
        reason: 'Inserção de vocabulário ofensivo, difamação ou repetição massiva de caracteres.',
        byteDelta,
        dropPercent,
      };
    }

    if (oldLen > 200 && dropPercent >= 35) {
      return {
        isVandalism: true,
        severity: 'critical',
        reason: `Esvaziamento em massa detectado: redução de ${dropPercent}% do conteúdo (${Math.abs(byteDelta)} caracteres removidos).`,
        byteDelta,
        dropPercent,
      };
    }

    if (dropPercent >= 20) {
      return {
        isVandalism: false,
        severity: 'warning',
        reason: `Remoção substancial de texto detectada (${dropPercent}%). Requer atenção da moderação.`,
        byteDelta,
        dropPercent,
      };
    }

    return {
      isVandalism: false,
      severity: 'info',
      reason: 'Edição dentro dos parâmetros usuais.',
      byteDelta,
      dropPercent,
    };
  }

  // ---------------------------------------------------------------------------
  // BOT 2: Citation Checker Engine (4.1.1.WV.1) via Gemini
  // ---------------------------------------------------------------------------
  public async checkCitations(title: string, wikitext: string) {
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI();
        const prompt = `Você é o CitationBot (4.1.1.WV.1), um agente de integridade enciclopédica do NotMediaWiki.
Analise detalhadamente o wikitext do verbete "${title}".
Identifique se há afirmações estatísticas, numéricas, biográficas ou científicas sem fontes verificáveis (<ref>).
Responda exclusivamente em formato JSON:
{
  "hasMissingCitations": boolean,
  "confidenceScore": number,
  "totalReferencesFound": number,
  "claimsNeedingCitations": [
    {
      "claim": "afirmação não referenciada",
      "issue": "motivo pelo qual carece de fonte",
      "suggestedMarkup": "sugestão com tag <ref> ou {{Carece de fontes}}"
    }
  ],
  "recommendations": ["recomendação 1", "recomendação 2"],
  "summary": "resumo geral da análise"
}

Wikitext:
${wikitext.substring(0, 12000)}`;

        const geminiRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        if (geminiRes.text) {
          const parsed = JSON.parse(geminiRes.text);
          return { success: true, source: 'gemini-2.5-flash', analysis: parsed };
        }
      } catch (err: any) {
        console.warn('[CitationBot Gemini Error]:', err.message);
      }
    }

    // Heuristic Fallback
    const refCount = (wikitext.match(/<ref[\s>]/gi) || []).length;
    const statRegex = /\b(\d+(?:\.\d+)?%|\bno ano de \d{4}\b|\bsegundo pesquisas\b|\bestatisticamente\b|\bafirmou que\b)/i;
    const paragraphs = wikitext.split(/\n\n+/).filter(p => p.trim().length > 50 && !p.startsWith('=='));
    const claimsNeedingCitations = [];

    for (const p of paragraphs) {
      if (statRegex.test(p) && !p.includes('<ref')) {
        claimsNeedingCitations.push({
          claim: p.substring(0, 120),
          issue: 'Afirmação factual ou estatística desacompanhada de referência bibliográfica.',
          suggestedMarkup: `${p} {{Carece de fontes}}`,
        });
      }
    }

    return {
      success: true,
      source: 'heuristic_fallback',
      analysis: {
        hasMissingCitations: claimsNeedingCitations.length > 0 || refCount === 0,
        confidenceScore: 80,
        totalReferencesFound: refCount,
        claimsNeedingCitations,
        recommendations: [
          refCount === 0
            ? 'O verbete não possui seção == Referências == nem tags <ref>. Adicionar fontes confiáveis.'
            : 'Adicionar fontes específicas para alegações estatísticas.',
        ],
        summary: `Heurística identificou ${refCount} referências e ${claimsNeedingCitations.length} pontos sem citação.`,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // BOT 3: LGPD / PII Moderation Engine (4.1.1.E0.1)
  // ---------------------------------------------------------------------------
  public checkLgpdCompliance(wikitext: string): {
    hasViolation: boolean;
    violations: Array<{ type: string; snippet: string; risk: 'critical' | 'warning' }>;
    redactedText: string;
  } {
    const violations: Array<{ type: string; snippet: string; risk: 'critical' | 'warning' }> = [];
    let redacted = wikitext;

    // CPF pattern
    const cpfRegex = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
    let match;
    while ((match = cpfRegex.exec(wikitext)) !== null) {
      violations.push({
        type: 'CPF_EXPOSTO',
        snippet: match[0],
        risk: 'critical',
      });
    }
    redacted = redacted.replace(cpfRegex, '[DADO PESSOAL REDIGIDO - LGPD]');

    // Brazilian phone with DDD
    const phoneRegex = /\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/g;
    while ((match = phoneRegex.exec(wikitext)) !== null) {
      violations.push({
        type: 'TELEFONE_PESSOAL',
        snippet: match[0],
        risk: 'warning',
      });
    }
    redacted = redacted.replace(phoneRegex, '[CONTATO REDIGIDO - LGPD]');

    // Exposed email
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    while ((match = emailRegex.exec(wikitext)) !== null) {
      violations.push({
        type: 'EMAIL_EXPOSTO',
        snippet: match[0],
        risk: 'warning',
      });
    }
    redacted = redacted.replace(emailRegex, '[EMAIL REDIGIDO - LGPD]');

    return {
      hasViolation: violations.length > 0,
      violations,
      redactedText: redacted,
    };
  }

  // ---------------------------------------------------------------------------
  // BOT 4: User Abuse Audit Engine (4.1.1.18C.1)
  // ---------------------------------------------------------------------------
  public auditUserBehavior(
    userId: string,
    username: string,
    action?: { articleSlug: string; charDelta: number; isVandal?: boolean }
  ): UserAbuseReport {
    let report = this.userAudits.get(userId);
    if (!report) {
      report = {
        id: `audit_${userId}`,
        userId,
        username,
        riskScore: 5,
        status: 'clean',
        flags: [],
        recentEditsCount: 1,
        revertCount: 0,
        burstEditsCount: 0,
        massDeletionsCount: 0,
        profanityDetections: 0,
        lastAuditAt: new Date().toISOString(),
        details: 'Perfil com histórico inicial regular.',
      };
    } else {
      report.recentEditsCount += 1;
      report.lastAuditAt = new Date().toISOString();
    }

    if (action) {
      if (action.charDelta < -300) {
        report.massDeletionsCount += 1;
        report.flags.push(`Remoção em massa em ${action.articleSlug} (${action.charDelta} chars)`);
      }
      if (action.isVandal) {
        report.revertCount += 1;
        report.profanityDetections += 1;
        report.flags.push(`Edição revertida por vandalismo em ${action.articleSlug}`);
      }
    }

    // Calculate risk
    let calculatedRisk = 5;
    calculatedRisk += report.revertCount * 30;
    calculatedRisk += report.massDeletionsCount * 25;
    calculatedRisk += report.profanityDetections * 35;
    calculatedRisk += report.burstEditsCount * 15;
    report.riskScore = Math.min(100, Math.max(0, calculatedRisk));

    if (report.riskScore >= 70) {
      report.status = 'flagged';
    } else if (report.riskScore >= 40) {
      report.status = 'suspicious';
    } else {
      report.status = 'clean';
    }

    this.userAudits.set(userId, report);
    return report;
  }

  public getAllUserAudits(): UserAbuseReport[] {
    return Array.from(this.userAudits.values());
  }

  // ---------------------------------------------------------------------------
  // BOT 5, 6, 7: Quality, Categorization & Broken Links
  // ---------------------------------------------------------------------------
  public checkQuality(wikitext: string) {
    const hasLead = wikitext.trim().length > 0 && !wikitext.trim().startsWith('==');
    const sections = (wikitext.match(/^==\s*[^=]+\s*==/gm) || []).length;
    const refCount = (wikitext.match(/<ref[\s>]/gi) || []).length;
    const wordCount = wikitext.split(/\s+/).filter(Boolean).length;
    const hasImage = /\[\[(Ficheiro|Arquivo|File|Image):/i.test(wikitext);

    let maturity = 'Esboço';
    if (wordCount > 600 && sections >= 3 && refCount >= 3) {
      maturity = 'Maduro';
    } else if (wordCount > 250 && sections >= 2 && refCount >= 1) {
      maturity = 'Básico';
    }

    return {
      hasLead,
      sectionsCount: sections,
      refCount,
      wordCount,
      hasImage,
      maturity,
      score: Math.min(100, Math.round((wordCount / 10) + (sections * 15) + (refCount * 10) + (hasImage ? 15 : 0))),
    };
  }

  public suggestCategories(title: string, wikitext: string): string[] {
    const categories: string[] = [];
    const lower = `${title} ${wikitext}`.toLowerCase();

    if (lower.includes('software') || lower.includes('código') || lower.includes('programação') || lower.includes('api')) {
      categories.push('Tecnologia', 'Ciência da Computação');
    }
    if (lower.includes('história') || lower.includes('século') || lower.includes('guerra') || lower.includes('império')) {
      categories.push('História');
    }
    if (lower.includes('brasil') || lower.includes('brasileiro') || lower.includes('estado')) {
      categories.push('Brasil');
    }
    if (lower.includes('física') || lower.includes('química') || lower.includes('biologia') || lower.includes('átomo')) {
      categories.push('Ciência');
    }
    if (lower.includes('música') || lower.includes('álbum') || lower.includes('banda') || lower.includes('artista')) {
      categories.push('Música', 'Cultura');
    }

    return Array.from(new Set(categories));
  }

  public checkExternalLinks(wikitext: string): Array<{ url: string; isHttps: boolean; isSecure: boolean }> {
    const urlRegex = /https?:\/\/[^\s\]\<\>"]+/g;
    const found = wikitext.match(urlRegex) || [];
    return found.map(url => ({
      url,
      isHttps: url.startsWith('https://'),
      isSecure: url.startsWith('https://') && !url.includes('127.0.0.1') && !url.includes('localhost'),
    }));
  }

  // ---------------------------------------------------------------------------
  // FULL SCAN EXECUTION ON BACKEND (Cloud Function simulation)
  // ---------------------------------------------------------------------------
  public async executeServerScan(articles: Array<{ slug: string; title: string; wikitext: string }>, selectedBots: string[]): Promise<BotScanFinding[]> {
    const findings: BotScanFinding[] = [];

    for (const art of articles) {
      // 1. Anti-Vandalism Check
      if (selectedBots.includes('antivandal_bot')) {
        const vResult = this.analyzeVandalism(art.wikitext, art.wikitext, { id: 'sys', name: 'System' });
        if (vResult.isVandalism || vResult.severity === 'warning') {
          findings.push({
            id: `find_av_${art.slug}_${Date.now()}`,
            articleSlug: art.slug,
            articleTitle: art.title,
            botId: 'antivandal_bot',
            botName: 'AntiVandalBot',
            severity: vResult.severity,
            title: 'Alerta de Integridade de Conteúdo',
            details: vResult.reason,
            actionTaken: vResult.isVandalism ? 'flagged' : 'none',
            detectedAt: new Date().toISOString(),
          });
        }
      }

      // 2. Citation Check
      if (selectedBots.includes('citation_bot')) {
        const cResult = await this.checkCitations(art.title, art.wikitext);
        if (cResult.analysis && cResult.analysis.hasMissingCitations) {
          findings.push({
            id: `find_cite_${art.slug}_${Date.now()}`,
            articleSlug: art.slug,
            articleTitle: art.title,
            botId: 'citation_bot',
            botName: 'CitationBot',
            severity: 'warning',
            title: 'Verificação Bibliográfica Pendente',
            details: cResult.analysis.summary,
            suggestion: cResult.analysis.recommendations?.[0] || 'Adicionar fontes com tags <ref>',
            actionTaken: 'suggested',
            detectedAt: new Date().toISOString(),
          });
        }
      }

      // 3. LGPD Check
      if (selectedBots.includes('lgpd_bot')) {
        const lgpd = this.checkLgpdCompliance(art.wikitext);
        if (lgpd.hasViolation) {
          findings.push({
            id: `find_lgpd_${art.slug}_${Date.now()}`,
            articleSlug: art.slug,
            articleTitle: art.title,
            botId: 'lgpd_bot',
            botName: 'LgpdModerationBot',
            severity: 'critical',
            title: 'Dados Pessoais Detectados (LGPD)',
            details: `Identificados ${lgpd.violations.length} dados sensíveis (${lgpd.violations.map(v => v.type).join(', ')}).`,
            suggestion: 'Redigir imediatamente informações sensíveis e mascarar PII.',
            actionTaken: 'flagged',
            detectedAt: new Date().toISOString(),
          });
        }
      }

      // 4. Quality Check
      if (selectedBots.includes('quality_bot')) {
        const q = this.checkQuality(art.wikitext);
        if (q.score < 50) {
          findings.push({
            id: `find_qual_${art.slug}_${Date.now()}`,
            articleSlug: art.slug,
            articleTitle: art.title,
            botId: 'quality_bot',
            botName: 'QualityBot',
            severity: 'info',
            title: `Avaliação Estrutural: ${q.maturity} (${q.score}/100)`,
            details: `Artigo possui ${q.sectionsCount} seções e ${q.refCount} referências.`,
            suggestion: !q.hasLead ? 'Inserir introdução clara antes do primeiro título H2.' : 'Expandir conteúdo.',
            actionTaken: 'none',
            detectedAt: new Date().toISOString(),
          });
        }
      }

      // 5. Categorization Check
      if (selectedBots.includes('category_bot')) {
        const cats = this.suggestCategories(art.title, art.wikitext);
        if (cats.length > 0 && !art.wikitext.includes('[[Categoria:')) {
          findings.push({
            id: `find_cat_${art.slug}_${Date.now()}`,
            articleSlug: art.slug,
            articleTitle: art.title,
            botId: 'category_bot',
            botName: 'CategoryBot',
            severity: 'info',
            title: `Sugestão Taxonômica (${cats.length} categorias)`,
            details: `Categorias sugeridas: ${cats.join(', ')}`,
            suggestion: `Inserir [[Categoria:${cats[0]}]] no final do artigo`,
            suggestedMarkup: `[[Categoria:${cats[0]}]]`,
            actionTaken: 'suggested',
            detectedAt: new Date().toISOString(),
          });
        }
      }

      // 6. Broken Links Check
      if (selectedBots.includes('link_checker_bot')) {
        const links = this.checkExternalLinks(art.wikitext);
        const insecure = links.filter(l => !l.isSecure);
        if (insecure.length > 0) {
          findings.push({
            id: `find_links_${art.slug}_${Date.now()}`,
            articleSlug: art.slug,
            articleTitle: art.title,
            botId: 'link_checker_bot',
            botName: 'BrokenLinksBot',
            severity: 'warning',
            title: 'Hiperlinks Inseguros Detectados',
            details: `${insecure.length} link(s) externo(s) sem protocolo HTTPS ou com IPs não roteáveis.`,
            suggestion: 'Atualizar para HTTPS ou aplicar redirecionador seguro.',
            actionTaken: 'flagged',
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }

    this.addLog({
      botId: 'antivandal_bot',
      botName: 'BotEngine Cluster',
      action: 'SERVER_SCAN_COMPLETE',
      severity: 'info',
      summary: `Varredura backend concluída: ${articles.length} artigos analisados, ${findings.length} achados reportados.`,
    });

    return findings;
  }
}

export const botEngine = new BotEngine();
