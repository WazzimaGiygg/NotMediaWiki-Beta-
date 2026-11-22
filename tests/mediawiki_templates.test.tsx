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
  expandWikitextTemplates,
  substituteTemplateParameters,
  applyIncludeDirectives,
  extractTemplateDeclaredParams,
  parseTemplateCallBody,
} from '../src/utils/templateEngine';
import {
  BUILTIN_MEDIAWIKI_TEMPLATES,
  buildTemplateInvocationWikitext,
  buildDefaultTemplatePageSkeleton,
} from '../src/data/defaultTemplates';
import { TemplateManagerModal } from '../src/components/TemplateManagerModal';
import { NewArticleModal } from '../src/components/NewArticleModal';
import { SpecialPagesHub } from '../src/components/SpecialPagesHub';
import { ArticleViewer } from '../src/components/ArticleViewer';
import { templateService, normalizeTemplateIdentity } from '../src/services/templateService';
import { TEMPLATE_EXAMPLE_ARTICLE } from '../src/data/templateExampleArticle';
import { Article } from '../src/types';

function makeCustomTemplate(name: string, wikitext: string, summary = ''): Article {
  const fullTitle = name.startsWith('Predefinição:') ? name : `Predefinição:${name}`;
  return {
    id: `tpl-${name.toLowerCase()}`,
    slug: fullTitle.replace(/\s+/g, '_'),
    title: fullTitle,
    namespace: 10,
    wikitext,
    summary,
    latestRevisionId: 'rev-1',
    createdAt: '2026-04-12T00:00:00Z',
    updatedAt: '2026-04-12T00:00:00Z',
    categories: ['Predefinições'],
    views: 1,
  };
}

