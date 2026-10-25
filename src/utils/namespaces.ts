/**
 * MediaWiki Canonical Namespace System
 * Implements complete namespace IDs, talk pairs, subpages, localized aliases (PT-BR) and permission matrices.
 */

export interface NamespaceDefinition {
  id: number;
  canonical: string;
  localized: string;
  aliases: string[];
  isTalk: boolean;
  hasSubpages: boolean;
  isContent: boolean;
  associatedTalkId?: number;
  associatedSubjectId?: number;
  requiredGroup?: 'sysop' | 'admin' | 'bureaucrat' | 'bot' | 'user';
  description: string;
}

export const MEDIAWIKI_NAMESPACES: Record<number, NamespaceDefinition> = {
  [-2]: {
    id: -2,
    canonical: 'Media',
    localized: 'Multimídia',
    aliases: ['Media'],
    isTalk: false,
    hasSubpages: false,
    isContent: false,
    description: 'Acesso direto ao arquivo multimídia bruto.',
  },
  [-1]: {
    id: -1,
    canonical: 'Special',
    localized: 'Especial',
    aliases: ['Special', 'Especial'],
    isTalk: false,
    hasSubpages: true,
    isContent: false,
    description: 'Páginas especiais de sistema, auditoria, estatísticas e ferramentas.',
  },
  [0]: {
    id: 0,
    canonical: '',
    localized: '',
    aliases: ['Artigo', 'Principal', 'Main'],
    isTalk: false,
    hasSubpages: false,
    isContent: true,
    associatedTalkId: 1,
    description: 'Namespace principal enciclopédico com os verbetes de conteúdo.',
  },
  [1]: {
    id: 1,
    canonical: 'Talk',
    localized: 'Discussão',
    aliases: ['Talk', 'Discussão'],
    isTalk: true,
    hasSubpages: true,
    isContent: false,
    associatedSubjectId: 0,
    description: 'Páginas de discussão do conteúdo enciclopédico principal.',
  },
  [2]: {
    id: 2,
    canonical: 'User',
    localized: 'Usuário',
    aliases: ['User', 'Usuário', 'Utilizador'],
    isTalk: false,
    hasSubpages: true,
    isContent: false,
    associatedTalkId: 3,
    description: 'Páginas de perfil e espaço de trabalho dos utilizadores.',
  },
  [3]: {
    id: 3,
    canonical: 'User talk',
    localized: 'Discussão Usuário',
    aliases: ['User talk', 'Discussão Usuário', 'Discussão Utilizador'],
    isTalk: true,
    hasSubpages: true,
    isContent: false,
    associatedSubjectId: 2,
    description: 'Páginas de recados e discussão direta entre editores.',
  },
  [4]: {
    id: 4,
    canonical: 'Project',
    localized: 'NotMediaWiki',
    aliases: ['Project', 'NotMediaWiki', 'WazzimaGiygg', 'Wikipedia', 'Projeto'],
    isTalk: false,
    hasSubpages: true,
    isContent: false,
    associatedTalkId: 5,
    description: 'Políticas, diretrizes e documentação institucional do projeto.',
  },
  [5]: {
    id: 5,
    canonical: 'Project talk',
    localized: 'Discussão NotMediaWiki',
    aliases: ['Project talk', 'Discussão NotMediaWiki', 'Discussão WazzimaGiygg', 'Discussão Projeto'],
    isTalk: true,
    hasSubpages: true,
    isContent: false,
    associatedSubjectId: 4,
    description: 'Debates sobre regras e governança do projeto.',
  },
  [6]: {
    id: 6,
    canonical: 'File',
    localized: 'Ficheiro',
    aliases: ['File', 'Ficheiro', 'Arquivo', 'Image', 'Imagem'],
    isTalk: false,
    hasSubpages: false,
    isContent: false,
    associatedTalkId: 7,
    description: 'Metadados, descrições e licenças de ficheiros carregados.',
  },
  [7]: {
    id: 7,
    canonical: 'File talk',
    localized: 'Discussão Ficheiro',
    aliases: ['File talk', 'Discussão Ficheiro', 'Discussão Arquivo'],
    isTalk: true,
    hasSubpages: true,
    isContent: false,
    associatedSubjectId: 6,
    description: 'Debates sobre licenças e direitos de imagens e mídia.',
  },
  [8]: {
    id: 8,
    canonical: 'MediaWiki',
    localized: 'MediaWiki',
    aliases: ['MediaWiki'],
    isTalk: false,
    hasSubpages: true,
    isContent: false,
    associatedTalkId: 9,
    requiredGroup: 'sysop',
    description: 'Mensagens de interface de sistema e traduções do motor.',
  },
  [9]: {
    id: 9,
    canonical: 'MediaWiki talk',
    localized: 'Discussão MediaWiki',
    aliases: ['MediaWiki talk', 'Discussão MediaWiki'],
    isTalk: true,
    hasSubpages: true,
    isContent: false,
    associatedSubjectId: 8,
    description: 'Discussão sobre mensagens de interface do sistema.',
  },
  [10]: {
    id: 10,
    canonical: 'Template',
    localized: 'Predefinição',
    aliases: ['Template', 'Predefinição', 'Predef'],
    isTalk: false,
    hasSubpages: true,
    isContent: false,
    associatedTalkId: 11,
    description: 'Infoboxes, caixas de aviso e modelos reutilizáveis.',
  },
  [11]: {
    id: 11,
    canonical: 'Template talk',
    localized: 'Discussão Predefinição',
    aliases: ['Template talk', 'Discussão Predefinição'],
    isTalk: true,
    hasSubpages: true,
    isContent: false,
    associatedSubjectId: 10,
    description: 'Debates sobre a estrutura e sintaxe de predefinições.',
  },
  [12]: {
    id: 12,
    canonical: 'Help',
    localized: 'Ajuda',
    aliases: ['Help', 'Ajuda'],
    isTalk: false,
    hasSubpages: true,
    isContent: false,
    associatedTalkId: 13,
    description: 'Guias de edição, tutoriais de sintaxe e manuais de navegação.',
  },
  [13]: {
    id: 13,
    canonical: 'Help talk',
    localized: 'Discussão Ajuda',
    aliases: ['Help talk', 'Discussão Ajuda'],
    isTalk: true,
    hasSubpages: true,
    isContent: false,
    associatedSubjectId: 12,
    description: 'Dúvidas e melhorias para os manuais de ajuda.',
  },
  [14]: {
    id: 14,
    canonical: 'Category',
    localized: 'Categoria',
    aliases: ['Category', 'Categoria'],
    isTalk: false,
    hasSubpages: false,
    isContent: false,
    associatedTalkId: 15,
    description: 'Índice taxonômico hierárquico e classificação de páginas.',
  },
  [15]: {
    id: 15,
    canonical: 'Category talk',
    localized: 'Discussão Categoria',
    aliases: ['Category talk', 'Discussão Categoria'],
    isTalk: true,
    hasSubpages: true,
    isContent: false,
    associatedSubjectId: 14,
    description: 'Debates sobre taxonomia e critérios de inclusão em categorias.',
  },
  [828]: {
    id: 828,
    canonical: 'Module',
    localized: 'Módulo',
    aliases: ['Module', 'Módulo'],
    isTalk: false,
    hasSubpages: true,
    isContent: false,
    associatedTalkId: 829,
    requiredGroup: 'sysop',
    description: 'Scripts Lua e módulos computacionais de parser avançado.',
  },
  [829]: {
    id: 829,
    canonical: 'Module talk',
    localized: 'Discussão Módulo',
    aliases: ['Module talk', 'Discussão Módulo'],
    isTalk: true,
    hasSubpages: true,
    isContent: false,
    associatedSubjectId: 828,
    description: 'Discussão técnica sobre algoritmos e scripts Lua.',
  },
};

