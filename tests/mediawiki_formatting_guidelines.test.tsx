import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  GoogleAuthProvider: vi.fn(function () {
    return { setCustomParameters: vi.fn() };
  }),
  signInWithPopup: vi.fn(),
  signInWithCredential: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(() => vi.fn()),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(async () => ({ forEach: () => {} })),
  getDoc: vi.fn(),
  getDocFromServer: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  query: vi.fn(),
  limit: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

import { clientParsoid } from '../src/services/parsoid';
import {
  wikitextToEditableHtml,
  editableHtmlToWikitext,
  FORMATTED_INSERT_OPTIONS,
} from '../src/utils/wikitextRichConverter';
import { SPECIAL_CHARACTER_GROUPS, recordRecentSpecialChar } from '../src/data/specialCharactersCatalog';
import {
  PageMetadataModal,
  extractWikitextMetadata,
  toggleWikitextMagicWord,
  addWikitextCategory,
  removeWikitextCategory,
  addInterwikiLink,
  removeInterwikiLink,
  upsertMagicDirective,
} from '../src/components/PageMetadataModal';
import {
  applyLineIndentToWikitext,
  toggleWikitextBlockHierarchy,
  applyFindAndReplace,
} from '../src/components/WikiEditor';
import { RichFormattedEditor } from '../src/components/RichFormattedEditor';

