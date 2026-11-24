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
import { TemplateDebugInspector } from '../src/components/TemplateDebugInspector';
import { clientParsoid } from '../src/services/parsoid';
import { expandWikitextTemplates } from '../src/utils/templateEngine';
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

describe('ArticleViewer Reading-Mode Template Debug Highlighting', () => {
  it('highlights unclosed {{ and {{{ braces, stray closing }}, and invalid template names in ArticleViewer', () => {
    const wikitext = [
      'Parágrafo com chave não fechada: {{Aviso|tipo=aviso|título=Sem Fechamento',
      '',
      'Parágrafo com parâmetro aberto: {{{parametroAberto',
      '',
      'Chave solta no texto }} e fechamento triplo }}}. ',
      '',
      'Nome inválido {{Caixa#Proibida}} e vazio {{}}.',
      '',
      'Bloco válido após erros: {{Aviso|tipo=info|título=Ainda funciona|texto=Tudo preservado.}}',
    ].join('\n');

    const html = renderToStaticMarkup(
      <ArticleViewer title="Teste de Sintaxe" wikitext={wikitext} />
    );

    expect(html).toContain('data-testid="template-debug-inspector"');
    expect(html).toContain('wiki-template-invalid-braces');
    expect(html).toContain('decoration-wavy');
    expect(html).toContain('data-template-issue="unclosed_braces"');
    expect(html).toContain('data-template-issue="unmatched_closing"');
    expect(html).toContain('data-template-issue="invalid_name"');
    expect(html).toContain('{{Aviso|tipo&#61;aviso|título&#61;Sem Fechamento');
    expect(html).toContain('{{{parametroAberto');
    expect(html).toContain('Caixa#Proibida');
    // Valid block afterwards still renders normally
    expect(html).toContain('Ainda funciona');
    expect(html).toContain('Tudo preservado.');
  });

  it('highlights unresolved {{{param}}} keys in articles and custom Namespace 10 transclusions', () => {
    const fichaTemplate = makeCustomTemplate(
      'FichaTeste',
      '<includeonly>{{Infocaixa|título={{{projeto|Projeto}}}|rótulo1=Autor|dados1={{{autor}}}|rótulo2=Versão|dados2={{{versao}}}}}</includeonly>'
    );

    const html = renderToStaticMarkup(
      <ArticleViewer
        title="Artigo com Parâmetros Ausentes"
        customTemplates={[fichaTemplate]}
        wikitext={[
          'Chamada sem parametros obrigatórios: {{FichaTeste|projeto=Atlas}}',
          '',
          'Placeholder solto no artigo: {{{campoFaltante}}}',
        ].join('\n')}
      />
    );

    expect(html).toContain('data-testid="template-debug-inspector"');
    expect(html).toContain('wiki-template-missing-param');
    expect(html).toContain('data-template-issue="unresolved_param"');
    expect(html).toContain('data-missing-param="autor"');
    expect(html).toContain('data-missing-param="versao"');
    expect(html).toContain('data-missing-param="campoFaltante"');
    expect(html).toContain('{{{autor}}}');
    expect(html).toContain('{{{versao}}}');
    expect(html).toContain('{{{campoFaltante}}}');
  });

  it('highlights missing required parameters on built-in MediaWiki templates instead of silently dropping them', () => {
    const wikitext = [
      '{{Aviso|tipo=aviso}}',
      '{{Artigo principal}}',
      '{{Veja também}}',
      '{{Citação}}',
      '{{Nota|tipo=dica}}',
      '{{Citar web|título=Guia sem URL}}',
      '{{Colunas}}',
      '{{Tecla}}',
      '{{Predefinição}}',
    ].join('\n\n');

    const res = clientParsoid.parse(wikitext, 'Testes Obrigatórios');
    expect(res.templateDiagnostics).toBeDefined();
    expect(res.templateDiagnostics!.length).toBeGreaterThanOrEqual(9);
    expect(res.templateDiagnostics!.every(d => d.type === 'missing_required_param')).toBe(true);

    const html = renderToStaticMarkup(
      <ArticleViewer title="Testes Obrigatórios" wikitext={wikitext} />
    );

    expect(html).toContain('data-testid="template-debug-inspector"');
    expect(html).toContain('wiki-template-missing-param');
    expect(html).toContain('data-template-issue="missing_required_param"');
    expect(html).toContain('Parâmetro(s) obrigatório(s) ausente(s) em {{Aviso}}: título, texto');
    expect(html).toContain('{{Artigo principal}}: parâmetro obrigatório ausente');
    expect(html).toContain('{{Veja também}}: parâmetro obrigatório ausente');
    expect(html).toContain('{{Citação}}: parâmetro obrigatório ausente (texto)');
    expect(html).toContain('{{Nota}}: parâmetro obrigatório ausente (texto)');
    expect(html).toContain('parâmetro ausente: url');
    expect(html).toContain('{{Colunas}}: parâmetro obrigatório ausente');
    expect(html).toContain('{{Tecla}}: parâmetro obrigatório ausente');
    expect(html).toContain('{{Predefinição}}: parâmetro obrigatório ausente');
  });

  it('never flags protected code blocks, <nowiki>, wikitables {|...|}, or Namespace 10 template docs', () => {
    const docAndTableWikitext = [
      '<nowiki>{{Aviso|incompleto e }}} sem erro</nowiki>',
      '',
      '<syntaxhighlight lang="wikitext">{{Invalida#Aqui}} {{{1}}}</syntaxhighlight>',
      '',
      'Inline `{{Quebrada` code example.',
      '',
      '{| class="wikitable"\n! Coluna 1 !! Coluna 2\n|-\n| Valor A || Valor B\n|}',
    ].join('\n');

    const expanded = expandWikitextTemplates(docAndTableWikitext, {
      pageTitle: 'Documentação Segura',
    });
    expect(expanded.diagnostics).toHaveLength(0);
    expect(expanded.errors).toHaveLength(0);

    const html = renderToStaticMarkup(
      <ArticleViewer title="Documentação Segura" wikitext={docAndTableWikitext} />
    );
    expect(html).not.toContain('data-testid="template-debug-inspector"');
    expect(html).not.toContain('wiki-template-invalid-braces');
    expect(html).not.toContain('wiki-template-missing-param');

    // On a Namespace 10 template page directly, declared {{{param}}} placeholders in docs are valid
    const tplPage = expandWikitextTemplates('Documentação usa {{{titulo}}} e {{{1}}}.', {
      pageTitle: 'Predefinição:Exemplo',
      isTemplatePage: true,
    });
    expect(tplPage.diagnostics).toHaveLength(0);
  });

  it('supports disabling highlight decoration class via highlightTemplateDiagnostics=false and renders TemplateDebugInspector details when expanded', () => {
    const htmlHidden = renderToStaticMarkup(
      <ArticleViewer
        title="Oculto"
        wikitext="{{PredefiniçãoInexistente}}"
        highlightTemplateDiagnostics={false}
      />
    );
    expect(htmlHidden).toContain('hide-template-debug-highlights');
    expect(htmlHidden).toContain('Destaques ocultos');

    const inspectorExpanded = renderToStaticMarkup(
      <TemplateDebugInspector
        diagnostics={[
          {
            id: 'tpl-diag-1',
            type: 'unclosed_braces',
            severity: 'error',
            templateName: 'Aviso',
            snippet: '{{Aviso|título=Erro',
            message: 'Chave não fechada.',
          },
          {
            id: 'tpl-diag-2',
            type: 'missing_required_param',
            severity: 'warning',
            templateName: 'Citar web',
            snippet: '{{Citar web|título=Docs}}',
            missingParams: ['url'],
            message: 'Parâmetro url ausente.',
          },
        ]}
        highlightEnabled={true}
        onToggleHighlight={() => {}}
        onJumpToDiagnostic={() => {}}
        onEdit={() => {}}
        editTargetSlug="Artigo_Teste"
        defaultExpanded={true}
      />
    );
    expect(inspectorExpanded).toContain('1 chave inválida');
    expect(inspectorExpanded).toContain('1 parâmetro ausente');
    expect(inspectorExpanded).toContain('Chave não fechada');
    expect(inspectorExpanded).toContain('Parâmetro obrigatório ausente');
    expect(inspectorExpanded).toContain('faltando: url');
    expect(inspectorExpanded).toContain('Localizar');
    expect(inspectorExpanded).toContain('Editar Wikitexto');
  });
});
