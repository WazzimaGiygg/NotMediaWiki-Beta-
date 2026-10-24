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
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { botUserManager, BotUserManager } from '../extensions/bots/BotUserManager';
import { botExecutionService, BotExecutionService } from './BotExecutionService';
import { antiVandalismBot } from '../extensions/bots/bots/AntiVandalismBot';
import { citationCheckerBot } from '../extensions/bots/bots/CitationCheckerBot';
import { qualityBot } from '../extensions/bots/bots/QualityBot';
import { categorizationBot } from '../extensions/bots/bots/CategorizationBot';
import { brokenLinksBot } from '../extensions/bots/bots/BrokenLinksBot';
import { lgpdModerationBot } from '../extensions/bots/bots/LgpdModerationBot';

export const BOT_TREE_CONFIGS: BotAgentConfig[] = [
  {
    id: 'citation_bot',
    code: '4.1.1.WV.1',
    name: 'CitationCheckerBot',
    namePt: 'Bot de Verificação de Citações (Gemini 3.8 Flash)',
    enabled: true,
    description:
      '4.1.1.WV.1: Analisa afirmações factuais sem fontes, datas desacompanhadas de <ref> e sugere citações ou {{Carece de fontes}}.',
    assignedUserId: 'bot_citation_0001',
    assignedUsername: 'CitationBot#0001',
    mode: 'automatic',
    settings: {
      useGemini: true,
      sensitivityLevel: 'medio',
    },
    stats: {
      totalRuns: 168,
      actionsTaken: 42,
      flagsRaised: 31,
      lastRunAt: new Date().toISOString(),
    },
  },
  {
    id: 'antivandal_bot',
    code: '4.1.1.11E.1',
    name: 'AntiVandalismBot',
    namePt: 'Bot Anti-Vandalismo & Proteção de Conteúdo',
    enabled: true,
    description:
      '4.1.1.11E.1: Detecta edições suspeitas, remoção massiva de conteúdo (>35%) e esvaziamentos, permitindo reversão automática.',
    assignedUserId: 'bot_antivandal_0002',
    assignedUsername: 'AntiVandalBot#0002',
    mode: 'automatic',
    settings: {
      autoRevertVandalism: true,
      byteDropThresholdPercent: 35,
      sensitivityLevel: 'alto',
    },
    stats: {
      totalRuns: 345,
      actionsTaken: 14,
      flagsRaised: 22,
      lastRunAt: new Date().toISOString(),
    },
  },
  {
    id: 'category_bot',
    code: '4.1.1.G2.1',
    name: 'CategorizationBot',
    namePt: 'Bot de Categorização Automática',
    enabled: true,
    description:
      '4.1.1.G2.1: Avalia tópicos semânticos e termos para sugerir ou aplicar categorias enciclopédicas padronizadas.',
    assignedUserId: 'bot_category_0003',
    assignedUsername: 'CategoryBot#0003',
    mode: 'manual',
    settings: {
      autoApplyCategories: false,
    },
    stats: {
      totalRuns: 95,
      actionsTaken: 51,
      flagsRaised: 16,
      lastRunAt: new Date().toISOString(),
    },
  },
  {
    id: 'quality_bot',
    code: '4.1.1.IL.1',
    name: 'QualityBot',
    namePt: 'Bot de Qualidade Estrutural & Maturidade',
    enabled: true,
    description:
      '4.1.1.IL.1: Verifica introdução, seções mínimas (>=2), referências e presença de ilustrações visuais.',
    assignedUserId: 'bot_quality_0004',
    assignedUsername: 'QualityBot#0004',
    mode: 'automatic',
    settings: {
      minQualityScoreRequired: 60,
    },
    stats: {
      totalRuns: 220,
      actionsTaken: 84,
      flagsRaised: 46,
      lastRunAt: new Date().toISOString(),
    },
  },
  {
    id: 'link_checker_bot',
    code: '4.1.1.GW.1',
    name: 'BrokenLinksBot',
    namePt: 'Bot de Links Quebrados & Conectividade',
    enabled: true,
    description:
      '4.1.1.GW.1: Inspeciona ligações externas http/https, detecta protocolos inseguros e marca links inativos com {{Ligação inativa}}.',
    assignedUserId: 'bot_linkchecker_0005',
    assignedUsername: 'LinkCheckerBot#0005',
    mode: 'manual',
    settings: {
      sensitivityLevel: 'medio',
    },
    stats: {
      totalRuns: 72,
      actionsTaken: 11,
      flagsRaised: 14,
      lastRunAt: new Date().toISOString(),
    },
  },
  {
    id: 'lgpd_bot',
    code: '4.1.1.E0.1',
    name: 'LgpdModerationBot',
    namePt: 'Bot de LGPD, Moderação & Privacidade',
    enabled: true,
    description:
      '4.1.1.E0.1: Patrulha dados sensíveis (CPF, RG, telefones móveis, e-mails pessoais) em conformidade com a Lei 13.709/2018.',
    assignedUserId: 'bot_lgpd_0006',
    assignedUsername: 'LgpdBot#0006',
    mode: 'automatic',
    settings: {
      sensitivityLevel: 'alto',
    },
    stats: {
      totalRuns: 215,
      actionsTaken: 9,
      flagsRaised: 19,
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
      '4.1.1.18C.1: Extensão auto-carregada por padrão que avalia o comportamento de edições e detecta abusos de usuários.',
    assignedUserId: 'bot_useraudit_0007',
    assignedUsername: 'UserAuditBot#0007',
    mode: 'automatic',
    settings: {
      sensitivityLevel: 'alto',
      scanRecentHours: 2, // 4.1.1.1IT.1 (Descontinuado para login universal, configurável sob demanda)
    },
    stats: {
      totalRuns: 310,
      actionsTaken: 18,
      flagsRaised: 27,
      lastRunAt: new Date().toISOString(),
    },
  },
];

const STORAGE_TREE_CONFIGS = 'notmediawiki_bot_tree_configs';

export class BotService {
  private configs: BotAgentConfig[] = [];
  public userManager: BotUserManager = botUserManager;
  public executionService: BotExecutionService = botExecutionService;

  constructor() {
    try {
      const stored = localStorage.getItem(STORAGE_TREE_CONFIGS);
      this.configs = stored ? JSON.parse(stored) : BOT_TREE_CONFIGS;
    } catch {
      this.configs = BOT_TREE_CONFIGS;
    }
    this.syncBotsWithModularClasses();
  }

  private syncBotsWithModularClasses() {
    const antivandal = this.configs.find(c => c.id === 'antivandal_bot');
    if (antivandal) {
      antiVandalismBot.updateConfig({
        enabled: antivandal.enabled,
        autoRevert: antivandal.settings.autoRevertVandalism !== false,
        byteLossThresholdPercent: antivandal.settings.byteDropThresholdPercent || 35,
      });
    }

    const citation = this.configs.find(c => c.id === 'citation_bot');
    if (citation) {
      citationCheckerBot.updateConfig({
        enabled: citation.enabled,
        useGemini: citation.settings.useGemini !== false,
      });
    }

    const quality = this.configs.find(c => c.id === 'quality_bot');
    if (quality) {
      qualityBot.updateConfig({
        enabled: quality.enabled,
        minQualityScore: quality.settings.minQualityScoreRequired || 60,
      });
    }

    const category = this.configs.find(c => c.id === 'category_bot');
    if (category) {
      categorizationBot.updateConfig({
        enabled: category.enabled,
        autoApply: Boolean(category.settings.autoApplyCategories),
      });
    }

    const links = this.configs.find(c => c.id === 'link_checker_bot');
    if (links) {
      brokenLinksBot.updateConfig({
        enabled: links.enabled,
      });
    }

    const lgpd = this.configs.find(c => c.id === 'lgpd_bot');
    if (lgpd) {
      lgpdModerationBot.updateConfig({
        enabled: lgpd.enabled,
      });
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_TREE_CONFIGS, JSON.stringify(this.configs));
    } catch (e) {
      console.warn('Storage save error:', e);
    }
    this.syncBotsWithModularClasses();
  }

  public async getConfigs(): Promise<BotAgentConfig[]> {
    try {
      const snap = await getDocs(collection(db, 'bot_agents_config'));
      if (!snap.empty) {
        const cloudConfigs: BotAgentConfig[] = [];
        snap.forEach(d => cloudConfigs.push(d.data() as BotAgentConfig));
        if (cloudConfigs.length >= 7) {
          this.configs = cloudConfigs;
          this.persist();
          return cloudConfigs;
        }
      }
    } catch {}
    return this.configs;
  }

  public async updateConfig(botId: BotAgentId, updates: Partial<BotAgentConfig>): Promise<BotAgentConfig> {
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
    this.persist();

    try {
      await setDoc(doc(db, 'bot_agents_config', botId), this.configs[idx], { merge: true });
    } catch {}

    await this.executionService.logActivity({
      botId,
      botName: this.configs[idx].name,
      action: 'UPDATE_TREE_CONFIG',
      severity: 'info',
      summary: `Configurações da árvore do bot ${this.configs[idx].namePt} atualizadas.`,
    });

    return this.configs[idx];
  }

  public async toggleBot(botId: BotAgentId, enabled: boolean): Promise<BotAgentConfig> {
    return this.updateConfig(botId, { enabled });
  }

  // Façade methods for ease of access
  public async getBotUsers(): Promise<BotUser[]> {
    return this.userManager.getBotUsers();
  }

  public async upsertBotUser(user: Partial<BotUser> & { id: string }): Promise<BotUser> {
    return this.userManager.upsertBotUser(user);
  }

  public async deleteBotUser(id: string): Promise<boolean> {
    return this.userManager.deleteBotUser(id);
  }

  public async runScan(articles: Article[], conditions?: BotScanCondition): Promise<BotScanResult[]> {
    return this.executionService.executeScan(articles, conditions);
  }

  public async auditUserContributions(user: UserSession, action?: { articleSlug: string; charDelta: number; isVandal?: boolean }): Promise<UserAbuseAudit> {
    return this.executionService.auditUserContributions(user, action);
  }

  public getUserAudits(): UserAbuseAudit[] {
    return this.executionService.getUserAudits();
  }

  public getLogs(): BotActivityLog[] {
    return this.executionService.getLogs();
  }
}

export const botService = new BotService();
