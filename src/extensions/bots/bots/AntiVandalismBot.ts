import { Article, BotScanResult } from '../../../types';

export interface AntiVandalismConfig {
  enabled: boolean;
  autoRevert: boolean;
  byteLossThresholdPercent: number;
  sensitivity: 'baixo' | 'medio' | 'alto';
}

export const DEFAULT_ANTI_VANDALISM_CONFIG: AntiVandalismConfig = {
  enabled: true,
  autoRevert: true,
  byteLossThresholdPercent: 35,
  sensitivity: 'alto',
};

// Vandalism and vulgarity patterns
const VANDALISM_TERMS = [
  /\b(vandalismo|lixo|bobagem|otario|idiota|burro|merda|porra|caralho|puta|cu)\b/gi,
  /(.)\1{7,}/g, // 8 or more repeated characters
  /hackeado por/gi,
  /\b(teste de edi[cç][aã]o|teste teste)\b/gi,
];

export class AntiVandalismBot {
  public static readonly ID = 'antivandal_bot';
  public static readonly CODE = '4.1.1.11E.1';
  public static readonly NAME = 'AntiVandalBot';

  private config: AntiVandalismConfig;

  constructor(config: Partial<AntiVandalismConfig> = {}) {
    this.config = { ...DEFAULT_ANTI_VANDALISM_CONFIG, ...config };
  }

  public updateConfig(updates: Partial<AntiVandalismConfig>) {
    this.config = { ...this.config, ...updates };
  }

  public getConfig(): AntiVandalismConfig {
    return this.config;
  }

  public inspect(article: Article, previousWikitext?: string): BotScanResult[] {
    if (!this.config.enabled) return [];
    const issues: BotScanResult[] = [];
    const wikitext = article.wikitext || '';

    // 1. Detect mass content removal (blanking/deletion)
    if (previousWikitext && previousWikitext.length > 200) {
      const byteDrop = ((previousWikitext.length - wikitext.length) / previousWikitext.length) * 100;
      if (byteDrop >= this.config.byteLossThresholdPercent) {
        issues.push({
          id: `vandal_drop_${article.slug}_${Date.now()}`,
          articleSlug: article.slug,
          articleTitle: article.title,
          botId: 'antivandal_bot',
          botName: AntiVandalismBot.NAME,
          severity: 'critical',
          title: `Remoção massiva de conteúdo detectada (${byteDrop.toFixed(1)}% de perda)`,
          details: `Remoção de ${previousWikitext.length - wikitext.length} caracteres sem sumário de justificativa enciclopédica.`,
          suggestion: 'Reverter imediatamente para a última versão íntegra e advertir o usuário.',
          autoFixAvailable: true,
          actionTaken: this.config.autoRevert ? 'reverted' : 'flagged',
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // 2. Detect offensive terms / character spam
    for (const pat of VANDALISM_TERMS) {
      const match = wikitext.match(pat);
      if (match && match.length > 0) {
        issues.push({
          id: `vandal_term_${article.slug}_${Math.random().toString(36).substring(2, 6)}`,
          articleSlug: article.slug,
          articleTitle: article.title,
          botId: 'antivandal_bot',
          botName: AntiVandalismBot.NAME,
          severity: 'critical',
          title: 'Padrão suspeito ou termos de vandalismo detectados',
          details: `Encontrado(s) padrão(ões) inadequados no wikitext: "${match.slice(0, 3).join(', ')}".`,
          suggestion: 'Remover o conteúdo difamatório e notificar os administradores.',
          autoFixAvailable: false,
          actionTaken: 'flagged',
          detectedAt: new Date().toISOString(),
        });
        break;
      }
    }

    return issues;
  }
}

export const antiVandalismBot = new AntiVandalismBot();
