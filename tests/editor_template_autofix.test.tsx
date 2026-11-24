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
  templateService,
  applyTemplateSuggestionFix,
  applyAllTemplateSuggestionFixes,
  appendTemplateParameterSnippet,
} from '../src/services/templateService';
import { TemplateFixAssistantPanel } from '../src/components/TemplateFixAssistantPanel';
import { WikiEditor } from '../src/components/WikiEditor';
import { ExtensionsProvider } from '../src/context/ExtensionsContext';
import { Article } from '../src/types';

function makeCustomTemplate(name: string, wikitext: string): Article {
  const fullTitle = name.startsWith('Predefinição:') ? name : `Predefinição:${name}`;
  return {
    id: `tpl-${name.toLowerCase()}`,
    slug: fullTitle.replace(/\s+/g, '_'),
    title: fullTitle,
    namespace: 10,
    wikitext,
    summary: '',
    latestRevisionId: 'rev-1',
    createdAt: '2026-11-23T00:00:00Z',
    updatedAt: '2026-11-23T00:00:00Z',
    categories: ['Predefinições'],
    views: 1,
  };
}

describe('WikiEditor Template Key Auto-Fix Suggestions & Expected Params (templateService.ts)', () => {
  it('detects unclosed {{...}} calls (single-line, single-trailing-brace, multiline) and lists expected params', () => {
    const single = 'Texto antes.\n{{Aviso|título=Atenção}';
    const res1 = templateService.analyzeTemplateSyntaxSuggestions(single);
    expect(res1.suggestions).toHaveLength(1);
    const s1 = res1.suggestions[0];
    expect(s1.issueType).toBe('unclosed_braces');
    expect(s1.lineNumber).toBe(2);
    expect(s1.missingRequiredParams).toEqual(['texto']);
    expect(s1.expectedParams.map(p => p.name)).toEqual(['tipo', 'título', 'texto']);
    expect(s1.expectedParams.find(p => p.name === 'título')?.present).toBe(true);
    expect(s1.expectedParams.find(p => p.name === 'texto')?.present).toBe(false);
    expect(s1.suggestedSnippet).toContain('{{Aviso|título=Atenção|texto=');
    expect(s1.suggestedSnippet?.endsWith('}}')).toBe(true);

    const fixed1 = applyTemplateSuggestionFix(single, s1);
    expect(fixed1.startsWith('Texto antes.\n{{Aviso|título=Atenção|texto=')).toBe(true);
    expect(fixed1.endsWith('}}')).toBe(true);
    expect(templateService.analyzeTemplateSyntaxSuggestions(fixed1).suggestions).toHaveLength(0);

    const multi = '{{Aviso\n| tipo = aviso\n| título = Multilinha\n\nParágrafo seguinte.';
    const resMulti = templateService.analyzeTemplateSyntaxSuggestions(multi);
    expect(resMulti.suggestions).toHaveLength(1);
    const sMulti = resMulti.suggestions[0];
    expect(sMulti.suggestedSnippet).toContain('| texto = ');
    expect(sMulti.suggestedSnippet?.endsWith('\n}}')).toBe(true);
    const fixedMulti = applyTemplateSuggestionFix(multi, sMulti);
    expect(fixedMulti).toContain('\n\nParágrafo seguinte.');
    expect(templateService.analyzeTemplateSyntaxSuggestions(fixedMulti).suggestions).toHaveLength(0);
  });

  it('detects single-brace opening {Aviso|...}}, unclosed {{{param, stray }}, and trailing extra }', () => {
    const wikitext = [
      '{Aviso|título=Quase|texto=Faltou uma chave na abertura}}',
      '{{{paramSemFecho',
      'Sobra no meio }} do texto.',
      '{{Nota|título=Ok|texto=Com chave extra}}}',
    ].join('\n');

    const res = templateService.analyzeTemplateSyntaxSuggestions(wikitext);
    expect(res.suggestions.map(s => s.issueType)).toEqual([
      'unclosed_braces',
      'unclosed_braces',
      'unmatched_closing',
      'unmatched_closing',
    ]);
    expect(res.suggestions[0].suggestedSnippet).toBe(
      '{{Aviso|título=Quase|texto=Faltou uma chave na abertura}}'
    );
    expect(res.suggestions[1].suggestedSnippet).toBe('{{{paramSemFecho}}}');
    expect(res.suggestions[2].suggestedSnippet).toBe('');
    expect(res.suggestions[3].suggestedSnippet).toBe('');

    const appliedAll = applyAllTemplateSuggestionFixes(wikitext, res.suggestions);
    expect(appliedAll).toContain('{{Aviso|título=Quase|texto=Faltou uma chave na abertura}}');
    expect(appliedAll).toContain('{{{paramSemFecho}}}');
    expect(appliedAll).toContain('Sobra no meio  do texto.');
    expect(appliedAll).toContain('{{Nota|título=Ok|texto=Com chave extra}}');
    expect(appliedAll).not.toContain('Com chave extra}}}');
  });

  it('suggests canonical template names for misspelled templates and invalid characters', () => {
    const wikitext = [
      '{{Avizo|título=Corrigir nome}}',
      '{{Aviso#1|título=Limpar|texto=Tudo certo}}',
    ].join('\n');

    const res = templateService.analyzeTemplateSyntaxSuggestions(wikitext);
    expect(res.suggestions).toHaveLength(2);

    const typoFix = res.suggestions[0];
    expect(typoFix.issueType).toBe('unknown_template');
    expect(typoFix.matchedTemplateName).toBe('Aviso');
    expect(typoFix.expectedParams.map(p => p.name)).toEqual(['tipo', 'título', 'texto']);
    expect(typoFix.missingRequiredParams).toEqual(['texto']);
    expect(typoFix.suggestedSnippet).toContain('{{Aviso|título=Corrigir nome|texto=');

    const invalidNameFix = res.suggestions[1];
    expect(invalidNameFix.issueType).toBe('invalid_name');
    expect(invalidNameFix.matchedTemplateName).toBe('Aviso');
    expect(invalidNameFix.suggestedSnippet).toBe('{{Aviso|título=Limpar|texto=Tudo certo}}');

    const fixed = applyAllTemplateSuggestionFixes(wikitext, res.suggestions);
    expect(templateService.analyzeTemplateSyntaxSuggestions(fixed).suggestions).toHaveLength(0);
  });

  it('lists expected params and fixes missing required parameters for built-in and custom Namespace 10 templates', () => {
    const customModulo = makeCustomTemplate(
      'FichaProjeto',
      '<includeonly>{{Infocaixa|título={{{nome}}}|rótulo1=Versão|dados1={{{versao|1.0}}}}}</includeonly>'
    );

    const wikitext = [
      '{{Citar web|título=Manual MediaWiki}}',
      '{{FichaProjeto|versao=2.0}}',
    ].join('\n');

    const res = templateService.analyzeTemplateSyntaxSuggestions(wikitext, {
      customTemplates: [customModulo],
    });
    expect(res.suggestions).toHaveLength(2);

    const citeSuggestion = res.suggestions[0];
    expect(citeSuggestion.issueType).toBe('missing_required_param');
    expect(citeSuggestion.missingRequiredParams).toEqual(['url']);
    expect(citeSuggestion.expectedParams.map(p => p.name)).toEqual([
      'título',
      'url',
      'autor',
      'publicado',
      'data',
    ]);
    expect(citeSuggestion.suggestedSnippet).toBe(
      '{{Citar web|título=Manual MediaWiki|url=https://www.mediawiki.org/wiki/Help:Templates}}'
    );

    const customSuggestion = res.suggestions[1];
    expect(customSuggestion.issueType).toBe('missing_required_param');
    expect(customSuggestion.matchedTemplateName).toBe('FichaProjeto');
    expect(customSuggestion.missingRequiredParams).toEqual(['nome']);
    expect(customSuggestion.expectedParams).toEqual([
      expect.objectContaining({ name: 'nome', required: true, present: false }),
      expect.objectContaining({ name: 'versao', required: false, defaultValue: '1.0', present: true }),
    ]);
    expect(customSuggestion.suggestedSnippet).toBe('{{FichaProjeto|versao=2.0|nome=nome}}');
  });

  it('keeps exact offsets after protected <nowiki> / code blocks and accepts valid built-in aliases', () => {
    const wikitext = [
      '<nowiki>{{Quebrada|nao_e_erro</nowiki>',
      '{{Aviso|titulo=Sem acento válido|texto=OK}}',
      '{{Esboço|Engenharia}}',
      '{{Citar web|título=Faltando URL}}',
    ].join('\n');

    const res = templateService.analyzeTemplateSyntaxSuggestions(wikitext);
    expect(res.suggestions).toHaveLength(1);
    expect(res.suggestions[0].templateName).toBe('Citar web');
    expect(res.suggestions[0].lineNumber).toBe(4);
    expect(
      wikitext.slice(res.suggestions[0].start, res.suggestions[0].end)
    ).toBe('{{Citar web|título=Faltando URL}}');
  });

  it('provides contextual expected params at cursor position and appends parameter snippets safely', () => {
    const wikitext = 'Veja {{Infocaixa|título=NotMediaWiki}} no topo.';
    const cursorOffset = wikitext.indexOf('NotMediaWiki');

    const res = templateService.analyzeTemplateSyntaxSuggestions(wikitext, {
      cursorOffset,
    });
    expect(res.suggestions).toHaveLength(0);
    expect(res.activeCursorTemplate).not.toBeNull();
    expect(res.activeCursorTemplate?.matchedTemplateName).toBe('Infocaixa');
    expect(res.activeCursorTemplate?.expectedParams.find(p => p.name === 'título')?.present).toBe(
      true
    );
    expect(
      res.activeCursorTemplate?.expectedParams.find(p => p.name === 'subtítulo')?.present
    ).toBe(false);

    const inserted = appendTemplateParameterSnippet(
      wikitext,
      res.activeCursorTemplate!,
      res.activeCursorTemplate!.expectedParams.find(p => p.name === 'rótulo1')!
    );
    expect(inserted.nextWikitext).toBe(
      'Veja {{Infocaixa|título=NotMediaWiki|rótulo1=Autor}} no topo.'
    );
  });

  it('renders TemplateFixAssistantPanel states and WikiEditor without regression', () => {
    const sample = '{{Avizo|título=Teste}}\n{{DesconhecidaTotalmente}}';
    const analysis = templateService.analyzeTemplateSyntaxSuggestions(sample, {
      cursorOffset: 4,
    });

    const panelHtml = renderToStaticMarkup(
      <TemplateFixAssistantPanel
        suggestions={analysis.suggestions}
        activeCursorTemplate={analysis.activeCursorTemplate}
        onApplyFix={() => {}}
        onApplyAllFixes={() => {}}
        onInsertParam={() => {}}
        onLocateRange={() => {}}
        onOpenTemplateManager={() => {}}
        onClose={() => {}}
      />
    );

    expect(panelHtml).toContain('data-testid="template-fix-assistant-panel"');
    expect(panelHtml).toContain('Corrigir todas (1)');
    expect(panelHtml).toContain('Aplicar correção');
    expect(panelHtml).toContain('Criar Predefinição');
    expect(panelHtml).toContain('Parâmetros esperados (templateService.ts):');
    expect(panelHtml).toContain('título');
    expect(panelHtml).toContain('texto');
    expect(panelHtml).toContain('obrigatório');
    expect(panelHtml).toContain('No cursor:');
    expect(panelHtml).not.toContain('border-l-4');

    const cleanHtml = renderToStaticMarkup(
      <TemplateFixAssistantPanel
        suggestions={[]}
        activeCursorTemplate={null}
        onApplyFix={() => {}}
        onApplyAllFixes={() => {}}
        onInsertParam={() => {}}
        onLocateRange={() => {}}
        onClose={() => {}}
      />
    );
    expect(cleanHtml).toContain('Nenhuma chave mal formada detectada');
    expect(cleanHtml).not.toContain('border-l-4');

    const editorHtml = renderToStaticMarkup(
      <ExtensionsProvider currentUser={null}>
        <WikiEditor
          slug="Teste_Editor"
          currentUser={null}
          onSaved={() => {}}
          onCancel={() => {}}
        />
      </ExtensionsProvider>
    );
    expect(editorHtml).toContain('Loading article wikitext source...');
  });
});
