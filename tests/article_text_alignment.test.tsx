import fs from 'node:fs';
import path from 'node:path';
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

import { ArticleViewer } from '../src/components/ArticleViewer';
import { clientParsoid } from '../src/services/parsoid';
import { parsoidService } from '../server/services/parsoid';
import { getPrintStyles } from '../src/utils/pdfDownloader';

describe('Article Text Alignment (Justified by Default, Preserving Explicit Alignment)', () => {
  it('defines @layer base justified alignment on .wiki-content while keeping headings, tables, infoboxes, code blocks, and notice templates left-aligned', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');

    expect(css).toContain('@layer base');
    expect(css).toMatch(/\.wiki-content\s*\{\s*text-align:\s*justify;\s*text-justify:\s*inter-word;\s*\}/);
    expect(css).toContain('.wiki-content :is(p, li, blockquote, .wiki-template-quote)');
    expect(css).toContain('text-align: inherit;');
    expect(css).toContain('.wiki-template:not(.wiki-template-quote)');
    expect(css).toContain('.wiki-content [align="center"]');
    expect(css).toContain('.wiki-content [align="right"]');
    expect(css).toContain('.wiki-content [align="left"]');
  });

  it('renders ArticleViewer with wiki-content and text-justify on the article container without forcing text-left/text-justify on inner <p>', () => {
    const wikitext = [
      '== Seção Principal ==',
      '',
      'Este é um parágrafo longo sem nenhum alinhamento explícito no código fonte do artigo.',
      '',
      '<p align="center">Parágrafo centralizado explícito</p>',
      '',
      '<p style="text-align: right">Parágrafo alinhado à direita</p>',
    ].join('\n');

    const html = renderToStaticMarkup(
      <ArticleViewer title="Artigo Teste" wikitext={wikitext} />
    );

    expect(html).toContain('wiki-content text-justify');
    expect(html).toContain('<p class="leading-relaxed');
    expect(html).toContain('<p align="center">Parágrafo centralizado explícito</p>');
    expect(html).toContain('<p style="text-align: right">Parágrafo alinhado à direita</p>');
    expect(html).not.toContain('<p class="leading-relaxed text-slate-800 dark:text-slate-300 mb-4 font-serif text-[16px]"><p ');
  });

  it('preserves explicit <center> and aligned blocks in clientParsoid and server Parsoid while keeping XSS sanitization strict', () => {
    const wikitext = [
      'Texto introdutório sem alinhamento.',
      '',
      '<center>Legenda centralizada</center>',
      '',
      '<div style="text-align: right; background-image: url(javascript:alert(1));" onclick="alert(1)">Bloco à direita</div>',
      '',
      '<script>alert("xss")</script>',
    ].join('\n');

    const clientRes = clientParsoid.parse(wikitext, 'Alinhamento');
    expect(clientRes.html).toContain('<p class="leading-relaxed');
    expect(clientRes.html).toContain('<center>Legenda centralizada</center>');

    const serverRes = parsoidService.parse(wikitext, 'Alinhamento');
    expect(serverRes.html).toContain('<p class="leading-relaxed');
    expect(serverRes.html).toContain('<center>Legenda centralizada</center>');
    expect(serverRes.html).toContain('text-align:right');
    expect(serverRes.html).not.toContain('javascript:');
    expect(serverRes.html).not.toContain('onclick');
    expect(serverRes.html).not.toContain('<script>');
  });

  it('applies text-justify to .notmediawiki-pdf-body while letting explicitly aligned paragraphs keep their alignment in PDF export', () => {
    const printCss = getPrintStyles();
    expect(printCss).toContain('.notmediawiki-pdf-body');
    expect(printCss).toContain('text-align: justify;');
    expect(printCss).not.toContain('text-align: justify !important;');
    expect(printCss).toContain('p:not([align]):not([style*="text-align"]):not(.text-left):not(.text-center):not(.text-right)');
  });
});
