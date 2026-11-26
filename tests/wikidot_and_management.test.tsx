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
import { buildTemplateInvocationWikitext } from '../src/data/defaultTemplates';
import { expandWikidotSyntax, convertWikidotFootnotes } from '../src/utils/wikidotSyntax';
import { TemplateManagementPanel } from '../src/components/TemplateManagementPanel';
import { TemplateManagerModal } from '../src/components/TemplateManagerModal';
import { WikiEditor } from '../src/components/WikiEditor';
import { ExtensionsProvider } from '../src/context/ExtensionsContext';

describe('Expanded Wikipedia Templates, Wikidot Syntax Engine & Gestão de Predefinições', () => {
  it('includes 75+ built-in presets covering all new Wikipedia templates and 12 Wikidot blocks/modules', () => {
    const builtins = templateService.listBuiltinTemplates();
    expect(builtins.length).toBeGreaterThanOrEqual(80);

    const names = new Set(builtins.map(t => t.name));
    const expectedNewWikipedia = [
      'Infocaixa software',
      'Infocaixa artista musical',
      'Infocaixa evento',
      'Infocaixa universidade',
      'Infocaixa empresa',
      'Artigo bom',
      'Escopo global',
      'Fonte primária',
      'Traduzido de',
      'Anexo',
      'Cronologia',
      'Galeria',
      'Imagem dupla',
      'Voto',
      'Etiqueta',
      'Áudio',
      'IPA',
      'Moeda',
      'Barra de progresso',
      'Matemática',
      'Código',
      'ISBN',
      'DOI',
    ];
    for (const n of expectedNewWikipedia) {
      expect(names.has(n)).toBe(true);
    }

    const wikidotPresets = builtins.filter(t => t.category === 'wikidot');
    expect(wikidotPresets.length).toBe(12);
    for (const w of [
      'Wikidot Infobox',
      'Wikidot Callout (Alerta)',
      'Wikidot Note',
      'Wikidot Navbox',
      'Wikidot Retrátil (Collapsible)',
      'Wikidot Abas (Tabview)',
      'Wikidot Citação (Quote)',
      'Wikidot Bloco de Código',
      'Wikidot Sumário (TOC)',
      'Wikidot Nota de Rodapé',
      'Wikidot Module Rate',
      'Wikidot Module ListPages',
    ]) {
      expect(names.has(w)).toBe(true);
    }
  });

  it('parses and renders all Wikidot syntax blocks, modules, and footnotes safely in clientParsoid', () => {
    const wikitext = [
      '[[toc title="Índice Principal"]]',
      '[[div class="infobox"]]\n**Projeto Atlas**\n* **Status:** Ativo\n[[/div]]',
      '[[callout type="warning" title="Atenção Editorial"]]\nVerifique fontes secundárias em [[Guia de Estilo]].\n[[/callout]]',
      '[[note]]\n**Nota:** Trecho compatível com sintaxe Wikidot.\n[[/note]]',
      '[[collapsible show="+ Expandir detalhes" hide="- Recolher"]]\nConteúdo técnico interno.\n[[/collapsible]]',
      '[[tabview]]\n[[tab Resumo]]\nPrimeira aba.\n[[/tab]]\n[[tab Dados]]\nSegunda aba.\n[[/tab]]\n[[/tabview]]',
      '[[quote author="Ada Lovelace" source="Notas de 1843"]]\nA máquina analítica tece padrões algébricos.\n[[/quote]]',
      '[[code type="typescript"]]\nconst ok = true;\n[[/code]]',
      '[[div class="navbox"]]\n**Série Técnica**\n[[Introdução]] · [[Arquitetura]]\n[[/div]]',
      'Afirmação documentada[[footnote]]Arquivo histórico de 2026.[[/footnote]].',
      '[[module Rate label="Avaliar guia"]]',
      '[[module ListPages category="Guias" order="updated_at desc" limit="5"]]',
    ].join('\n\n');

    const res = clientParsoid.parse(wikitext, 'Página Wikidot');
    expect(res.missingTemplates).toEqual([]);
    expect(res.html).toContain('data-wikidot="toc"');
    expect(res.html).toContain('Índice Principal');
    expect(res.html).toContain('data-wikidot="div-infobox"');
    expect(res.html).toContain('<strong>Projeto Atlas</strong>');
    expect(res.html).toContain('data-wikidot="callout"');
    expect(res.html).toContain('Atenção Editorial');
    expect(res.html).toContain('href="#/wiki/Guia_de_Estilo"');
    expect(res.html).toContain('data-wikidot="note"');
    expect(res.html).toContain('data-wikidot="collapsible"');
    expect(res.html).toContain('<details');
    expect(res.html).toContain('data-wikidot="tabview"');
    expect(res.html).toContain('Primeira aba.');
    expect(res.html).toContain('data-wikidot="quote"');
    expect(res.html).toContain('Ada Lovelace');
    expect(res.html).toContain('data-wikidot="code"');
    expect(res.html).toContain('data-wikidot="div-navbox"');
    expect(res.html).toContain('data-wikidot="module-rate"');
    expect(res.html).toContain('Avaliar guia');
    expect(res.html).toContain('data-wikidot="module-listpages"');
    expect(res.references.length).toBe(1);
    expect(String(res.references[0])).toContain('Arquivo histórico de 2026');
  });

  it('escapes XSS attempts in Wikidot attributes/code and preserves <nowiki> spans', () => {
    const raw = [
      '<nowiki>[[note]]Literal[[/note]]</nowiki>',
      '[[callout type="danger" title="<script>alert(1)</script>"]]\nSeguro\n[[/callout]]',
      '[[code type="html"]]<img src=x onerror=alert(2)>[[/code]]',
    ].join('\n\n');

    const converted = convertWikidotFootnotes(raw);
    const expanded = expandWikidotSyntax(converted);
    expect(expanded).toContain('<nowiki>[[note]]Literal[[/note]]</nowiki>');
    expect(expanded).not.toContain('<script>alert(1)</script>');
    expect(expanded).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(expanded).not.toContain('<img src=x onerror=alert(2)>');
    expect(expanded).toContain('&lt;img src=x onerror=alert(2)&gt;');
  });

  it('renders all 23 newly added Wikipedia templates cleanly with no missing templates', () => {
    const wikitext = [
      '{{Infocaixa software|nome=TypeScript|desenvolvedor=Microsoft|versão=5.8|linguagem=TypeScript}}',
      '{{Infocaixa artista musical|nome=Milton Nascimento|origem=Rio de Janeiro|gênero=MPB}}',
      '{{Infocaixa evento|título=Wikimania|data=2026|local=Paris}}',
      '{{Infocaixa universidade|nome=Universidade de São Paulo|sigla=USP|fundação=1934}}',
      '{{Infocaixa empresa|nome=Embraer|setor=Aeroespacial|fundação=1969|sede=São José dos Campos}}',
      '{{Artigo bom|data=Novembro de 2026}}',
      '{{Escopo global|região=lusófona|data=2026}}',
      '{{Fonte primária|data=2026|assunto=História}}',
      '{{Traduzido de|en|MediaWiki|versao=2026}}',
      '{{Anexo|Anexo:Lista de módulos}}',
      '{{Cronologia|título=Marcos|item1=2001 — Fundação|item2=2026 — Expansão}}',
      '{{Galeria|título=Figuras|img1=https://example.org/a.png|leg1=Diagrama A}}',
      '{{Imagem dupla|título=Antes e Depois|img1=https://example.org/1.png|leg1=A|img2=https://example.org/2.png|leg2=B}}',
      '{{Voto|apoio|Excelente melhoria}}',
      '{{Etiqueta|v3.0|ok}}',
      '{{Áudio|https://example.org/pronuncia.ogg|Ouvir termo}}',
      '{{IPA|ˈwiki|pt}}',
      '{{Moeda|1990|BRL}}',
      '{{Barra de progresso|80|título=Meta Editorial|cor=blue}}',
      '{{Matemática|E = mc²}}',
      '{{Código|npm run build|bash}}',
      '{{ISBN|978-85-359-0277-8}}',
      '{{DOI|10.1038/s41586-020-2649-2}}',
    ].join('\n\n');

    const res = clientParsoid.parse(wikitext, 'Enciclopédia Completa');
    expect(res.missingTemplates).toEqual([]);
    expect(res.html).not.toContain('border-l-4');
    expect(res.html).toContain('data-template="Infocaixa software"');
    expect(res.html).toContain('data-template="Infocaixa artista musical"');
    expect(res.html).toContain('data-template="Infocaixa evento"');
    expect(res.html).toContain('data-template="Infocaixa universidade"');
    expect(res.html).toContain('data-template="Infocaixa empresa"');
    expect(res.html).toContain('data-template="Artigo bom"');
    expect(res.html).toContain('data-template="Escopo global"');
    expect(res.html).toContain('data-template="Fonte primária"');
    expect(res.html).toContain('data-template="Traduzido de"');
    expect(res.html).toContain('data-template="Anexo"');
    expect(res.html).toContain('data-template="Cronologia"');
    expect(res.html).toContain('data-template="Galeria"');
    expect(res.html).toContain('data-template="Imagem dupla"');
    expect(res.html).toContain('data-template="Voto"');
    expect(res.html).toContain('data-template="Etiqueta"');
    expect(res.html).toContain('data-template="Áudio"');
    expect(res.html).toContain('data-template="IPA"');
    expect(res.html).toContain('data-template="Moeda"');
    expect(res.html).toContain('R$ 1990');
    expect(res.html).toContain('data-template="Barra de progresso"');
    expect(res.html).toContain('80%');
    expect(res.html).toContain('data-template="Matemática"');
    expect(res.html).toContain('data-template="Código"');
    expect(res.html).toContain('data-template="ISBN"');
    expect(res.html).toContain('data-template="DOI"');
  });

  it('builds customized Wikidot code snippets via buildTemplateInvocationWikitext and keeps {{Avizo}} fuzzy matching accurate', () => {
    const calloutDef = templateService.findBuiltin('Wikidot Callout (Alerta)');
    expect(calloutDef).toBeDefined();
    const snippet = buildTemplateInvocationWikitext(
      'Wikidot Callout (Alerta)',
      { tipo: 'danger', título: 'Aviso de Segurança', texto: 'Revise as regras.' },
      calloutDef
    );
    expect(snippet).toBe('[[callout type="danger" title="Aviso de Segurança"]]\nRevise as regras.\n[[/callout]]');

    // Wikidot presets do not interfere with {{...}} typo auto-fix
    expect(templateService.findClosestTemplateName('Avizo')).toBe('Aviso');
    expect(templateService.findClosestTemplateName('DesconhecidaTotalmente')).toBeNull();
  });

  it('renders TemplateManagementPanel ("Gestão de Predefinições"), TemplateManagerModal Wikidot tab, and WikiEditor toggle button', () => {
    const panelHtml = renderToStaticMarkup(
      <TemplateManagementPanel
        onInsertCode={vi.fn()}
        pageTitle="Artigo Teste"
      />
    );
    expect(panelHtml).toContain('Gestão de Predefinições');
    expect(panelHtml).toContain('data-testid="management-cat-wikidot"');
    expect(panelHtml).toContain('Wikidot Infobox');
    expect(panelHtml).toContain('Wikidot Callout (Alerta)');
    expect(panelHtml).toContain('Wikidot Navbox');
    expect(panelHtml).toContain('data-testid="management-live-preview"');
    expect(panelHtml).toContain('data-testid="management-generated-code"');
    expect(panelHtml).toContain('Inserir no Markdown / Editor');

    const modalHtml = renderToStaticMarkup(
      <TemplateManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onInsertTemplate={vi.fn()}
      />
    );
    expect(modalHtml).toContain('Wikidot');

    const editorHtml = renderToStaticMarkup(
      <ExtensionsProvider currentUser={null}>
        <WikiEditor
          slug="Teste_Editor"
          currentUser={null}
          onSaved={vi.fn()}
          onCancel={vi.fn()}
        />
      </ExtensionsProvider>
    );
    expect(editorHtml).toContain('Loading article wikitext source...');
  });
});
