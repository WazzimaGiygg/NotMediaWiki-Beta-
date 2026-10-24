import { Article, BotScanResult } from '../../../types';

export interface QualityBotConfig {
  enabled: boolean;
  minQualityScore: number;
  sensitivity: 'baixo' | 'medio' | 'alto';
}

export const DEFAULT_QUALITY_CONFIG: QualityBotConfig = {
  enabled: true,
  minQualityScore: 60,
  sensitivity: 'medio',
};

export class QualityBot {
  public static readonly ID = 'quality_bot';
  public static readonly CODE = '4.1.1.IL.1';
  public static readonly NAME = 'QualityBot';

  private config: QualityBotConfig;

  constructor(config: Partial<QualityBotConfig> = {}) {
    this.config = { ...DEFAULT_QUALITY_CONFIG, ...config };
  }

  public updateConfig(updates: Partial<QualityBotConfig>) {
    this.config = { ...this.config, ...updates };
  }

  public getConfig(): QualityBotConfig {
    return this.config;
  }

  public inspect(article: Article): BotScanResult[] {
    if (!this.config.enabled) return [];
    const issues: BotScanResult[] = [];
    const wikitext = article.wikitext || '';

    // 1. Introduction check
    const firstSectionIndex = wikitext.search(/==\s*[^=]+\s*==/);
    const leadText = firstSectionIndex === -1 ? wikitext : wikitext.substring(0, firstSectionIndex).trim();

    if (leadText.length < 50) {
      issues.push({
        id: `qual_intro_${article.slug}`,
        articleSlug: article.slug,
        articleTitle: article.title,
        botId: 'quality_bot',
        botName: QualityBot.NAME,
        severity: 'warning',
        title: 'Seção introdutória ausente ou muito breve',
        details: 'O artigo deve apresentar um resumo introdutório elucidativo antes do primeiro título de seção.',
        suggestion: 'Redigir uma introdução de 1 a 2 parágrafos contextualizando o escopo do assunto.',
        autoFixAvailable: false,
        actionTaken: 'flagged',
        detectedAt: new Date().toISOString(),
      });
    }

    // 2. Sections hierarchy check
    const headings = wikitext.match(/==\s*[^=]+\s*==/g) || [];
    if (headings.length < 2 && wikitext.length > 400) {
      issues.push({
        id: `qual_sections_${article.slug}`,
        articleSlug: article.slug,
        articleTitle: article.title,
        botId: 'quality_bot',
        botName: QualityBot.NAME,
        severity: 'info',
        title: 'Estruturação enciclopédica deficiente',
        details: `O artigo possui ${headings.length} seção(ões). Textos substanciais necessitam de ao menos 2 seções hierárquicas.`,
        suggestion: 'Dividir o conteúdo em tópicos usando == Seção ==.',
        autoFixAvailable: false,
        actionTaken: 'suggested',
        detectedAt: new Date().toISOString(),
      });
    }

    // 3. Media / Images check
    const hasMedia = /\[\[\s*(Ficheiro|Imagem|File|Image)\s*:[^\]]+\]\]/i.test(wikitext);
    if (!hasMedia && wikitext.length > 800) {
      issues.push({
        id: `qual_media_${article.slug}`,
        articleSlug: article.slug,
        articleTitle: article.title,
        botId: 'quality_bot',
        botName: QualityBot.NAME,
        severity: 'info',
        title: 'Conteúdo sem ilustrações ou mídias visuais',
        details: 'O documento tem texto amplo mas carece de imagens informativas para a experiência de leitura.',
        suggestion: 'Inserir infobox ou mídia utilizando [[Ficheiro:Nome.jpg|thumb|Legenda]].',
        autoFixAvailable: false,
        actionTaken: 'suggested',
        detectedAt: new Date().toISOString(),
      });
    }

    return issues;
  }
}

export const qualityBot = new QualityBot();
