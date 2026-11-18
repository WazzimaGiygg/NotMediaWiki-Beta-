import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { Breadcrumbs } from '../src/components/Breadcrumbs';
import {
  PRIMARY_CANONICAL_ORIGIN,
  buildBreadcrumbTrail,
  buildArticleJsonLd,
} from '../src/utils/seoManager';
import { Article } from '../src/types';

describe('Breadcrumbs Navigation & SEO Hierarchy Suite', () => {
  const sampleArticle: Article = {
    id: 'art-bc-1',
    slug: 'Arquitetura_Parsoid',
    title: 'Arquitetura Parsoid',
    namespace: 0,
    wikitext: 'Documentação técnica do Parsoid.',
    summary: 'Detalhes da arquitetura Parsoid no NotMediaWiki.',
    latestRevisionId: 'rev-10',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
    categories: ['Tecnologia', 'Sistemas Distribuídos', 'ExtraIgnoredInBreadcrumbs'],
    views: 310,
  };

  it('builds a canonical breadcrumb trail following Home -> Categories -> Subpages -> Article Title', () => {
    const trail = buildBreadcrumbTrail(sampleArticle, undefined, [
      { label: 'Motor Wiki', slug: 'Motor_Wiki' },
    ]);

    expect(trail.map(t => t.label)).toEqual([
      'Início',
      'Tecnologia',
      'Sistemas Distribuídos',
      'Motor Wiki',
      'Arquitetura Parsoid',
    ]);
    expect(trail.map(t => t.position)).toEqual([1, 2, 3, 4, 5]);
    expect(trail[0].href).toBe(`${PRIMARY_CANONICAL_ORIGIN}/`);
    expect(trail[1].href).toBe(`${PRIMARY_CANONICAL_ORIGIN}/#/wiki/Categoria%3ATecnologia`);
    expect(trail[4].href).toBe(`${PRIMARY_CANONICAL_ORIGIN}/#/wiki/Arquitetura_Parsoid`);
  });

  it('renders semantic Breadcrumbs markup with Schema.org BreadcrumbList microdata and aria-current', () => {
    const html = renderToStaticMarkup(
      <Breadcrumbs
        article={sampleArticle}
        categories={sampleArticle.categories}
        onNavigate={() => {}}
      />
    );

    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('itemType="https://schema.org/BreadcrumbList"');
    expect(html).toContain('itemType="https://schema.org/ListItem"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Início');
    expect(html).toContain('Tecnologia');
    expect(html).toContain('Sistemas Distribuídos');
    expect(html).toContain('Arquitetura Parsoid');
    expect(html).toContain('content="1"');
    expect(html).toContain('content="4"');
  });

  it('falls back to Enciclopédia when an article has no categories and syncs JSON-LD BreadcrumbList', () => {
    const uncategorized: Article = {
      ...sampleArticle,
      slug: 'Guia_Inicial',
      title: 'Guia Inicial',
      categories: [],
    };

    const html = renderToStaticMarkup(
      <Breadcrumbs article={uncategorized} categories={[]} onNavigate={() => {}} />
    );
    expect(html).toContain('Enciclopédia');
    expect(html).toContain('Guia Inicial');

    const jsonLd = buildArticleJsonLd(uncategorized);
    const breadcrumbNode = jsonLd['@graph'].find((n: any) => n['@type'] === 'BreadcrumbList');
    expect(breadcrumbNode.itemListElement).toHaveLength(3);
    expect(breadcrumbNode.itemListElement[1].name).toBe('Enciclopédia');
    expect(breadcrumbNode.itemListElement[2].name).toBe('Guia Inicial');
  });
});
