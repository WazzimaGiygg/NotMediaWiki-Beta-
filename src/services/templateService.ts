import {
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  Article,
  Revision,
  TemplateDiagnostic,
  TemplateDiagnosticType,
  UserSession,
  WikiEvent,
} from '../types';
import {
  auth,
  db,
  fetchArticleFromFirestore,
  fetchArticlesFromFirestore,
  handleFirestoreError,
  OperationType,
  saveArticleToFirestore,
} from '../firebase';
import {
  BUILTIN_MEDIAWIKI_TEMPLATES,
  WikiTemplateDefinition,
  buildDefaultTemplatePageSkeleton,
  buildTemplateInvocationWikitext,
} from '../data/defaultTemplates';
import { TEMPLATE_EXAMPLE_CUSTOM_TEMPLATE } from '../data/templateExampleArticle';
import {
  TemplateExpansionOptions,
  TemplateExpansionResult,
  ParsedTemplateCall,
  applyIncludeDirectives,
  expandWikitextTemplates,
  extractTemplateDeclaredParams,
  findBuiltinTemplate,
  normalizeTemplateKey,
  parseTemplateCallBody,
  splitTopLevelPipes,
  substituteTemplateParameters,
} from '../utils/templateEngine';
import { INFOBOX_SOFTWARE_FIELDS } from '../utils/infoboxSoftware';
import { parseTitle } from '../utils/namespaces';

export interface SaveTemplateInput {
  name: string;
  wikitext: string;
  summary?: string;
  comment?: string;
  authorUser?: UserSession | null;
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalized: {
    baseName: string;
    title: string;
    slug: string;
    key: string;
  };
  declaredParams: string[];
}

export interface ServiceTemplateExpansionOptions extends TemplateExpansionOptions {
  /** Parâmetros dinâmicos opcionais aplicados em placeholders {{{chave|padrão}}} */
  dynamicParams?: Record<string, string>;
}

export interface ExpectedTemplateParamInfo {
  name: string;
  label: string;
  description?: string;
  required: boolean;
  defaultValue?: string;
  placeholder?: string;
  present: boolean;
  currentValue?: string;
}

export type TemplateFixIssueType =
  | 'unclosed_braces'
  | 'unmatched_closing'
  | 'invalid_name'
  | 'unknown_template'
  | 'missing_required_param'
  | 'unresolved_param';

export interface TemplateCorrectionSuggestion {
  id: string;
  issueType: TemplateFixIssueType;
  severity: 'error' | 'warning';
  start: number;
  end: number;
  lineNumber: number;
  templateName: string;
  matchedTemplateName?: string;
  title: string;
  reason: string;
  originalSnippet: string;
  suggestedSnippet?: string;
  expectedParams: ExpectedTemplateParamInfo[];
  missingRequiredParams: string[];
}

export interface ActiveCursorTemplateContext {
  templateName: string;
  matchedTemplateName?: string;
  start: number;
  end: number;
  isUnclosed: boolean;
  expectedParams: ExpectedTemplateParamInfo[];
  missingRequiredParams: string[];
}

export interface TemplateSuggestionAnalysisResult {
  suggestions: TemplateCorrectionSuggestion[];
  activeCursorTemplate: ActiveCursorTemplateContext | null;
}

