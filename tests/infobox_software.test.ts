import { describe, it, expect } from 'vitest';
import { clientParsoid } from '../src/services/parsoid';
import { parsoidService } from '../server/services/parsoid';
import {
  INFOBOX_SOFTWARE_FIELDS,
  buildInfoboxSoftwareWikitext,
  getInfoboxFieldLabel,
} from '../src/utils/infoboxSoftware';
import {
  INFOBOX_USER_FIELDS,
  buildInfoboxUserWikitext,
  buildInitialUserPageWikitext,
  hasInfoboxInWikitext,
  resolveRoleDisplayTitle,
} from '../src/utils/infoboxUser';

describe('Infobox Software Extended Fields & Rendering Suite', () => {
  it('exposes name, email, and comprehensive software metadata fields', () => {
    const keys = INFOBOX_SOFTWARE_FIELDS.map(f => f.key);
    expect(keys).toContain('name');
    expect(keys).toContain('developer');
    expect(keys).toContain('author');
    expect(keys).toContain('maintainer');
    expect(keys).toContain('email');
    expect(keys).toContain('latest_release_version');
    expect(keys).toContain('initial_release');
    expect(keys).toContain('status');
    expect(keys).toContain('programming_language');
    expect(keys).toContain('operating_system');
    expect(keys).toContain('platform');
    expect(keys).toContain('genre');
    expect(keys).toContain('license');
    expect(keys).toContain('repository');
    expect(keys).toContain('website');
    expect(keys).toContain('support_url');
  });

  it('generates clean Infobox software wikitext with custom values and starter template', () => {
    const custom = buildInfoboxSoftwareWikitext({
      name: 'NotMediaWiki',
      developer: 'Projetos WazzimaGiygg',
      email: 'contato@wazzimagiygg.com',
      latest_release_version: '3.05.3',
      website: 'https://core.wazzimagiygg.com',
    });

    expect(custom).toContain('{{Infobox software');
    expect(custom).toContain('| name = NotMediaWiki');
    expect(custom).toContain('| email = contato@wazzimagiygg.com');
    expect(custom).toContain('| latest_release_version = 3.05.3');
    expect(custom).toContain('| website = https://core.wazzimagiygg.com');
    expect(custom).toContain('}}');

    const blankTemplate = buildInfoboxSoftwareWikitext();
    expect(blankTemplate).toContain('| name = ');
    expect(blankTemplate).toContain('| email = ');
    expect(blankTemplate).toContain('| support_url = ');
  });

  it('renders email as mailto link, bare URLs as clickable links, Portuguese labels, logo, and skips empty rows in client Parsoid', () => {
    const wikitext = `{{Infobox software
| name = NotMediaWiki Core
| logo = /assets/aistudio/image_370f9ede.png
| caption = Logotipo oficial
| developer = Projetos WazzimaGiygg
| email = contato@wazzimagiygg.com
| latest_release_version = 3.05.3
| status = Ativo
| website = https://core.wazzimagiygg.com
| repository = 
}}

Texto introdutório.`;

    const parsed = clientParsoid.parse(wikitext, 'NotMediaWiki Core');
    expect(parsed.html).toContain('NotMediaWiki Core');
    expect(parsed.html).toContain('src="/assets/aistudio/image_370f9ede.png"');
    expect(parsed.html).toContain('Logotipo oficial');
    expect(parsed.html).toContain('Desenvolvedor');
    expect(parsed.html).toContain('E-mail');
    expect(parsed.html).toContain('href="mailto:contato@wazzimagiygg.com"');
    expect(parsed.html).toContain('Versão Atual');
    expect(parsed.html).toContain('Site Oficial');
    expect(parsed.html).toContain('core.wazzimagiygg.com');
    // Empty repository row should be omitted from rendered table
    expect(parsed.html).not.toContain('Repositório');
  });

  it('maintains server Parsoid rendering parity for Infobox software email and URLs', () => {
    const wikitext = `{{Infobox software
| nome = Sistema WazzimaGiygg
| email = suporte@wazzimagiygg.com
| website = https://core.wazzimagiygg.com
| support_url = https://support.wazzimagiygg.com/
| license = Apache-2.0
}}`;

    const parsed = parsoidService.parse(wikitext, 'Fallback');
    expect(parsed.html).toContain('Sistema WazzimaGiygg');
    expect(parsed.html).toContain('href="mailto:suporte@wazzimagiygg.com"');
    expect(parsed.html).toContain('href="https://core.wazzimagiygg.com"');
    expect(parsed.html).toContain('Suporte');
    expect(parsed.html).toContain('Licença');
    expect(getInfoboxFieldLabel('e-mail')).toBe('E-mail');
  });
});

