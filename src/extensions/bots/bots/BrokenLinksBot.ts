import { Article, BotScanResult } from '../../../types';

export interface BrokenLinksConfig {
  enabled: boolean;
  sensitivity: 'baixo' | 'medio' | 'alto';
}

export const DEFAULT_BROKEN_LINKS_CONFIG: BrokenLinksConfig = {
  enabled: true,
  sensitivity: 'medio',
};

const URL_EXTRACT_REGEX = /(https?:\/\/[^\s\]"'>]+)/gi;

export class BrokenLinksBot {
  public static readonly ID = 'link_checker_bot';
  public static readonly CODE = '4.1.1.GW.1';
  public static readonly NAME = 'BrokenLinksBot';

  private config: BrokenLinksConfig;

  constructor(config: Partial<BrokenLinksConfig> = {}) {
    this.config = { ...DEFAULT_BROKEN_LINKS_CONFIG, ...config };
  }

  public updateConfig(updates: Partial<BrokenLinksConfig>) {
    this.config = { ...this.config, ...updates };
  }

  public getConfig(): BrokenLinksConfig {
    return this.config;
  }

  public inspect(article: Article): BotScanResult[] {
    if (!this.config.enabled) return [];
    const issues: BotScanResult[] = [];
    const wikitext = article.wikitext || '';
    const matches = wikitext.match(URL_EXTRACT_REGEX) || [];

    for (const url of matches) {
      // 1. Insecure IP HTTP detection
      if (/^http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(url)) {
        issues.push({
          id: `link_ip_${article.slug}_${Math.random().toString(36).substring(2, 6)}`,
          articleSlug: article.slug,
          articleTitle: article.title,
          botId: 'link_checker_bot',
          botName: BrokenLinksBot.NAME,
          severity: 'warning',
          title: 'Link externo apontando para IP sem criptografia (HTTP)',
          details: `Ligação potencialmente insegura detectada: ${url}`,
          suggestion: 'Substituir por domínio com certificado SSL válido (HTTPS).',
          autoFixAvailable: false,
          actionTaken: 'flagged',
          detectedAt: new Date().toISOString(),
        });
      }

      // 2. Dead or mock domains
      if (url.includes('example.com') || url.includes('localhost') || url.includes('test.local')) {
        issues.push({
          id: `link_dead_${article.slug}_${Math.random().toString(36).substring(2, 6)}`,
          articleSlug: article.slug,
          articleTitle: article.title,
          botId: 'link_checker_bot',
          botName: BrokenLinksBot.NAME,
          severity: 'warning',
          title: 'Ligação externa inoperante ou de teste',
          details: `URL de demonstração encontrada no wikitext: ${url}`,
          suggestion: 'Anexar a predefinição {{Ligação inativa}} ou substituir pela URL oficial definitiva.',
          suggestedMarkup: `[${url} {{Ligação inativa}}]`,
          autoFixAvailable: true,
          actionTaken: 'suggested',
          detectedAt: new Date().toISOString(),
        });
      }
    }

    return issues;
  }
}

export const brokenLinksBot = new BrokenLinksBot();
