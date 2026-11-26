import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { Article } from '../src/types';
import {
  buildCategorySlug,
  extractCategoriesAndSortKeys,
  getCategoryPageDetails,
  groupByInitialLetter,
  normalizeCategoryName,
  parseCategoryTag,
  resolvePageSortKey,
} from '../src/utils/wikiCategories';
import { clientParsoid } from '../src/services/parsoid';
import { parsoidService } from '../server/services/parsoid';
import { CategoryPageView } from '../src/components/CategoryPageView';
import { ArticleCategories } from '../src/components/ArticleCategories';
import {
  addWikitextCategory,
  removeWikitextCategory,
} from '../src/components/PageMetadataModal';

function makeArticle(overrides: Partial<Article>): Article {
  return {
    id: overrides.id || `id-${overrides.slug || 'a'}`,
    slug: overrides.slug || 'Artigo',
    title: overrides.title || 'Artigo',
    namespace: overrides.namespace ?? 0,
    wikitext: overrides.wikitext || '',
    summary: overrides.summary || 'Resumo',
    latestRevisionId: overrides.latestRevisionId || 'rev-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    categories: overrides.categories || [],
    views: overrides.views ?? 10,
    isProtected: overrides.isProtected ?? false,
  };
}

describe('Wikipedia-style Page Categories (Categorias de Páginas)', () => {
  it('normalizes category tags, builds canonical slugs, and parses sort keys', () => {
    expect(normalizeCategoryName('Categoria:Software_Livre|Livre')).toBe('Software Livre');
    expect(buildCategorySlug('Software Livre')).toBe('Categoria:Software_Livre');
    expect(parseCategoryTag('Físicos|Einstein, Albert')).toEqual({
      name: 'Físicos',
      sortKey: 'Einstein, Albert',
    });
  });

  it('extracts categories and DEFAULTSORT while ignoring nowiki/pre and inline [[:Categoria:...]]', () => {
    const wikitext = `
Veja também [[:Categoria:História|História geral]] no texto.
<nowiki>[[Categoria:Ignorada]]</nowiki>
{{DEFAULTSORT:Silva, Joao}}
[[Categoria:Biografias]]
[[Category:Cientistas|Silva, J.]]
`;
    const { categories, defaultSort } = extractCategoriesAndSortKeys(wikitext);
    expect(defaultSort).toBe('Silva, Joao');
    expect(categories).toEqual([
      { name: 'Biografias', sortKey: undefined },
      { name: 'Cientistas', sortKey: 'Silva, J.' },
    ]);
  });

  it('adds and removes wikitext categories cleanly even when sort keys exist', () => {
    const base = 'Texto introdutório.\n[[Categoria:Física|Einstein, Albert]]';
    const added = addWikitextCategory(base, 'Nobel');
    expect(added).toContain('[[Category:Nobel]]');
    const removed = removeWikitextCategory(added, 'Física');
    expect(removed).not.toContain('Física');
    expect(removed).toContain('[[Category:Nobel]]');
  });

  it('handles sort keys, __HIDDENCAT__, and inline [[:Categoria:...]] links in client and server Parsoid', () => {
    const wt = `__HIDDENCAT__
Consulte [[:Categoria:Física|Física]] para detalhes.
[[Categoria:Ciência|A Ciência]]
[[Category:Artigos destacados| ]]`;

    const clientRes = clientParsoid.parse(wt, 'Página Teste', { skipTemplateExpansion: true });
    expect(clientRes.categories).toEqual(['Ciência', 'Artigos destacados']);
    expect(clientRes.categorySortKeys).toEqual({
      Ciência: 'A Ciência',
      'Artigos destacados': '',
    });
    expect(clientRes.pageSettings?.hiddenCat).toBe(true);
    expect(clientRes.html).toContain('href="#/wiki/Categoria%3AF%C3%ADsica"');
    expect(clientRes.html).not.toContain('__HIDDENCAT__');

    const serverRes = parsoidService.parse(wt, 'Página Teste');
    expect(serverRes.categories).toEqual(['Ciência', 'Artigos destacados']);
    expect(serverRes.html).toContain('href="#/wiki/Categoria%3AF%C3%ADsica"');
    expect(serverRes.html).not.toContain('__HIDDENCAT__');
  });

  it('groups category members alphabetically with diacritic folding and sort keys', () => {
    const a1 = makeArticle({
      slug: 'Albert_Einstein',
      title: 'Albert Einstein',
      wikitext: '{{DEFAULTSORT:Einstein, Albert}}\n[[Categoria:Física]]',
      categories: ['Física'],
    });
    const a2 = makeArticle({
      slug: 'Átomo',
      title: 'Átomo',
      wikitext: '[[Categoria:Física]]',
      categories: ['Física'],
    });

    expect(resolvePageSortKey(a1, 'Física')).toBe('Einstein, Albert');
    const grouped = groupByInitialLetter(
      [a1, a2],
      art => resolvePageSortKey(art, 'Física')
    );
    expect(grouped.map(g => g.letter)).toEqual(['A', 'E']);
    expect(grouped[0].items[0].title).toBe('Átomo');
    expect(grouped[1].items[0].title).toBe('Albert Einstein');
  });

  it('renders CategoryPageView with subcategories, A-Z grouped pages, and virtual category notice', () => {
    const articles: Article[] = [
      makeArticle({
        slug: 'Categoria:Software_Livre',
        title: 'Categoria:Software Livre',
        namespace: 14,
        wikitext: 'Software distribuído com código aberto.\n[[Categoria:Software]]',
        categories: ['Software'],
      }),
      makeArticle({
        slug: 'MediaWiki',
        title: 'MediaWiki',
        categories: ['Software'],
      }),
      makeArticle({
        slug: 'Apache_HTTP',
        title: 'Apache HTTP',
        categories: ['Software'],
      }),
      makeArticle({
        slug: 'Linux',
        title: 'Linux',
        categories: ['Software Livre'],
      }),
    ];

    const details = getCategoryPageDetails('Software', articles);
    expect(details.totalSubcategories).toBe(1);
    expect(details.totalPages).toBe(2);
    expect(details.isVirtual).toBe(true);

    const html = renderToStaticMarkup(
      <CategoryPageView
        categoryName="Software"
        allArticles={articles}
        onNavigate={vi.fn()}
        onEditCategory={vi.fn()}
        canEdit={true}
      />
    );

    expect(html).toContain('data-testid="virtual-category-notice"');
    expect(html).toContain('Subcategorias');
    expect(html).toContain('Software Livre');
    expect(html).toContain('Apache HTTP');
    expect(html).toContain('MediaWiki');
    expect(html).toContain('Criar descrição');
  });

  it('renders Wikipedia #catlinks bar with Categoria: links, hidden category section, and quick-add button', () => {
    const articles: Article[] = [
      makeArticle({
        slug: 'Categoria:Manutenção',
        title: 'Categoria:Manutenção',
        namespace: 14,
        wikitext: '__HIDDENCAT__',
      }),
      makeArticle({
        slug: 'Artigo_A',
        title: 'Artigo A',
        categories: ['Computação', 'Manutenção'],
      }),
    ];

    const html = renderToStaticMarkup(
      <ArticleCategories
        categories={['Computação', 'Manutenção']}
        allArticles={articles}
        currentSlug="Artigo_A"
        onNavigate={vi.fn()}
        canEdit={true}
        onAddCategory={vi.fn()}
      />
    );

    expect(html).toContain('id="catlinks"');
    expect(html).toContain('href="#/wiki/Categoria%3AComputa%C3%A7%C3%A3o"');
    expect(html).toContain('Categoria oculta:');
    expect(html).toContain('[mostrar 1]');
    expect(html).toContain('data-testid="quick-add-category-btn"');
  });
});
