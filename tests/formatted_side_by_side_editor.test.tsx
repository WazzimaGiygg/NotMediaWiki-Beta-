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

import {
  FORMATTED_INSERT_OPTIONS,
  wikitextToEditableHtml,
  editableHtmlToWikitext,
} from '../src/utils/wikitextRichConverter';
import { RichFormattedEditor } from '../src/components/RichFormattedEditor';
import { NewArticleModal } from '../src/components/NewArticleModal';
import { WikiEditor } from '../src/components/WikiEditor';
import { ExtensionsProvider } from '../src/context/ExtensionsContext';

describe('Formatted & Side-by-Side (Code + Formatted) Article Creation and Editing', () => {
  it('converts prose, headings, lists, links, blockquotes, tables, and alignments round-trip between Wikitext and Editable HTML', () => {
    const sourceWikitext = [
      '== Arquitetura Geral ==',
      '',
      "O '''NotMediaWiki''' usa ''Parsoid'' e `TypeScript` para [[Artigo Principal|documentação]] e [https://wazzimagiygg.com Portal].",
      '',
      '=== Tópicos ===',
      '',
      '* Item alfa',
      '* Item beta',
      '',
      '# Etapa um',
      '# Etapa dois',
      '',
      '<blockquote>Citação editorial importante.</blockquote>',
      '',
      '<p style="text-align: center">Parágrafo centralizado explícito.</p>',
      '',
      '<p style="text-align: right">Assinatura à direita.</p>',
      '',
      '{| class="wikitable"',
      '! Nome !! Papel',
      '|-',
      '| Node.js || Servidor',
      '|}',
    ].join('\n');

    const editableHtml = wikitextToEditableHtml(sourceWikitext);
    expect(editableHtml).toContain('<h2>Arquitetura Geral</h2>');
    expect(editableHtml).toContain('<strong>NotMediaWiki</strong>');
    expect(editableHtml).toContain('<em>Parsoid</em>');
    expect(editableHtml).toContain('<code');
    expect(editableHtml).toContain('data-wiki-target="Artigo Principal"');
    expect(editableHtml).toContain('data-ext-url="https://wazzimagiygg.com"');
    expect(editableHtml).toContain('<h3>Tópicos</h3>');
    expect(editableHtml).toContain('<ul><li>Item alfa</li><li>Item beta</li></ul>');
    expect(editableHtml).toContain('<ol><li>Etapa um</li><li>Etapa dois</li></ol>');
    expect(editableHtml).toContain('<blockquote>Citação editorial importante.</blockquote>');
    expect(editableHtml).toContain('text-align: center');
    expect(editableHtml).toContain('text-align: right');
    expect(editableHtml).toContain('<table class="wikitable');

    const restoredWikitext = editableHtmlToWikitext(editableHtml);
    expect(restoredWikitext).toContain('== Arquitetura Geral ==');
    expect(restoredWikitext).toContain("'''NotMediaWiki'''");
    expect(restoredWikitext).toContain("''Parsoid''");
    expect(restoredWikitext).toContain('`TypeScript`');
    expect(restoredWikitext).toContain('[[Artigo Principal|documentação]]');
    expect(restoredWikitext).toContain('[https://wazzimagiygg.com Portal]');
    expect(restoredWikitext).toContain('=== Tópicos ===');
    expect(restoredWikitext).toContain('* Item alfa\n* Item beta');
    expect(restoredWikitext).toContain('# Etapa um\n# Etapa dois');
    expect(restoredWikitext).toContain('<blockquote>Citação editorial importante.</blockquote>');
    expect(restoredWikitext).toContain('<p style="text-align: center">Parágrafo centralizado explícito.</p>');
    expect(restoredWikitext).toContain('<p style="text-align: right">Assinatura à direita.</p>');
    expect(restoredWikitext).toContain('{| class="wikitable"');
    expect(restoredWikitext).toContain('! Nome !! Papel');
    expect(restoredWikitext).toContain('| Node.js || Servidor');
    // Unaligned prose remains plain paragraphs (which receive default justified alignment on render)
    expect(restoredWikitext).not.toContain('<p style="text-align: justify">');
  });

  it('losslessly preserves Infoboxes, templates, syntaxhighlight blocks, refs, nowiki, and categories during formatted edits', () => {
    const complexWikitext = [
      '{{Infobox software\n| name = WikiZero\n| license = MIT\n}}',
      '',
      'Texto introdutório com referência.<ref>Fonte oficial (2026).</ref> <nowiki>[[Literal]]</nowiki>',
      '',
      '{{Aviso|tipo=info|título=Atenção|texto=Bloco preservado sem perda.}}',
      '',
      '<syntaxhighlight lang="ts">\nconst x = 1;\n</syntaxhighlight>',
      '',
      '[[Category:Software]]',
    ].join('\n');

    const editableHtml = wikitextToEditableHtml(complexWikitext);
    expect(editableHtml).toContain('data-wikitext-raw=');

    // Simulate user editing the plain paragraph in Formatted mode while preserving structured blocks
    const editedHtml = editableHtml.replace(
      'Texto introdutório com referência.',
      'Texto revisado no modo formatado com referência.'
    );
    const backToWikitext = editableHtmlToWikitext(editedHtml);

    expect(backToWikitext).toContain('{{Infobox software\n| name = WikiZero\n| license = MIT\n}}');
    expect(backToWikitext).toContain('Texto revisado no modo formatado com referência.<ref>Fonte oficial (2026).</ref>');
    expect(backToWikitext).toContain('<nowiki>[[Literal]]</nowiki>');
    expect(backToWikitext).toContain('{{Aviso|tipo=info|título=Atenção|texto=Bloco preservado sem perda.}}');
    expect(backToWikitext).toContain('<syntaxhighlight lang="ts">\nconst x = 1;\n</syntaxhighlight>');
    expect(backToWikitext).toContain('[[Category:Software]]');
  });

  it('provides structured FORMATTED_INSERT_OPTIONS covering headings, alignments, lists, tables, templates, and citations', () => {
    const categories = new Set(FORMATTED_INSERT_OPTIONS.map(opt => opt.category));
    expect(categories).toEqual(new Set(['estrutura', 'alinhamento', 'listas', 'blocos']));

    for (const option of FORMATTED_INSERT_OPTIONS) {
      expect(option.wikitextSnippet.trim().length).toBeGreaterThan(0);
      const html = wikitextToEditableHtml(option.wikitextSnippet.trim());
      expect(html.length).toBeGreaterThan(0);
    }
  });

  it('renders RichFormattedEditor with Inserir Formatado control and justified wiki-content surface', () => {
    const html = renderToStaticMarkup(
      <RichFormattedEditor
        wikitext={'== Título ==\n\nParágrafo inicial.'}
        onChange={() => {}}
      />
    );

    expect(html).toContain('data-testid="rich-formatted-editor"');
    expect(html).toContain('data-testid="insert-formatted-menu-btn"');
    expect(html).toContain('Inserir Formatado');
    expect(html).toContain('data-testid="rich-formatted-surface"');
    expect(html).toContain('wiki-content text-justify');
    expect(html).toContain('Parágrafo normal (alinhamento justificado por padrão)');
    expect(html).toContain('Alinhamento justificado (padrão do artigo)');
  });

  it('renders NewArticleModal with mode selector (Código + Formatado / Edição Formatada), inline composer toggle, and Namespace 10 support', () => {
    const html = renderToStaticMarkup(
      <NewArticleModal
        isOpen={true}
        onClose={() => {}}
        onCreate={() => {}}
      />
    );

    expect(html).toContain('Modo de Abertura no Editor:');
    expect(html).toContain('data-testid="new-article-mode-split-formatted"');
    expect(html).toContain('Código + Formatado');
    expect(html).toContain('data-testid="new-article-mode-formatted"');
    expect(html).toContain('Edição Formatada');
    expect(html).toContain('data-testid="toggle-new-article-formatted-composer"');
    expect(html).toContain('Inserir / Redigir Conteúdo Inicial Agora (Formatado &amp; Código Lado a Lado)');
    // Backwards compatibility with existing template namespace assertions
    expect(html).toContain('10 - Predefinição (Template)');
    expect(html).toContain('Predefinição Reutilizável (Namespace 10)');
  });

  it('wires split-formatted, formatted, Inserir Formatado, and initial props cleanly across WikiEditor and App', () => {
    const editorSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/WikiEditor.tsx'), 'utf8');
    const appSource = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');

    expect(editorSource).toContain("export type EditorViewMode = 'split-formatted' | 'formatted' | 'split' | 'edit' | 'preview'");
    expect(editorSource).toContain('data-testid="tab-split-formatted"');
    expect(editorSource).toContain('data-testid="tab-formatted"');
    expect(editorSource).toContain('data-testid="toolbar-insert-formatted-btn"');
    expect(editorSource).toContain('<RichFormattedEditor');
    expect(appSource).toContain('pendingNewArticle');
    expect(appSource).toContain('initialWikitext={pendingNewArticle?.slug === activeArticleSlug ? pendingNewArticle.wikitext : undefined}');
    expect(appSource).toContain('initialMode={pendingNewArticle?.slug === activeArticleSlug ? pendingNewArticle.editorMode : undefined}');

    const loadingHtml = renderToStaticMarkup(
      <ExtensionsProvider currentUser={null}>
        <WikiEditor
          slug="Artigo_Formatado"
          initialTitle="Artigo Formatado"
          initialWikitext="== Introdução ==\n\nTexto formatado."
          initialMode="split-formatted"
          currentUser={null}
          onSaved={() => {}}
          onCancel={() => {}}
        />
      </ExtensionsProvider>
    );
    expect(loadingHtml).toContain('Loading article wikitext source...');
  });
});
