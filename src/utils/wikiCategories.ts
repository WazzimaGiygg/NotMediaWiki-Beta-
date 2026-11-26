import { Article } from '../types';
import { parseTitle } from './namespaces';

/**
 * Mapeamento de relações pai-filho convencionais de enciclopédia (pt/en),
 * complementado dinamicamente por tags [[Categoria:Pai]] nas próprias páginas Categoria:.
 */
export const CATEGORY_HIERARCHY_PARENTS: Record<string, string> = {
  'Software Livre': 'Software',
  'Free software': 'Software',
  'Software de Wiki': 'Software',
  'Wiki software': 'Software',
  'Node.js software': 'Software',
  'Server software': 'Software',
  'Software architecture': 'Computação',
  'Arquitetura de software': 'Computação',
  'Sistemas Operacionais': 'Computação',
  'Sistemas distribuídos': 'Computação',
  'Distributed computing': 'Computação',
  'Computer systems': 'Computação',
  'Linguagens de Programação': 'Ciência da Computação',
  'JavaScript': 'Linguagens de Programação',
  'Inteligência Artificial': 'Ciência da Computação',
  'Algoritmos': 'Ciência da Computação',
  'Parsers': 'Wikimedia technology',
  'Wikimedia technology': 'Wikimedia Foundation',
  'História do Brasil': 'Brasil',
  'Geografia do Brasil': 'Brasil',
  'Física Quântica': 'Física',
  'Astrofísica': 'Física',
};

export interface ParsedCategoryTag {
  name: string;
  sortKey?: string;
}

export interface CategoryIndexEntry {
  key: string; // normalized lowercase key
  displayName: string;
  slug: string;
  categoryArticle?: Article;
  isHidden: boolean;
  memberArticles: Article[];
  subcategoryKeys: Set<string>;
  parentNames: string[];
}

export interface CategoryMemberPageItem {
  article: Article;
  sortKey: string;
}

export interface CategorySubcategoryItem {
  name: string;
  slug: string;
  sortKey: string;
  pageCount: number;
  subCount: number;
  exists: boolean;
  isHidden: boolean;
  summary?: string;
}

export interface LetterGroup<T> {
  letter: string;
  items: T[];
}

export interface CategoryPageDetails {
  categoryName: string;
  slug: string;
  categoryArticle?: Article;
  isVirtual: boolean;
  isHidden: boolean;
  parentCategories: string[];
  subcategories: CategorySubcategoryItem[];
  subcategoryGroups: LetterGroup<CategorySubcategoryItem>[];
  pages: CategoryMemberPageItem[];
  pageGroups: LetterGroup<CategoryMemberPageItem>[];
  totalSubcategories: number;
  totalPages: number;
}

/**
 * Normaliza o nome de uma categoria removendo prefixo de namespace, sortKey e underscores.
 */
export function normalizeCategoryName(raw: string): string {
  const withoutSort = (raw || '').split('|')[0] || '';
  return withoutSort
    .trim()
    .replace(/^:?(?:Categoria|Category):/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function categoryCanonicalKey(raw: string): string {
  return normalizeCategoryName(raw).toLowerCase();
}

/**
 * Constrói o slug canônico MediaWiki (Namespace 14) para uma categoria.
 */
export function buildCategorySlug(categoryName: string): string {
  const clean = normalizeCategoryName(categoryName);
  return `Categoria:${clean.replace(/\s+/g, '_')}`;
}

/**
 * Faz o parse do conteúdo interno de [[Categoria:Nome|ChaveDeOrdenação]].
 */
export function parseCategoryTag(rawInner: string): ParsedCategoryTag {
  const pipeIdx = (rawInner || '').indexOf('|');
  if (pipeIdx === -1) {
    return { name: normalizeCategoryName(rawInner) };
  }
  const rawName = rawInner.slice(0, pipeIdx);
  const rawSort = rawInner.slice(pipeIdx + 1);
  return {
    name: normalizeCategoryName(rawName),
    sortKey: rawSort.trim(),
  };
}

/**
 * Verifica se o wikitexto de uma página de categoria marca __HIDDENCAT__.
 */
export function isHiddenCategoryWikitext(wikitext?: string): boolean {
  if (!wikitext) return false;
  return /__HIDDENCAT__|\{\{\s*(?:Categoria\s+oculta|Hidden\s+category|HIDDENCAT)\s*\}\}/i.test(
    wikitext
  );
}

function stripMaskedCodeForCategoryScan(wikitext: string): string {
  return (wikitext || '')
    .replace(/<nowiki>[\s\S]*?<\/nowiki>/gi, '')
    .replace(/<(?:syntaxhighlight|source)(?:\s+[^>]*)?>[\s\S]*?<\/(?:syntaxhighlight|source)>/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<pre(?:\s+[^>]*)?>[\s\S]*?<\/pre>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Extrai categorias (ignorando links inline [[:Categoria:...]]) e {{DEFAULTSORT:...}} de um wikitexto.
 */
export function extractCategoriesAndSortKeys(wikitext: string): {
  categories: ParsedCategoryTag[];
  defaultSort?: string;
} {
  const cleaned = stripMaskedCodeForCategoryScan(wikitext);
  const defaultSortMatch = cleaned.match(/\{\{\s*DEFAULTSORT\s*:([^}]+)\}\}/i);
  const defaultSort = defaultSortMatch ? defaultSortMatch[1].trim() : undefined;

  const categories: ParsedCategoryTag[] = [];
  const seen = new Set<string>();
  const regex = /\[\[\s*(Category|Categoria):([^\]]+)\]\]/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleaned)) !== null) {
    const parsed = parseCategoryTag(match[2]);
    if (!parsed.name) continue;
    const key = parsed.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      categories.push(parsed);
    }
  }

  return { categories, defaultSort };
}