const MAX_TITLE_LEN = 255;
const MAX_WIKITEXT_LEN = 500000;
const MAX_SUMMARY_LEN = 2000;
const INVALID_TITLE_CHARS_RE = /[#<>[\]{}|]/;

const MAGIC_WORD_NAMES = new Set([
  'PAGENAME',
  'NOMEDAPAGINA',
  'FULLPAGENAME',
  'NOMECOMPLETODAPAGINA',
  'NAMESPACE',
  'DOMINIO',
  'SITENAME',
  'NOMEDOSITE',
  'CURRENTYEAR',
  'ANOATUAL',
  'CURRENTMONTH',
  'MESATUAL',
  'CURRENTMONTHNAME',
  'NOMEDOMESATUAL',
  'CURRENTDAY',
  'DIAATUAL',
  'CURRENTDATE',
]);

const BUILTIN_PARAM_ALIASES: Record<string, Record<string, string[]>> = {
  aviso: {
    tipo: ['tipo', 'type', '1'],
    título: ['título', 'titulo', 'title', 'cabeçalho'],
    texto: ['texto', 'text', 'mensagem', '2'],
  },
  esboço: {
    '1': ['1', 'tema', 'topic'],
  },
  'sem fontes': {
    data: ['data', 'date', '1'],
  },
  'em construção': {
    usuário: ['usuário', 'usuario', 'user', '1'],
    nota: ['nota', 'motivo', 'note', '2'],
  },
  desambiguação: {
    termo: ['termo', '1'],
  },
  spoiler: {
    obra: ['obra', '1'],
  },
  'em tradução': {
    idioma: ['idioma', '1', 'lang'],
    artigo: ['artigo', '2', 'article'],
  },
  'evento atual': {
    assunto: ['assunto', '1', 'subject'],
    data: ['data', '2', 'date'],
  },
  parcial: {
    motivo: ['motivo', '1', 'reason'],
    data: ['data', '2', 'date'],
  },
  revisão: {
    motivo: ['motivo', '1', 'reason'],
    data: ['data', '2', 'date'],
  },
  'artigo principal': {
    '1': ['1', 'artigo'],
    '2': ['2'],
  },
  'veja também': {
    '1': ['1'],
    '2': ['2'],
  },
  navbox: {
    título: ['título', 'titulo', 'title'],
    grupo1: ['grupo1', 'group1'],
    lista1: ['lista1', 'list1'],
    grupo2: ['grupo2', 'group2'],
    lista2: ['lista2', 'list2'],
  },
  'sem saída': {
    data: ['data', '1', 'date'],
  },
  predefinição: {
    '1': ['1', 'nome'],
    '2': ['2'],
  },
  infocaixa: {
    título: ['título', 'titulo', 'title', 'nome', 'name'],
    subtítulo: ['subtítulo', 'subtitulo', 'subtitle'],
    imagem: ['imagem', 'image', 'logo'],
    legenda: ['legenda', 'caption'],
    rótulo1: ['rótulo1', 'rotulo1', 'label1'],
    dados1: ['dados1', 'data1'],
    rótulo2: ['rótulo2', 'rotulo2', 'label2'],
    dados2: ['dados2', 'data2'],
    rótulo3: ['rótulo3', 'rotulo3', 'label3'],
    dados3: ['dados3', 'data3'],
  },
  'infocaixa pessoa': {
    nome: ['nome', 'name', 'título', 'titulo', '1'],
    subtítulo: ['subtítulo', 'subtitulo', 'subtitle'],
    nascimento: ['nascimento', 'data_nascimento', 'birth_date'],
    local: ['local', 'local_nascimento', 'birth_place'],
    ocupação: ['ocupação', 'ocupacao', 'occupation', 'profissão', 'profissao'],
    nacionalidade: ['nacionalidade', 'nationality'],
    obras: ['obras', 'obras_notáveis', 'obras_notaveis', 'notable_works'],
    website: ['website', 'site'],
  },
  'infocaixa organização': {
    nome: ['nome', 'name', 'título', 'titulo', '1'],
    tipo: ['tipo', 'type'],
    fundação: ['fundação', 'fundacao', 'founded'],
    sede: ['sede', 'headquarters', 'local'],
    fundadores: ['fundadores', 'founders'],
    área: ['área', 'area', 'industry'],
    website: ['website', 'site'],
  },
  'carece de fontes': {
    data: ['data', 'date', '1'],
  },
  'ligação inativa': {
    data: ['data', 'date', '1'],
  },
  citação: {
    texto: ['texto', '1', 'quote'],
    autor: ['autor', '2', 'author'],
    fonte: ['fonte', '3', 'source'],
  },
  nota: {
    tipo: ['tipo', 'type'],
    título: ['título', 'titulo', 'title'],
    texto: ['texto', 'text', '1'],
  },
  destaque: {
    data: ['data', 'date', '1'],
    texto: ['texto', '2'],
  },
  'esclarecimento necessário': {
    razão: ['razão', 'razao', 'reason', '1'],
    data: ['data', 'date', '2'],
  },
  tecla: {
    '1': ['1', 'tecla', 'key'],
    '2': ['2'],
    '3': ['3'],
  },
  'citar web': {
    título: ['título', 'titulo', 'title', '1'],
    url: ['url', 'link', '2'],
    autor: ['autor', 'author'],
    publicado: ['publicado', 'publisher', 'obra', 'work'],
    data: ['data', 'ano', 'date', 'year'],
  },
  colunas: {
    colunas: ['colunas', 'cols', '2'],
    '1': ['1', 'conteúdo', 'conteudo', 'content'],
  },
  'mais fontes': {
    data: ['data', 'date', '1'],
    assunto: ['assunto', 'seção', 'secao', 'topic', '2'],
  },
  wikificação: {
    data: ['data', 'date', '1'],
    motivo: ['motivo', 'reason', '2'],
  },
  fusão: {
    '1': ['1', 'artigo', 'destino', 'target'],
    data: ['data', 'date'],
    motivo: ['motivo', 'reason'],
  },
  atualizar: {
    data: ['data', 'date', '1'],
    parte: ['parte', 'part', 'motivo', '2'],
  },
  publicidade: {
    data: ['data', 'date', '1'],
    motivo: ['motivo', 'reason', '2'],
  },
  controverso: {
    motivo: ['motivo', 'reason', '1'],
    data: ['data', 'date', '2'],
  },
  protegido: {
    nível: ['nível', 'nivel', 'level', '1'],
    motivo: ['motivo', 'reason', '2'],
  },
  redireciona: {
    '1': ['1', 'termo'],
    '2': ['2', 'destino'],
  },
  sobre: {
    '1': ['1', 'assunto'],
    '2': ['2'],
    '3': ['3', 'destino'],
  },
  distinguir: {
    '1': ['1'],
    '2': ['2'],
  },
  portal: {
    '1': ['1'],
    '2': ['2'],
    '3': ['3'],
  },
  correlatos: {
    commons: ['commons', '1'],
    wikiquote: ['wikiquote', '2'],
    wikcionario: ['wikcionario', 'wikcionário', 'wiktionary', '3'],
    wikisource: ['wikisource', '4'],
  },
  'controle de autoridade': {
    VIAF: ['VIAF', 'viaf'],
    ISNI: ['ISNI', 'isni'],
    ORCID: ['ORCID', 'orcid'],
    LCCN: ['LCCN', 'lccn'],
    GND: ['GND', 'gnd'],
    Wikidata: ['Wikidata', 'wikidata'],
  },
  'infocaixa país': {
    nome: ['nome', 'name', 'título', 'titulo', '1'],
    imagem: ['imagem', 'bandeira', 'image'],
    capital: ['capital'],
    idioma: ['idioma', 'língua', 'lingua', 'idiomas'],
    governo: ['governo', 'sistema'],
    população: ['população', 'populacao'],
    área: ['área', 'area'],
    moeda: ['moeda', 'currency'],
  },
  'infocaixa município': {
    nome: ['nome', 'name', 'título', 'titulo', '1'],
    estado: ['estado', 'uf', 'província', 'provincia'],
    país: ['país', 'pais', 'country'],
    fundação: ['fundação', 'fundacao'],
    população: ['população', 'populacao'],
    área: ['área', 'area'],
    fuso: ['fuso', 'timezone'],
    website: ['website', 'site'],
  },
  'infocaixa filme': {
    título: ['título', 'titulo', 'title', 'nome', '1'],
    imagem: ['imagem', 'poster', 'image'],
    direção: ['direção', 'direcao', 'diretor', 'director'],
    roteiro: ['roteiro', 'writer'],
    elenco: ['elenco', 'starring'],
    gênero: ['gênero', 'genero', 'genre'],
    duração: ['duração', 'duracao', 'runtime'],
    ano: ['ano', 'lançamento', 'lancamento', 'year'],
    país: ['país', 'pais', 'country'],
  },
  'infocaixa livro': {
    título: ['título', 'titulo', 'title', 'nome', '1'],
    autor: ['autor', 'author'],
    gênero: ['gênero', 'genero', 'genre'],
    editora: ['editora', 'publisher'],
    ano: ['ano', 'lançamento', 'lancamento', 'year'],
    páginas: ['páginas', 'paginas', 'pages'],
    isbn: ['isbn'],
    idioma: ['idioma', 'language'],
  },
  'infocaixa jogo': {
    título: ['título', 'titulo', 'title', 'nome', '1'],
    desenvolvedora: ['desenvolvedora', 'developer'],
    publicadora: ['publicadora', 'publisher'],
    gênero: ['gênero', 'genero', 'genre'],
    plataformas: ['plataformas', 'plataforma', 'platforms'],
    lançamento: ['lançamento', 'lancamento', 'ano', 'release'],
    modos: ['modos', 'modes'],
  },
  'infocaixa álbum': {
    nome: ['nome', 'título', 'titulo', 'name', '1'],
    artista: ['artista', 'artist', 'banda'],
    tipo: ['tipo', 'type'],
    lançamento: ['lançamento', 'lancamento', 'ano', 'released'],
    gênero: ['gênero', 'genero', 'genre'],
    duração: ['duração', 'duracao', 'length'],
    gravadora: ['gravadora', 'label'],
  },
  'infocaixa taxonomia': {
    nome: ['nome', 'name', 'título', 'titulo', '1'],
    estado: ['estado', 'conservação', 'conservacao', 'status'],
    reino: ['reino', 'regnum'],
    filo: ['filo', 'divisão', 'divisao', 'phylum'],
    classe: ['classe', 'classis'],
    ordem: ['ordem', 'ordo'],
    família: ['família', 'familia'],
    gênero: ['gênero', 'genero', 'genus'],
    espécie: ['espécie', 'especie', 'species', 'binomial'],
  },
  'quem?': {
    data: ['data', 'date', '1'],
  },
  'quando?': {
    data: ['data', 'date', '1'],
  },
  'por quê?': {
    razão: ['razão', 'razao', 'reason', '1'],
    data: ['data', 'date', '2'],
  },
  'caixa de diálogo': {
    título: ['título', 'titulo', 'title'],
    '1': ['1', 'conteúdo', 'conteudo', 'content', 'texto'],
  },
  'sem quebra': {
    '1': ['1', 'texto'],
  },
  símbolo: {
    '1': ['1', 'estado', 'status'],
    '2': ['2', 'texto', 'label'],
  },
  'citar livro': {
    título: ['título', 'titulo', 'title', '1'],
    autor: ['autor', 'author', 'sobrenome'],
    editora: ['editora', 'publisher'],
    local: ['local', 'location'],
    ano: ['ano', 'data', 'year', 'date'],
    páginas: ['páginas', 'paginas', 'pages', 'p'],
    isbn: ['isbn'],
  },
  'citar periódico': {
    título: ['título', 'titulo', 'title', '1'],
    jornal: ['jornal', 'periódico', 'periodico', 'revista', 'journal'],
    autor: ['autor', 'author'],
    volume: ['volume', 'vol'],
    número: ['número', 'numero', 'issue'],
    páginas: ['páginas', 'paginas', 'pages'],
    ano: ['ano', 'data', 'year', 'date'],
    doi: ['doi'],
  },
  'citar notícia': {
    título: ['título', 'titulo', 'title', '1'],
    jornal: ['jornal', 'publicado', 'newspaper', 'work'],
    url: ['url', 'link'],
    autor: ['autor', 'author'],
    data: ['data', 'ano', 'date', 'year'],
  },
  coord: {
    '1': ['1', 'lat', 'latitude'],
    '2': ['2', 'lon', 'lng', 'longitude'],
    nome: ['nome', 'name', 'title'],
  },
  converter: {
    '1': ['1', 'valor'],
    '2': ['2', 'de'],
    '3': ['3', 'para'],
  },
  dni: {
    '1': ['1', 'dia'],
    '2': ['2', 'mes', 'mês'],
    '3': ['3', 'ano'],
  },
  lang: {
    '1': ['1', 'lang', 'código', 'codigo'],
    '2': ['2', 'texto', 'text'],
  },
  'site oficial': {
    '1': ['1', 'url', 'site'],
    nome: ['nome', '2', 'name', 'label'],
  },
  'infocaixa software': {
    nome: ['nome', 'name', 'título', 'titulo', '1'],
    desenvolvedor: ['desenvolvedor', 'developer', 'autor', 'author'],
    versão: ['versão', 'versao', 'version'],
    lançamento: ['lançamento', 'lancamento', 'release'],
    linguagem: ['linguagem', 'language', 'programming_language'],
    sistema: ['sistema', 'so', 'operating_system', 'plataforma'],
    licença: ['licença', 'licenca', 'license'],
    website: ['website', 'site'],
  },
  'infocaixa artista musical': {
    nome: ['nome', 'name', 'título', 'titulo', '1'],
    origem: ['origem', 'origin', 'local'],
    gênero: ['gênero', 'genero', 'gêneros', 'generos', 'genre'],
    período: ['período', 'periodo', 'years_active', 'atividade'],
    gravadora: ['gravadora', 'label'],
    integrantes: ['integrantes', 'membros', 'members'],
    website: ['website', 'site'],
  },
  'infocaixa evento': {
    título: ['título', 'titulo', 'title', 'nome', '1'],
    tipo: ['tipo', 'type'],
    data: ['data', 'date', 'período', 'periodo'],
    local: ['local', 'location', 'cidade'],
    participantes: ['participantes', 'participants', 'organizadores'],
    website: ['website', 'site'],
  },
  'infocaixa universidade': {
    nome: ['nome', 'name', 'título', 'titulo', '1'],
    sigla: ['sigla', 'acronym'],
    fundação: ['fundação', 'fundacao', 'founded'],
    tipo: ['tipo', 'type'],
    localização: ['localização', 'localizacao', 'local', 'sede'],
    reitor: ['reitor', 'diretor'],
    estudantes: ['estudantes', 'alunos', 'students'],
    website: ['website', 'site'],
  },
  'infocaixa empresa': {
    nome: ['nome', 'name', 'título', 'titulo', '1'],
    tipo: ['tipo', 'type'],
    setor: ['setor', 'área', 'area', 'industry'],
    fundação: ['fundação', 'fundacao', 'founded'],
    sede: ['sede', 'headquarters', 'local'],
    fundadores: ['fundadores', 'founders'],
    website: ['website', 'site'],
  },
  'artigo bom': {
    data: ['data', 'date', '1'],
    texto: ['texto', '2'],
  },
  'escopo global': {
    região: ['região', 'regiao', 'region', '1'],
    data: ['data', 'date', '2'],
    motivo: ['motivo', 'reason'],
  },
  'fonte primária': {
    data: ['data', 'date', '1'],
    assunto: ['assunto', 'seção', 'secao', '2'],
  },
  'traduzido de': {
    '1': ['1', 'idioma', 'lang'],
    '2': ['2', 'artigo', 'title'],
    versao: ['versao', 'versão', 'data', 'version'],
  },
  anexo: {
    '1': ['1'],
    '2': ['2'],
  },
  cronologia: {
    título: ['título', 'titulo', 'title'],
    item1: ['item1', '1'],
    item2: ['item2', '2'],
    item3: ['item3', '3'],
    item4: ['item4', '4'],
  },
  galeria: {
    título: ['título', 'titulo', 'title'],
    img1: ['img1', 'imagem1'],
    leg1: ['leg1', 'legenda1', 'caption1'],
    img2: ['img2', 'imagem2'],
    leg2: ['leg2', 'legenda2', 'caption2'],
  },
  'imagem dupla': {
    título: ['título', 'titulo', 'title'],
    img1: ['img1', 'imagem1', 'image1'],
    leg1: ['leg1', 'legenda1', 'caption1'],
    img2: ['img2', 'imagem2', 'image2'],
    leg2: ['leg2', 'legenda2', 'caption2'],
  },
  voto: {
    '1': ['1', 'posição', 'posicao', 'tipo'],
    '2': ['2', 'comentário', 'comentario', 'texto'],
  },
  etiqueta: {
    '1': ['1', 'texto', 'label'],
    tipo: ['tipo', 'type', '2'],
  },
  áudio: {
    '1': ['1', 'arquivo', 'url'],
    '2': ['2', 'rótulo', 'rotulo', 'label'],
  },
  ipa: {
    '1': ['1', 'transcrição', 'transcricao'],
    lang: ['lang', 'idioma', '2'],
  },
  moeda: {
    '1': ['1', 'valor'],
    '2': ['2', 'moeda', 'code'],
  },
  'barra de progresso': {
    '1': ['1', 'percentual', 'value'],
    título: ['título', 'titulo', 'title'],
    cor: ['cor', 'color'],
  },
  matemática: {
    '1': ['1', 'expressão', 'expressao', 'expr'],
  },
  código: {
    '1': ['1', 'código', 'codigo', 'code'],
    lang: ['lang', 'linguagem', '2'],
  },
  isbn: {
    '1': ['1', 'isbn', 'código', 'codigo'],
  },
  doi: {
    '1': ['1', 'doi', 'id'],
    título: ['título', 'titulo', 'title', '2'],
  },
};

function stripAccents(value: string): string {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function foldTemplateKey(value: string): string {
  return stripAccents(normalizeTemplateKey(value));
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, idx) => idx);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[n];
}

