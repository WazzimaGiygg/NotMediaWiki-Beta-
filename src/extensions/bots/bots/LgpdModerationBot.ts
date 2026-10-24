import { Article, BotScanResult } from '../../../types';

export interface LgpdModerationConfig {
  enabled: boolean;
  strictRedaction: boolean;
  sensitivity: 'baixo' | 'medio' | 'alto';
}

export const DEFAULT_LGPD_CONFIG: LgpdModerationConfig = {
  enabled: true,
  strictRedaction: true,
  sensitivity: 'alto',
};

const CPF_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const PHONE_BR_REGEX = /(?:\+?55\s?)?(?:\(?0?[1-9]{2}\)?\s?)?(?:9\s?\d{4}[-\s]?\d{4}|\d{4}[-\s]?\d{4})\b/g;

export class LgpdModerationBot {
  public static readonly ID = 'lgpd_bot';
  public static readonly CODE = '4.1.1.E0.1';
  public static readonly NAME = 'LgpdModerationBot';

  private config: LgpdModerationConfig;

  constructor(config: Partial<LgpdModerationConfig> = {}) {
    this.config = { ...DEFAULT_LGPD_CONFIG, ...config };
  }

  public updateConfig(updates: Partial<LgpdModerationConfig>) {
    this.config = { ...this.config, ...updates };
  }

  public getConfig(): LgpdModerationConfig {
    return this.config;
  }

  public inspect(article: Article): BotScanResult[] {
    if (!this.config.enabled) return [];
    const issues: BotScanResult[] = [];
    const wikitext = article.wikitext || '';

    // 1. CPF leaks (Critical LGPD violation)
    const cpfs = wikitext.match(CPF_REGEX) || [];
    if (cpfs.length > 0) {
      issues.push({
        id: `lgpd_cpf_${article.slug}_${Math.random().toString(36).substring(2, 6)}`,
        articleSlug: article.slug,
        articleTitle: article.title,
        botId: 'lgpd_bot',
        botName: LgpdModerationBot.NAME,
        severity: 'critical',
        title: 'Violação LGPD: CPF detectado em texto público',
        details: `Identificado(s) ${cpfs.length} padrão(ões) de CPF no corpo do artigo. Violação direta do Art. 18 da Lei 13.709/2018.`,
        suggestion: 'Ofuscar imediatamente para [DADO PESSOAL OCULTADO - ART. 18 LGPD].',
        suggestedMarkup: wikitext.replace(CPF_REGEX, '[CPF OCULTADO - LGPD]'),
        autoFixAvailable: true,
        actionTaken: 'flagged',
        detectedAt: new Date().toISOString(),
      });
    }

    // 2. Personal phone numbers
    const phones = wikitext.match(PHONE_BR_REGEX) || [];
    if (phones.length > 0 && !article.slug.toLowerCase().includes('contato')) {
      issues.push({
        id: `lgpd_phone_${article.slug}_${Math.random().toString(36).substring(2, 6)}`,
        articleSlug: article.slug,
        articleTitle: article.title,
        botId: 'lgpd_bot',
        botName: LgpdModerationBot.NAME,
        severity: 'warning',
        title: 'Número telefônico pessoal detectado',
        details: `Exposição indevida de telefone móvel/fixo pessoal: ${phones[0]}.`,
        suggestion: 'Remover dados de contato direto de pessoas vivas (WP:BLP).',
        autoFixAvailable: false,
        actionTaken: 'flagged',
        detectedAt: new Date().toISOString(),
      });
    }

    return issues;
  }
}

export const lgpdModerationBot = new LgpdModerationBot();