export interface ParsedTitle {
  fullTitle: string;
  namespaceId: number;
  namespaceDef: NamespaceDefinition;
  namespacePrefix: string;
  baseTitle: string;
  rootTitle: string;
  subpageParts: string[];
  isSubpage: boolean;
  isTalk: boolean;
  subjectTitle: string;
  talkTitle: string | null;
  subjectNamespaceId: number;
  talkNamespaceId: number | null;
}

/**
 * Normaliza e analisa um título ou slug do MediaWiki identificando namespace,
 * subpáginas, e o par canônico (Assunto <-> Discussão).
 */
export function parseTitle(rawTitle: string): ParsedTitle {
  const cleanTitle = (rawTitle || '').trim().replace(/_/g, ' ');
  const colonIndex = cleanTitle.indexOf(':');

  let nsId = 0;
  let prefix = '';
  let baseTitle = cleanTitle;

  if (colonIndex > 0) {
    const candidatePrefix = cleanTitle.substring(0, colonIndex).trim().toLowerCase();
    const candidateBase = cleanTitle.substring(colonIndex + 1).trim();

    for (const def of Object.values(MEDIAWIKI_NAMESPACES)) {
      const allNames = [def.canonical, def.localized, ...def.aliases]
        .filter(Boolean)
        .map(n => n.toLowerCase());

      if (allNames.includes(candidatePrefix)) {
        nsId = def.id;
        prefix = def.localized || def.canonical;
        baseTitle = candidateBase;
        break;
      }
    }
  }

  const nsDef = MEDIAWIKI_NAMESPACES[nsId] || MEDIAWIKI_NAMESPACES[0];
  const isTalk = nsDef.isTalk;

  // Split subpages if enabled for namespace
  const subpageParts = nsDef.hasSubpages ? baseTitle.split('/') : [baseTitle];
  const isSubpage = subpageParts.length > 1;
  const rootTitle = subpageParts[0];

  // Resolve Subject and Talk pairs
  let subjectNsId = nsId;
  let talkNsId: number | null = null;
  let subjectTitle = cleanTitle;
  let talkTitle: string | null = null;

  if (nsId < 0) {
    // Special or Media pages don't have talk pages
    subjectNsId = nsId;
    talkNsId = null;
    subjectTitle = cleanTitle;
    talkTitle = null;
  } else if (isTalk) {
    subjectNsId = nsDef.associatedSubjectId ?? 0;
    talkNsId = nsId;
    const subjectNsDef = MEDIAWIKI_NAMESPACES[subjectNsId];
    subjectTitle = subjectNsId === 0 ? baseTitle : `${subjectNsDef.localized || subjectNsDef.canonical}:${baseTitle}`;
    talkTitle = cleanTitle;
  } else {
    subjectNsId = nsId;
    talkNsId = nsDef.associatedTalkId ?? null;
    if (talkNsId !== null) {
      const talkNsDef = MEDIAWIKI_NAMESPACES[talkNsId];
      talkTitle = `${talkNsDef.localized || talkNsDef.canonical}:${baseTitle}`;
    }
    subjectTitle = cleanTitle;
  }

  return {
    fullTitle: cleanTitle,
    namespaceId: nsId,
    namespaceDef: nsDef,
    namespacePrefix: prefix,
    baseTitle,
    rootTitle,
    subpageParts,
    isSubpage,
    isTalk,
    subjectTitle,
    talkTitle,
    subjectNamespaceId: subjectNsId,
    talkNamespaceId: talkNsId,
  };
}

