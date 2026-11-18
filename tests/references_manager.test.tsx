import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  parseCitationTemplate,
  buildRefMarkup,
  extractCitationsFromWikitext,
  formatCitationAsAbnt,
  formatCitationAsApa,
  formatCitationAsBibtex,
  exportCitationsAsBibtex,
} from '../src/utils/citationParser';
import { ArticleFootnotes } from '../src/components/ArticleFootnotes';
import { ReferenceManagerModal } from '../src/components/ReferenceManagerModal';

describe('Bibliographic Reference Management System', () => {
  it('parses MediaWiki {{citar web}} and {{cite book}} templates inside <ref> tags', () => {
    const raw =
      '{{citar web|autor=Silva, Maria|título=Arquitetura Distribuída|publicado=Portal Tech|data=2025|url=https://portaltech.org/artigo}}';
    const parsed = parseCitationTemplate(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('web');
    expect(parsed?.author).toBe('Silva, Maria');
    expect(parsed?.title).toBe('Arquitetura Distribuída');
    expect(parsed?.publisher).toBe('Portal Tech');
    expect(parsed?.year).toBe('2025');
    expect(parsed?.url).toBe('https://portaltech.org/artigo');

    const book = parseCitationTemplate(
      '{{cite book|author=Knuth, Donald|title=The Art of Computer Programming|publisher=Addison-Wesley|year=1997}}'
    );
    expect(book?.type).toBe('book');
    expect(book?.author).toBe('Knuth, Donald');
    expect(book?.year).toBe('1997');
  });

  it('builds structured <ref> wikitext markup with optional name and group attributes', () => {
    const markup = buildRefMarkup({
      type: 'web',
      author: 'Pereira, Lucas',
      title: 'Guia NotMediaWiki',
      publisher: 'WazzimaGiygg',
      year: '2026',
      url: 'https://wazzimagiygg.com/guia',
      name: 'guia2026',
      group: 'notas',
    });

    expect(markup).toContain('<ref name="guia2026" group="notas">');
    expect(markup).toContain('{{citar web|');
    expect(markup).toContain('autor=Pereira, Lucas');
    expect(markup).toContain('título=Guia NotMediaWiki');
    expect(markup).toContain('url=https://wazzimagiygg.com/guia');
    expect(markup).toContain('</ref>');
  });

  it('formats extracted <ref> citations in ABNT, APA, and BibTeX styles', () => {
    const wikitext =
      'O protocolo HTTP/3 usa QUIC<ref name="rfc9114">{{citar web|autor=Bishop, Mike|título=HTTP/3|publicado=IETF|data=2022|url=https://datatracker.ietf.org/doc/html/rfc9114}}</ref>.';
    const { citations } = extractCitationsFromWikitext(wikitext);
    expect(citations).toHaveLength(1);

    const cite = citations[0];
    const abnt = formatCitationAsAbnt(cite);
    expect(abnt).toContain('BISHOP, MIKE.');
    expect(abnt).toContain('HTTP/3.');
    expect(abnt).toContain('IETF, 2022.');
    expect(abnt).toContain('Disponível em: <https://datatracker.ietf.org/doc/html/rfc9114>.');

    const apa = formatCitationAsApa(cite);
    expect(apa).toContain('Bishop, Mike (2022). HTTP/3. IETF.');

    const bibtex = formatCitationAsBibtex(cite);
    expect(bibtex).toContain('@misc{rfc9114,');
    expect(bibtex).toContain('author = {Bishop, Mike}');
    expect(bibtex).toContain('title = {HTTP/3}');
    expect(bibtex).toContain('year = {2022}');

    const exported = exportCitationsAsBibtex(citations, 'Protocolo HTTP/3');
    expect(exported).toContain('% Referências bibliográficas — Protocolo HTTP/3');
    expect(exported).toContain('@misc{rfc9114,');
  });

  it('renders ArticleFootnotes Referências footer automatically from article <ref> tags', () => {
    const wikitext = [
      'A computação quântica usa qubits<ref name="nc">{{citar livro|autor=Nielsen, M.|título=Quantum Computation|data=2010}}</ref>.',
      'Nota explicativa adicional<ref group="notas">Ver glossário interno.</ref>.',
      'Reutilização da fonte principal<ref name="nc" />.',
    ].join('\n');

    const html = renderToStaticMarkup(
      <ArticleFootnotes wikitext={wikitext} articleTitle="Computação Quântica" />
    );

    expect(html).toContain('id="references"');
    expect(html).toContain('Referências');
    expect(html).toContain('2 fontes');
    expect(html).toContain('ABNT');
    expect(html).toContain('APA');
    expect(html).toContain('BibTeX');
    expect(html).toContain('.bib');
    expect(html).toContain('Quantum Computation');
    expect(html).toContain('Ver glossário interno.');
    // Group filter buttons should appear because group="notas" is present
    expect(html).toContain('Todas (2)');
    expect(html).toContain('notas (1)');
  });

  it('does not render ArticleFootnotes when the article has no <ref> tags', () => {
    const html = renderToStaticMarkup(
      <ArticleFootnotes wikitext="Artigo simples sem nenhuma referência." />
    );
    expect(html).toBe('');
  });

  it('renders ReferenceManagerModal when open and displays existing reference count', () => {
    const wikitext = 'Texto<ref name="f1">Fonte Um</ref> e mais texto<ref>Fonte Dois</ref>.';
    const openHtml = renderToStaticMarkup(
      <ReferenceManagerModal
        isOpen={true}
        wikitext={wikitext}
        onClose={() => {}}
        onInsertMarkup={() => {}}
      />
    );
    expect(openHtml).toContain('Gestor de Referências Bibliográficas');
    expect(openHtml).toContain('Referências no Artigo (2)');
    expect(openHtml).toContain('Inserir Referência');

    const closedHtml = renderToStaticMarkup(
      <ReferenceManagerModal
        isOpen={false}
        wikitext={wikitext}
        onClose={() => {}}
        onInsertMarkup={() => {}}
      />
    );
    expect(closedHtml).toBe('');
  });
});
