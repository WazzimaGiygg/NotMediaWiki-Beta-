import { Article } from '../data/seedData';

export interface SearchMatch {
  slug: string;
  title: string;
  namespace: number;
  snippet: string;
  score: number;
  categories: string[];
}

export class SearchService {
  // Inverted index: term -> Set of article slugs
  private index: Map<string, Set<string>> = new Map();
  private articlesMap: Map<string, Article> = new Map();

  public indexArticle(article: Article) {
    this.articlesMap.set(article.slug, article);
    const textToTokenize = `${article.title} ${article.title} ${article.summary} ${article.wikitext} ${article.categories.join(' ')}`;
    const terms = this.tokenize(textToTokenize);

    for (const term of terms) {
      if (!this.index.has(term)) {
        this.index.set(term, new Set());
      }
      this.index.get(term)!.add(article.slug);
    }
  }

  public removeArticle(slug: string) {
    this.articlesMap.delete(slug);
    for (const slugs of this.index.values()) {
      slugs.delete(slug);
    }
  }

  public query(q: string, namespace?: number): SearchMatch[] {
    if (!q || !q.trim()) return [];

    const queryTerms = this.tokenize(q);
    if (queryTerms.length === 0) return [];

    const scores: Map<string, number> = new Map();

    for (const term of queryTerms) {
      // Direct matches
      const directMatches = this.index.get(term) || new Set();
      for (const slug of directMatches) {
        scores.set(slug, (scores.get(slug) || 0) + 10);
      }

      // Fuzzy / partial matches
      for (const [indexedTerm, slugs] of this.index.entries()) {
        if (indexedTerm !== term && indexedTerm.includes(term)) {
          for (const slug of slugs) {
            scores.set(slug, (scores.get(slug) || 0) + 3);
          }
        }
      }
    }

    const results: SearchMatch[] = [];

    for (const [slug, score] of scores.entries()) {
      const article = this.articlesMap.get(slug);
      if (!article) continue;
      if (namespace !== undefined && article.namespace !== namespace) continue;

      // Bonus for exact title match
      let finalScore = score;
      if (article.title.toLowerCase() === q.toLowerCase()) {
        finalScore += 50;
      } else if (article.title.toLowerCase().includes(q.toLowerCase())) {
        finalScore += 25;
      }

      // Snippet generation
      const snippet = this.generateSnippet(article.wikitext || article.summary, queryTerms);

      results.push({
        slug: article.slug,
        title: article.title,
        namespace: article.namespace,
        snippet,
        score: finalScore,
        categories: article.categories,
      });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  public suggest(prefix: string): Array<{ title: string; slug: string }> {
    const clean = prefix.toLowerCase().trim();
    if (!clean) return [];

    const suggestions: Array<{ title: string; slug: string }> = [];
    for (const article of this.articlesMap.values()) {
      if (article.title.toLowerCase().startsWith(clean) || article.slug.toLowerCase().startsWith(clean)) {
        suggestions.push({ title: article.title, slug: article.slug });
      }
    }
    return suggestions.slice(0, 8);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  private generateSnippet(text: string, terms: string[]): string {
    const cleanText = text.replace(/[{}[\]|'=*#]/g, ' ').replace(/\s+/g, ' ');
    const lower = cleanText.toLowerCase();

    for (const term of terms) {
      const idx = lower.indexOf(term);
      if (idx !== -1) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(cleanText.length, idx + 100);
        let snip = cleanText.substring(start, end);
        if (start > 0) snip = '...' + snip;
        if (end < cleanText.length) snip = snip + '...';
        return snip;
      }
    }

    return cleanText.substring(0, 120) + '...';
  }
}

export const searchService = new SearchService();
