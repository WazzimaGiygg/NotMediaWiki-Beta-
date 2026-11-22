export type WikiTemplateCategory = 'avisos' | 'navegacao' | 'infocaixa' | 'editorial' | 'dados';

export interface WikiTemplateParamDef {
  name: string;
  label: string;
  description: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  multiline?: boolean;
}

export interface WikiTemplateDefinition {
  id: string;
  name: string;
  aliases?: string[];
  category: WikiTemplateCategory;
  kind: 'block' | 'inline';
  description: string;
  exampleWikitext: string;
  params: WikiTemplateParamDef[];
}

export const TEMPLATE_CATEGORY_LABELS: Record<WikiTemplateCategory, string> = {
  avisos: 'Avisos & Manutenção',
  navegacao: 'Navegação & Remissivas',
  infocaixa: 'Infocaixas (Infobox)',
  editorial: 'Editorial & Citações',
  dados: 'Dados & Referências',
};

export const BUILTIN_MEDIAWIKI_TEMPLATES: WikiTemplateDefinition[] = [
  {
    id: 'tpl-aviso',
    name: 'Aviso',
    aliases: ['Ambox', 'Caixa de aviso', 'Alerta'],
    category: 'avisos',
    kind: 'block',
    description: 'Caixa de mensagem padrão do MediaWiki (Ambox) para alertas editoriais, avisos de manutenção, notas ou avisos críticos.',
    exampleWikitext: `{{Aviso\n| tipo = aviso\n| título = Artigo em revisão técnica\n| texto = Este conteúdo passa por verificação de fontes independentes.\n}}`,
    params: [
      {
        name: 'tipo',
        label: 'Tipo do aviso',
        description: 'Define o estilo visual: info, aviso, erro, sucesso ou manutencao.',
        placeholder: 'info | aviso | erro | sucesso | manutencao',
        defaultValue: 'info',
      },
      {
        name: 'título',
        label: 'Título',
        description: 'Cabeçalho resumido da caixa de aviso.',
        placeholder: 'Ex: Nota editorial',
        defaultValue: 'Aviso editorial',
        required: true,
      },
      {
        name: 'texto',
        label: 'Mensagem',
        description: 'Texto explicativo (aceita links internos [[Artigo]] e negrito).',
        placeholder: 'Descreva o motivo do aviso...',
        defaultValue: 'Este artigo encontra-se em processo de revisão pela comunidade.',
        multiline: true,
        required: true,
      },
    ],
  },
  {
    id: 'tpl-esboco',
    name: 'Esboço',
    aliases: ['Stub', 'Mínimo'],
    category: 'avisos',
    kind: 'block',
    description: 'Indica que o verbete ainda é um esboço introdutório e convida editores a expandi-lo.',
    exampleWikitext: `{{Esboço|Ciência da Computação}}`,
    params: [
      {
        name: '1',
        label: 'Tema / Área',
        description: 'Assunto principal do esboço (parâmetro posicional 1).',
        placeholder: 'Ex: Tecnologia, História, Direito Digital',
        defaultValue: 'Conhecimento livre',
      },
    ],
  },
  {
    id: 'tpl-sem-fontes',
    name: 'Sem fontes',
    aliases: ['Sem referências', 'Falta de fontes', 'Unreferenced'],
    category: 'avisos',
    kind: 'block',
    description: 'Aviso de topo indicando que o artigo não cita fontes confiáveis ou verificáveis.',
    exampleWikitext: `{{Sem fontes|data=Abril de 2026}}`,
    params: [
      {
        name: 'data',
        label: 'Data da marcação',
        description: 'Mês e ano em que a falta de fontes foi sinalizada.',
        placeholder: 'Ex: Abril de 2026',
        defaultValue: '2026',
      },
    ],
  },
  {
    id: 'tpl-em-construcao',
    name: 'Em construção',
    aliases: ['Em edição', 'WIP', 'Under construction'],
    category: 'avisos',
    kind: 'block',
    description: 'Sinaliza que uma página está em desenvolvimento ativo para evitar conflitos de edição.',
    exampleWikitext: `{{Em construção|usuário=Editor|nota=Expandindo seções técnicas.}}`,
    params: [
      {
        name: 'usuário',
        label: 'Editor responsável',
        description: 'Nome do usuário que está conduzindo a expansão.',
        placeholder: 'Ex: MariaSilva',
        defaultValue: '',
      },
      {
        name: 'nota',
        label: 'Observação',
        description: 'Detalhes sobre o trabalho em andamento.',
        placeholder: 'Ex: Adicionando referências e arquitetura.',
        defaultValue: '',
      },
    ],
  },
  {
    id: 'tpl-desambiguacao',
    name: 'Desambiguação',
    aliases: ['Disambig', 'Desambig'],
    category: 'avisos',
    kind: 'block',
    description: 'Banner oficial para páginas de desambiguação que listam múltiplos significados de um termo.',
    exampleWikitext: `{{Desambiguação}}`,
    params: [
      {
        name: 'termo',
        label: 'Termo ambíguo (opcional)',
        description: 'Nome do termo listado nesta página.',
        placeholder: 'Ex: MediaWiki',
        defaultValue: '',
      },
    ],
  },
  {
    id: 'tpl-spoiler',
    name: 'Spoiler',
    aliases: ['Revelação'],
    category: 'avisos',
    kind: 'block',
    description: 'Avisa o leitor que a seção seguinte contém revelações sobre o enredo de uma obra.',
    exampleWikitext: `{{Spoiler|obra=Série Documental}}`,
    params: [
      {
        name: 'obra',
        label: 'Título da obra',
        description: 'Nome do livro, filme ou projeto citado.',
        placeholder: 'Ex: Obra analisada',
        defaultValue: '',
      },
    ],
  },
  {
    id: 'tpl-em-traducao',
    name: 'Em tradução',
    aliases: ['Tradução', 'Translating'],
    category: 'avisos',
    kind: 'block',
    description: 'Indica que o verbete está sendo traduzido a partir de outro idioma ou projeto irmão.',
    exampleWikitext: `{{Em tradução|idioma=inglês|artigo=MediaWiki}}`,
    params: [
      {
        name: 'idioma',
        label: 'Idioma de origem',
        description: 'Idioma do artigo original.',
        placeholder: 'Ex: inglês, espanhol, francês',
        defaultValue: 'inglês',
      },
      {
        name: 'artigo',
        label: 'Artigo original (opcional)',
        description: 'Título do verbete de origem.',
        placeholder: 'Ex: MediaWiki',
        defaultValue: '',
      },
    ],
  },
  {
    id: 'tpl-evento-atual',
    name: 'Evento atual',
    aliases: ['Current', 'Notícia recente'],
    category: 'avisos',
    kind: 'block',
    description: 'Alerta que o artigo documenta um acontecimento em andamento e suas informações podem mudar rapidamente.',
    exampleWikitext: `{{Evento atual|assunto=Lançamento da versão 2.0|data=Novembro de 2026}}`,
    params: [
      {
        name: 'assunto',
        label: 'Assunto (opcional)',
        description: 'Evento ou processo atualmente em curso.',
        placeholder: 'Ex: Lançamento de protocolo',
        defaultValue: '',
      },
      {
        name: 'data',
        label: 'Data',
        description: 'Mês/ano de referência do evento.',
        placeholder: 'Ex: Novembro de 2026',
        defaultValue: '2026',
      },
    ],
  },
  {
    id: 'tpl-parcial',
    name: 'Parcial',
    aliases: ['NPOV', 'Parcialidade', 'POV'],
    category: 'avisos',
    kind: 'block',
    description: 'Sinaliza disputa sobre neutralidade editorial e convida editores a equilibrar pontos de vista com fontes.',
    exampleWikitext: `{{Parcial|motivo=Faltam fontes independentes para o contraponto.|data=2026}}`,
    params: [
      {
        name: 'motivo',
        label: 'Motivo da sinalização',
        description: 'Aspecto que necessita de maior imparcialidade.',
        placeholder: 'Ex: Redação opinativa na seção de críticas.',
        defaultValue: 'A redação atual pode beneficiar-se de fontes adicionais para assegurar ponto de vista neutro.',
        multiline: true,
      },
      {
        name: 'data',
        label: 'Data',
        description: 'Data da marcação editorial.',
        placeholder: 'Ex: Novembro de 2026',
        defaultValue: '2026',
      },
    ],
  },
  {
    id: 'tpl-revisao',
    name: 'Revisão',
    aliases: ['Reciclagem', 'Cleanup'],
    category: 'avisos',
    kind: 'block',
    description: 'Indica que o texto requer revisão ortográfica, formatação wiki ou organização de seções.',
    exampleWikitext: `{{Revisão|motivo=Formatar referências e seções.|data=2026}}`,
    params: [
      {
        name: 'motivo',
        label: 'Motivo da revisão',
        description: 'O que precisa ser ajustado no verbete.',
        placeholder: 'Ex: Padronizar seções e links internos.',
        defaultValue: 'Formatar ligações internas, ortografia e estrutura das seções.',
      },
      {
        name: 'data',
        label: 'Data',
        description: 'Mês/ano da marcação.',
        placeholder: 'Ex: 2026',
        defaultValue: '2026',
      },
    ],
  },
  {
    id: 'tpl-artigo-principal',
    name: 'Artigo principal',
    aliases: ['AP', 'Main'],
    category: 'navegacao',
    kind: 'block',
    description: 'Nota remissiva (hatnote) no início de seções apontando para o artigo completo sobre o subtema.',
    exampleWikitext: `{{Artigo principal|MediaWiki|Parsoid}}`,
    params: [
      {
        name: '1',
        label: 'Artigo principal 1',
        description: 'Nome exato da página de destino.',
        placeholder: 'Ex: MediaWiki',
        defaultValue: 'MediaWiki',
        required: true,
      },
      {
        name: '2',
        label: 'Artigo principal 2 (opcional)',
        description: 'Segundo verbete relacionado.',
        placeholder: 'Ex: Sistemas distribuídos',
        defaultValue: '',
      },
    ],
  },
  {
    id: 'tpl-veja-tambem',
    name: 'Veja também',
    aliases: ['Ver também', 'See also'],
    category: 'navegacao',
    kind: 'block',
    description: 'Nota remissiva (hatnote) indicando artigos complementares recomendados para leitura.',
    exampleWikitext: `{{Veja também|Parsoid|CentralAuth}}`,
    params: [
      {
        name: '1',
        label: 'Artigo 1',
        description: 'Primeiro artigo sugerido.',
        placeholder: 'Ex: Parsoid',
        defaultValue: 'MediaWiki',
        required: true,
      },
      {
        name: '2',
        label: 'Artigo 2 (opcional)',
        description: 'Segundo artigo sugerido.',
        placeholder: 'Ex: CentralAuth',
        defaultValue: '',
      },
    ],
  },
  {
    id: 'tpl-navbox',
    name: 'Navbox',
    aliases: ['Navegação', 'Caixa de navegação'],
    category: 'navegacao',
    kind: 'block',
    description: 'Caixa de navegação horizontal colocada no rodapé de artigos para conectar páginas da mesma série.',
    exampleWikitext: `{{Navbox\n| título = Ecossistema NotMediaWiki\n| grupo1 = Motor & Parser\n| lista1 = [[MediaWiki]] · [[Parsoid]] · [[Predefinições]]\n| grupo2 = Governança\n| lista2 = [[Especial:Burocratas]] · [[Especial:PáginasEspeciais]]\n}}`,
    params: [
      {
        name: 'título',
        label: 'Título da Navbox',
        description: 'Cabeçalho exibido no topo da caixa de navegação.',
        placeholder: 'Ex: Tópicos de Arquitetura Wiki',
        defaultValue: 'Navegação Temática',
        required: true,
      },
      {
        name: 'grupo1',
        label: 'Grupo 1',
        description: 'Rótulo da primeira linha de links.',
        placeholder: 'Ex: Núcleo',
        defaultValue: 'Conceitos Principais',
      },
      {
        name: 'lista1',
        label: 'Lista 1',
        description: 'Links separados por ponto médio (·).',
        placeholder: '[[Artigo 1]] · [[Artigo 2]]',
        defaultValue: '[[MediaWiki]] · [[Talk:MediaWiki]]',
        multiline: true,
      },
      {
        name: 'grupo2',
        label: 'Grupo 2 (opcional)',
        description: 'Rótulo da segunda linha.',
        placeholder: 'Ex: Ferramentas',
        defaultValue: '',
      },
      {
        name: 'lista2',
        label: 'Lista 2 (opcional)',
        description: 'Links da segunda linha.',
        placeholder: '[[Artigo 3]] · [[Artigo 4]]',
        defaultValue: '',
        multiline: true,
      },
    ],
  },
  {
    id: 'tpl-sem-saida',
    name: 'Sem saída',
    aliases: ['Deadend'],
    category: 'navegacao',
    kind: 'block',
    description: 'Alerta que o artigo possui poucas ou nenhuma ligação interna ([[wikilink]]) para outros verbetes.',
    exampleWikitext: `{{Sem saída|data=2026}}`,
    params: [
      {
        name: 'data',
        label: 'Data da marcação',
        description: 'Mês ou ano da sinalização.',
        placeholder: 'Ex: 2026',
        defaultValue: '2026',
      },
    ],
  },
  {
    id: 'tpl-tl',
    name: 'Predefinição',
    aliases: ['Tl', 'Predef', 'Template link'],
    category: 'navegacao',
    kind: 'inline',
    description: 'Exibe uma chamada de pré-definição clicável em fonte monoespaçada, ideal para documentação técnica.',
    exampleWikitext: `{{Predefinição|Aviso|tipo=dica}}`,
    params: [
      {
        name: '1',
        label: 'Nome da pré-definição',
        description: 'Nome da página em Predefinição: a ser vinculada.',
        placeholder: 'Ex: Aviso',
        defaultValue: 'Aviso',
        required: true,
      },
      {
        name: '2',
        label: 'Parâmetro ilustrativo 1 (opcional)',
        description: 'Exemplo de parâmetro exibido junto ao link.',
        placeholder: 'Ex: tipo=dica',
        defaultValue: '',
      },
    ],
  },
  {
    id: 'tpl-infocaixa',
    name: 'Infocaixa',
    aliases: ['Infobox genérica', 'Ficha técnica'],
    category: 'infocaixa',
    kind: 'block',
    description: 'Infocaixa lateral genérica do MediaWiki com título, imagem, legenda e até 12 pares dinâmicos de rótulo/dados.',
    exampleWikitext: `{{Infocaixa\n| título = Sistema Distribuído\n| subtítulo = Visão Geral Técnica\n| rótulo1 = Protocolo\n| dados1 = HTTP/2 + Firestore\n| rótulo2 = Licença\n| dados2 = MIT\n| rótulo3 = Mantenedor\n| dados3 = Projetos WazzimaGiygg\n}}`,
    params: [
      {
        name: 'título',
        label: 'Título da Infocaixa',
        description: 'Nome principal no topo do painel lateral.',
        placeholder: 'Ex: Nome do Verbete',
        defaultValue: 'Ficha Técnica',
        required: true,
      },
      {
        name: 'subtítulo',
        label: 'Subtítulo (opcional)',
        description: 'Classificação breve abaixo do título.',
        placeholder: 'Ex: Projeto Open Source',
        defaultValue: '',
      },
      {
        name: 'imagem',
        label: 'URL da imagem (opcional)',
        description: 'Endereço HTTPS ou /assets/... para ilustração.',
        placeholder: 'https://...',
        defaultValue: '',
      },
      {
        name: 'legenda',
        label: 'Legenda da imagem',
        description: 'Texto descritivo abaixo da imagem.',
        placeholder: 'Ex: Logotipo oficial',
        defaultValue: '',
      },
      {
        name: 'rótulo1',
        label: 'Rótulo 1',
        description: 'Nome do primeiro campo.',
        placeholder: 'Ex: Criador',
        defaultValue: 'Autor',
      },
      {
        name: 'dados1',
        label: 'Dados 1',
        description: 'Valor do primeiro campo.',
        placeholder: 'Ex: Comunidade Wiki',
        defaultValue: 'Equipe Editorial',
      },
      {
        name: 'rótulo2',
        label: 'Rótulo 2',
        description: 'Nome do segundo campo.',
        placeholder: 'Ex: Ano',
        defaultValue: 'Ano',
      },
      {
        name: 'dados2',
        label: 'Dados 2',
        description: 'Valor do segundo campo.',
        placeholder: 'Ex: 2026',
        defaultValue: '2026',
      },
      {
        name: 'rótulo3',
        label: 'Rótulo 3 (opcional)',
        description: 'Nome do terceiro campo.',
        placeholder: 'Ex: Categoria',
        defaultValue: '',
      },
      {
        name: 'dados3',
        label: 'Dados 3 (opcional)',
        description: 'Valor do terceiro campo.',
        placeholder: 'Ex: Infraestrutura',
        defaultValue: '',
      },
    ],
  },
  {
    id: 'tpl-infocaixa-pessoa',
    name: 'Infocaixa pessoa',
    aliases: ['Infobox pessoa', 'Infobox biografia'],
    category: 'infocaixa',
    kind: 'block',
    description: 'Infocaixa biográfica para pesquisadores, engenheiros, autores e personalidades históricas.',
    exampleWikitext: `{{Infocaixa pessoa\n| nome = Magnus Manske\n| ocupação = Biólogo e desenvolvedor\n| nacionalidade = Alemão\n| obras = [[MediaWiki]]\n}}`,
    params: [
      {
        name: 'nome',
        label: 'Nome completo',
        description: 'Nome exibido no cabeçalho da biografia.',
        placeholder: 'Ex: Magnus Manske',
        defaultValue: 'Personalidade',
        required: true,
      },
      {
        name: 'subtítulo',
        label: 'Subtítulo (opcional)',
        description: 'Título ou função curta.',
        placeholder: 'Ex: Cientista da computação',
        defaultValue: '',
      },
      {
        name: 'nascimento',
        label: 'Nascimento',
        description: 'Data de nascimento.',
        placeholder: 'Ex: 24 de maio de 1974',
        defaultValue: '',
      },
      {
        name: 'local',
        label: 'Local de nascimento',
        description: 'Cidade e país.',
        placeholder: 'Ex: Colônia, Alemanha',
        defaultValue: '',
      },
      {
        name: 'ocupação',
        label: 'Ocupação',
        description: 'Área de atuação principal.',
        placeholder: 'Ex: Engenheiro de software',
        defaultValue: 'Pesquisador(a)',
      },
      {
        name: 'nacionalidade',
        label: 'Nacionalidade',
        description: 'País de nacionalidade.',
        placeholder: 'Ex: Brasileira',
        defaultValue: '',
      },
      {
        name: 'obras',
        label: 'Principais contribuições',
        description: 'Obras, projetos ou criações notáveis.',
        placeholder: 'Ex: [[MediaWiki]]',
        defaultValue: '',
      },
      {
        name: 'website',
        label: 'Site oficial',
        description: 'URL institucional ou página pessoal.',
        placeholder: 'https://...',
        defaultValue: '',
      },
    ],
  },
  {
    id: 'tpl-infocaixa-organizacao',
    name: 'Infocaixa organização',
    aliases: ['Infobox organização', 'Infobox empresa'],
    category: 'infocaixa',
    kind: 'block',
    description: 'Infocaixa lateral para instituições, projetos coletivos, fundações e empresas de tecnologia.',
    exampleWikitext: `{{Infocaixa organização\n| nome = Projetos WazzimaGiygg\n| tipo = Ecossistema Digital Aberto\n| fundação = 2024\n| sede = Brasil\n| área = Enciclopédia livre e sistemas distribuídos\n}}`,
    params: [
      {
        name: 'nome',
        label: 'Nome da organização',
        description: 'Título oficial da instituição ou projeto.',
        placeholder: 'Ex: Projetos WazzimaGiygg',
        defaultValue: 'Organização',
        required: true,
      },
      {
        name: 'tipo',
        label: 'Tipo',
        description: 'Natureza jurídica ou coletiva.',
        placeholder: 'Ex: Fundação sem fins lucrativos',
        defaultValue: 'Projeto colaborativo',
      },
      {
        name: 'fundação',
        label: 'Fundação',
        description: 'Data ou ano de fundação.',
        placeholder: 'Ex: 2024',
        defaultValue: '2026',
      },
      {
        name: 'sede',
        label: 'Sede / Origem',
        description: 'Localidade principal.',
        placeholder: 'Ex: São Paulo, Brasil',
        defaultValue: '',
      },
      {
        name: 'fundadores',
        label: 'Fundadores',
        description: 'Criadores ou mantenedores iniciais.',
        placeholder: 'Ex: Comunidade Técnica',
        defaultValue: '',
      },
      {
        name: 'área',
        label: 'Área de atuação',
        description: 'Domínio de atividade.',
        placeholder: 'Ex: Conhecimento livre e software',
        defaultValue: '',
      },
      {
        name: 'website',
        label: 'Website oficial',
        description: 'URL do portal oficial.',
        placeholder: 'https://wazzimagiygg.com',
        defaultValue: '',
      },
    ],
  },
  {
    id: 'tpl-carece-de-fontes',
    name: 'Carece de fontes',
    aliases: ['Citation needed', 'CN', 'Sem fonte'],
    category: 'editorial',
    kind: 'inline',
    description: 'Marcação em linha sobrescrita [carece de fontes] usada após afirmações sem referência bibliográfica.',
    exampleWikitext: `Esta afirmação técnica ainda precisa de comprovação{{Carece de fontes|data=Abril de 2026}}.`,
    params: [
      {
        name: 'data',
        label: 'Data (opcional)',
        description: 'Mês/ano em que a citação foi solicitada.',
        placeholder: 'Ex: Abril de 2026',
        defaultValue: '',
      },
    ],
  },
  {
    id: 'tpl-ligacao-inativa',
    name: 'Ligação inativa',
    aliases: ['Link quebrado', 'Dead link'],
    category: 'editorial',
    kind: 'inline',
    description: 'Marcação em linha [ligação inativa] para links externos que ficaram indisponíveis.',
    exampleWikitext: `[https://exemplo.org Fonte original]{{Ligação inativa|data=2026}}`,
    params: [
      {
        name: 'data',
        label: 'Data da verificação (opcional)',
        description: 'Quando o link foi testado pela última vez.',
        placeholder: 'Ex: 2026',
        defaultValue: '',
      },
    ],
  },
  {
    id: 'tpl-citacao',
    name: 'Citação',
    aliases: ['Quote', 'Cquote'],
    category: 'editorial',
    kind: 'block',
    description: 'Bloco tipográfico de citação destacada com atribuição opcional de autor e fonte.',
    exampleWikitext: `{{Citação\n| texto = A documentação aberta multiplica o impacto coletivo da engenharia de software.\n| autor = Caderno Editorial\n| fonte = Anais WazzimaGiygg, 2026\n}}`,
    params: [
      {
        name: 'texto',
        label: 'Texto citado',
        description: 'Trecho literal da citação.',
        placeholder: 'Insira a citação aqui...',
        defaultValue: 'O conhecimento compartilhado fortalece toda a comunidade técnica.',
        multiline: true,
        required: true,
      },
      {
        name: 'autor',
        label: 'Autor',
        description: 'Nome do autor da frase ou obra.',
        placeholder: 'Ex: Nome do Autor',
        defaultValue: '',
      },
      {
        name: 'fonte',
        label: 'Obra / Fonte',
        description: 'Publicação, documento ou ano de origem.',
        placeholder: 'Ex: Manual Técnico, p. 42',
        defaultValue: '',
      },
    ],
  },
  {
    id: 'tpl-nota',
    name: 'Nota',
    aliases: ['Note', 'Callout', 'Observação'],
    category: 'editorial',
    kind: 'block',
    description: 'Quadro editorial destacado para observações técnicas, dicas de uso ou ressalvas importantes.',
    exampleWikitext: `{{Nota|tipo=dica|título=Dica de Edição|texto=Use predefinições personalizadas criando páginas no namespace Predefinição:.}}`,
    params: [
      {
        name: 'tipo',
        label: 'Estilo',
        description: 'info, dica ou alerta.',
        placeholder: 'info | dica | alerta',
        defaultValue: 'info',
      },
      {
        name: 'título',
        label: 'Título da nota',
        description: 'Rótulo curto no topo do quadro.',
        placeholder: 'Ex: Nota técnica',
        defaultValue: 'Nota',
      },
      {
        name: 'texto',
        label: 'Conteúdo da nota',
        description: 'Texto da observação.',
        placeholder: 'Escreva a observação...',
        defaultValue: 'Consulte a documentação oficial para detalhes de compatibilidade.',
        multiline: true,
        required: true,
      },
    ],
  },
  {
    id: 'tpl-destaque',
    name: 'Destaque',
    aliases: ['Artigo destacado', 'Featured article'],
    category: 'editorial',
    kind: 'block',
    description: 'Selo de reconhecimento editorial para artigos revisados e considerados exemplares na enciclopédia.',
    exampleWikitext: `{{Destaque|data=2026|texto=Verbete reconhecido pela profundidade técnica e referências verificáveis.}}`,
    params: [
      {
        name: 'data',
        label: 'Data da eleição',
        description: 'Data ou ano do reconhecimento.',
        placeholder: 'Ex: Abril de 2026',
        defaultValue: '2026',
      },
      {
        name: 'texto',
        label: 'Descrição opcional',
        description: 'Observação sobre a qualidade editorial.',
        placeholder: 'Texto adicional...',
        defaultValue: 'Este verbete atingiu o padrão de excelência editorial da comunidade.',
      },
    ],
  },
  {
    id: 'tpl-esclarecer',
    name: 'Esclarecimento necessário',
    aliases: ['Clarify', 'Esclarecer'],
    category: 'editorial',
    kind: 'inline',
    description: 'Marcação inline [esclarecimento necessário] para trechos ambíguos ou termos técnicos sem definição.',
    exampleWikitext: `O sistema opera em modo federado{{Esclarecimento necessário|razão=Explicar qual protocolo é usado.|data=2026}}.`,
    params: [
      {
        name: 'razão',
        label: 'Motivo (opcional)',
        description: 'O que precisa ficar mais claro no texto.',
        placeholder: 'Ex: Detalhar a versão do protocolo.',
        defaultValue: '',
      },
      {
        name: 'data',
        label: 'Data (opcional)',
        description: 'Data da observação.',
        placeholder: 'Ex: 2026',
        defaultValue: '',
      },
    ],
  },
  {
    id: 'tpl-tecla',
    name: 'Tecla',
    aliases: ['Kbd', 'Teclado'],
    category: 'editorial',
    kind: 'inline',
    description: 'Formata combinações de teclas e atalhos de teclado (ex.: Ctrl + S) com aparência de tecla física.',
    exampleWikitext: `Pressione {{Tecla|Ctrl|K}} para pesquisar.`,
    params: [
      {
        name: '1',
        label: 'Primeira tecla',
        description: 'Nome da tecla principal.',
        placeholder: 'Ex: Ctrl',
        defaultValue: 'Ctrl',
        required: true,
      },
      {
        name: '2',
        label: 'Segunda tecla (opcional)',
        description: 'Segunda tecla do atalho.',
        placeholder: 'Ex: S',
        defaultValue: 'S',
      },
      {
        name: '3',
        label: 'Terceira tecla (opcional)',
        description: 'Terceira tecla do atalho.',
        placeholder: 'Ex: Shift',
        defaultValue: '',
      },
    ],
  },
  {
    id: 'tpl-citar-web',
    name: 'Citar web',
    aliases: ['Cite web', 'Referência web'],
    category: 'dados',
    kind: 'inline',
    description: 'Formata uma referência bibliográfica web estruturada com título, link externo, autor, editora e data.',
    exampleWikitext: `{{Citar web|autor=MediaWiki Core|título=Help:Templates|url=https://www.mediawiki.org/wiki/Help:Templates|publicado=MediaWiki.org|data=2026}}`,
    params: [
      {
        name: 'título',
        label: 'Título da página',
        description: 'Título do documento ou matéria citada.',
        placeholder: 'Ex: Help:Templates',
        defaultValue: 'Documentação Oficial',
        required: true,
      },
      {
        name: 'url',
        label: 'URL',
        description: 'Endereço web completo (https://...).',
        placeholder: 'https://...',
        defaultValue: 'https://www.mediawiki.org/wiki/Help:Templates',
        required: true,
      },
      {
        name: 'autor',
        label: 'Autor',
        description: 'Autor ou organização responsável.',
        placeholder: 'Ex: Equipe Técnica',
        defaultValue: '',
      },
      {
        name: 'publicado',
        label: 'Publicado por',
        description: 'Site, periódico ou instituição.',
        placeholder: 'Ex: MediaWiki.org',
        defaultValue: '',
      },
      {
        name: 'data',
        label: 'Data de publicação',
        description: 'Ano ou data completa.',
        placeholder: 'Ex: 2026',
        defaultValue: '2026',
      },
    ],
  },
  {
    id: 'tpl-colunas',
    name: 'Colunas',
    aliases: ['Lista de colunas', 'Div col'],
    category: 'dados',
    kind: 'block',
    description: 'Organiza listas longas de tópicos, conceitos ou referências em múltiplas colunas responsivas.',
    exampleWikitext: `{{Colunas|colunas=2|Item A · Item B · Item C · Item D}}`,
    params: [
      {
        name: 'colunas',
        label: 'Número de colunas',
        description: 'Quantidade de colunas (2 ou 3).',
        placeholder: '2 ou 3',
        defaultValue: '2',
      },
      {
        name: '1',
        label: 'Conteúdo / Itens',
        description: 'Texto ou lista de itens separados por ponto médio ou quebra de linha.',
        placeholder: 'Tópico 1 · Tópico 2 · Tópico 3 · Tópico 4',
        defaultValue: '[[MediaWiki]] · [[Parsoid]] · [[Predefinições]] · [[Wikitext]]',
        multiline: true,
        required: true,
      },
    ],
  },
  {
    id: 'tpl-reflist',
    name: 'Reflist',
    aliases: ['Referências', 'Listaref'],
    category: 'dados',
    kind: 'block',
    description: 'Marca a seção de notas de rodapé; o motor Parsoid sincroniza automaticamente todas as tags <ref> do artigo.',
    exampleWikitext: `== Referências ==\n{{Reflist}}`,
    params: [],
  },
];

