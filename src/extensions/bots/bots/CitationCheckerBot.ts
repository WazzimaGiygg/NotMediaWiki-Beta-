import { Article, BotScanResult } from '../../../types';

export interface CitationCheckerConfig {
  enabled: boolean;
  useGemini: boolean;
  sensitivity: 'baixo' | 'medio' | 'alto';
}

export const DEFAULT_CITATION_CONFIG: CitationCheckerConfig = {
  enabled: true,
  useGemini: true,
  sensitivity: 'medio',
};

const STATISTICAL_CLAIM_REGEX = /\b(\d+(?:\.\d+)?%|\bno ano de \d{4}\b|\bsegundo estudos\b|\bestatisticamente\b|\bpesquisas apontam\b)/i;

export class CitationCheckerBot {
  public static readonly ID = 'citation_bot';
  public static readonly CODE = '4.1.1.WV.1';
  public static readonly NAME = 'CitationCheckerBot';

  private config: CitationCheckerConfig;

  constructor(config: Partial<CitationCheckerConfig> = {}) {
    this.config = { ...DEFAULT_CITATION_CONFIG, ...config };
  }

  public updateConfig(updates: Partial<CitationCheckerConfig>) {
    this.config = { ...this.config, ...updates };
  }

  public getConfig(): CitationCheckerConfig {
    return this.config;
  }

  public inspect(article: Article): BotScanResult[] {
    if (!this.config.enabled) return [];
    const issues: BotScanResult[] = [];
    const wikitext = article.wikitext || '';

    const refCount = (wikitext.match(/<ref[\s>]/gi) || []).length;
    const paragraphs = wikitext
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 50 && !p.startsWith('==') && !p.startsWith('{{') && !p.startsWith('{|'));

    for (const p of paragraphs) {
      if (STATISTICAL_CLAIM_REGEX.test(p) && !p.includes('<ref')) {
        issues.push({
          id: `cite_claim_${article.slug}_${Math.random().toString(36).substring(2, 6)}`,
          articleSlug: article.slug,
          articleTitle: article.title,
          botId: 'citation_bot',
          botName: CitationCheckerBot.NAME,
          severity: 'warning',
          title: 'Afirmação factual desacompanhada de referência bibliográfica',
          details: `Trecho factual sem fonte: "${p.substring(0, 100)}..."`,
          suggestion: 'Adicionar nota bibliográfica <ref> com autor, ano e editora ou usar {{Carece de fontes}}.',
          suggestedMarkup: `${p} {{Carece de fontes}}`,
          autoFixAvailable: true,
          actionTaken: 'suggested',
          detectedAt: new Date().toISOString(),
        });
      }
    }

    if (refCount === 0 && wikitext.length > 300) {
      issues.push({
        id: `cite_zero_${article.slug}`,
        articleSlug: article.slug,
        articleTitle: article.title,
        botId: 'citation_bot',
        botName: CitationCheckerBot.NAME,
        severity: 'critical',
        title: 'Artigo completamente sem citações bibliográficas',
        details: `O artigo "${article.title}" não possui nenhuma citação <ref> para verificação dos fatos.`,
        suggestion: 'Inserir seção == Referências == com <references /> e fontes verificáveis.',
        suggestedMarkup: `\n\n== Referências ==\n<references />\n`,
        autoFixAvailable: true,
        actionTaken: 'flagged',
        detectedAt: new Date().toISOString(),
      });
    }

    return issues;
  }
}

export const citationCheckerBot = new CitationCheckerBot();
