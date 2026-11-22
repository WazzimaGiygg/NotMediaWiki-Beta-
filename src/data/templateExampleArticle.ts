import { Article } from '../types';

export const TEMPLATE_EXAMPLE_SLUG = 'Exemplo_de_Predefinicoes';
export const TEMPLATE_EXAMPLE_CUSTOM_TEMPLATE_SLUG = 'Predefinição:CartaoModulo';

/**
 * Pré-definição reutilizável de exemplo no Namespace 10 (Predefinição:CartaoModulo).
 * Demonstra diretivas <includeonly>/<noinclude> e parâmetros dinâmicos ({{{título}}}, {{{1}}}, {{{versao}}}, {{{estado}}}, {{{autor}}}).
 */
export const TEMPLATE_EXAMPLE_CUSTOM_TEMPLATE: Article = {
  id: 'tpl-cartao-modulo',
  slug: TEMPLATE_EXAMPLE_CUSTOM_TEMPLATE_SLUG,
  title: 'Predefinição:CartaoModulo',
  namespace: 10,
  summary:
    'Pré-definição reutilizável de exemplo para exibir cartões de módulos técnicos com versão, estado e descrição dinâmica.',
  latestRevisionId: 'rev-tpl-cartao-1',
  createdAt: '2026-11-22T08:00:00Z',
  updatedAt: '2026-11-22T08:00:00Z',
  categories: ['Predefinições', 'Documentação MediaWiki'],
  views: 42,
  isProtected: false,
  wikitext: `<includeonly>{{Infocaixa
| título = {{{título|Módulo do Sistema}}}
| rótulo1 = Versão
| dados1 = v{{{versao|1.0.0}}}
| rótulo2 = Estado
| dados2 = {{{estado|Ativo}}}
| rótulo3 = Responsável
| dados3 = {{{autor|Comunidade {{SITENAME}}}}}
| rótulo4 = Descrição
| dados4 = {{{1|Nenhuma descrição informada.}}}
}}</includeonly><noinclude>
== Documentação da Predefinição ==
Esta pré-definição exibe um cartão informativo padronizado para documentar módulos e componentes técnicos usando parâmetros dinâmicos.

=== Sintaxe de Uso ===
<syntaxhighlight lang="wikitext">
{{CartaoModulo
| título = Nome do Módulo
| versao = 2.4
| estado = Estável
| autor = Equipe Núcleo
| Descrição resumida passada como primeiro parâmetro posicional.
}}
</syntaxhighlight>

=== Veja na prática ===
* [[Exemplo_de_Predefinicoes|Exemplo de Predefinições]]

[[Categoria:Predefinições]]
</noinclude>`,
};

/**
 * Artigo enciclopédico demonstrando o uso completo de pré-definições MediaWiki
 * (integradas + Namespace 10 personalizada com parâmetros dinâmicos).
 */