describe('MediaWiki Full Formatting & Structure Guidelines Coverage', () => {
  it('supports H1-H6 headings, <pre>, <blockquote>, and inline u/s/sup/sub round-trip in converter & Parsoid', () => {
    const wt = [
      '= Título da Página =',
      '== Cabeçalho ==',
      '=== Subtítulo 1 ===',
      '==== Subtítulo 2 ====',
      '===== Subtítulo 3 =====',
      '====== Subtítulo 4 ======',
      '<pre>\nlinha   pré-formatada\n</pre>',
      '<blockquote>Citação longa editorial</blockquote>',
      "Texto com '''negrito''', ''itálico'', <u>sublinhado</u>, <s>tachado</s>, x<sup>2</sup> e H<sub>2</sub>O.",
    ].join('\n\n');

    const editable = wikitextToEditableHtml(wt);
    expect(editable).toContain('<h1>Título da Página</h1>');
    expect(editable).toContain('<h2>Cabeçalho</h2>');
    expect(editable).toContain('<h3>Subtítulo 1</h3>');
    expect(editable).toContain('<h4>Subtítulo 2</h4>');
    expect(editable).toContain('<h5>Subtítulo 3</h5>');
    expect(editable).toContain('<h6>Subtítulo 4</h6>');
    expect(editable).toContain('<pre data-pre-block="true"');
    expect(editable).toContain('<u>sublinhado</u>');
    expect(editable).toContain('<s>tachado</s>');
    expect(editable).toContain('<sup>2</sup>');
    expect(editable).toContain('<sub>2</sub>');

    const back = editableHtmlToWikitext(editable);
    expect(back).toContain('= Título da Página =');
    expect(back).toContain('== Cabeçalho ==');
    expect(back).toContain('=== Subtítulo 1 ===');
    expect(back).toContain('==== Subtítulo 2 ====');
    expect(back).toContain('===== Subtítulo 3 =====');
    expect(back).toContain('====== Subtítulo 4 ======');
    expect(back).toContain('<pre>\nlinha   pré-formatada\n</pre>');
    expect(back).toContain('<u>sublinhado</u>');
    expect(back).toContain('<s>tachado</s>');
    expect(back).toContain('<sup>2</sup>');
    expect(back).toContain('<sub>2</sub>');

    const parsed = clientParsoid.parse(wt, 'Diretrizes');
    expect(parsed.html).toContain('<h1 ');
    expect(parsed.html).toContain('<h5 ');
    expect(parsed.html).toContain('<h6 ');
    expect(parsed.html).toContain('<u>sublinhado</u>');
    expect(parsed.html).toContain('<s>tachado</s>');
  });

  it('parses all Section 5 insertable blocks securely and hides editorial HTML comments', () => {
    const wt = [
      'Texto público <!-- nota interna secreta --> visível.',
      '[[File:https://example.org/diagram.png|thumb|Diagrama arquitetural]]',
      '<gallery>\nhttps://example.org/a.png|Figura A\nFile:Local_fig.png|Figura B\n</gallery>',
      '<hiero>A1-B1-N35</hiero>',
      '<score>\\relative c\' { c4 d e f }</score>',
      '<chem>2H2 + O2 -> 2H2O</chem>',
      '<math>E = mc^2 + \\frac{p^2}{2m}</math>',
      '<mapframe latitude="-23.55" longitude="-46.63" zoom="12" text="São Paulo" />',
      '<graph>{"title": "Crescimento"}</graph>',
      'Assinado por ~~~~',
      '__NOTOC__',
      '[[en:Wiki Formatting]]',
    ].join('\n\n');

    const parsed = clientParsoid.parse(wt, 'Artigo Rico');
    expect(parsed.html).not.toContain('nota interna secreta');
    expect(parsed.html).toContain('Texto público  visível.');
    expect(parsed.html).toContain('class="wiki-media');
    expect(parsed.html).toContain('Diagrama arquitetural');
    expect(parsed.html).toContain('data-wiki-block="gallery"');
    expect(parsed.html).toContain('data-wiki-block="hiero"');
    expect(parsed.html).toContain('data-wiki-block="score"');
    expect(parsed.html).toContain('data-wiki-block="chem"');
    expect(parsed.html).toContain('2H<sub>2</sub>O');
    expect(parsed.html).toContain('data-wiki-block="math"');
    expect(parsed.html).toContain('data-wiki-block="mapframe"');
    expect(parsed.html).toContain('data-wiki-block="graph"');
    expect(parsed.html).toContain('class="wiki-signature');
    expect(parsed.pageSettings?.noToc).toBe(true);
    expect(parsed.interwikiLinks).toEqual([{ lang: 'en', title: 'Wiki Formatting' }]);

    // Lossless preservation in Formatted editor round-trip
    const editable = wikitextToEditableHtml(wt);
    const back = editableHtmlToWikitext(editable);
    expect(back).toContain('<!-- nota interna secreta -->');
    expect(back).toContain('<hiero>A1-B1-N35</hiero>');
    expect(back).toContain('<chem>2H2 + O2 -> 2H2O</chem>');
    expect(back).toContain('<math>E = mc^2 + \\frac{p^2}{2m}</math>');
    expect(back).toContain('[[en:Wiki Formatting]]');
    expect(back).toContain('__NOTOC__');

    // XSS escape check inside math, hiero, and gallery
    const xss = clientParsoid.parse('<math><script>alert(1)</script></math>\n\n<hiero><img onerror=alert(2)></hiero>');
    expect(xss.html).not.toContain('<script>alert(1)</script>');
    expect(xss.html).not.toContain('<img onerror=alert(2)>');
  });

  it('includes all 29 script categories + recent special characters tracking', () => {
    const expectedIds = [
      'symbols',
      'latin',
      'ipa',
      'greek',
      'cyrillic',
      'arabic',
      'arabic-extended',
      'hebrew',
      'armenian',
      'georgian',
      'devanagari',
      'bengali',
      'gurmukhi',
      'gujarati',
      'oriya',
      'tamil',
      'telugu',
      'kannada',
      'malayalam',
      'sinhala',
      'thai',
      'lao',
      'tibetan',
      'myanmar',
      'khmer',
      'ethiopic',
      'canadian-aboriginal',
      'cherokee',
      'tifinagh',
    ];
    const actualIds = new Set(SPECIAL_CHARACTER_GROUPS.map(g => g.id));
    for (const id of expectedIds) {
      expect(actualIds.has(id as any)).toBe(true);
    }

    const r1 = recordRecentSpecialChar('Ω', 'Ômega', []);
    const r2 = recordRecentSpecialChar('ə', 'Schwa', r1);
    const r3 = recordRecentSpecialChar('Ω', 'Ômega', r2);
    expect(r3.map(x => x.char)).toEqual(['Ω', 'ə']);
  });

  it('supports Ctrl+0..8 block hierarchy, Tab/Shift+Tab indent/outdent, and Ctrl+F find/replace helpers', () => {
    const h2 = toggleWikitextBlockHierarchy('Seção Teste', 2, '2');
    expect(h2.nextText).toBe('== Seção Teste ==');
    const h5 = toggleWikitextBlockHierarchy(h2.nextText, 4, '5');
    expect(h5.nextText).toBe('===== Seção Teste =====');
    const para = toggleWikitextBlockHierarchy(h5.nextText, 4, '0');
    expect(para.nextText).toBe('Seção Teste');
    const quote = toggleWikitextBlockHierarchy(para.nextText, 2, '8');
    expect(quote.nextText).toBe('<blockquote>Seção Teste</blockquote>');

    const indentedList = applyLineIndentToWikitext('* Item 1\n* Item 2', 2, 12, 'indent');
    expect(indentedList.nextText).toBe('** Item 1\n** Item 2');
    const outdentedList = applyLineIndentToWikitext(indentedList.nextText, 2, 12, 'outdent');
    expect(outdentedList.nextText).toBe('* Item 1\n* Item 2');

    const replaced = applyFindAndReplace('Wiki é bom. wiki funciona.', 'wiki', 'MediaWiki', {
      matchCase: false,
      replaceAll: true,
    });
    expect(replaced.count).toBe(2);
    expect(replaced.nextText).toBe('MediaWiki é bom. MediaWiki funciona.');
  });

  it('manages Page Metadata (Categories, Page Settings, Advanced Directives, Languages) and renders RichFormattedEditor + PageMetadataModal', () => {
    let doc = 'Conteúdo inicial.';
    doc = addWikitextCategory(doc, 'Enciclopédia');
    doc = toggleWikitextMagicWord(doc, '__NOTOC__', true);
    doc = upsertMagicDirective(doc, 'DISPLAYTITLE', 'NotMediaWiki Pro');
    doc = upsertMagicDirective(doc, 'DEFAULTSORT', 'NotMediaWiki');
    doc = addInterwikiLink(doc, 'en', 'NotMediaWiki');

    const snap = extractWikitextMetadata(doc);
    expect(snap.categories).toEqual(['Enciclopédia']);
    expect(snap.magicWords.noToc).toBe(true);
    expect(snap.displayTitle).toBe('NotMediaWiki Pro');
    expect(snap.defaultSort).toBe('NotMediaWiki');
    expect(snap.interwikiLinks).toEqual([{ lang: 'en', title: 'NotMediaWiki' }]);

    doc = removeWikitextCategory(doc, 'Enciclopédia');
    doc = removeInterwikiLink(doc, 'en');
    const snapAfter = extractWikitextMetadata(doc);
    expect(snapAfter.categories).toEqual([]);
    expect(snapAfter.interwikiLinks).toEqual([]);

    const modalHtml = renderToStaticMarkup(
      <PageMetadataModal
        isOpen={true}
        wikitext={doc}
        pageTitle="Artigo"
        onUpdateWikitext={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(modalHtml).toContain('data-testid="page-metadata-modal"');
    expect(modalHtml).toContain('Categorias');
    expect(modalHtml).toContain('Configurações da página');
    expect(modalHtml).toContain('Configurações avançadas');
    expect(modalHtml).toContain('Idiomas');
    expect(modalHtml).toContain('Predefinições usadas');

    const richHtml = renderToStaticMarkup(
      <RichFormattedEditor wikitext="== Seção ==" onChange={vi.fn()} />
    );
    expect(richHtml).toContain('data-testid="rich-hierarchy-menu-btn"');
    expect(richHtml).toContain('Sublinhado');
    expect(richHtml).toContain('Tachado');
    expect(richHtml).toContain('Sobrescrito');
    expect(richHtml).toContain('Subscrito');
    expect(richHtml).toContain('Limpar formatação');
    expect(richHtml).toContain('Diminuir recuo (Shift+Tab)');
    expect(richHtml).toContain('Aumentar recuo (Tab)');

    expect(FORMATTED_INSERT_OPTIONS.some(o => o.id === 'hiero')).toBe(true);
    expect(FORMATTED_INSERT_OPTIONS.some(o => o.id === 'score')).toBe(true);
    expect(FORMATTED_INSERT_OPTIONS.some(o => o.id === 'chem-formula')).toBe(true);
    expect(FORMATTED_INSERT_OPTIONS.some(o => o.id === 'math-formula')).toBe(true);
    expect(FORMATTED_INSERT_OPTIONS.some(o => o.id === 'mapframe')).toBe(true);
    expect(FORMATTED_INSERT_OPTIONS.some(o => o.id === 'graph')).toBe(true);
  });
});
