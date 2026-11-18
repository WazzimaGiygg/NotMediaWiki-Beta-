import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import {
  extractHeadingsFromHtml,
  groupHeadings,
  slugifyHeading,
} from '../src/utils/tocParser';
import { TableOfContents } from '../src/components/TableOfContents';

describe('TableOfContents (TOC) H2/H3 Extraction & Anchor Links Suite', () => {
  const longArticleHtml = `
    <h1>Título Principal Ignorado</h1>
    <h2 id="introducao">Introdução</h2>
    <p>Parágrafo inicial.</p>
    <h3>Contexto Histórico</h3>
    <p>Detalhes históricos.</p>
    <h3>Objetivos Principais #</h3>
    <p>Objetivos.</p>
    <h2>Arquitetura do Sistema</h2>
    <h3 id="parsoid-ast">Parsoid AST</h3>
    <h3>Objetivos Principais</h3>
    <h4>Subnível 4 Ignorado</h4>
    <h2 id="conclusao">Conclusão</h2>
  `;

  it('extracts H2 and H3 headings with hierarchical numbering and unique anchor IDs', () => {
    const headings = extractHeadingsFromHtml(longArticleHtml);

    expect(headings).toEqual([
      { id: 'introducao', level: 2, text: 'Introdução', number: '1' },
      { id: 'contexto-historico', level: 3, text: 'Contexto Histórico', number: '1.1' },
      { id: 'objetivos-principais', level: 3, text: 'Objetivos Principais', number: '1.2' },
      { id: 'arquitetura-do-sistema', level: 2, text: 'Arquitetura do Sistema', number: '2' },
      { id: 'parsoid-ast', level: 3, text: 'Parsoid AST', number: '2.1' },
      { id: 'objetivos-principais-1', level: 3, text: 'Objetivos Principais', number: '2.2' },
      { id: 'conclusao', level: 2, text: 'Conclusão', number: '3' },
    ]);

    expect(slugifyHeading('Governança & Ética (LGPD)')).toBe('governanca-etica-lgpd');
  });

  it('groups H3 subsections under their parent H2 headings', () => {
    const headings = extractHeadingsFromHtml(longArticleHtml);
    const groups = groupHeadings(headings);

    expect(groups).toHaveLength(3);
    expect(groups[0].parent.text).toBe('Introdução');
    expect(groups[0].subSections.map(s => s.text)).toEqual([
      'Contexto Histórico',
      'Objetivos Principais',
    ]);
    expect(groups[1].parent.text).toBe('Arquitetura do Sistema');
    expect(groups[1].subSections).toHaveLength(2);
    expect(groups[2].parent.text).toBe('Conclusão');
    expect(groups[2].subSections).toHaveLength(0);
  });

  it('renders TableOfContents with anchor links, search filter for long articles, and sticky sidebar styling', () => {
    const ref = { current: null };
    const html = renderToStaticMarkup(
      <TableOfContents contentRef={ref} html={longArticleHtml} variant="sidebar" />
    );

    expect(html).toContain('aria-label="Tabela de Conteúdos"');
    expect(html).toContain('href="#introducao"');
    expect(html).toContain('href="#contexto-historico"');
    expect(html).toContain('href="#arquitetura-do-sistema"');
    expect(html).toContain('href="#parsoid-ast"');
    expect(html).toContain('href="#conclusao"');
    expect(html).toContain('Filtrar seções (H2, H3)...');
    expect(html).toContain('lg:sticky');
  });

  it('returns null when article has no H2 or H3 headings', () => {
    const ref = { current: null };
    const html = renderToStaticMarkup(
      <TableOfContents contentRef={ref} html="<p>Artigo curto sem seções.</p>" />
    );
    expect(html).toBe('');
  });
});
