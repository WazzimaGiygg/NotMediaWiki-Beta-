import { WikiExtension } from '../types';

/**
 * 3.05.3.g - Transformar Wiki dos Livros, Wiki Universitário e Jornal WazzimaGiygg
 * em extensões que podem ser desativadas.
 */

export const wikiLivrosExtension: WikiExtension = {
  id: 'ext-portal-livros',
  name: 'WikiLivrosPortal',
  namePt: 'Wiki dos Livros',
  version: '1.8.0',
  category: 'ui',
  author: 'WazzimaGiygg Knowledge & Literature Initiative',
  description: 'Portal temático de literatura aberta, e-books, manuais e compêndios colaborativos no ecossistema WikiWorlWeb. Pode ser desativado a qualquer momento pelo burocrata.',
  enabled: true,
  type: 'extension',
  url: 'https://wazzimagiygg.com/livros',
  license: 'CC-BY-SA-4.0',
  hooks: [
    {
      name: 'SkinTemplateNavigation',
      handler: 'WikiLivrosHooks::onSkinTemplateNavigation',
      description: 'Adiciona link do Portal Wiki dos Livros na barra de portais e na navegação superior.',
    },
  ],
  config: [
    {
      key: '$wgLivrosPortalEnabled',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Habilita o portal do Wiki dos Livros.',
    },
    {
      key: '$wgLivrosShowInNav',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Exibe o botão do Wiki dos Livros no cabeçalho e na página inicial.',
    },
    {
      key: '$wgLivrosCatalogueTitle',
      type: 'string',
      value: 'Catálogo de Livros Abertos & Manuais',
      defaultValue: 'Catálogo de Livros Abertos & Manuais',
      description: 'Título principal da seção de obras do Wiki dos Livros.',
    },
  ],
  manifestJson: {
    name: 'WikiLivrosPortal',
    version: '1.8.0',
    type: 'ui',
    license_name: 'CC-BY-SA-4.0',
  },
  lastUpdated: '2026-11-05',
};

export const wikiUniversitarioExtension: WikiExtension = {
  id: 'ext-portal-universitario',
  name: 'WikiUniversitarioPortal',
  namePt: 'Wiki Universitário',
  version: '1.9.0',
  category: 'ui',
  author: 'WazzimaGiygg Academic Network & Higher Education Guild',
  description: 'Ambiente acadêmico colaborativo com planos de aula, apostilas universitárias, teses e artigos revisados por pares. Pode ser desativado a qualquer momento pelo burocrata.',
  enabled: true,
  type: 'extension',
  url: 'https://wazzimagiygg.com/universitario',
  license: 'CC-BY-SA-4.0',
  hooks: [
    {
      name: 'SkinTemplateNavigation',
      handler: 'WikiUniversitarioHooks::onSkinTemplateNavigation',
      description: 'Adiciona link do Portal Wiki Universitário na barra de navegação e portais.',
    },
  ],
  config: [
    {
      key: '$wgUniversitarioPortalEnabled',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Habilita o portal do Wiki Universitário.',
    },
    {
      key: '$wgUniversitarioShowInNav',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Exibe o botão do Wiki Universitário no cabeçalho e na página inicial.',
    },
    {
      key: '$wgUniversitarioAcademicYear',
      type: 'string',
      value: 'Ano Letivo 2026',
      defaultValue: 'Ano Letivo 2026',
      description: 'Período acadêmico de referência dos cursos e ementas.',
    },
  ],
  manifestJson: {
    name: 'WikiUniversitarioPortal',
    version: '1.9.0',
    type: 'ui',
    license_name: 'CC-BY-SA-4.0',
  },
  lastUpdated: '2026-11-05',
};

export const jornalWazzimaGiyggExtension: WikiExtension = {
  id: 'ext-portal-jornal',
  name: 'JornalWazzimaGiyggPortal',
  namePt: 'Jornal WazzimaGiygg',
  version: '2.1.0',
  category: 'ui',
  author: 'WazzimaGiygg Press Office & Community Journalists',
  description: 'Veículo de imprensa oficial comunitário com notícias em tempo real, diário oficial da burocracia, crônicas e despachos comunitários. Pode ser desativado a qualquer momento pelo burocrata.',
  enabled: true,
  type: 'extension',
  url: 'https://wazzimagiygg.com/jornal',
  license: 'CC-BY-SA-4.0',
  hooks: [
    {
      name: 'SkinTemplateNavigation',
      handler: 'JornalHooks::onSkinTemplateNavigation',
      description: 'Adiciona o Jornal WazzimaGiygg no menu de portais e na navegação principal.',
    },
  ],
  config: [
    {
      key: '$wgJornalPortalEnabled',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Habilita o portal do Jornal WazzimaGiygg.',
    },
    {
      key: '$wgJornalShowInNav',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Exibe o botão do Jornal WazzimaGiygg no cabeçalho e na página inicial.',
    },
    {
      key: '$wgJornalHeadline',
      type: 'string',
      value: 'Edição Especial: Atualização do NotMediaWiki com Módulos de Governança',
      defaultValue: 'Edição Especial: Atualização do NotMediaWiki com Módulos de Governança',
      description: 'Manchete principal em destaque na capa do Jornal.',
    },
  ],
  manifestJson: {
    name: 'JornalWazzimaGiyggPortal',
    version: '2.1.0',
    type: 'ui',
    license_name: 'CC-BY-SA-4.0',
  },
  lastUpdated: '2026-11-05',
};

export const PORTAL_EXTENSIONS = [
  wikiLivrosExtension,
  wikiUniversitarioExtension,
  jornalWazzimaGiyggExtension,
];

/**
 * Obtém o status e configuração de cada um dos portais (Livros, Universitário, Jornal)
 */
export function getPortalsConfig(extensions?: WikiExtension[]): {
  livros: {
    id: string;
    enabled: boolean;
    showInNav: boolean;
    name: string;
  };
  universitario: {
    id: string;
    enabled: boolean;
    showInNav: boolean;
    name: string;
  };
  jornal: {
    id: string;
    enabled: boolean;
    showInNav: boolean;
    name: string;
  };
} {
  let list = PORTAL_EXTENSIONS;
  if (extensions && extensions.length > 0) {
    list = extensions;
  } else {
    try {
      const raw = localStorage.getItem('notmediawiki_extensions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
        }
      }
    } catch {}
  }

  const findPortal = (id: string, defExt: WikiExtension, keyEnabled: string, keyNav: string) => {
    const ext = list.find((e: any) => e.id === id) || defExt;
    const isExtEnabled = Boolean(ext.enabled);
    const pEnabled = ext.config.find(c => c.key === keyEnabled)?.value;
    const pNav = ext.config.find(c => c.key === keyNav)?.value;
    const enabled = isExtEnabled && (pEnabled !== undefined ? Boolean(pEnabled) : true);
    const showInNav = enabled && (pNav !== undefined ? Boolean(pNav) : true);
    return {
      id,
      enabled,
      showInNav,
      name: ext.namePt || ext.name,
    };
  };

  return {
    livros: findPortal('ext-portal-livros', wikiLivrosExtension, '$wgLivrosPortalEnabled', '$wgLivrosShowInNav'),
    universitario: findPortal('ext-portal-universitario', wikiUniversitarioExtension, '$wgUniversitarioPortalEnabled', '$wgUniversitarioShowInNav'),
    jornal: findPortal('ext-portal-jornal', jornalWazzimaGiyggExtension, '$wgJornalPortalEnabled', '$wgJornalShowInNav'),
  };
}