/**
 * Gera código Wikitext formatado para invocação de uma predefinição {{Nome|...}}
 */
export function buildTemplateInvocationWikitext(
  templateName: string,
  values: Record<string, string>,
  definition?: WikiTemplateDefinition
): string {
  const cleanName = templateName
    .replace(/^(?:Predefinição|Predef|Template):/i, '')
    .trim()
    .replace(/_/g, ' ');

  if (!definition || definition.params.length === 0) {
    const entries = Object.entries(values).filter(([, v]) => (v || '').trim() !== '');
    if (entries.length === 0) {
      return `{{${cleanName}}}`;
    }
    const inlineArgs = entries
      .map(([k, v]) => (/^\d+$/.test(k) ? v.trim() : `${k}=${v.trim()}`))
      .join('|');
    return `{{${cleanName}|${inlineArgs}}}`;
  }

  // Build ordered args according to definition
  const positionalParts: string[] = [];
  const namedParts: string[] = [];

  for (const param of definition.params) {
    const rawVal = (values[param.name] ?? param.defaultValue ?? '').trim();
    if (!rawVal) continue;
    if (/^\d+$/.test(param.name)) {
      positionalParts.push(rawVal);
    } else {
      namedParts.push(`${param.name} = ${rawVal}`);
    }
  }

  // Include any extra custom values user typed
  const knownKeys = new Set(definition.params.map(p => p.name));
  for (const [k, v] of Object.entries(values)) {
    if (!knownKeys.has(k) && (v || '').trim() !== '') {
      if (/^\d+$/.test(k)) {
        positionalParts.push(v.trim());
      } else {
        namedParts.push(`${k} = ${v.trim()}`);
      }
    }
  }

  if (definition.kind === 'inline' || (namedParts.length <= 1 && positionalParts.length <= 2 && !namedParts.some(p => p.length > 45))) {
    const combined = [
      ...positionalParts,
      ...namedParts.map(p => p.replace(/\s*=\s*/, '=')),
    ];
    if (combined.length === 0) {
      return `{{${cleanName}}}`;
    }
    return `{{${cleanName}|${combined.join('|')}}}`;
  }

  const lines = [`{{${cleanName}`];
  for (const p of positionalParts) {
    lines.push(`| ${p}`);
  }
  for (const np of namedParts) {
    lines.push(`| ${np}`);
  }
  lines.push('}}');
  return lines.join('\n');
}

