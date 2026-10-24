import { Article, BotScanResult } from '../../../types';

export interface CategorizationConfig {
  enabled: boolean;
  autoApply: boolean;
  sensitivity: 'baixo' | 'medio' | 'alto';
}

export const DEFAULT_CATEGORIZATION_CONFIG: CategorizationConfig = {
  enabled: true,
  autoApply: false,
  sensitivity: 'medio',
};

export class CategorizationBot {
  public static readonly ID = 'category_bot';
  public static readonly CODE = '4.1.1.G2.1';
  public static readonly NAME = 'CategorizationBot';

  private config: CategorizationConfig;

  constructor(config: Partial<CategorizationConfig> = {}) {
    this.config = { ...DEFAULT_CATEGORIZATION_CONFIG, ...config };
  }

  public updateConfig(updates: Partial<CategorizationConfig>) {
    this.config = { ...this.config, ...updates };
  }

  public getConfig(): CategorizationConfig {
    return this.config;
  }

  public inspect(article: Article): BotScanResult[] {
    if (!this.config.enabled) return [];
    const issues: BotScanResult[] = [];
    const wikitext = article.wikitext || '';
    const categories = article.categories || [];
    const hasCategoryTag = /\[\[\s*Categoria\s*:[^\]]+\]\]/i.test(wikitext) || categories.length > 0;

    if (!hasCategoryTag) {
      const lower = `${article.title} ${wikitext}`.toLowerCase();
      const suggestions: string[] = [];

      if (/software|algoritmo|sistema|computad|c[oó]digo|program|web|typescript|javascript|node/i.test(lower)) {
        suggestions.push('Ciência da computação', 'Software');
      }
      if (/brasil|brasileir|s[aã]o paulo|rio de janeiro|bras[ií]lia/i.test(lower)) {
        suggestions.push('Brasil');
      }
      if (/biografia|nasceu|faleceu|pol[ií]tico|ator|cantor|escritor|pesquisador/i.test(lower)) {
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
        botName: CategorizationBot.NAME,
        severity: 'info',
        title: 'Página sem categorias indexadas',
        details: `O artigo "${article.title}" não possui categorias enciclopédicas atribuídas.`,
        suggestion: `Categorias recomendadas: ${suggestions.join(', ')}.`,
        suggestedMarkup: `\n\n${markup}`,
        autoFixAvailable: true,
        actionTaken: 'suggested',
        detectedAt: new Date().toISOString(),
      });
    }

    return issues;
  }
}

export const categorizationBot = new CategorizationBot();
