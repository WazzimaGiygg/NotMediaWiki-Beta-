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
import { templateService } from '../src/services/templateService';
import { BUILTIN_MEDIAWIKI_TEMPLATES } from '../src/data/defaultTemplates';
import { ArticleViewer } from '../src/components/ArticleViewer';
import { TemplateManagerModal } from '../src/components/TemplateManagerModal';

describe('Popular Wikipedia / Wikipédia PT Built-in Templates', () => {
  it('exposes the expanded catalog of widely used Wikipedia templates across all 5 categories', () => {
    const builtins = templateService.listBuiltinTemplates();
    expect(builtins.length).toBeGreaterThanOrEqual(50);

    const names = new Set(builtins.map(t => t.name));
    for (const expectedName of [
      'Mais fontes',
      'Wikificação',
      'Fusão',
      'Atualizar',
      'Publicidade',
      'Controverso',
      'Protegido',
      'Redireciona',
      'Sobre',
      'Distinguir',
      'Portal',
      'Correlatos',
      'Controle de autoridade',
      'Infocaixa país',
      'Infocaixa município',
      'Infocaixa filme',
      'Infocaixa livro',
      'Infocaixa jogo',
      'Infocaixa álbum',
      'Infocaixa taxonomia',
      'Quem?',
      'Quando?',
      'Por quê?',
      'Caixa de diálogo',
      'Sem quebra',
      'Símbolo',
      'Citar livro',
      'Citar periódico',
      'Citar notícia',
      'Coord',
      'Converter',
      'Dni',
      'Lang',
      'Site oficial',
    ]) {
      expect(names.has(expectedName)).toBe(true);
    }
  });

  it('renders Wikipedia maintenance, hatnote, navigation, and authority control templates cleanly', () => {
    const wikitext = [
      '{{Redireciona|WikiEngine|Wiki (desambiguação)}}',
      '{{Sobre|o motor wiki|outras acepções|MediaWiki (desambiguação)}}',
      '{{Distinguir|JavaScript|TypeScript}}',
      '{{Mais fontes|data=Novembro de 2026|assunto=Histórico}}',
      '{{Wikificação|data=2026}}',
      '{{Fusão|MediaWiki|data=2026|motivo=Escopo idêntico}}',
      '{{Atualizar|data=2026|parte=Estatísticas}}',
      '{{Publicidade|data=2026}}',
      '{{Controverso|motivo=Divergência de fontes|data=2026}}',
      '{{Protegido|nível=semiproteção|motivo=Alta visibilidade}}',
      '{{Portal|Tecnologia|Software livre}}',
      '{{Correlatos|commons=MediaWiki|wikiquote=Conhecimento}}',
      '{{Controle de autoridade|VIAF=12345678|ORCID=0000-0002-1825-0097|Wikidata=Q52}}',
    ].join('\n\n');

    const res = clientParsoid.parse(wikitext, 'Artigo Enciclopédico');
    expect(res.missingTemplates).toEqual([]);
    expect(res.html).toContain('data-template="Redireciona"');
    expect(res.html).toContain('redireciona para este artigo');
    expect(res.html).toContain('data-template="Sobre"');
    expect(res.html).toContain('data-template="Distinguir"');
    expect(res.html).toContain('Não confundir com');
    expect(res.html).toContain('data-template="Mais fontes"');
    expect(res.html).toContain('data-template="Wikificação"');
    expect(res.html).toContain('data-template="Fusão"');
    expect(res.html).toContain('data-template="Atualizar"');
    expect(res.html).toContain('data-template="Publicidade"');
    expect(res.html).toContain('data-template="Controverso"');
    expect(res.html).toContain('data-template="Protegido"');
    expect(res.html).toContain('data-template="Portal"');
    expect(res.html).toContain('Portal%3ATecnologia');
    expect(res.html).toContain('Portal Tecnologia');
    expect(res.html).toContain('data-template="Correlatos"');
    expect(res.html).toContain('commons.wikimedia.org/wiki/MediaWiki');
    expect(res.html).toContain('data-template="Controle de autoridade"');
    expect(res.html).toContain('viaf.org/viaf/12345678');
    expect(res.html).not.toContain('border-l-4');
  });

  it('renders specialized Wikipedia Infoboxes (País, Município, Filme, Livro, Jogo, Álbum, Taxonomia) and Info/* aliases', () => {
    const wikitext = [
      '{{Info/País|nome=Brasil|capital=Brasília|idioma=Português|moeda=Real}}',
      '{{Infocaixa município|nome=Curitiba|estado=Paraná|país=Brasil|fuso=UTC−3}}',
      '{{Info/Filme|título=Cidade de Deus|direção=Fernando Meirelles|ano=2002}}',
      '{{Infocaixa livro|título=Dom Casmurro|autor=Machado de Assis|ano=1899}}',
      '{{Info/Jogo|título=Horizon Chase Turbo|desenvolvedora=Aquiris|lançamento=2018}}',
      '{{Infocaixa álbum|nome=Clube da Esquina|artista=Milton Nascimento|lançamento=1972}}',
      '{{Infocaixa taxonomia|nome=Onça-pintada|reino=Animalia|espécie=Panthera onca}}',
    ].join('\n\n');

    const res = clientParsoid.parse(wikitext, 'Infocaixas Wikipédia');
    expect(res.missingTemplates).toEqual([]);
    expect(res.html).toContain('data-template="Infocaixa país"');
    expect(res.html).toContain('Brasília');
    expect(res.html).toContain('data-template="Infocaixa município"');
    expect(res.html).toContain('Curitiba');
    expect(res.html).toContain('data-template="Infocaixa filme"');
    expect(res.html).toContain('Fernando Meirelles');
    expect(res.html).toContain('data-template="Infocaixa livro"');
    expect(res.html).toContain('Dom Casmurro');
    expect(res.html).toContain('data-template="Infocaixa jogo"');
    expect(res.html).toContain('Horizon Chase Turbo');
    expect(res.html).toContain('data-template="Infocaixa álbum"');
    expect(res.html).toContain('Clube da Esquina');
    expect(res.html).toContain('data-template="Infocaixa taxonomia"');
    expect(res.html).toContain('Panthera onca');
  });

  it('renders inline editorial markers, collapsible box, citations, Coord, Converter, Dni, Lang, and Site oficial (PT + EN aliases)', () => {
    const wikitext = [
      'Alguns autores afirmam{{Quem?|data=2026}} que houve avanços recentes{{Quando?}} por razões técnicas{{Por quê?|razão=Latência}}.',
      'Velocidade: {{Sem quebra|100 km/h}} · {{Converter|100|km|mi}} · {{Convert|20|C|F}}.',
      'Data: {{Dni|15|1|2001}} · Termo: {{Lang|en|open knowledge}} · Mapa: {{Coord|-15.793889|-47.882778|nome=Brasília}}.',
      'Status: {{Feito}} e {{Não feito}} · Portal: {{Site oficial|https://www.mediawiki.org|nome=MediaWiki.org}}.',
      '{{Caixa de diálogo|título=Detalhes Técnicos|1=Lista expandida de módulos}}',
      'Livros: {{Cite book|author=Cunningham, Ward|title=The Wiki Way|publisher=Addison-Wesley|year=2001|isbn=978-0-201-71499-9}}',
      'Artigos: {{Citar periódico|autor=Silva, A.|título=Wikis|jornal=Nature|volume=14|número=2|ano=2026|doi=10.1000/wiki}}',
      'Imprensa: {{Cite news|title=Lançamento|newspaper=Folha Técnica|date=2026|url=https://exemplo.org/n}}',
    ].join('\n\n');

    const html = renderToStaticMarkup(
      <ArticleViewer title="Utilidades e Citações" wikitext={wikitext} />
    );

    expect(html).toContain('quem?');
    expect(html).toContain('quando?');
    expect(html).toContain('por quê?');
    expect(html).toContain('whitespace-nowrap');
    expect(html).toContain('100 km (62.14 mi)');
    expect(html).toContain('20 °C (68 °F)');
    expect(html).toContain('15 de janeiro de 2001');
    expect(html).toContain('lang="en"');
    expect(html).toContain('open knowledge');
    expect(html).toContain('openstreetmap.org/?mlat=-15.793889&amp;mlon=-47.882778');
    expect(html).toContain('Feito');
    expect(html).toContain('Não feito');
    expect(html).toContain('MediaWiki.org');
    expect(html).toContain('<details');
    expect(html).toContain('Detalhes Técnicos');
    expect(html).toContain('The Wiki Way');
    expect(html).toContain('ISBN 978-0-201-71499-9');
    expect(html).toContain('doi.org/10.1000/wiki');
    expect(html).toContain('Folha Técnica');
  });

  it('escapes untrusted HTML and blocks non-http URLs inside template parameters', () => {
    const malicious = [
      '{{Site oficial|javascript:alert(1)|nome=<script>alert(1)</script>}}',
      '{{Infocaixa livro|título=<img src=x onerror=alert(1)>|autor=Teste}}',
      '{{Caixa de diálogo|título=<b>Titulo</b>|1=<script>bad()</script>}}',
    ].join('\n\n');

    const res = clientParsoid.parse(malicious, 'Segurança');
    expect(res.html).not.toContain('<script>');
    expect(res.html).not.toContain('javascript:alert');
    expect(res.html).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('validates expected parameters and English/Portuguese aliases in templateService syntax analyzer and TemplateManagerModal', () => {
    const analysis = templateService.analyzeTemplateSyntaxSuggestions(
      [
        '{{Citar livro|autor=Leuf}}',
        '{{Fusão}}',
        '{{Cite journal|title=Valid|journal=IEEE|year=2026}}',
      ].join('\n')
    );

    expect(analysis.suggestions.map(s => s.templateName)).toEqual(['Citar livro', 'Fusão']);
    expect(analysis.suggestions[0].missingRequiredParams).toEqual(['título']);
    expect(analysis.suggestions[1].missingRequiredParams).toEqual(['1']);

    const modalHtml = renderToStaticMarkup(
      <TemplateManagerModal
        isOpen={true}
        onClose={() => {}}
        onInsertTemplate={() => {}}
        pageTitle="Artigo"
      />
    );
    expect(modalHtml).toContain('Dados &amp; Ref.');
    expect(modalHtml).toContain('{{Controle de autoridade}}');
    expect(modalHtml).toContain('{{Infocaixa país}}');
    expect(BUILTIN_MEDIAWIKI_TEMPLATES.some(t => t.name === 'Citar livro')).toBe(true);
  });
});
