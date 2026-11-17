import { UserSession } from '../types';
import { InfoboxFieldDef } from './infoboxSoftware';

export const INFOBOX_USER_FIELDS: InfoboxFieldDef[] = [
  {
    key: 'name',
    label: 'Nome de Exibição',
    placeholder: 'Ex.: Maria Silva',
    description: 'Nome principal exibido no topo da Infobox de identificação.',
    type: 'text',
  },
  {
    key: 'tag',
    label: 'Tag Exclusiva',
    placeholder: 'Ex.: #1100',
    description: 'Identificador numérico único da conta na enciclopédia.',
    type: 'text',
  },
  {
    key: 'role',
    label: 'Função / Papel',
    placeholder: 'Ex.: Editor Comunitário',
    description: 'Nível de permissão na comunidade (Editor, Moderador, Administrador, Burocrata).',
    type: 'text',
  },
  {
    key: 'email',
    label: 'E-mail de Contato',
    placeholder: 'Ex.: usuario@wazzimagiygg.com',
    description: 'E-mail exibido como link mailto: clicável (opcional).',
    type: 'email',
  },
  {
    key: 'location',
    label: 'Localização',
    placeholder: 'Ex.: Brasil',
    description: 'País, estado ou fuso horário de atuação.',
    type: 'text',
  },
  {
    key: 'languages',
    label: 'Idiomas',
    placeholder: 'Ex.: Português (Nativo), Inglês',
    description: 'Idiomas em que o usuário contribui e revisa artigos.',
    type: 'text',
  },
  {
    key: 'joined',
    label: 'Membro desde',
    placeholder: 'Ex.: 2026-11-17',
    description: 'Data de ingresso na comunidade NotMediaWiki.',
    type: 'text',
  },
  {
    key: 'specialties',
    label: 'Especialidades / Interesses',
    placeholder: 'Ex.: Tecnologia, História, Ciência',
    description: 'Temas principais em que costuma editar ou revisar.',
    type: 'text',
  },
  {
    key: 'status',
    label: 'Status',
    placeholder: 'Ex.: Ativo',
    description: 'Disponibilidade atual na enciclopédia (Ativo, Em pausa, Disponível para revisões).',
    type: 'text',
  },
  {
    key: 'website',
    label: 'Site / Portfólio',
    placeholder: 'Ex.: https://core.wazzimagiygg.com',
    description: 'Página pessoal ou projeto principal (renderizado como link clicável).',
    type: 'url',
  },
  {
    key: 'github',
    label: 'GitHub / Rede Social',
    placeholder: 'Ex.: https://github.com/usuario',
    description: 'Perfil técnico ou rede social de referência (opcional).',
    type: 'url',
  },
  {
    key: 'logo',
    label: 'Foto / Avatar (URL)',
    placeholder: 'Ex.: https://...',
    description: 'Imagem exibida no topo da Infobox de usuário (opcional).',
    type: 'url',
  },
  {
    key: 'caption',
    label: 'Legenda / Frase',
    placeholder: 'Ex.: Contribuidor do conhecimento livre',
    description: 'Texto curto exibido abaixo da imagem do perfil (opcional).',
    type: 'text',
  },
];

export function resolveRoleDisplayTitle(role?: string): string {
  switch (role) {
    case 'bureaucrat':
      return 'Burocrata';
    case 'sysop':
      return 'Administrador';
    case 'moderator':
      return 'Moderador';
    default:
      return 'Editor Comunitário';
  }
}

/**
 * Generates a {{Infobox user ... }} Wikitext block populated with a user's identification metadata.
 */
export function buildInfoboxUserWikitext(params: {
  username: string;
  userTag?: string;
  role?: string;
  email?: string;
  location?: string;
  languages?: string;
  joined?: string;
  specialties?: string;
  status?: string;
  website?: string;
  github?: string;
  photoURL?: string;
  caption?: string;
}): string {
  const roleLabel = resolveRoleDisplayTitle(params.role);
  const joinedDate = params.joined || new Date().toISOString().split('T')[0];

  const lines: string[] = [
    '{{Infobox user',
    `| name = ${params.username}`,
  ];

  if (params.photoURL && /^(https?:\/\/|\/assets\/)/i.test(params.photoURL.trim())) {
    lines.push(`| logo = ${params.photoURL.trim()}`);
    if (params.caption) {
      lines.push(`| caption = ${params.caption.trim()}`);
    }
  }

  if (params.userTag) {
    lines.push(`| tag = ${params.userTag}`);
  }

  lines.push(`| role = ${roleLabel}`);

  if (params.email) {
    lines.push(`| email = ${params.email}`);
  }

  lines.push(`| location = ${params.location || 'Brasil'}`);
  lines.push(`| languages = ${params.languages || 'Português (BR)'}`);
  lines.push(`| joined = ${joinedDate}`);
  lines.push(`| specialties = ${params.specialties || 'Enciclopédia Colaborativa, Revisão de Artigos'}`);
  lines.push(`| status = ${params.status || 'Ativo'}`);

  if (params.website) {
    lines.push(`| website = ${params.website}`);
  }
  if (params.github) {
    lines.push(`| github = ${params.github}`);
  }

  lines.push('}}');
  return lines.join('\n');
}

/**
 * Generates the default initial Wikitext for newly created user accounts,
 * guaranteeing an {{Infobox user}} identification block at the top of the page.
 */
export function buildInitialUserPageWikitext(
  user: Pick<UserSession, 'username' | 'role' | 'email' | 'photoURL'>,
  tag: string,
  roleTitle?: string
): string {
  const resolvedRole = roleTitle || resolveRoleDisplayTitle(user.role);
  const infobox = buildInfoboxUserWikitext({
    username: user.username,
    userTag: tag,
    role: user.role,
    email: user.email,
    location: 'Brasil',
    languages: 'Português (BR)',
    specialties: 'Tecnologia, Conhecimento Livre, Curadoria Wiki',
    status: 'Ativo',
    website: 'https://core.wazzimagiygg.com',
    photoURL: user.photoURL,
    caption: `${resolvedRole} no NotMediaWiki`,
  });

  return `${infobox}

== Apresentação ==
Olá! Bem-vindo(a) à página oficial de usuário de '''${user.username}''' (${tag}) no NotMediaWiki.

=== Sobre Mim ===
* Membro da comunidade do NotMediaWiki com privilégios de '''${resolvedRole}'''.
* Dedicado à expansão e curadoria de conhecimento enciclopédico livre e transparente.

=== Interesses Enciclopédicos ===
# Tecnologia e Sistemas Distribuídos
# Governança de Software Livre e Mídia Digital
# Conformidade com LGPD e Marco Civil da Internet

=== Contato ===
Para entrar em contato, deixe uma mensagem na minha seção de discussão abaixo ou inicie um Chat em Tempo Real.`;
}

/**
 * Checks whether a Wikitext document already contains any {{Infobox ...}} block.
 */
export function hasInfoboxInWikitext(wikitext?: string): boolean {
  if (!wikitext) return false;
  return /\{\{\s*Infobox\s+/i.test(wikitext);
}