/**
 * Resolve a chave de ordenação efetiva de um artigo dentro de uma categoria alvo.
 */
export function resolvePageSortKey(article: Article, targetCategoryName: string): string {
  const targetKey = categoryCanonicalKey(targetCategoryName);
  const { categories, defaultSort } = extractCategoriesAndSortKeys(article.wikitext || '');

  const explicit = categories.find(c => c.name.toLowerCase() === targetKey);
  if (explicit?.sortKey !== undefined && explicit.sortKey !== '') {
    return explicit.sortKey;
  }

  if (defaultSort) {
    return defaultSort;
  }

  const parsedTitle = parseTitle(article.title || article.slug);
  if (parsedTitle.namespaceId === 14) {
    return parsedTitle.baseTitle || article.title;
  }

  return article.title || article.slug;
}

/**
 * Determina o cabeçalho de índice alfabético ao estilo Wikipédia (*, 0-9, A-Z).
 */
export function getInitialBucket(sortKey: string): string {
  const trimmed = (sortKey || '').trim();
  if (!trimmed) return '*';

  const firstChar = trimmed.charAt(0);
  if (/[0-9]/.test(firstChar)) return '0–9';

  const normalized = firstChar
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (/[A-Z]/.test(normalized)) {
    return normalized;
  }

  return '*';
}

/**
 * Ordena e agrupa itens por letra inicial (como nas páginas de categoria da Wikipédia).
 */
export function groupByInitialLetter<T>(
  items: T[],
  getSortKey: (item: T) => string
): LetterGroup<T>[] {
  const sorted = [...items].sort((a, b) => {
    const keyA = getSortKey(a);
    const keyB = getSortKey(b);
    return keyA.localeCompare(keyB, 'pt-BR', { sensitivity: 'base', numeric: true });
  });

  const buckets = new Map<string, T[]>();
  for (const item of sorted) {
    const bucket = getInitialBucket(getSortKey(item));
    if (!buckets.has(bucket)) {
      buckets.set(bucket, []);
    }
    buckets.get(bucket)!.push(item);
  }

  const bucketKeys = Array.from(buckets.keys()).sort((a, b) => {
    if (a === '*') return -1;
    if (b === '*') return 1;
    if (a === '0–9') return -1;
    if (b === '0–9') return 1;
    return a.localeCompare(b, 'pt-BR');
  });

  return bucketKeys.map(letter => ({
    letter,
    items: buckets.get(letter)!,
  }));
}

/**
 * Retorna a lista efetiva de categorias de um artigo (combinando wikitexto e array persistido).
 */
export function getEffectiveArticleCategories(article: Article): string[] {
  const fromWikitext = extractCategoriesAndSortKeys(article.wikitext || '').categories.map(c => c.name);
  const fromField = (article.categories || []).map(normalizeCategoryName).filter(Boolean);

  const merged: string[] = [];
  const seen = new Set<string>();
  for (const cat of [...fromWikitext, ...fromField]) {
    const key = cat.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(cat);
    }
  }
  return merged;
}

/**
 * Constrói o índice completo de categorias, membros e hierarquia pai/filho de toda a wiki.
 */