/**
 * Replaces protected spans (<nowiki>, code, pre, include directives) with spaces while preserving
 * exact character offsets and newline positions.
 */
function maskProtectedWikitext(wikitext: string): string {
  const maskMatch = (match: string) => match.replace(/[^\n]/g, ' ');
  return (wikitext || '')
    .replace(/<nowiki>[\s\S]*?<\/nowiki>/gi, maskMatch)
    .replace(/<(?:syntaxhighlight|source)(?:\s+[^>]*)?>[\s\S]*?<\/(?:syntaxhighlight|source)>/gi, maskMatch)
    .replace(/<pre(?:\s+[^>]*)?>[\s\S]*?<\/pre>/gi, maskMatch)
    .replace(/```[\s\S]*?```/g, maskMatch)
    .replace(/`[^`\n]+`/g, maskMatch)
    .replace(/<\/?(?:includeonly|noinclude|onlyinclude)>/gi, maskMatch);
}

function extractCustomTemplateParamSpecs(templateWikitext: string): Array<{
  name: string;
  required: boolean;
  defaultValue?: string;
}> {
  const body = applyIncludeDirectives(templateWikitext || '', true).trim() || templateWikitext || '';
  const specs = new Map<string, { name: string; required: boolean; defaultValue?: string }>();
  let i = 0;

  while (i < body.length) {
    if (body.startsWith('{{{', i)) {
      const stack: number[] = [3];
      let j = i + 3;
      while (j < body.length && stack.length > 0) {
        if (body[j] === '{') {
          let openCount = 0;
          while (body[j + openCount] === '{') openCount++;
          let rem = openCount;
          while (rem >= 2) {
            if (rem === 3 || (rem >= 5 && rem % 2 === 1)) {
              stack.push(3);
              rem -= 3;
            } else {
              stack.push(2);
              rem -= 2;
            }
          }
          j += openCount;
          continue;
        }
        if (body[j] === '}') {
          let closeCount = 0;
          while (body[j + closeCount] === '}') closeCount++;
          let consumed = 0;
          while (stack.length > 0 && closeCount - consumed >= stack[stack.length - 1]) {
            consumed += stack.pop()!;
          }
          j += consumed > 0 ? consumed : closeCount;
          continue;
        }
        j++;
      }

      if (stack.length === 0) {
        const inner = body.slice(i + 3, j - 3);
        const parts = splitTopLevelPipes(inner);
        const name = (parts[0] || '').trim();
        const hasDefault = parts.length > 1;
        const rawDefault = hasDefault ? parts.slice(1).join('|').trim() : undefined;
        const cleanDefault =
          rawDefault && !rawDefault.includes('{{{')
            ? rawDefault.replace(/\{\{[A-Z]+\}\}/g, '').trim() || rawDefault
            : undefined;

        if (name) {
          const prev = specs.get(name.toLowerCase());
          if (!prev) {
            specs.set(name.toLowerCase(), {
              name,
              required: !hasDefault,
              defaultValue: cleanDefault,
            });
          } else {
            if (!hasDefault) prev.required = true;
            if (!prev.defaultValue && cleanDefault) prev.defaultValue = cleanDefault;
          }
        }
        i = j;
        continue;
      }
    }
    i++;
  }

  return Array.from(specs.values());
}

function defaultPlaceholderForParam(param: Pick<ExpectedTemplateParamInfo, 'name' | 'defaultValue' | 'placeholder'>): string {
  if (param.defaultValue && param.defaultValue.trim()) {
    return param.defaultValue.trim();
  }
  const cleanedPlaceholder = (param.placeholder || '')
    .replace(/^Ex\.?:\s*/i, '')
    .split('|')[0]
    .trim();
  if (cleanedPlaceholder && !cleanedPlaceholder.includes('...')) {
    return cleanedPlaceholder;
  }
  if (/^\d+$/.test(param.name)) {
    return 'valor';
  }
  if (param.name === 'url') {
    return 'https://exemplo.org';
  }
  return param.name;
}

function formatUpdatedTemplateCall(
  rawCallSnippet: string,
  targetName: string,
  paramsToAppend: ExpectedTemplateParamInfo[],
  forceCloseBraces = true
): string {
  let trimmed = rawCallSnippet.trimEnd();
  const hasClosing = trimmed.endsWith('}}');
  const hasSingleClosing = !hasClosing && trimmed.endsWith('}') && !trimmed.endsWith('|}');

  let inner = trimmed;
  if (inner.startsWith('{{')) {
    inner = inner.slice(2);
  } else if (inner.startsWith('{')) {
    inner = inner.slice(1);
  }

  if (hasClosing) {
    inner = inner.slice(0, -2);
  } else if (hasSingleClosing) {
    inner = inner.slice(0, -1);
  }

  const segments = splitTopLevelPipes(inner);
  const firstSeg = segments[0] ?? '';
  const leadingWs = firstSeg.match(/^\s*/)?.[0] ?? '';
  const trailingWs = firstSeg.match(/\s*$/)?.[0] ?? '';
  const cleanFirstSeg = `${leadingWs}${targetName}${trailingWs}`;
  segments[0] = cleanFirstSeg;

  const isMultiline = inner.includes('\n');
  const existingBody = segments.join('|');

  if (paramsToAppend.length === 0) {
    const cleanBody = existingBody.replace(/\s+$/, '');
    if (isMultiline && (hasClosing || forceCloseBraces)) {
      return `{{${cleanBody}\n}}`;
    }
    return `{{${existingBody.trimEnd()}${forceCloseBraces || hasClosing ? '}}' : ''}`;
  }

  if (isMultiline) {
    const cleanBody = existingBody.replace(/\s+$/, '');
    const addedLines = paramsToAppend.map(p => {
      const val = defaultPlaceholderForParam(p);
      return /^\d+$/.test(p.name) ? `| ${val}` : `| ${p.name} = ${val}`;
    });
    return `{{${cleanBody}\n${addedLines.join('\n')}\n}}`;
  }

  const cleanSingleBody = existingBody.trimEnd().replace(/\|$/, '');
  const addedInline = paramsToAppend.map(p => {
    const val = defaultPlaceholderForParam(p);
    return /^\d+$/.test(p.name) ? val : `${p.name}=${val}`;
  });
  return `{{${cleanSingleBody}|${addedInline.join('|')}}}`;
}

export function applyTemplateSuggestionFix(
  wikitext: string,
  suggestion: Pick<TemplateCorrectionSuggestion, 'start' | 'end' | 'suggestedSnippet'>
): string {
  if (suggestion.suggestedSnippet === undefined) return wikitext;
  const start = Math.max(0, Math.min(wikitext.length, suggestion.start));
  const end = Math.max(start, Math.min(wikitext.length, suggestion.end));
  return wikitext.slice(0, start) + suggestion.suggestedSnippet + wikitext.slice(end);
}

export function applyAllTemplateSuggestionFixes(
  wikitext: string,
  suggestions: TemplateCorrectionSuggestion[]
): string {
  const fixable = suggestions
    .filter(s => s.suggestedSnippet !== undefined)
    .sort((a, b) => b.start - a.start || b.end - a.end);

  let next = wikitext;
  let lastAppliedStart = Number.POSITIVE_INFINITY;

  for (const s of fixable) {
    // Skip overlapping nested edits when an outer fix covering this range was already applied
    if (s.end > lastAppliedStart) {
      continue;
    }
    next = applyTemplateSuggestionFix(next, s);
    lastAppliedStart = s.start;
  }

  return next;
}

export function appendTemplateParameterSnippet(
  wikitext: string,
  templateRange: { start: number; end: number; isUnclosed?: boolean },
  param: Pick<ExpectedTemplateParamInfo, 'name' | 'defaultValue' | 'placeholder'>
): { nextWikitext: string; selectionStart: number; selectionEnd: number } {
  const start = Math.max(0, Math.min(wikitext.length, templateRange.start));
  const end = Math.max(start, Math.min(wikitext.length, templateRange.end));
  const snippet = wikitext.slice(start, end);
  const val = defaultPlaceholderForParam(param);
  const isMultiline = snippet.includes('\n');
  const trimmedEnd = snippet.trimEnd();
  const closesProperly = trimmedEnd.endsWith('}}');
  const bodyWithoutClosing = closesProperly ? trimmedEnd.slice(0, -2) : trimmedEnd;
  const closing = closesProperly || templateRange.isUnclosed ? '}}' : '';

  const addition = isMultiline
    ? '\n' + (/^\d+$/.test(param.name) ? `| ${val}` : `| ${param.name} = ${val}`)
    : (/^\d+$/.test(param.name) ? `|${val}` : `|${param.name}=${val}`);

  const nextSnippet = isMultiline
    ? `${bodyWithoutClosing.replace(/\s+$/, '')}${addition}${closing ? `\n${closing}` : ''}`
    : `${bodyWithoutClosing.replace(/\|$/, '')}${addition}${closing}`;

  const nextWikitext = wikitext.slice(0, start) + nextSnippet + wikitext.slice(end);
  const valIndexInAddition = addition.lastIndexOf(val);
  const valStart =
    start +
    (isMultiline ? bodyWithoutClosing.replace(/\s+$/, '').length : bodyWithoutClosing.replace(/\|$/, '').length) +
    valIndexInAddition;
  const valEnd = valStart + val.length;

  return { nextWikitext, selectionStart: valStart, selectionEnd: valEnd };
}

/**
 * Normalizes a raw template name or slug into canonical Namespace 10 title and slug.
 */
export function normalizeTemplateIdentity(rawName: string): {
  baseName: string;
  title: string;
  slug: string;
  key: string;
} {
  const stripped = (rawName || '')
    .trim()
    .replace(/^:/, '')
    .replace(/^(?:Predefinição|Predef|Template)\s*:/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const baseName = stripped;
  const title = baseName ? `Predefinição:${baseName}` : 'Predefinição:';
  const slug = title.replace(/\s+/g, '_');
  const key = normalizeTemplateKey(baseName);

  return { baseName, title, slug, key };
}

function stripProtectedMarkupForValidation(wikitext: string): string {
  return (wikitext || '')
    .replace(/<nowiki>[\s\S]*?<\/nowiki>/gi, '')
    .replace(/<syntaxhighlight\b[^>]*>[\s\S]*?<\/syntaxhighlight>/gi, '')
    .replace(/<pre>[\s\S]*?<\/pre>/gi, '')
    .replace(/<code>[\s\S]*?<\/code>/gi, '');
}

/**
 * Extrai nomes de predefinições referenciadas em wikitext via sintaxe {{Nome|...}}.
 */
export function extractTemplateReferences(wikitext: string): string[] {
  const clean = stripProtectedMarkupForValidation(wikitext || '');
  const found = new Set<string>();
  const matches = clean.matchAll(/\{\{\s*([^|{}#\n]+?)(?:\s*\||\s*\}\})/g);
  for (const m of matches) {
    const candidate = (m[1] || '').trim();
    if (
      candidate &&
      !candidate.startsWith('{') &&
      !/^(?:PAGENAME|FULLPAGENAME|NAMESPACE|SITENAME|CURRENTYEAR|CURRENTMONTH|CURRENTDAY)$/i.test(candidate)
    ) {
      found.add(candidate);
    }
  }
  return Array.from(found);
}

/**
 * Serviço centralizado de gerenciamento, armazenamento, validação
 * e expansão sintática de Predefinições MediaWiki ({{NomeDaPredefinição|parâmetro}}).
 */
export class TemplateService {
  private cachedCustomTemplates: Article[] = [];

  public listBuiltinTemplates(): WikiTemplateDefinition[] {
    return BUILTIN_MEDIAWIKI_TEMPLATES;
  }

  public getCachedCustomTemplates(): Article[] {
    return this.cachedCustomTemplates;
  }

  public setCachedCustomTemplates(templates: Article[]): void {
    const dedup = new Map<string, Article>();
    for (const art of templates || []) {
      const parsed = parseTitle(art.title || art.slug);
      if (art.namespace === 10 || parsed.namespaceId === 10) {
        const key = normalizeTemplateKey(parsed.baseTitle || art.title || art.slug);
        if (key) {
          dedup.set(key, { ...art, namespace: 10 });
        }
      }
    }
    this.cachedCustomTemplates = Array.from(dedup.values()).sort((a, b) =>
      a.title.localeCompare(b.title)
    );
  }

  private mergeCustomTemplates(explicit?: Article[]): Article[] {
    const merged = new Map<string, Article>();
    const defaultParsed = parseTitle(TEMPLATE_EXAMPLE_CUSTOM_TEMPLATE.title);
    const defaultKey = normalizeTemplateKey(
      defaultParsed.baseTitle || TEMPLATE_EXAMPLE_CUSTOM_TEMPLATE.title
    );
    if (defaultKey) {
      merged.set(defaultKey, TEMPLATE_EXAMPLE_CUSTOM_TEMPLATE);
    }

    for (const art of this.cachedCustomTemplates) {
      const parsed = parseTitle(art.title || art.slug);
      const key = normalizeTemplateKey(parsed.baseTitle || art.title || art.slug);
      if (key) merged.set(key, art);
    }
    if (explicit && explicit.length > 0) {
      for (const art of explicit) {
        const parsed = parseTitle(art.title || art.slug);
        if (art.namespace === 10 || parsed.namespaceId === 10) {
          const key = normalizeTemplateKey(parsed.baseTitle || art.title || art.slug);
          if (key) merged.set(key, { ...art, namespace: 10 });
        }
      }
    }
    return Array.from(merged.values());
  }

  /**
   * Valida nome, limites do blueprint, balanceamento de chaves {{...}} / {{{...}}}
   * e diretivas de inclusão de uma predefinição MediaWiki.
   */
  public validateTemplateDefinition(input: {
    name: string;
    wikitext: string;
    summary?: string;
  }): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalized = normalizeTemplateIdentity(input.name);

    if (!normalized.baseName) {
      errors.push('Informe um nome válido para a predefinição.');
    } else if (INVALID_TITLE_CHARS_RE.test(normalized.baseName)) {
      errors.push(
        'O nome da predefinição contém caracteres inválidos (#, <, >, [, ], {, }, |).'
      );
    }

    if (normalized.title.length > MAX_TITLE_LEN || normalized.slug.length > MAX_TITLE_LEN) {
      errors.push(
        `O título completo da predefinição excede o limite de ${MAX_TITLE_LEN} caracteres.`
      );
    }

    const rawWikitext = input.wikitext || '';
    if (!rawWikitext.trim()) {
      errors.push('O conteúdo Wikitext da predefinição não pode estar vazio.');
    } else if (rawWikitext.length > MAX_WIKITEXT_LEN) {
      errors.push(
        `O Wikitext da predefinição excede o limite máximo de ${MAX_WIKITEXT_LEN} caracteres.`
      );
    }

    if (input.summary && input.summary.trim().length > MAX_SUMMARY_LEN) {
      warnings.push(
        `O resumo será truncado para o limite de ${MAX_SUMMARY_LEN} caracteres.`
      );
    }

    const bodyForBalance = stripProtectedMarkupForValidation(rawWikitext);

    // Verifica balanceamento básico de abertura/fechamento de chaves de predefinição/parâmetro
    // ignorando sintaxe de tabelas {| ... |}
    const cleanBraces = bodyForBalance.replace(/\{\|/g, '').replace(/\|\}/g, '');
    const openBraces = (cleanBraces.match(/\{/g) || []).length;
    const closeBraces = (cleanBraces.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push(
        `Chaves {{...}} ou {{{...}}} desbalanceadas (${openBraces} aberturas para ${closeBraces} fechamentos).`
      );
    }

    // Verifica tags de inclusão balanceadas
    const directiveTags = ['includeonly', 'noinclude', 'onlyinclude'] as const;
    for (const tag of directiveTags) {
      const opens = (bodyForBalance.match(new RegExp(`<${tag}>`, 'gi')) || []).length;
      const closes = (bodyForBalance.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
      if (opens !== closes) {
        errors.push(`Tag <${tag}>...</${tag}> não foi fechada corretamente.`);
      }
    }

    // Avisa sobre auto-recursão direta na transclusão
    if (normalized.key) {
      const transclusionBody = applyIncludeDirectives(rawWikitext, true);
      const refs = extractTemplateReferences(transclusionBody);
      if (refs.some(ref => normalizeTemplateKey(ref) === normalized.key)) {
        warnings.push(
          `A predefinição "${normalized.title}" referencia a si mesma diretamente; a profundidade de recursão será limitada em tempo de execução.`
        );
      }
    }

    const declaredParams = extractTemplateDeclaredParams(rawWikitext);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      normalized,
      declaredParams,
    };
  }

  /**
   * Busca todas as predefinições personalizadas (Namespace 10) no Firestore
   * e atualiza o cache síncrono para expansão imediata em visualizadores.
   */
  public async getAllTemplates(): Promise<Article[]> {
    try {
      const list = (await fetchArticlesFromFirestore(10)) || [];
      const hasExample = list.some(
        art =>
          normalizeTemplateKey(parseTitle(art.title || art.slug).baseTitle || art.title) ===
          normalizeTemplateKey('CartaoModulo')
      );
      const combined = hasExample ? list : [TEMPLATE_EXAMPLE_CUSTOM_TEMPLATE, ...list];
      this.setCachedCustomTemplates(combined);
      return this.cachedCustomTemplates;
    } catch (err) {
      console.warn('Erro ao listar predefinições do Firestore:', err);
      return this.mergeCustomTemplates();
    }
  }

  /**
   * Busca uma predefinição específica pelo nome ou slug (com ou sem prefixo Predefinição:).
   */
  public async getTemplateByName(rawName: string): Promise<Article | null> {
    const identity = normalizeTemplateIdentity(rawName);
    if (!identity.baseName) return null;

    const cachedMatch = this.cachedCustomTemplates.find(art => {
      const parsed = parseTitle(art.title || art.slug);
      return normalizeTemplateKey(parsed.baseTitle || art.title) === identity.key;
    });
    if (cachedMatch) return cachedMatch;

    try {
      const direct = await fetchArticleFromFirestore(identity.slug);
      if (direct) {
        this.setCachedCustomTemplates([...this.cachedCustomTemplates, direct]);
        return direct;
      }
      const all = await this.getAllTemplates();
      return (
        all.find(art => {
          const parsed = parseTitle(art.title || art.slug);
          return normalizeTemplateKey(parsed.baseTitle || art.title) === identity.key;
        }) || null
      );
    } catch {
      return identity.key === normalizeTemplateKey('CartaoModulo')
        ? TEMPLATE_EXAMPLE_CUSTOM_TEMPLATE
        : null;
    }
  }

  /**
   * Assina atualizações em tempo real das predefinições (Namespace 10) no Firestore.
   */
  public subscribeTemplates(
    onUpdate: (templates: Article[]) => void,
    onError?: (error: unknown) => void
  ): () => void {
    const path = 'articles';
    try {
      const q = query(collection(db, path), where('namespace', '==', 10));
      return onSnapshot(
        q,
        snapshot => {
          const templates: Article[] = [];
          snapshot.forEach(docSnap => {
            const data = docSnap.data() as Article;
            templates.push({ ...data, namespace: 10 });
          });
          this.setCachedCustomTemplates(templates);
          onUpdate(this.cachedCustomTemplates);
        },
        err => {
          if (onError) onError(err);
          try {
            handleFirestoreError(err, OperationType.LIST, path);
          } catch {
            // Surface safely if caller provided onError or run standalone
          }
        }
      );
    } catch (err) {
      if (onError) onError(err);
      return () => {};
    }
  }

  /**
   * Valida e cria/atualiza uma predefinição reutilizável no Namespace 10 do Firestore,
   * respeitando os limites estruturais do firebase-blueprint.json.
   */
  public async saveTemplate(
    input: SaveTemplateInput
  ): Promise<{ article: Article; revision: Revision; event: WikiEvent }> {
    const validation = this.validateTemplateDefinition({
      name: input.name,
      wikitext: input.wikitext,
      summary: input.summary,
    });

    if (!validation.valid) {
      throw new Error(validation.errors[0]);
    }

    if (!auth.currentUser) {
      throw new Error('Você precisa fazer login com sua conta Google para criar ou editar predefinições.');
    }

    const identity = validation.normalized;
    const cleanWikitext = (input.wikitext || '').slice(0, MAX_WIKITEXT_LEN);
    const safeTitle = identity.title.slice(0, MAX_TITLE_LEN);
    const safeSlug = identity.slug.slice(0, MAX_TITLE_LEN);
    const safeSummary = (input.summary || '').trim().slice(0, MAX_SUMMARY_LEN);

    const result = await saveArticleToFirestore({
      slug: safeSlug,
      title: safeTitle,
      wikitext: cleanWikitext,
      summary: safeSummary || `Predefinição reutilizável ${safeTitle}`,
      comment: (input.comment || `Criada/atualizada predefinição ${safeTitle}`).slice(0, 1000),
      isMinor: false,
      namespace: 10,
      authorUser: input.authorUser || null,
    });

    this.setCachedCustomTemplates([
      ...this.cachedCustomTemplates.filter(
        t => normalizeTemplateKey(parseTitle(t.title || t.slug).baseTitle) !== identity.key
      ),
      result.article,
    ]);

    return result;
  }

  /**
   * Remove uma predefinição personalizada do Firestore (requer privilégio admin/sysop nas regras).
   */
  public async deleteTemplate(nameOrSlug: string): Promise<void> {
    const identity = normalizeTemplateIdentity(nameOrSlug);
    const targetPath = `articles/${identity.slug}`;
    try {
      await deleteDoc(doc(db, 'articles', identity.slug));
      this.setCachedCustomTemplates(
        this.cachedCustomTemplates.filter(
          t => normalizeTemplateKey(parseTitle(t.title || t.slug).baseTitle) !== identity.key
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, targetPath);
    }
  }

  /**
   * Expande sintaxe {{NomeDaPredefinição|parâmetro}} e palavras mágicas no Wikitext,
   * combinando predefinições integradas + predefinições personalizadas do Namespace 10
   * e parâmetros dinâmicos opcionais.
   */
  public expandTemplates(
    wikitext: string,
    options: ServiceTemplateExpansionOptions = {}
  ): TemplateExpansionResult {
    const mergedTemplates = this.mergeCustomTemplates(options.customTemplates);
    let source = wikitext || '';

    if (options.dynamicParams && Object.keys(options.dynamicParams).length > 0) {
      source = substituteTemplateParameters(source, options.dynamicParams);
    }

    return expandWikitextTemplates(source, {
      ...options,
      customTemplates: mergedTemplates,
    });
  }

  /**
   * Versão assíncrona que garante o carregamento prévio das predefinições do Firestore
   * caso existam referências {{Nome|params}} ainda não presentes no cache local.
   */
  public async expandTemplatesAsync(
    wikitext: string,
    options: ServiceTemplateExpansionOptions = {}
  ): Promise<TemplateExpansionResult> {
    const refs = extractTemplateReferences(wikitext);
    if (refs.length > 0) {
      const merged = this.mergeCustomTemplates(options.customTemplates);
      const hasUncachedCustomCandidate = refs.some(ref => {
        if (this.findBuiltin(ref)) return false;
        const key = normalizeTemplateKey(ref);
        return !merged.some(
          art => normalizeTemplateKey(parseTitle(art.title || art.slug).baseTitle) === key
        );
      });

      if (hasUncachedCustomCandidate) {
        await this.getAllTemplates();
      }
    }

    return this.expandTemplates(wikitext, options);
  }

  public parseTemplateCall(rawBody: string): ParsedTemplateCall {
    return parseTemplateCallBody(rawBody);
  }

  public substituteParameters(templateWikitext: string, params: Record<string, string>): string {
    return substituteTemplateParameters(templateWikitext, params);
  }

  public applyDirectives(rawWikitext: string, isTransclusion: boolean): string {
    return applyIncludeDirectives(rawWikitext, isTransclusion);
  }

  public extractDeclaredParams(templateWikitext: string): string[] {
    return extractTemplateDeclaredParams(templateWikitext);
  }

  public buildInvocation(
    name: string,
    params: Record<string, string>,
    definition?: WikiTemplateDefinition
  ): string {
    return buildTemplateInvocationWikitext(name, params, definition);
  }

  public buildSkeleton(name: string): string {
    return buildDefaultTemplatePageSkeleton(name);
  }

  public findBuiltin(name: string): WikiTemplateDefinition | undefined {
    const direct = findBuiltinTemplate(name);
    if (direct) return direct;
    const folded = foldTemplateKey(name);
    if (!folded) return undefined;
    return BUILTIN_MEDIAWIKI_TEMPLATES.find(
      tpl =>
        foldTemplateKey(tpl.name) === folded ||
        (tpl.aliases || []).some(a => foldTemplateKey(a) === folded)
    );
  }

  /**
   * Retorna os parâmetros esperados para uma pré-definição (integrada, Infobox software ou Namespace 10),
   * avaliando quais já estão preenchidos na chamada informada.
   */
  public getExpectedParameters(
    templateName: string,
    call?: ParsedTemplateCall,
    customTemplates?: Article[]
  ): {
    matchedTemplateName?: string;
    isKnown: boolean;
    expectedParams: ExpectedTemplateParamInfo[];
  } {
    const cleanName = (templateName || '')
      .trim()
      .replace(/^:/, '')
      .replace(/^(?:Predefinição|Predef|Template)\s*:/i, '')
      .trim();

    if (!cleanName) {
      return { isKnown: false, expectedParams: [] };
    }

    const mergedCustom = this.mergeCustomTemplates(customTemplates);
    const normKey = normalizeTemplateKey(cleanName);
    const foldedKey = foldTemplateKey(cleanName);

    // 1. Custom Namespace 10 template (takes precedence like MediaWiki)
    const customMatch = mergedCustom.find(art => {
      const parsed = parseTitle(art.title || art.slug);
      const base = parsed.baseTitle || art.title || art.slug;
      return normalizeTemplateKey(base) === normKey || foldTemplateKey(base) === foldedKey;
    });

    if (customMatch) {
      const parsedTitle = parseTitle(customMatch.title || customMatch.slug);
      const canonical = parsedTitle.baseTitle || customMatch.title;
      const specs = extractCustomTemplateParamSpecs(customMatch.wikitext || '');
      const expectedParams: ExpectedTemplateParamInfo[] = specs.map(spec => {
        const val = call
          ? call.params[spec.name] ?? call.params[spec.name.toLowerCase()]
          : undefined;
        const present = val !== undefined && val.trim() !== '';
        return {
          name: spec.name,
          label: spec.name,
          description: spec.defaultValue
            ? `Parâmetro da pré-definição ${canonical} (padrão: ${spec.defaultValue})`
            : `Parâmetro declarado em Predefinição:${canonical}`,
          required: spec.required,
          defaultValue: spec.defaultValue,
          present,
          currentValue: present ? val!.trim() : undefined,
        };
      });
      return { matchedTemplateName: canonical, isKnown: true, expectedParams };
    }

    // 2. Built-in MediaWiki standard templates (exclude Wikidot [[...]] blocks)
    const builtin = this.findBuiltin(cleanName);
    if (builtin && builtin.syntaxStyle !== 'wikidot') {
      const canonicalKey = normalizeTemplateKey(builtin.name);
      const aliasMap = BUILTIN_PARAM_ALIASES[canonicalKey] || {};
      const expectedParams: ExpectedTemplateParamInfo[] = builtin.params.map(p => {
        const candidateKeys = aliasMap[p.name] || [p.name, p.name.toLowerCase(), stripAccents(p.name).toLowerCase()];
        let matchedValue: string | undefined;
        if (call) {
          for (const k of candidateKeys) {
            const v = call.params[k] ?? call.params[k.toLowerCase()];
            if (v !== undefined && v.trim() !== '') {
              matchedValue = v.trim();
              break;
            }
          }
        }
        return {
          name: p.name,
          label: p.label,
          description: p.description,
          required: Boolean(p.required),
          defaultValue: p.defaultValue,
          placeholder: p.placeholder,
          present: matchedValue !== undefined,
          currentValue: matchedValue,
        };
      });
      return { matchedTemplateName: builtin.name, isKnown: true, expectedParams };
    }

    // 3. {{Infobox software}}
    if (foldedKey === 'infobox software') {
      const expectedParams: ExpectedTemplateParamInfo[] = INFOBOX_SOFTWARE_FIELDS.map(field => {
        const val = call ? call.params[field.key] ?? call.params[field.key.toLowerCase()] : undefined;
        const present = val !== undefined && val.trim() !== '';
        return {
          name: field.key,
          label: field.label,
          description: field.description,
          required: field.key === 'name',
          placeholder: field.placeholder,
          present,
          currentValue: present ? val!.trim() : undefined,
        };
      });
      return { matchedTemplateName: 'Infobox software', isKnown: true, expectedParams };
    }

    return { isKnown: false, expectedParams: [] };
  }

  /**
   * Busca a pré-definição conhecida mais próxima (integrada ou Namespace 10) para corrigir erros de digitação.
   */
  public findClosestTemplateName(
    rawName: string,
    customTemplates?: Article[]
  ): string | null {
    const cleanName = (rawName || '')
      .trim()
      .replace(/^:/, '')
      .replace(/^(?:Predefinição|Predef|Template)\s*:/i, '')
      .replace(/[#<>[\]{}\n]/g, '')
      .trim();
    if (!cleanName) return null;

    const queryFolded = foldTemplateKey(cleanName);
    if (!queryFolded) return null;

    const candidates: Array<{ folded: string; canonical: string }> = [];
    for (const def of BUILTIN_MEDIAWIKI_TEMPLATES) {
      if (def.syntaxStyle === 'wikidot') continue;
      candidates.push({ folded: foldTemplateKey(def.name), canonical: def.name });
      for (const alias of def.aliases || []) {
        candidates.push({ folded: foldTemplateKey(alias), canonical: def.name });
      }
    }
    candidates.push({ folded: 'infobox software', canonical: 'Infobox software' });

    const mergedCustom = this.mergeCustomTemplates(customTemplates);
    for (const art of mergedCustom) {
      const parsed = parseTitle(art.title || art.slug);
      const base = parsed.baseTitle || art.title;
      if (base) {
        candidates.push({ folded: foldTemplateKey(base), canonical: base });
      }
    }

    let bestCandidate: { canonical: string; dist: number; lenDiff: number } | null = null;
    const maxDist =
      queryFolded.length <= 4 ? 1 : queryFolded.length >= 10 ? 3 : 2;

    for (const cand of candidates) {
      if (cand.folded === queryFolded) {
        return cand.canonical;
      }
      const dist = levenshteinDistance(queryFolded, cand.folded);
      if (dist <= maxDist) {
        const lenDiff = Math.abs(queryFolded.length - cand.folded.length);
        if (
          !bestCandidate ||
          dist < bestCandidate.dist ||
          (dist === bestCandidate.dist && lenDiff < bestCandidate.lenDiff)
        ) {
          bestCandidate = { canonical: cand.canonical, dist, lenDiff };
        }
      }
    }

    return bestCandidate ? bestCandidate.canonical : null;
  }

  /**
   * Analisa o wikitexto do editor para detectar chaves de pré-definição mal formadas,
   * ausentes de fechamento, nomes inválidos/incorretos ou sem parâmetros obrigatórios,
   * gerando sugestões automáticas de correção com a lista completa de parâmetros esperados.
   */
  public analyzeTemplateSyntaxSuggestions(
    wikitext: string,
    options: {
      customTemplates?: Article[];
      cursorOffset?: number;
      isTemplatePage?: boolean;
    } = {}
  ): TemplateSuggestionAnalysisResult {
    const source = wikitext || '';
    const masked = maskProtectedWikitext(source);
    const mergedCustom = this.mergeCustomTemplates(options.customTemplates);
    const suggestions: TemplateCorrectionSuggestion[] = [];
    const cursorMatches: ActiveCursorTemplateContext[] = [];
    let counter = 0;

    const lineNumberAt = (offset: number): number => {
      let line = 1;
      for (let k = 0; k < offset && k < source.length; k++) {
        if (source[k] === '\n') line++;
      }
      return line;
    };

    const nextId = () => {
      counter += 1;
      return `tpl-fix-${counter}`;
    };

    const recordCursorMatch = (ctx: ActiveCursorTemplateContext) => {
      if (
        options.cursorOffset !== undefined &&
        options.cursorOffset >= ctx.start &&
        options.cursorOffset <= ctx.end
      ) {
        cursorMatches.push(ctx);
      }
    };

    const findLogicalUnclosedDoubleEnd = (startIdx: number): number => {
      const firstNewline = masked.indexOf('\n', startIdx + 2);
      if (firstNewline === -1) {
        return masked.length;
      }

      const firstLineInner = masked.slice(startIdx + 2, firstNewline);
      // Multiline template block style: {{Nome\n| param = val
      if (!firstLineInner.includes('|') || /^\s*[^|]*$/.test(firstLineInner)) {
        let cursor = firstNewline + 1;
        let lastParamEnd = firstNewline;
        while (cursor < masked.length) {
          const nextNl = masked.indexOf('\n', cursor);
          const lineEnd = nextNl === -1 ? masked.length : nextNl;
          const line = masked.slice(cursor, lineEnd);
          if (/^\s*$/.test(line) || /^\s*==/.test(line)) {
            break;
          }
          if (/^\s*\|(?!\})/.test(line)) {
            lastParamEnd = lineEnd;
            if (nextNl === -1) break;
            cursor = nextNl + 1;
            continue;
          }
          break;
        }
        return lastParamEnd;
      }

      // Single-line style {{Nome|param=val (if next line starts with |, include pipe lines too)
      let cursor = firstNewline + 1;
      let lastEnd = firstNewline;
      while (cursor < masked.length) {
        const nextNl = masked.indexOf('\n', cursor);
        const lineEnd = nextNl === -1 ? masked.length : nextNl;
        const line = masked.slice(cursor, lineEnd);
        if (/^\s*\|(?!\})/.test(line)) {
          lastEnd = lineEnd;
          if (nextNl === -1) break;
          cursor = nextNl + 1;
          continue;
        }
        break;
      }
      return lastEnd;
    };

    const scanSegment = (segStart: number, segEnd: number) => {
      let i = segStart;

      while (i < segEnd) {
        if (masked.startsWith('{|', i) || masked.startsWith('|}', i)) {
          i += 2;
          continue;
        }

        // Triple braces {{{...}}}
        if (masked.startsWith('{{{', i)) {
          const stack: number[] = [3];
          let j = i + 3;
          while (j < segEnd && stack.length > 0) {
            if (masked.startsWith('\n\n', j) || masked.startsWith('\r\n\r\n', j)) {
              break;
            }
            if (masked[j] === '{') {
              let openCount = 0;
              while (j + openCount < segEnd && masked[j + openCount] === '{') openCount++;
              let rem = openCount;
              while (rem >= 2) {
                if (rem === 3 || (rem >= 5 && rem % 2 === 1)) {
                  stack.push(3);
                  rem -= 3;
                } else {
                  stack.push(2);
                  rem -= 2;
                }
              }
              j += openCount;
              continue;
            }
            if (masked[j] === '}') {
              let closeCount = 0;
              while (j + closeCount < segEnd && masked[j + closeCount] === '}') closeCount++;
              let consumed = 0;
              while (stack.length > 0 && closeCount - consumed >= stack[stack.length - 1]) {
                consumed += stack.pop()!;
              }
              j += consumed > 0 ? consumed : closeCount;
              continue;
            }
            j++;
          }

          if (stack.length === 0) {
            const rawWhole = source.slice(i, j);
            const inner = source.slice(i + 3, j - 3);
            const parts = splitTopLevelPipes(inner);
            const rawKey = (parts[0] || '').trim() || 'parametro';
            const hasDefault = parts.length > 1;
            const defaultVal = hasDefault ? parts.slice(1).join('|').trim() : '';

            if (!options.isTemplatePage) {
              suggestions.push({
                id: nextId(),
                issueType: 'unresolved_param',
                severity: 'warning',
                start: i,
                end: j,
                lineNumber: lineNumberAt(i),
                templateName: rawKey,
                title: `Parâmetro "{{{${rawKey}}}}" sem valor neste artigo`,
                reason: hasDefault
                  ? `Placeholders {{{...}}} só expandem dentro de pré-definições; substitua pelo valor padrão "${defaultVal}" ou texto final.`
                  : `Placeholder {{{${rawKey}}}} sem valor padrão será exibido como código bruto no artigo.`,
                originalSnippet: rawWhole,
                suggestedSnippet: hasDefault && defaultVal ? defaultVal : `{{{${rawKey}|valor}}}`,
                expectedParams: [
                  {
                    name: rawKey,
                    label: rawKey,
                    description: 'Placeholder de parâmetro MediaWiki',
                    required: !hasDefault,
                    defaultValue: defaultVal || undefined,
                    present: false,
                  },
                ],
                missingRequiredParams: hasDefault ? [] : [rawKey],
              });
            }
            i = j;
            continue;
          }

          // Unclosed triple braces
          const lineEnd = masked.indexOf('\n', i);
          const unclosedEnd =
            lineEnd === -1 ? Math.min(segEnd, i + 120) : Math.min(segEnd, lineEnd);
          const rawSnippet = source.slice(i, unclosedEnd);
          const strippedBody = rawSnippet.slice(3).replace(/\}+$/, '').trimEnd();
          const rawKey = strippedBody.split('|')[0].trim() || 'parametro';
          suggestions.push({
            id: nextId(),
            issueType: 'unclosed_braces',
            severity: 'error',
            start: i,
            end: unclosedEnd,
            lineNumber: lineNumberAt(i),
            templateName: rawKey,
            title: `Chave de parâmetro "{{{${rawKey}" sem fechamento "}}}"`,
            reason: 'Placeholders de pré-definição precisam de três chaves de fechamento "}}}".',
            originalSnippet: rawSnippet,
            suggestedSnippet: `{{{${strippedBody || rawKey}}}}`,
            expectedParams: [
              {
                name: rawKey,
                label: rawKey,
                description: 'Placeholder de parâmetro MediaWiki',
                required: true,
                present: false,
              },
            ],
            missingRequiredParams: [rawKey],
          });
          i = unclosedEnd;
          continue;
        }

        // Single opening brace typo `{Nome|...}}` on the same line
        if (
          masked[i] === '{' &&
          masked[i + 1] !== '{' &&
          masked[i + 1] !== '|'
        ) {
          const lineEnd = masked.indexOf('\n', i);
          const lineLimit = lineEnd === -1 ? segEnd : Math.min(segEnd, lineEnd);
          const sameLine = masked.slice(i, lineLimit);
          const closeIdxRel = sameLine.indexOf('}}');
          if (closeIdxRel > 1) {
            const candidateEnd = i + closeIdxRel + 2;
            const rawSnippet = source.slice(i, candidateEnd);
            const rawInner = source.slice(i + 1, candidateEnd - 2);
            const call = parseTemplateCallBody(rawInner);
            const rawName = call.name;
            const resolved = this.getExpectedParameters(rawName, call, mergedCustom);
            const fuzzy = resolved.isKnown
              ? resolved.matchedTemplateName!
              : this.findClosestTemplateName(rawName, mergedCustom) || undefined;
            const paramInfo = resolved.isKnown
              ? resolved
              : fuzzy
                ? this.getExpectedParameters(fuzzy, call, mergedCustom)
                : resolved;
            const missingReq = paramInfo.expectedParams.filter(p => p.required && !p.present);
            const targetName = paramInfo.matchedTemplateName || rawName.trim() || 'Aviso';
            const fixed = formatUpdatedTemplateCall(`{{${rawInner}}}`, targetName, missingReq, true);

            suggestions.push({
              id: nextId(),
              issueType: 'unclosed_braces',
              severity: 'error',
              start: i,
              end: candidateEnd,
              lineNumber: lineNumberAt(i),
              templateName: rawName || '(sem nome)',
              matchedTemplateName: paramInfo.matchedTemplateName,
              title: `Abertura incompleta "{" em vez de "{{" para ${targetName}`,
              reason: 'A invocação de pré-definição iniciou com apenas uma chave "{".',
              originalSnippet: rawSnippet,
              suggestedSnippet: fixed,
              expectedParams: paramInfo.expectedParams,
              missingRequiredParams: missingReq.map(p => p.name),
            });
            recordCursorMatch({
              templateName: rawName,
              matchedTemplateName: paramInfo.matchedTemplateName,
              start: i,
              end: candidateEnd,
              isUnclosed: false,
              expectedParams: paramInfo.expectedParams,
              missingRequiredParams: missingReq.map(p => p.name),
            });
            i = candidateEnd;
            continue;
          }
        }

        // Stray closing braces `}}}` or `}}`
        if (masked.startsWith('}}', i)) {
          const len = masked.startsWith('}}}', i) ? 3 : 2;
          const stray = source.slice(i, i + len);
          suggestions.push({
            id: nextId(),
            issueType: 'unmatched_closing',
            severity: 'error',
            start: i,
            end: i + len,
            lineNumber: lineNumberAt(i),
            templateName: '(chave solta)',
            title: `Chaves de fechamento "${stray}" sem abertura correspondente`,
            reason: `Há "${stray}" sobrando sem "{{" correspondente; remova as chaves extras.`,
            originalSnippet: stray,
            suggestedSnippet: '',
            expectedParams: [],
            missingRequiredParams: [],
          });
          i += len;
          continue;
        }

        // Double braces {{...
        if (masked.startsWith('{{', i)) {
          const stack: number[] = [2];
          let j = i + 2;

          while (j < segEnd && stack.length > 0) {
            if (masked.startsWith('{|', j) || masked.startsWith('|}', j)) {
              j += 2;
              continue;
            }
            if (masked[j] === '{') {
              let openCount = 0;
              while (j + openCount < segEnd && masked[j + openCount] === '{') openCount++;
              let rem = openCount;
              while (rem >= 2) {
                if (rem === 3 || (rem >= 5 && rem % 2 === 1)) {
                  stack.push(3);
                  rem -= 3;
                } else {
                  stack.push(2);
                  rem -= 2;
                }
              }
              j += openCount;
              continue;
            }
            if (masked[j] === '}') {
              let closeCount = 0;
              while (j + closeCount < segEnd && masked[j + closeCount] === '}') closeCount++;
              let consumed = 0;
              while (stack.length > 0 && closeCount - consumed >= stack[stack.length - 1]) {
                consumed += stack.pop()!;
              }
              j += consumed > 0 ? consumed : closeCount;
              continue;
            }
            j++;
          }

          if (stack.length === 0) {
            const rawWhole = source.slice(i, j);
            const rawInner = source.slice(i + 2, j - 2);
            const call = parseTemplateCallBody(rawInner);
            const rawCallName = call.name;

            // 1. Empty or invalid characters in template name
            if (!rawCallName || /[#<>[\]{}\n]/.test(rawCallName)) {
              const cleanedCandidate = rawCallName.replace(/[#<>[\]{}\n]/g, '').trim();
              const resolvedClean = cleanedCandidate
                ? this.getExpectedParameters(cleanedCandidate, call, mergedCustom)
                : { isKnown: false, expectedParams: [] as ExpectedTemplateParamInfo[], matchedTemplateName: undefined };
              const fuzzyClean =
                !resolvedClean.isKnown && cleanedCandidate
                  ? this.findClosestTemplateName(cleanedCandidate, mergedCustom)
                  : null;
              const finalLookup = resolvedClean.isKnown
                ? resolvedClean
                : fuzzyClean
                  ? this.getExpectedParameters(fuzzyClean, call, mergedCustom)
                  : resolvedClean;

              const targetName = finalLookup.matchedTemplateName || cleanedCandidate;
              const missingReq = finalLookup.expectedParams.filter(p => p.required && !p.present);
              const suggestedSnippet = !rawCallName
                ? (Object.keys(call.params).length > 0
                    ? formatUpdatedTemplateCall(rawWhole, 'Nota', [], true)
                    : '')
                : targetName
                  ? formatUpdatedTemplateCall(rawWhole, targetName, missingReq, true)
                  : undefined;

              suggestions.push({
                id: nextId(),
                issueType: 'invalid_name',
                severity: 'error',
                start: i,
                end: j,
                lineNumber: lineNumberAt(i),
                templateName: rawCallName || '(vazio)',
                matchedTemplateName: finalLookup.matchedTemplateName,
                title: !rawCallName
                  ? 'Chave de pré-definição vazia "{{}}"'
                  : `Nome inválido na chave "{{${rawCallName}}}"`,
                reason: !rawCallName
                  ? 'Nenhuma pré-definição foi informada entre "{{ }}".'
                  : 'Nomes de pré-definições não podem conter "#", "<", ">", "[", "]", "{" ou "}".',
                originalSnippet: rawWhole,
                suggestedSnippet,
                expectedParams: finalLookup.expectedParams,
                missingRequiredParams: missingReq.map(p => p.name),
              });
              i = j;
              continue;
            }

            // 2. Magic words & native {{Infobox ...}}
            const magicUpper = rawCallName.trim().toUpperCase().replace(/\s+/g, '');
            if (MAGIC_WORD_NAMES.has(magicUpper)) {
              i = j;
              continue;
            }

            // 3. Resolve known vs unknown template
            const resolved = this.getExpectedParameters(rawCallName, call, mergedCustom);

            if (resolved.isKnown) {
              const missingReq = resolved.expectedParams.filter(p => p.required && !p.present);
              recordCursorMatch({
                templateName: rawCallName,
                matchedTemplateName: resolved.matchedTemplateName,
                start: i,
                end: j,
                isUnclosed: false,
                expectedParams: resolved.expectedParams,
                missingRequiredParams: missingReq.map(p => p.name),
              });

              if (missingReq.length > 0 && !/^infobox\s+/i.test(rawCallName)) {
                const targetName =
                  rawCallName.replace(/^(?:Predefinição|Predef|Template)\s*:/i, '').trim() ||
                  resolved.matchedTemplateName ||
                  rawCallName;
                const suggested = formatUpdatedTemplateCall(rawWhole, targetName, missingReq, true);
                suggestions.push({
                  id: nextId(),
                  issueType: 'missing_required_param',
                  severity: 'warning',
                  start: i,
                  end: j,
                  lineNumber: lineNumberAt(i),
                  templateName: rawCallName,
                  matchedTemplateName: resolved.matchedTemplateName,
                  title: `Pré-definição "{{${resolved.matchedTemplateName || rawCallName}}}" sem parâmetro(s) obrigatório(s)`,
                  reason: `Faltando: ${missingReq.map(p => p.name).join(', ')}. Clique para preencher com os parâmetros esperados.`,
                  originalSnippet: rawWhole,
                  suggestedSnippet: suggested,
                  expectedParams: resolved.expectedParams,
                  missingRequiredParams: missingReq.map(p => p.name),
                });
              }
            } else if (!/^infobox\s+/i.test(rawCallName)) {
              const fuzzyMatch = this.findClosestTemplateName(rawCallName, mergedCustom);
              const fuzzyLookup = fuzzyMatch
                ? this.getExpectedParameters(fuzzyMatch, call, mergedCustom)
                : { isKnown: false, expectedParams: [] as ExpectedTemplateParamInfo[], matchedTemplateName: undefined };
              const missingReq = fuzzyLookup.expectedParams.filter(p => p.required && !p.present);
              const suggested = fuzzyMatch
                ? formatUpdatedTemplateCall(rawWhole, fuzzyMatch, missingReq, true)
                : undefined;

              recordCursorMatch({
                templateName: rawCallName,
                matchedTemplateName: fuzzyMatch || undefined,
                start: i,
                end: j,
                isUnclosed: false,
                expectedParams: fuzzyLookup.expectedParams,
                missingRequiredParams: missingReq.map(p => p.name),
              });

              suggestions.push({
                id: nextId(),
                issueType: 'unknown_template',
                severity: 'error',
                start: i,
                end: j,
                lineNumber: lineNumberAt(i),
                templateName: rawCallName,
                matchedTemplateName: fuzzyMatch || undefined,
                title: fuzzyMatch
                  ? `Pré-definição "{{${rawCallName}}}" desconhecida — você quis dizer "{{${fuzzyMatch}}}"?`
                  : `Pré-definição "{{${rawCallName}}}" não cadastrada`,
                reason: fuzzyMatch
                  ? `"${rawCallName}" não foi encontrada no templateService; "${fuzzyMatch}" é a correspondência mais próxima.`
                  : `"${rawCallName}" não corresponde a nenhuma pré-definição integrada ou do Namespace Predefinição:.`,
                originalSnippet: rawWhole,
                suggestedSnippet: suggested,
                expectedParams: fuzzyLookup.expectedParams,
                missingRequiredParams: missingReq.map(p => p.name),
              });
            }

            // Recurse into inner body to catch nested malformed/incomplete template calls
            if (rawInner.includes('{{')) {
              scanSegment(i + 2, j - 2);
            }

            // Catch extra single trailing `}` immediately after valid `}}` (e.g. `{{Aviso|...}}}`)
            if (j < segEnd && masked[j] === '}' && !masked.startsWith('}}', j)) {
              suggestions.push({
                id: nextId(),
                issueType: 'unmatched_closing',
                severity: 'error',
                start: j,
                end: j + 1,
                lineNumber: lineNumberAt(j),
                templateName: rawCallName,
                title: 'Chave "}" excedente após fechamento "}}"',
                reason: 'Há uma chave "}" extra sobrando logo após o fechamento da pré-definição.',
                originalSnippet: '}',
                suggestedSnippet: '',
                expectedParams: [],
                missingRequiredParams: [],
              });
              i = j + 1;
              continue;
            }

            i = j;
            continue;
          }

          // Unclosed `{{...`
          const unclosedEnd = Math.min(segEnd, findLogicalUnclosedDoubleEnd(i));
          const rawSnippet = source.slice(i, unclosedEnd);
          const trimmedNoTrailingBrace = rawSnippet
            .slice(2)
            .replace(/\}\s*$/, '');
          const call = parseTemplateCallBody(trimmedNoTrailingBrace);
          const rawName = call.name;

          const resolved = rawName
            ? this.getExpectedParameters(rawName, call, mergedCustom)
            : { isKnown: false, expectedParams: [] as ExpectedTemplateParamInfo[], matchedTemplateName: undefined };
          const fuzzy =
            !resolved.isKnown && rawName
              ? this.findClosestTemplateName(rawName, mergedCustom)
              : null;
          const finalLookup = resolved.isKnown
            ? resolved
            : fuzzy
              ? this.getExpectedParameters(fuzzy, call, mergedCustom)
              : resolved;

          const targetName =
            finalLookup.matchedTemplateName ||
            rawName.replace(/[#<>[\]{}\n]/g, '').trim() ||
            'Aviso';
          const missingReq = finalLookup.expectedParams.filter(p => p.required && !p.present);
          const suggestedSnippet = formatUpdatedTemplateCall(
            rawSnippet,
            targetName,
            missingReq,
            true
          );

          recordCursorMatch({
            templateName: rawName || targetName,
            matchedTemplateName: finalLookup.matchedTemplateName,
            start: i,
            end: unclosedEnd,
            isUnclosed: true,
            expectedParams: finalLookup.expectedParams,
            missingRequiredParams: missingReq.map(p => p.name),
          });

          suggestions.push({
            id: nextId(),
            issueType: 'unclosed_braces',
            severity: 'error',
            start: i,
            end: unclosedEnd,
            lineNumber: lineNumberAt(i),
            templateName: rawName || '(sem fechamento)',
            matchedTemplateName: finalLookup.matchedTemplateName,
            title: `Chave "{{${rawName || '...'}" sem fechamento "}}"`,
            reason:
              missingReq.length > 0
                ? `Falta fechar com "}}" e preencher parâmetro(s) obrigatório(s): ${missingReq.map(p => p.name).join(', ')}.`
                : 'A chamada de pré-definição foi aberta com "{{" mas não recebeu o fechamento "}}".',
            originalSnippet: rawSnippet,
            suggestedSnippet,
            expectedParams: finalLookup.expectedParams,
            missingRequiredParams: missingReq.map(p => p.name),
          });

          i = unclosedEnd;
          continue;
        }

        i++;
      }
    };

    scanSegment(0, source.length);

    // Pick innermost cursor match (smallest span covering cursorOffset)
    cursorMatches.sort((a, b) => a.end - a.start - (b.end - b.start));

    return {
      suggestions,
      activeCursorTemplate: cursorMatches[0] || null,
    };
  }
}

export const templateService = new TemplateService();
export type {
  TemplateExpansionOptions,
  TemplateExpansionResult,
  ParsedTemplateCall,
  TemplateDiagnostic,
  TemplateDiagnosticType,
};