describe('MediaWiki Predefinições (Templates) Engine & Parsoid Integration', () => {
  it('parses positional and named parameters with nested braces correctly', () => {
    const parsed = parseTemplateCallBody('Aviso|tipo=aviso|título=Ver [[MediaWiki]]|texto=Veja {{Carece de fontes}} aqui|extra');
    expect(parsed.name).toBe('Aviso');
    expect(parsed.named.tipo).toBe('aviso');
    expect(parsed.named['título']).toBe('Ver [[MediaWiki]]');
    expect(parsed.named.texto).toBe('Veja {{Carece de fontes}} aqui');
    expect(parsed.positional).toEqual(['extra']);
    expect(parsed.params['1']).toBe('extra');
  });

  it('substitutes {{{param|default}}} placeholders including nested fallbacks and positional args', () => {
    const tpl = 'Olá {{{usuário|{{{1|Visitante}}}}}}, projeto: {{{projeto|NotMediaWiki}}}!';
    expect(substituteTemplateParameters(tpl, { '1': 'Maria', projeto: 'WazzimaGiygg' })).toBe(
      'Olá Maria, projeto: WazzimaGiygg!'
    );
    expect(substituteTemplateParameters(tpl, {})).toBe(
      'Olá Visitante, projeto: NotMediaWiki!'
    );
  });

  it('handles <noinclude>, <includeonly>, and <onlyinclude> faithfully between transclusion and template page view', () => {
    const raw = '<includeonly>Transcluído: {{{1|OK}}}</includeonly><noinclude>Documentação da predefinição</noinclude>';
    expect(applyIncludeDirectives(raw, true)).toBe('Transcluído: {{{1|OK}}}');
    expect(applyIncludeDirectives(raw, false)).toBe('Documentação da predefinição');

    const onlyRaw = 'Ignorado <onlyinclude>Apenas isto</onlyinclude> também ignorado';
    expect(applyIncludeDirectives(onlyRaw, true)).toBe('Apenas isto');
  });

  it('evaluates MediaWiki magic words ({{PAGENAME}}, {{SITENAME}}, {{CURRENTYEAR}}, {{NAMESPACE}})', () => {
    const out = expandWikitextTemplates(
      'Página: {{PAGENAME}} | Namespace: {{NAMESPACE}} | Wiki: {{SITENAME}} | Ano: {{CURRENTYEAR}}',
      {
        pageTitle: 'Predefinição:Exemplo',
        siteName: 'Wikidiota',
      }
    );
    expect(out.wikitext).toContain('Página: Exemplo');
    expect(out.wikitext).toContain('Namespace: Predefinição');
    expect(out.wikitext).toContain('Wiki: Wikidiota');
    expect(out.wikitext).toContain(`Ano: ${new Date().getFullYear()}`);
  });

  it('renders standard MediaWiki templates ({{Aviso}}, {{Esboço}}, {{Artigo principal}}, {{Carece de fontes}}, {{Infocaixa}}, {{Navbox}}) cleanly via clientParsoid.parse', () => {
    const wikitext = [
      '{{Aviso|tipo=aviso|título=Revisão Editorial|texto=Consulte [[Política de Fontes]].}}',
      '{{Artigo principal|MediaWiki|Parsoid}}',
      '== Resumo ==',
      'Esta é uma afirmação{{Carece de fontes|data=2026}} com link{{Ligação inativa}}.',
      '{{Citação|texto=Saber livre é poder coletivo.|autor=Equipe Editorial|fonte=2026}}',
      '{{Infocaixa|título=Projeto Alpha|rótulo1=Licença|dados1=MIT|rótulo2=Linguagem|dados2=TypeScript}}',
      '{{Navbox|título=Arquitetura|grupo1=Núcleo|lista1=[[MediaWiki]] · [[Parsoid]]}}',
      '{{Esboço|Sistemas Distribuídos}}',
    ].join('\n\n');

    const res = clientParsoid.parse(wikitext, 'Artigo Exemplo');
    expect(res.html).toContain('data-template="Aviso"');
    expect(res.html).toContain('Revisão Editorial');
    expect(res.html).toContain('href="#/wiki/Pol%C3%ADtica_de_Fontes"');
    expect(res.html).toContain('Ver artigos principais:');
    expect(res.html).toContain('href="#/wiki/MediaWiki"');
    expect(res.html).toContain('href="#/wiki/Parsoid"');
    expect(res.html).toContain('<i>carece de fontes</i>');
    expect(res.html).toContain('<i>ligação inativa</i>');
    expect(res.html).toContain('data-template="Citação"');
    expect(res.html).toContain('data-template="Infocaixa"');
    expect(res.html).toContain('Projeto Alpha');
    expect(res.html).toContain('data-template="Navbox"');
    expect(res.html).toContain('data-template="Esboço"');
    expect(res.html).toContain('Sistemas Distribuídos');
    // Built-in templates should never leave border-l-4 anti-pattern
    expect(res.html).not.toContain('border-l-4');
    expect(res.usedTemplates).toContain('Aviso');
    expect(res.usedTemplates).toContain('Navbox');
  });

  it('transcludes custom Namespace 10 templates from Firestore with nested parameters and cycle protection', () => {
    const boasVindas = makeCustomTemplate(
      'BoasVindas',
      `<includeonly>{{Nota|tipo=dica|título=Bem-vindo, {{{1|Editor}}}!|texto=Explore [[{{{dest|MediaWiki}}}]] no {{SITENAME}}.}}</includeonly><noinclude>Ajuda da predefinição.</noinclude>`
    );

    const loopA = makeCustomTemplate('LoopA', 'A -> {{LoopB}}');
    const loopB = makeCustomTemplate('LoopB', 'B -> {{LoopA}}');

    const parsedCustom = clientParsoid.parse(
      '{{BoasVindas|Carlos|dest=CentralAuth}}',
      'Página Inicial',
      { customTemplates: [boasVindas], siteName: 'NotMediaWiki' }
    );
    expect(parsedCustom.html).toContain('Bem-vindo, Carlos!');
    expect(parsedCustom.html).toContain('href="#/wiki/CentralAuth"');
    expect(parsedCustom.html).toContain('NotMediaWiki');
    expect(parsedCustom.html).not.toContain('Ajuda da predefinição');

    const parsedCycle = clientParsoid.parse('{{LoopA}}', 'CicloTeste', {
      customTemplates: [loopA, loopB],
    });
    expect(parsedCycle.html).toContain('wiki-template-error');
    expect(parsedCycle.html).toContain('Ciclo');
  });

  it('renders MediaWiki redlink for non-existent templates while preserving code/nowiki and Infobox software', () => {
    const res = clientParsoid.parse(
      [
        '{{PredefiniçãoInexistente123}}',
        '<nowiki>{{Aviso}}</nowiki>',
        '<syntaxhighlight lang="wikitext">{{Esboço|Computação}}</syntaxhighlight>',
        '{{Infobox software\n| name = NotMediaWiki\n| license = MIT\n}}',
      ].join('\n\n'),
      'Teste'
    );

    expect(res.html).toContain('wiki-redlink');
    expect(res.html).toContain('Predefinição:PredefiniçãoInexistente123');
    expect(res.html).toContain('#/edit/Predefini%C3%A7%C3%A3o%3APredefini%C3%A7%C3%A3oInexistente123');
    expect(res.html).toContain('{{Aviso}}');
    expect(res.html).toContain('{{Esboço|Computação}}');
    expect(res.html).toContain('infobox');
    expect(res.html).toContain('NotMediaWiki');
    expect(res.missingTemplates).toContain('Predefinição:PredefiniçãoInexistente123');
  });

  it('builds valid invocation syntax and extracts declared parameters from custom Namespace 10 templates', () => {
    const skeleton = buildDefaultTemplatePageSkeleton('CaixaResumo');
    const params = extractTemplateDeclaredParams(skeleton);
    expect(params).toContain('título');
    expect(params).toContain('texto');
    expect(params).toContain('1');

    const builtAviso = buildTemplateInvocationWikitext(
      'Aviso',
      { tipo: 'erro', 'título': 'Importante', texto: 'Verificado.' },
      BUILTIN_MEDIAWIKI_TEMPLATES.find(t => t.name === 'Aviso')
    );
    expect(builtAviso).toContain('{{Aviso');
    expect(builtAviso).toContain('| tipo = erro');
    expect(builtAviso).toContain('| título = Importante');

    const builtEsboco = buildTemplateInvocationWikitext(
      'Esboço',
      { '1': 'Astronomia' },
      BUILTIN_MEDIAWIKI_TEMPLATES.find(t => t.name === 'Esboço')
    );
    expect(builtEsboco).toBe('{{Esboço|Astronomia}}');
  });

  it('renders TemplateManagerModal, NewArticleModal (with Namespace 10), and SpecialPagesHub Templates catalog', () => {
    const customTpl = makeCustomTemplate(
      'Predefinição:SeloProjeto',
      '<includeonly>{{Nota|título={{{projeto|WazzimaGiygg}}}|texto=Oficial}}</includeonly>',
      'Selo oficial de projeto'
    );

    const modalHtml = renderToStaticMarkup(
      <TemplateManagerModal
        isOpen={true}
        onClose={() => {}}
        onInsertTemplate={() => {}}
        customTemplates={[customTpl]}
        pageTitle="MediaWiki"
      />
    );
    expect(modalHtml).toContain('Predefinições MediaWiki');
    expect(modalHtml).toContain('{{Aviso}}');
    expect(modalHtml).toContain('{{SeloProjeto}}');
    expect(modalHtml).toContain('Inserir no Wikitext');
    expect(modalHtml).toContain('template-live-preview');

    const newArticleHtml = renderToStaticMarkup(
      <NewArticleModal
        isOpen={true}
        onClose={() => {}}
        onCreate={() => {}}
      />
    );
    expect(newArticleHtml).toContain('10 - Predefinição (Template)');
    expect(newArticleHtml).toContain('Predefinição Reutilizável (Namespace 10)');

    const specialTemplatesHtml = renderToStaticMarkup(
      <SpecialPagesHub
        initialSpecialPage="Templates"
        onNavigateArticle={() => {}}
        onOpenEdit={() => {}}
        onOpenHistory={() => {}}
      />
    );
    expect(specialTemplatesHtml).toContain('Especial:Predefinições (MediaWiki Templates · Namespace 10)');
    expect(specialTemplatesHtml).toContain('{{Aviso}}');
    expect(specialTemplatesHtml).toContain('{{Navbox}}');
    expect(specialTemplatesHtml).toContain('{{Infocaixa}}');
  });

  it('provides templateService caching, normalization, validation, and {{NomeDaPredefinição|parâmetro}} expansion', async () => {
    expect(templateService.listBuiltinTemplates().length).toBeGreaterThanOrEqual(8);

    const idNorm = normalizeTemplateIdentity('Minha Caixa Especial');
    expect(idNorm.baseName).toBe('Minha Caixa Especial');
    expect(idNorm.title).toBe('Predefinição:Minha Caixa Especial');
    expect(idNorm.slug).toBe('Predefinição:Minha_Caixa_Especial');

    const cachedCustom = makeCustomTemplate(
      'MinhaCaixa',
      '<includeonly>{{Nota|tipo=info|título={{{título|Título Padrão}}}|texto={{{1|Sem detalhes}}}}}</includeonly>'
    );
    templateService.setCachedCustomTemplates([cachedCustom]);
    expect(templateService.getCachedCustomTemplates().length).toBe(1);

    const expanded = templateService.expandTemplates(
      '{{MinhaCaixa|Parâmetro posicional aplicado|título=Resumo Rápido}}'
    );
    expect(expanded.wikitext).toContain('Resumo Rápido');
    expect(expanded.wikitext).toContain('Parâmetro posicional aplicado');
    expect(expanded.usedTemplates).toContain('MinhaCaixa');

    // Validation & auth guard on saveTemplate
    await expect(
      templateService.saveTemplate({ name: 'Teste', wikitext: '   ' })
    ).rejects.toThrow('Wikitext da predefinição');
    await expect(
      templateService.saveTemplate({ name: 'Teste', wikitext: '<includeonly>{{{1}}}</includeonly>' })
    ).rejects.toThrow('login');

    // Clean service cache after test
    templateService.setCachedCustomTemplates([]);
  });

  it('validates template names, unbalanced braces, unclosed tags, and direct self-recursion via validateTemplateDefinition', () => {
    const invalidName = templateService.validateTemplateDefinition({
      name: 'Caixa[Inválida]',
      wikitext: '<includeonly>{{{1|OK}}}</includeonly>',
    });
    expect(invalidName.valid).toBe(false);
    expect(invalidName.errors[0]).toContain('caracteres inválidos');

    const unbalanced = templateService.validateTemplateDefinition({
      name: 'CaixaQuebrada',
      wikitext: '<includeonly>{{Nota|título={{{1}}</includeonly>',
    });
    expect(unbalanced.valid).toBe(false);
    expect(unbalanced.errors.some(e => e.includes('desbalanceadas'))).toBe(true);

    const unclosedTag = templateService.validateTemplateDefinition({
      name: 'TagAberta',
      wikitext: '<includeonly>Conteúdo {{{1|ok}}}',
    });
    expect(unclosedTag.valid).toBe(false);
    expect(unclosedTag.errors.some(e => e.includes('<includeonly>'))).toBe(true);

    const recursive = templateService.validateTemplateDefinition({
      name: 'AutoRef',
      wikitext: '<includeonly>Item {{{1|x}}} {{AutoRef}}</includeonly>',
    });
    expect(recursive.valid).toBe(true);
    expect(recursive.warnings.some(w => w.includes('referencia a si mesma'))).toBe(true);
    expect(recursive.declaredParams).toContain('1');
  });

  it('expands {{NomeDaPredefinição|parâmetro}} inside ArticleViewer for both built-in and custom templates with dynamicParams and preserves <nowiki>', () => {
    const customBadge = makeCustomTemplate(
      'CartaoProjeto',
      '<includeonly>{{Infocaixa|título={{{1|Projeto}}}|rótulo1=Estado|dados1={{{estado|Ativo}}}}}</includeonly>'
    );

    const html = renderToStaticMarkup(
      <ArticleViewer
        title="Documentação do Núcleo"
        customTemplates={[customBadge]}
        siteName="WazzimaGiygg"
        dynamicParams={{ ambiente: 'Produção' }}
        wikitext={[
          '{{Aviso|tipo=dica|título=Guia {{{ambiente|Dev}}}|texto=Leia [[Ajuda:Predefinições]].}}',
          '{{CartaoProjeto|WikiEngine|estado=Estável}}',
          '<nowiki>{{Aviso}}</nowiki>',
        ].join('\n\n')}
      />
    );

    expect(html).toContain('data-testid="article-viewer"');
    expect(html).toContain('Guia Produção');
    expect(html).toContain('WikiEngine');
    expect(html).toContain('Estável');
    expect(html).toContain('Ajuda:Predefinições');
    expect(html).toContain('{{Aviso}}');
  });

  it('renders the built-in Exemplo de Predefinições article with live {{CartaoModulo}} and built-in template expansions', () => {
    const html = renderToStaticMarkup(
      <ArticleViewer
        title={TEMPLATE_EXAMPLE_ARTICLE.title}
        wikitext={TEMPLATE_EXAMPLE_ARTICLE.wikitext}
        siteName="NotMediaWiki"
      />
    );

    expect(html).toContain('Artigo Demonstrativo de Pré-definições');
    expect(html).toContain('Motor Parsoid');
    expect(html).toContain('v2.4');
    expect(html).toContain('Gerenciador de Extensões');
    expect(html).toContain('Ecossistema de Pré-definições');
    expect(html).toContain('Exemplo de Predefinições');
    // Code blocks wrapped in <nowiki> remain literal documentation
    expect(html).toContain('{{PAGENAME}}');
    expect(html).not.toContain('wiki-template-error');
  });
});