describe('Infobox User & New Account Identification Suite', () => {
  it('exposes all user identification metadata fields and resolves role titles in Portuguese', () => {
    const keys = INFOBOX_USER_FIELDS.map(f => f.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'name',
        'tag',
        'role',
        'email',
        'location',
        'languages',
        'joined',
        'specialties',
        'status',
        'website',
        'github',
        'logo',
        'caption',
      ])
    );

    expect(resolveRoleDisplayTitle('bureaucrat')).toBe('Burocrata');
    expect(resolveRoleDisplayTitle('sysop')).toBe('Administrador');
    expect(resolveRoleDisplayTitle('moderator')).toBe('Moderador');
    expect(resolveRoleDisplayTitle('editor')).toBe('Editor Comunitário');
  });

  it('generates {{Infobox user}} automatically for newly created user accounts', () => {
    const initialWikitext = buildInitialUserPageWikitext(
      {
        username: 'Ana Costa',
        role: 'editor',
        email: 'ana@wazzimagiygg.com',
        photoURL: 'https://core.wazzimagiygg.com/avatars/ana.png',
      },
      '#1142'
    );

    expect(hasInfoboxInWikitext(initialWikitext)).toBe(true);
    expect(initialWikitext).toContain('{{Infobox user');
    expect(initialWikitext).toContain('| name = Ana Costa');
    expect(initialWikitext).toContain('| tag = #1142');
    expect(initialWikitext).toContain('| role = Editor Comunitário');
    expect(initialWikitext).toContain('| email = ana@wazzimagiygg.com');
    expect(initialWikitext).toContain('| logo = https://core.wazzimagiygg.com/avatars/ana.png');
    expect(initialWikitext).toContain('| website = https://core.wazzimagiygg.com');
    expect(initialWikitext).toContain('== Apresentação ==');
  });

  it('detects whether a wikitext document already includes an Infobox', () => {
    expect(hasInfoboxInWikitext('{{Infobox user\n| name = Teste\n}}')).toBe(true);
    expect(hasInfoboxInWikitext('{{Infobox software\n| name = App\n}}')).toBe(true);
    expect(hasInfoboxInWikitext('== Apresentação ==\nTexto simples sem infobox.')).toBe(false);
    expect(hasInfoboxInWikitext('')).toBe(false);
  });

  it('renders {{Infobox user}} with Portuguese labels and clickable links in both client and server Parsoid', () => {
    const userInfobox = buildInfoboxUserWikitext({
      username: 'Carlos Mendes',
      userTag: '#1205',
      role: 'moderator',
      email: 'carlos@wazzimagiygg.com',
      location: 'São Paulo, Brasil',
      languages: 'Português (BR), Inglês',
      joined: '2026-11-17',
      specialties: 'História, Ciência',
      status: 'Ativo',
      website: 'https://core.wazzimagiygg.com',
      github: 'https://github.com/carlosmendes',
    });

    const clientParsed = clientParsoid.parse(userInfobox, 'Usuário:Carlos Mendes');
    const serverParsed = parsoidService.parse(userInfobox, 'Usuário:Carlos Mendes');

    for (const parsed of [clientParsed, serverParsed]) {
      expect(parsed.html).toContain('Carlos Mendes');
      expect(parsed.html).toContain('Tag Exclusiva');
      expect(parsed.html).toContain('#1205');
      expect(parsed.html).toContain('Função');
      expect(parsed.html).toContain('Moderador');
      expect(parsed.html).toContain('E-mail');
      expect(parsed.html).toContain('href="mailto:carlos@wazzimagiygg.com"');
      expect(parsed.html).toContain('Localização');
      expect(parsed.html).toContain('São Paulo, Brasil');
      expect(parsed.html).toContain('Idiomas');
      expect(parsed.html).toContain('Membro desde');
      expect(parsed.html).toContain('Especialidades');
      expect(parsed.html).toContain('GitHub');
      expect(parsed.html).toContain('href="https://github.com/carlosmendes"');
    }
  });
});
