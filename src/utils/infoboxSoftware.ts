export interface InfoboxFieldDef {
  key: string;
  label: string;
  placeholder: string;
  description: string;
  type?: 'text' | 'email' | 'url';
}

export const INFOBOX_SOFTWARE_FIELDS: InfoboxFieldDef[] = [
  {
    key: 'name',
    label: 'Nome do Software',
    placeholder: 'Ex.: NotMediaWiki',
    description: 'Nome oficial exibido no cabeçalho da Infobox.',
    type: 'text',
  },
  {
    key: 'developer',
    label: 'Desenvolvedor',
    placeholder: 'Ex.: Projetos WazzimaGiygg',
    description: 'Organização, empresa ou equipe responsável pelo desenvolvimento.',
    type: 'text',
  },
  {
    key: 'author',
    label: 'Autor / Criador',
    placeholder: 'Ex.: Equipe Core WazzimaGiygg',
    description: 'Autor original ou criador principal do projeto.',
    type: 'text',
  },
  {
    key: 'maintainer',
    label: 'Mantenedor',
    placeholder: 'Ex.: Comunidade NotMediaWiki',
    description: 'Pessoa ou grupo responsável pela manutenção contínua.',
    type: 'text',
  },
  {
    key: 'email',
    label: 'E-mail de Contato',
    placeholder: 'Ex.: contato@wazzimagiygg.com',
    description: 'E-mail oficial de suporte, segurança ou contato (renderizado como link mailto:).',
    type: 'email',
  },
  {
    key: 'latest_release_version',
    label: 'Versão Atual',
    placeholder: 'Ex.: 3.05.3',
    description: 'Número da versão estável mais recente.',
    type: 'text',
  },
  {
    key: 'initial_release',
    label: 'Lançamento Inicial',
    placeholder: 'Ex.: 2026-01-15',
    description: 'Data ou ano da primeira versão pública.',
    type: 'text',
  },
  {
    key: 'status',
    label: 'Status',
    placeholder: 'Ex.: Ativo / Em desenvolvimento',
    description: 'Estado atual do ciclo de vida do software (Ativo, Beta, Descontinuado).',
    type: 'text',
  },
  {
    key: 'programming_language',
    label: 'Linguagem',
    placeholder: 'Ex.: TypeScript, Node.js, React',
    description: 'Principais linguagens e tecnologias utilizadas.',
    type: 'text',
  },
  {
    key: 'operating_system',
    label: 'Sistema Operacional',
    placeholder: 'Ex.: Multiplataforma (Linux, Windows, macOS, Web)',
    description: 'Sistemas operacionais suportados.',
    type: 'text',
  },
  {
    key: 'platform',
    label: 'Plataforma',
    placeholder: 'Ex.: Web / Cloud Run / Node.js 20+',
    description: 'Ambiente de execução ou arquitetura alvo.',
    type: 'text',
  },
  {
    key: 'genre',
    label: 'Categoria / Gênero',
    placeholder: 'Ex.: Motor Wiki / Base de Conhecimento',
    description: 'Classificação funcional do software.',
    type: 'text',
  },
  {
    key: 'license',
    label: 'Licença',
    placeholder: 'Ex.: Apache-2.0 / MIT / GPL-2.0',
    description: 'Licença de distribuição e uso do código.',
    type: 'text',
  },
  {
    key: 'repository',
    label: 'Repositório',
    placeholder: 'Ex.: https://github.com/wazzimagiygg/notmediawiki',
    description: 'URL do repositório de código-fonte.',
    type: 'url',
  },
  {
    key: 'website',
    label: 'Site Oficial',
    placeholder: 'Ex.: https://core.wazzimagiygg.com',
    description: 'Endereço principal do projeto na web.',
    type: 'url',
  },
  {
    key: 'support_url',
    label: 'Suporte / Documentação',
    placeholder: 'Ex.: https://support.wazzimagiygg.com/',
    description: 'Portal de documentação, central de ajuda ou tickets.',
    type: 'url',
  },
  {
    key: 'logo',
    label: 'Logotipo (URL)',
    placeholder: 'Ex.: /assets/aistudio/image_370f9ede.png',
    description: 'URL ou caminho da imagem exibida no topo da Infobox (opcional).',
    type: 'url',
  },
  {
    key: 'caption',
    label: 'Legenda do Logotipo',
    placeholder: 'Ex.: Logotipo oficial do software',
    description: 'Texto descritivo abaixo do logotipo (opcional).',
    type: 'text',
  },
];

/**
 * Maps standard English & Portuguese Infobox software parameter keys to readable Portuguese labels.
 */
