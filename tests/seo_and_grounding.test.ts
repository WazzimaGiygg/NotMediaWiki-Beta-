import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../server/app';
import {
  PRIMARY_CANONICAL_ORIGIN,
  buildCanonicalUrl,
  buildArticleMetaDescription,
  buildArticleJsonLd,
} from '../src/utils/seoManager';
import { Article } from '../src/types';

describe('SEO Metadata, Canonical Authority (core.wazzimagiygg.com) & Search Grounding', () => {
  it('builds canonical URLs anchored on https://core.wazzimagiygg.com', () => {
    expect(buildCanonicalUrl()).toBe('https://core.wazzimagiygg.com/');
    expect(buildCanonicalUrl('MediaWiki')).toBe('https://core.wazzimagiygg.com/#/wiki/MediaWiki');
    expect(buildCanonicalUrl('Projeto WazzimaGiygg')).toBe(
      'https://core.wazzimagiygg.com/#/wiki/Projeto_WazzimaGiygg'
    );
  });

  it('strips wikitext markup and produces concise SEO meta descriptions', () => {
    const desc = buildArticleMetaDescription({
      title: 'NotMediaWiki',
      summary: '',
      wikitext:
        "{{Infobox|nome=Test}} '''NotMediaWiki''' é a [[enciclopédia|base oficial]] dos Projetos WazzimaGiygg<ref>Fonte oficial</ref>.",
    });

    expect(desc).toContain('NotMediaWiki é a base oficial dos Projetos WazzimaGiygg');
    expect(desc).not.toContain('{{');
    expect(desc).not.toContain('<ref>');
    expect(desc.length).toBeLessThanOrEqual(160);
  });

  it('generates Schema.org Article + BreadcrumbList JSON-LD pointing to core.wazzimagiygg.com', () => {
    const sampleArticle: Article = {
      id: 'art-1',
      slug: 'Projetos_WazzimaGiygg',
      title: 'Projetos WazzimaGiygg',
      namespace: 0,
      wikitext: 'Documentação oficial dos Projetos WazzimaGiygg.',
      summary: 'Portal central da enciclopédia oficial WazzimaGiygg.',
      latestRevisionId: 'rev-1',
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-17T10:00:00.000Z',
      categories: ['Institucional', 'Enciclopédia'],
      views: 150,
    };

    const jsonLd = buildArticleJsonLd(sampleArticle);
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(Array.isArray(jsonLd['@graph'])).toBe(true);

    const articleNode = jsonLd['@graph'].find((n: any) => n['@type'] === 'Article');
    const breadcrumbNode = jsonLd['@graph'].find((n: any) => n['@type'] === 'BreadcrumbList');

    expect(articleNode).toBeDefined();
    expect(articleNode.url).toBe(`${PRIMARY_CANONICAL_ORIGIN}/#/wiki/Projetos_WazzimaGiygg`);
    expect(articleNode.publisher.url).toBe(PRIMARY_CANONICAL_ORIGIN);
    expect(articleNode.inLanguage).toBe('pt-BR');

    expect(breadcrumbNode).toBeDefined();
    expect(breadcrumbNode.itemListElement[0].item).toBe(`${PRIMARY_CANONICAL_ORIGIN}/`);
  });

  it('serves dynamic XML sitemap anchored on core.wazzimagiygg.com', async () => {
    const res = await request(app).get('/sitemap.xml');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/xml');
    expect(res.headers['x-robots-tag']).toBe('all');
    expect(res.text).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(res.text).toContain('<loc>https://core.wazzimagiygg.com/</loc>');
  });

  it('validates query length on POST /api/v1/search/grounded', async () => {
    const res = await request(app).post('/api/v1/search/grounded').send({ query: 'a' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('verifies index.html and robots.txt declare core.wazzimagiygg.com authority and structured data', () => {
    const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
    const robotsTxt = fs.readFileSync(path.resolve(process.cwd(), 'public/robots.txt'), 'utf-8');

    expect(indexHtml).toContain('<link rel="canonical" href="https://core.wazzimagiygg.com/" />');
    expect(indexHtml).toContain('application/ld+json');
    expect(indexHtml).toContain('application/opensearchdescription+xml');
    expect(indexHtml).toContain('property="og:title"');
    expect(indexHtml).toContain('name="twitter:card"');

    expect(robotsTxt).toContain('Host: core.wazzimagiygg.com');
    expect(robotsTxt).toContain('Sitemap: https://core.wazzimagiygg.com/sitemap.xml');
  });
});