/**
 * Retorna as migalhas de pão (breadcrumbs) de subpáginas.
 * Exemplo: "Usuário:Mafersao/Testes/Sandbox" ->
 * [
 *   { label: "Usuário:Mafersao", slug: "Usuário:Mafersao" },
 *   { label: "Testes", slug: "Usuário:Mafersao/Testes" }
 * ]
 */
export function getSubpageBreadcrumbs(parsed: ParsedTitle): Array<{ label: string; slug: string }> {
  if (!parsed.isSubpage || parsed.subpageParts.length <= 1) return [];

  const crumbs: Array<{ label: string; slug: string }> = [];
  let accumulated = '';

  for (let i = 0; i < parsed.subpageParts.length - 1; i++) {
    const part = parsed.subpageParts[i];
    accumulated = i === 0 ? part : `${accumulated}/${part}`;
    const fullSlug = parsed.namespaceId === 0
      ? accumulated
      : `${parsed.namespacePrefix}:${accumulated}`;

    crumbs.push({
      label: i === 0 ? (parsed.namespaceId === 0 ? part : `${parsed.namespacePrefix}:${part}`) : part,
      slug: fullSlug.replace(/ /g, '_'),
    });
  }

  return crumbs;
}

/**
 * Retorna todos os namespaces disponíveis para seleção em formulários e dropdowns de pesquisa.
 */
export function getAvailableNamespaces(includeSpecial = false): NamespaceDefinition[] {
  return Object.values(MEDIAWIKI_NAMESPACES)
    .filter(ns => (includeSpecial ? true : ns.id >= 0))
    .sort((a, b) => a.id - b.id);
}