export const INFOBOX_LABEL_MAP: Record<string, string> = {
  name: 'Nome',
  nome: 'Nome',
  developer: 'Desenvolvedor',
  desenvolvedor: 'Desenvolvedor',
  author: 'Autor',
  autor: 'Autor',
  creator: 'Criador',
  criador: 'Criador',
  maintainer: 'Mantenedor',
  mantenedor: 'Mantenedor',
  email: 'E-mail',
  'e-mail': 'E-mail',
  contact_email: 'E-mail de Contato',
  contato: 'Contato',
  initial_release: 'Lançamento Inicial',
  lancamento: 'Lançamento Inicial',
  lancamento_inicial: 'Lançamento Inicial',
  latest_release_version: 'Versão Atual',
  version: 'Versão',
  versao: 'Versão',
  latest_release_date: 'Data da Versão',
  status: 'Status',
  estado: 'Status',
  programming_language: 'Linguagem',
  linguagem: 'Linguagem',
  operating_system: 'Sistema Operacional',
  sistema_operacional: 'Sistema Operacional',
  platform: 'Plataforma',
  plataforma: 'Plataforma',
  genre: 'Categoria',
  category: 'Categoria',
  categoria: 'Categoria',
  license: 'Licença',
  licenca: 'Licença',
  repository: 'Repositório',
  repositorio: 'Repositório',
  website: 'Site Oficial',
  site: 'Site Oficial',
  homepage: 'Site Oficial',
  support_url: 'Suporte',
  suporte: 'Suporte',
  documentation: 'Documentação',
  documentacao: 'Documentação',
  key_characteristics: 'Características',
  caption: 'Legenda',
  legenda: 'Legenda',
  tag: 'Tag Exclusiva',
  role: 'Função',
  papel: 'Função',
  funcao: 'Função',
  location: 'Localização',
  localizacao: 'Localização',
  languages: 'Idiomas',
  idiomas: 'Idiomas',
  joined: 'Membro desde',
  membro_desde: 'Membro desde',
  specialties: 'Especialidades',
  especialidades: 'Especialidades',
  interesses: 'Interesses',
  github: 'GitHub',
  social: 'Rede Social',
};

export function getInfoboxFieldLabel(rawKey: string): string {
  const normalized = rawKey.trim().toLowerCase().replace(/\s+/g, '_');
  if (INFOBOX_LABEL_MAP[normalized]) {
    return INFOBOX_LABEL_MAP[normalized];
  }
  return rawKey
    .trim()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, ch => ch.toUpperCase());
}

/**
 * Generates a complete {{Infobox software ... }} Wikitext block.
 * If `values` are provided, fills matching fields; otherwise produces an editable starter template.
 */
export function buildInfoboxSoftwareWikitext(values?: Partial<Record<string, string>>): string {
  const defaultKeys = [
    'name',
    'developer',
    'author',
    'email',
    'latest_release_version',
    'initial_release',
    'status',
    'programming_language',
    'operating_system',
    'platform',
    'genre',
    'license',
    'repository',
    'website',
    'support_url',
  ];

  const lines: string[] = ['{{Infobox software'];

  if (values && Object.keys(values).length > 0) {
    // Include all fields in canonical order that have non-empty values (always keeping name)
    for (const field of INFOBOX_SOFTWARE_FIELDS) {
      const val = (values[field.key] ?? '').trim();
      if (val || field.key === 'name') {
        lines.push(`| ${field.key} = ${val}`);
      }
    }
  } else {
    for (const key of defaultKeys) {
      lines.push(`| ${key} = `);
    }
  }

  lines.push('}}');
  return lines.join('\n') + '\n';
}

function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Formats an Infobox row value, converting wikilinks, bracketed external links,
 * bare URLs, and email addresses into safe clickable HTML links.
 */
export function formatInfoboxFieldValue(
  rawKey: string,
  rawValue: string,
  wrapExternal?: (url: string) => string
): string {
  const trimmed = rawValue.trim();
  const normalizedKey = rawKey.trim().toLowerCase();

  // Direct email address formatting for email fields or plain email values
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (emailRegex.test(trimmed)) {
    const safeEmail = escapeHtmlAttr(trimmed);
    return `<a href="mailto:${safeEmail}" class="text-blue-600 dark:text-blue-400 underline break-all">${safeEmail}</a>`;
  }

  // Bare URL formatting (e.g. website = https://core.wazzimagiygg.com)
  if (/^https?:\/\/[^\s<>"']+$/i.test(trimmed)) {
    const targetHref = wrapExternal ? wrapExternal(trimmed) : trimmed;
    const displayLabel = trimmed.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    return `<a href="${escapeHtmlAttr(targetHref)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 underline break-all">${escapeHtmlAttr(displayLabel)}</a>`;
  }

  // Inline wikilinks and bracketed external links + inline emails
  let formatted = trimmed
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_: string, target: string, label?: string) => label || target)
    .replace(/\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g, (_: string, url: string, text: string) => {
      const targetHref = wrapExternal ? wrapExternal(url) : url;
      return `<a href="${escapeHtmlAttr(targetHref)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 underline">${text}</a>`;
    });

  if (['email', 'e-mail', 'contact_email', 'contato'].includes(normalizedKey)) {
    formatted = formatted.replace(
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      '<a href="mailto:$1" class="text-blue-600 dark:text-blue-400 underline break-all">$1</a>'
    );
  }

  return formatted;
}
