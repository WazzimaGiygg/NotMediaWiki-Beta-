import { Article } from '../types';

export const LGPD_INVESTIGATION_SLUG = 'Investigacao_LGPD_e_Marco_Civil_WMF_e_Wikipedia';

export const LGPD_INVESTIGATION_PDF_URL =
  'https://wazzimagiygg.com/Investiga%C3%A7%C3%A3o%20LGPD%20e%20Marco%20Civ%C3%ADl%20WMF%20e%20Wikip%C3%A9dia.pdf';

export const LGPD_INVESTIGATION_ARTICLE: Article = {
  id: 'art-lgpd-wmf-investigation',
  slug: LGPD_INVESTIGATION_SLUG,
  title: 'Investigação LGPD e Marco Civil: WMF e Wikipédia',
  namespace: 0,
  summary:
    'Dossiê investigativo e análise crítica sobre a atuação da Wikimedia Foundation (WMF) e da Wikipédia frente à LGPD (Lei nº 13.709/2018) e ao Marco Civil da Internet (Lei nº 12.965/2014), com comparativo institucional frente ao NotMediaWiki.',
  latestRevisionId: 'rev-601',
  createdAt: '2026-11-19T12:00:00Z',
  updatedAt: '2026-11-19T12:00:00Z',
  categories: [
    'LGPD',
    'Marco Civil da Internet',
    'Crítica à Wikipédia',
    'Wikimedia Foundation',
    'Governança Digital',
    'Projetos WazzimaGiygg',
  ],
  views: 1284,
  isProtected: true,
  wikitext: `'''Investigação LGPD e Marco Civil: WMF e Wikipédia''' é um dossiê investigativo publicado no ecossistema '''WazzimaGiygg''' que analisa práticas administrativas, políticas de retenção de dados, exposição de metadados e barreiras ao exercício de direitos de titulares na '''Wikipédia''' e na '''Wikimedia Foundation (WMF)''' sob a ótica da legislação brasileira.<ref name="dossie-pdf">{{citar web |autor=Projetos WazzimaGiygg |título=Investigação LGPD e Marco Civil — WMF e Wikipédia (Documento Oficial PDF) |url=${LGPD_INVESTIGATION_PDF_URL} |publicado=WazzimaGiygg |ano=2026 |acessodata=2026-11-19}}</ref>

O levantamento fundamenta a posição institucional do '''NotMediaWiki''' como alternativa enciclopédica livre em conformidade nativa com o ordenamento jurídico brasileiro, em contraposição ao modelo centralizado e opaco atribuído à administração da Wikipédia lusófona.<ref name="dossie-pdf" />

== Contexto e Motivação da Investigação ==
Ao longo dos últimos anos, editores, biografados e pesquisadores brasileiros relataram obstáculos recorrentes ao solicitar retificação, anonimização ou eliminação de dados pessoais expostos em páginas de discussão, registros de bloqueio, verificações de contas (''CheckUser'') e históricos públicos da Wikipédia.<ref name="dossie-pdf" />

Segundo o dossiê, a ausência de um canal simplificado de atendimento em conformidade com o '''Art. 18 da LGPD''' e a manutenção indefinida de registros públicos de endereços IP e dados sensíveis criam assimetrias severas entre a Wikimedia Foundation e os cidadãos residentes no Brasil.<ref name="lgpd-lei">{{citar web |autor=Presidência da República |título=Lei nº 13.709, de 14 de agosto de 2018 (Lei Geral de Proteção de Dados Pessoais - LGPD) |url=https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm |publicado=Planalto |ano=2018}}</ref>

== Pontos Críticos Apontados Frente à LGPD (Lei nº 13.709/2018) ==
O documento analisa potenciais desconformidades da operação da WMF e da Wikipédia lusófona em relação aos princípios e deveres da LGPD:<ref name="dossie-pdf" /><ref name="lgpd-lei" />

=== Exposição de Dados Pessoais e Endereços IP ===
* '''Publicação permanente de IPs''': edições não autenticadas e registros administrativos históricos frequentemente vinculam endereços IP diretamente a contribuições públicas, permitindo rastreamento geográfico e correlação de identidade sem consentimento explícito adequado.
* '''Princípio da Minimização e Necessidade (Art. 6º, III)''': o dossiê questiona a retenção perpétua de comentários ofensivos, acusações não comprovadas e dados pessoais em páginas de discussão e arquivos de bloqueio.

=== Barreiras ao Exercício dos Direitos do Titular (Art. 18) ===
* '''Dificuldade de eliminação e anonimização''': pedidos de remoção de dados pessoais ou supressão de revisões (''Oversight'') são frequentemente redirecionados a procedimentos internos em língua estrangeira ou negados por administradores voluntários sem formação jurídica.
* '''Ausência de DPO acessível localmente''': o relatório destaca a falta de transparência sobre o Encarregado pelo Tratamento de Dados Pessoais (DPO) responsável por atender demandas brasileiras nos termos do Art. 41 da LGPD.<ref name="lgpd-lei" />

== Pontos Críticos Frente ao Marco Civil da Internet (Lei nº 12.965/2014) ==
Sob a perspectiva do '''Marco Civil da Internet''', o dossiê examina a responsabilidade por danos decorrentes de conteúdo de terceiros e a proteção à privacidade nas comunicações eletrônicas:<ref name="marco-civil">{{citar web |autor=Presidência da República |título=Lei nº 12.965, de 23 de abril de 2014 (Marco Civil da Internet) |url=https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2014/lei/l12965.htm |publicado=Planalto |ano=2014}}</ref>

* '''Inviolabilidade da intimidade e da vida privada (Art. 7º, I)''': a exposição coordenada de informações pessoais (''doxxing'') e perseguição em discussões comunitárias viola garantias fundamentais dos usuários da internet no Brasil.
* '''Guarda sigilosa de registros de acesso (Art. 15)''': o Marco Civil determina que registros de acesso a aplicações sejam mantidos sob sigilo, em ambiente controlado e de segurança, e não expostos abertamente em páginas públicas de histórico.
* '''Transparência e devido processo na moderação''': bloqueios indefinidos e sanções aplicadas por grupos fechados de administradores sem direito efetivo ao contraditório são apontados como falhas graves de governança.<ref name="dossie-pdf" />

== Comparativo: Wikipédia / WMF vs. NotMediaWiki ==
A tabela abaixo resume as diferenças estruturais defendidas pelo projeto '''NotMediaWiki''' (ecossistema WazzimaGiygg) em resposta às falhas documentadas na investigação:<ref name="dossie-pdf" />

{| class="wikitable"
! Critério de Governança !! Wikipédia / WMF (Apontado no Dossiê) !! NotMediaWiki (WazzimaGiygg)
|-
| '''Conformidade LGPD (Art. 18)''' || Fluxos complexos em inglês; supressão restrita e opaca || Central dedicada de Solicitações LGPD / Oversight e DPO ativo (<code>dpo@wazzimagiygg.com</code>)
|-
| '''Proteção de Dados e IPs (Marco Civil Art. 15)''' || Histórico público expõe IPs e metadados de forma ampla || Sigilo de logs em ambiente controlado com auditoria restrita e bot preventivo '''LgpdBot'''
|-
| '''Biografias de Pessoas Vivas (BPV)''' || Remoções demoradas sujeitas a disputas editoriais || Conselho de Ética BPV com remoção cautelar e respeito à privacidade
|-
| '''Due Process & Apelação''' || Bloqueios frequentemente definitivos sem revisão externa || Fila auditável de Desbloqueio e Conselho de Arbitragem transparente
|-
| '''Auditoria e Transparência''' || Decisões administrativas dispersas em múltiplos fóruns || Relatório de Impacto (RIPD / Art. 38) e logs verificáveis em tempo real
|}

== Documento Original na Íntegra ==
O relatório completo da investigação, contendo evidências documentais, fundamentação jurídica detalhada e anexos técnicos, está disponível para consulta e download público no portal WazzimaGiygg:

* [https://wazzimagiygg.com/Investiga%C3%A7%C3%A3o%20LGPD%20e%20Marco%20Civ%C3%ADl%20WMF%20e%20Wikip%C3%A9dia.pdf Baixar PDF: Investigação LGPD e Marco Civil — WMF e Wikipédia]<ref name="dossie-pdf" />

== Veja também ==
* [[MediaWiki]]
* [[Distributed_Systems]]

== Referências ==
`,
};