export function buildCategoryIndex(allArticles: Article[]): Map<string, CategoryIndexEntry> {
  const index = new Map<string, CategoryIndexEntry>();

  const ensureEntry = (rawName: string): CategoryIndexEntry | null => {
    const displayName = normalizeCategoryName(rawName);
    if (!displayName) return null;
    const key = displayName.toLowerCase();
    if (!index.has(key)) {
      index.set(key, {
        key,
        displayName,
        slug: buildCategorySlug(displayName),
        isHidden: false,
        memberArticles: [],
        subcategoryKeys: new Set<string>(),
        parentNames: [],
      });
    }
    return index.get(key)!;
  };

  // 1. Registrar páginas explícitas do namespace 14 (Categoria: / Category:)
  for (const art of allArticles) {
    const parsed = parseTitle(art.slug || art.title);
    if (parsed.namespaceId === 14) {
      const entry = ensureEntry(parsed.baseTitle);
      if (entry) {
        entry.categoryArticle = art;
        entry.displayName = parsed.baseTitle.trim() || entry.displayName;
        entry.isHidden = isHiddenCategoryWikitext(art.wikitext);
      }
    }
  }

  // 2. Registrar associações de artigos e subcategorias
  for (const art of allArticles) {
    const parsed = parseTitle(art.slug || art.title);
    const effectiveCats = getEffectiveArticleCategories(art);

    if (parsed.namespaceId === 14) {
      const childEntry = ensureEntry(parsed.baseTitle);
      if (!childEntry) continue;

      for (const parentCat of effectiveCats) {
        const parentEntry = ensureEntry(parentCat);
        if (parentEntry && parentEntry.key !== childEntry.key) {
          parentEntry.subcategoryKeys.add(childEntry.key);
          if (!childEntry.parentNames.some(p => p.toLowerCase() === parentEntry.key)) {
            childEntry.parentNames.push(parentEntry.displayName);
          }
        }
      }
    } else {
      for (const cat of effectiveCats) {
        const entry = ensureEntry(cat);
        if (entry && !entry.memberArticles.some(a => a.slug === art.slug)) {
          entry.memberArticles.push(art);
        }
      }
    }
  }

  // 3. Aplicar relações convencionais conhecidas para categorias que existem na wiki
  for (const entry of Array.from(index.values())) {
    const mappedParent =
      CATEGORY_HIERARCHY_PARENTS[entry.displayName] ||
      Object.entries(CATEGORY_HIERARCHY_PARENTS).find(
        ([child]) => child.toLowerCase() === entry.key
      )?.[1];

    if (mappedParent && entry.parentNames.length === 0) {
      const parentEntry = ensureEntry(mappedParent);
      if (parentEntry && parentEntry.key !== entry.key) {
        parentEntry.subcategoryKeys.add(entry.key);
        entry.parentNames.push(parentEntry.displayName);
      }
    }
  }

  return index;
}

/**
 * Gera todos os dados estruturados para exibir uma página Categoria:<Nome> no estilo Wikipédia.
 */
export function getCategoryPageDetails(
  rawCategoryName: string,
  allArticles: Article[]
): CategoryPageDetails {
  const categoryName = normalizeCategoryName(rawCategoryName);
  const key = categoryName.toLowerCase();
  const index = buildCategoryIndex(allArticles);
  const currentEntry = index.get(key);

  const subcategories: CategorySubcategoryItem[] = [];
  if (currentEntry) {
    for (const subKey of currentEntry.subcategoryKeys) {
      const subEntry = index.get(subKey);
      if (!subEntry) continue;
      const sortKey = subEntry.categoryArticle
        ? resolvePageSortKey(subEntry.categoryArticle, categoryName)
        : subEntry.displayName;

      subcategories.push({
        name: subEntry.displayName,
        slug: subEntry.slug,
        sortKey,
        pageCount: subEntry.memberArticles.length,
        subCount: subEntry.subcategoryKeys.size,
        exists: Boolean(subEntry.categoryArticle && subEntry.categoryArticle.latestRevisionId !== 'virtual-category'),
        isHidden: subEntry.isHidden,
        summary: subEntry.categoryArticle?.summary,
      });
    }
  }

  const pages: CategoryMemberPageItem[] = (currentEntry?.memberArticles || []).map(article => ({
    article,
    sortKey: resolvePageSortKey(article, categoryName),
  }));

  const categoryArticle =
    currentEntry?.categoryArticle &&
    currentEntry.categoryArticle.latestRevisionId !== 'virtual-category'
      ? currentEntry.categoryArticle
      : undefined;

  return {
    categoryName: currentEntry?.displayName || categoryName,
    slug: buildCategorySlug(currentEntry?.displayName || categoryName),
    categoryArticle,
    isVirtual: !categoryArticle,
    isHidden: currentEntry?.isHidden || false,
    parentCategories: currentEntry?.parentNames || [],
    subcategories,
    subcategoryGroups: groupByInitialLetter(subcategories, item => item.sortKey),
    pages,
    pageGroups: groupByInitialLetter(pages, item => item.sortKey),
    totalSubcategories: subcategories.length,
    totalPages: pages.length,
  };
}