/**
 * Esqueleto Wikitext inicial ao criar uma nova página no Namespace 10 (Predefinição:)
 */
export function buildDefaultTemplatePageSkeleton(templateName: string): string {
  const baseName = templateName.replace(/^(?:Predefinição|Predef|Template):/i, '').trim() || 'MinhaPredefinicao';
  return `<includeonly><div class="wiki-template-note not-prose rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 my-4 font-sans text-xs"><div class="font-bold text-slate-900 dark:text-slate-100 mb-1">{{{título|${baseName}}}}</div><div class="text-slate-700 dark:text-slate-300 leading-relaxed">{{{texto|{{{1|Conteúdo padrão da predefinição ${baseName}.}}}}}}</div></div></includeonly><noinclude>
== Documentação da Predefinição ==
Esta predefinição pertence ao namespace '''Predefinição:''' do {{SITENAME}} e pode ser transcluída em qualquer artigo usando a sintaxe padrão da MediaWiki.

=== Uso ===
<syntaxhighlight lang="wikitext">
{{${baseName}|título=Título personalizado|texto=Sua mensagem aqui}}
</syntaxhighlight>

=== Parâmetros ===
* '''título''' — Cabeçalho exibido na caixa (opcional).
* '''texto''' ou '''1''' — Corpo da mensagem renderizada.

[[Category:Predefinições]]
</noinclude>`;
}