export const TEMPLATE_EXAMPLE_ARTICLE: Article = {
  id: 'art-exemplo-predefinicoes',
  slug: TEMPLATE_EXAMPLE_SLUG,
  title: 'Exemplo de Predefinições',
  namespace: 0,
  summary:
    'Guia prático com exemplos ao vivo de uso de pré-definições MediaWiki ({{Aviso}}, {{Infocaixa}}, {{Citação}}, {{Navbox}} e pré-definição personalizada {{CartaoModulo}}) expandidas pelo templateService no ArticleViewer.',
  latestRevisionId: 'rev-exemplo-tpl-1',
  createdAt: '2026-11-22T08:05:00Z',
  updatedAt: '2026-11-22T08:05:00Z',
  categories: [
    'Predefinições',
    'Documentação MediaWiki',
    'Ajuda do Wikitexto',
    'Exemplos',
  ],
  views: 158,
  isProtected: false,
  wikitext: `{{Aviso|tipo=dica|título=Artigo Demonstrativo de Pré-definições|texto=Esta página demonstra em tempo real como o '''templateService''' valida e expande pré-definições no estilo MediaWiki (<code><nowiki>{{Nome|parâmetros}}</nowiki></code>) antes da renderização no '''ArticleViewer'''.}}

{{Infocaixa
| título = Pré-definições MediaWiki
| rótulo1 = Namespace
| dados1 = 10 (<code>Predefinição:</code>)
| rótulo2 = Sintaxe
| dados2 = <code><nowiki>{{Nome|parâmetro=valor}}</nowiki></code>
| rótulo3 = Parâmetros
| dados3 = Posicionais (<code><nowiki>{{{1}}}</nowiki></code>) e Nomeados (<code><nowiki>{{{chave|padrão}}}</nowiki></code>)
| rótulo4 = Motor
| dados4 = templateService + [[Parsoid]]
}}

{{Artigo principal|MediaWiki|Parsoid}}

Uma '''pré-definição''' (em inglês, ''template'') é uma página reutilizável do '''Namespace 10''' (prefixo <code>Predefinição:</code>) cujo conteúdo pode ser transcluído dinamicamente dentro de qualquer artigo por meio de chaves duplas.<ref name="mw-templates">{{citar web |autor=MediaWiki Documentation |título=Help:Templates — Transclusion and Parameters |url=https://www.mediawiki.org/wiki/Help:Templates |publicado=MediaWiki.org |ano=2026}}</ref>

Ao editar um verbete, os usuários podem aproveitar modelos prontos — como caixas de aviso, infocaixas, citações e barras de navegação — ou criar suas próprias pré-definições reutilizáveis sem duplicar código Wikitexto.

== Exemplo 1: Pré-definição Personalizada (Predefinição:CartaoModulo) ==
Este exemplo utiliza a página [[Predefinição:CartaoModulo]], definida no Namespace 10 com diretivas <code>&lt;includeonly&gt;</code> e <code>&lt;noinclude&gt;</code> além dos parâmetros dinâmicos <code>título</code>, <code>versao</code>, <code>estado</code>, <code>autor</code> e do parâmetro posicional <code>1</code>.

=== Código Wikitexto utilizado ===
<syntaxhighlight lang="wikitext">
<nowiki>{{CartaoModulo
| título = Motor Parsoid
| versao = 2.4
| estado = Estável
| autor = Equipe Núcleo
| Converte Wikitexto em HTML5 semântico após a expansão de pré-definições pelo templateService.
}}</nowiki>
</syntaxhighlight>

=== Resultado expandido no ArticleViewer ===
{{CartaoModulo
| título = Motor Parsoid
| versao = 2.4
| estado = Estável
| autor = Equipe Núcleo
| Converte Wikitexto em HTML5 semântico após a expansão de pré-definições pelo templateService.
}}

A mesma pré-definição pode ser reutilizada imediatamente com outros valores de parâmetros dinâmicos, omitindo campos opcionais para acionar seus valores padrão:

{{CartaoModulo|título=Gerenciador de Extensões|versao=1.8|estado=Ativo|Sincroniza extensões e títulos configurados pelo Burocrata no Firebase Firestore.}}

== Exemplo 2: Pré-definições Padrão Integradas ==
Além das pré-definições personalizadas da comunidade, o wiki oferece modelos padronizados prontos para uso imediato no editor Wikitexto.

=== Caixa de Nota (<code><nowiki>{{Nota}}</nowiki></code>) ===
<syntaxhighlight lang="wikitext">
<nowiki>{{Nota|tipo=alerta|título=Uso de &lt;nowiki&gt;|texto=Trechos dentro de &lt;nowiki&gt; permanecem literais e não são expandidos.}}</nowiki>
</syntaxhighlight>

{{Nota|tipo=alerta|título=Uso de <nowiki>|texto=Trechos dentro de <nowiki> permanecem literais e não são expandidos como pré-definições.}}

=== Citação Destacada (<code><nowiki>{{Citação}}</nowiki></code>) ===
<syntaxhighlight lang="wikitext">
<nowiki>{{Citação|texto=Pré-definições separam o conteúdo editorial da apresentação estrutural reutilizável.|autor=Guia de Estilo|fonte={{SITENAME}} ({{CURRENTYEAR}})}}</nowiki>
</syntaxhighlight>

{{Citação|texto=Pré-definições separam o conteúdo editorial da apresentação estrutural reutilizável.|autor=Guia de Estilo|fonte={{SITENAME}} ({{CURRENTYEAR}})}}

=== Marcações Editoriais Inline, Teclas e Links de Pré-definição ===
* Esta frase demonstra uma marcação editorial inline{{Carece de fontes|data=novembro de 2026}} e pedido de precisão{{Esclarecimento necessário|razão=Informar versão mínima.|data=2026}}.
* Para pesquisar rapidamente na enciclopédia, pressione {{Tecla|Ctrl|K}} ou consulte a sintaxe de {{Predefinição|CartaoModulo|versao=2.4}}.

=== Distribuição em Colunas (<code><nowiki>{{Colunas}}</nowiki></code>) ===
{{Colunas|colunas=2|[[Aviso]] · [[Em tradução]] · [[Evento atual]] · [[Parcial]] · [[Revisão]] · [[Infocaixa pessoa]] · [[Infocaixa organização]] · [[Citar web]]}}

== Parâmetros Dinâmicos e Palavras Mágicas ==
O <code>templateService</code> também resolve palavras mágicas do MediaWiki em tempo de renderização:

{| class="wikitable"
! Sintaxe Wikitexto !! Função !! Valor Expandido Nesta Página
|-
| <code><nowiki>{{PAGENAME}}</nowiki></code> || Nome da página atual || '''{{PAGENAME}}'''
|-
| <code><nowiki>{{NAMESPACE}}</nowiki></code> || Espaço nominal atual || '''{{NAMESPACE}}'''
|-
| <code><nowiki>{{SITENAME}}</nowiki></code> || Nome configurado do Wiki-site || '''{{SITENAME}}'''
|-
| <code><nowiki>{{CURRENTYEAR}}</nowiki></code> || Ano corrente do servidor || '''{{CURRENTYEAR}}'''
|}

== Caixa de Navegação e Esboço ==
{{Navbox
| título = Ecossistema de Pré-definições
| grupo1 = Avisos & Manutenção
| lista1 = Aviso · Em tradução · Evento atual · Parcial · Revisão · Sem fontes · Em construção · Desambiguação · Spoiler
| grupo2 = Navegação, Infocaixas & Dados
| lista2 = Artigo principal · Veja também · Predefinição (Tl) · Infocaixa · Infocaixa pessoa · Infocaixa organização · Tecla · Citar web · Colunas · [[Predefinição:CartaoModulo]]
}}

{{Esboço|Documentação de Pré-definições MediaWiki}}

== Veja também ==
* [[Predefinição:CartaoModulo]]
* [[MediaWiki]]
* [[Parsoid]]
* [[Especial:Predefinições]]

== Referências ==
<references />
`,
};
