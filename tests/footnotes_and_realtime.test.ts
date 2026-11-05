import { describe, it, expect } from 'vitest';
import { extractCitationsFromWikitext, extractCitationsFromAst, parseFootnoteTagsInHtml } from '../src/utils/citationParser';
import { clientParsoid } from '../src/services/parsoid';
import { subscribeToFirestoreArticle } from '../src/firebase';

describe('Footnotes Parser (<ref> syntax)', () => {
  it('should parse simple <ref>conteúdo</ref> syntax from wikitext into superscript links and citations', () => {
    const wikitext = 'O Brasil é um país continental<ref>IBGE Censo 2022.</ref> situado na América do Sul.';
    const result = extractCitationsFromWikitext(wikitext);

    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].index).toBe(1);
    expect(result.citations[0].rawText).toBe('IBGE Censo 2022.');
    expect(result.citations[0].noteId).toBe('cite_note-1');
    expect(result.citations[0].backlinks[0].id).toBe('cite_ref-1');
    expect(result.transformedWikitext).toContain('<sup class="reference" id="cite_ref-1"><a href="#cite_note-1"');
  });

  it('should support named references (<ref name="...">) and self-closing reuse (<ref name="..." />)', () => {
    const wikitext = 'Primeira afirmação<ref name="fonte1">Fonte Primária.</ref> e segunda afirmação<ref name="fonte1" />.';
    const result = extractCitationsFromWikitext(wikitext);

    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].index).toBe(1);
    expect(result.citations[0].rawText).toBe('Fonte Primária.');
    expect(result.citations[0].backlinks).toHaveLength(2);
    expect(result.citations[0].backlinks[0].label).toBe('a');
    expect(result.citations[0].backlinks[1].label).toBe('b');
    expect(result.transformedWikitext).toContain('cite_ref-1');
    expect(result.transformedWikitext).toContain('cite_ref-1_1');
  });

  it('should parse raw <ref> tags embedded in HTML using parseFootnoteTagsInHtml', () => {
    const rawHtml = '<p>Este parágrafo possui uma referência direta<ref>Documento Oficial 2026.</ref> anexada.</p>';
    const { html, foundRefs } = parseFootnoteTagsInHtml(rawHtml);

    expect(foundRefs).toHaveLength(1);
    expect(foundRefs[0].index).toBe(1);
    expect(foundRefs[0].text).toBe('Documento Oficial 2026.');
    expect(html).toContain('<sup class="reference" id="cite_ref-1">');
    expect(html).toContain('<a href="#cite_note-1"');
    expect(html).toContain('>[1]</a></sup>');
  });

  it('clientParsoid should transform <ref> tags into interactive superscripts and populates AST', () => {
    const wikitext = 'A teoria da relatividade<ref>[https://example.com Artigo Científico de Einstein] (1905)</ref> revolucionou a física.';
    const parsed = clientParsoid.parse(wikitext, 'Relatividade');

    expect(parsed.html).toContain('<sup class="reference" id="cite_ref-1">');
    expect(parsed.html).toContain('<a href="#cite_note-1"');
    expect(parsed.references).toHaveLength(1);
    expect(parsed.references[0]).toContain('Artigo Científico de Einstein');

    const citations = extractCitationsFromAst(parsed.ast, wikitext);
    expect(citations).toHaveLength(1);
    expect(citations[0].domain).toBe('example.com');
  });
});

describe('Firestore Real-time Article Subscription', () => {
  it('should export subscribeToFirestoreArticle function', () => {
    expect(typeof subscribeToFirestoreArticle).toBe('function');
  });
});

describe('PDF Export & Print Styling (index.css compliance)', () => {
  it('buildPrintStyledHtml should generate markup respecting index.css print rules', async () => {
    const { buildPrintStyledHtml, getPrintStyles } = await import('../src/utils/pdfDownloader');
    const mockArticle = {
      id: 'art-1',
      slug: 'Inteligencia_Artificial',
      title: 'Inteligência Artificial',
      wikitext: 'Texto wikitext...',
      namespace: 0,
      views: 120,
      latestRevisionId: 'rev-456',
    };
    const htmlContent = '<h2>Conceitos</h2><p>IA é um campo multidisciplinar.</p>';
    const footnotesHtml = '<ol><li>Primeira nota</li></ol>';
    const outputHtml = buildPrintStyledHtml(mockArticle as any, htmlContent, footnotesHtml);

    expect(outputHtml).toBeDefined();
    expect(outputHtml).toContain('notmediawiki-pdf-export-root');
    expect(outputHtml).toContain('Inteligência Artificial');
    expect(outputHtml).toContain('Revisão: rev-456');
    expect(outputHtml).toContain('notmediawiki-pdf-body');
    expect(outputHtml).toContain('IA é um campo multidisciplinar.');
    expect(outputHtml).toContain('notmediawiki-pdf-footnotes');
    expect(outputHtml).toContain('Primeira nota');
    expect(outputHtml).toContain('CC BY-SA 4.0');

    // Verify exact print CSS rules injected from src/index.css
    const styles = getPrintStyles();
    expect(styles).toContain('Georgia, Cambria, "Times New Roman"');
    expect(styles).toContain('border-collapse: collapse');
    expect(styles).toContain('#111827');
    expect(styles).toContain('#ffffff');
  });

  it('buildPrintStyledContainer throws friendly error when document is undefined', async () => {
    const { buildPrintStyledContainer } = await import('../src/utils/pdfDownloader');
    const mockArticle = { id: 'art-1', slug: 'teste', title: 'Teste', wikitext: '', namespace: 0, views: 1 };
    expect(() => buildPrintStyledContainer(mockArticle as any, '<p>teste</p>')).toThrow('document is not defined');
  });
});

