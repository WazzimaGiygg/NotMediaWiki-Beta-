import { WikiExtension } from '../types';

export const EXTENSION_SITE_TITLE_ENABLED = true;
export const DEFAULT_WIKI_SITE_TITLE = 'NotMediaWiki';
export const DEFAULT_WIKI_SITE_SUBTITLE = 'Projetos WazzimaGiygg';
export const DEFAULT_WIKI_PROJECT_BADGE = 'WazzimaGiygg';

/**
 * Extensão de Identidade & Renomeação do Título do Wiki ($wgSitename)
 * Permite ao burocrata renomear dinamicamente o título principal do Wiki-site
 * (atualmente "NotMediaWiki") e o subtítulo institucional, com persistência no Firebase.
 */
export const siteTitleExtension: WikiExtension = {
  id: 'ext-site-title',
  name: 'SiteTitle',
  namePt: 'Título do Wiki ($wgSitename)',
  version: '1.0.0',
  category: 'ui',
  author: 'NotMediaWiki Core & WazzimaGiygg Governance',
  description:
    'Permite ao burocrata renomear o título principal do Wiki-site (padrão: "NotMediaWiki"), o subtítulo institucional e o selo de rede exibidos no cabeçalho, rodapé, metadados SEO, navegador e exportações PDF. Configurações salvas no Firebase Firestore e carregadas na abertura do site.',
  enabled: true,
  type: 'extension',
  url: 'https://www.mediawiki.org/wiki/Manual:$wgSitename',
  license: 'GPL-2.0-or-later',
  hooks: [
    {
      name: 'BeforePageDisplay',
      handler: 'SiteTitleHooks::onBeforePageDisplay',
      description: 'Aplica o título personalizado ($wgSitename) no cabeçalho, metadados SEO e documento HTML.',
    },
    {
      name: 'SkinTemplateNavigation',
      handler: 'SiteTitleHooks::onSkinTemplateNavigation',
      description: 'Atualiza a marca textual principal na barra superior e no rodapé enciclopédico.',
    },
  ],
  config: [
    {
      key: '$wgSitename',
      type: 'string',
      value: DEFAULT_WIKI_SITE_TITLE,
      defaultValue: DEFAULT_WIKI_SITE_TITLE,
      description: 'Nome/título principal do Wiki-site exibido em todo o sistema (padrão: NotMediaWiki).',
    },
    {
      key: '$wgSiteSubtitle',
      type: 'string',
      value: DEFAULT_WIKI_SITE_SUBTITLE,
      defaultValue: DEFAULT_WIKI_SITE_SUBTITLE,
      description: 'Subtítulo institucional exibido no título da aba do navegador e abaixo da marca no cabeçalho.',
    },
    {
      key: '$wgSiteProjectBadge',
      type: 'string',
      value: DEFAULT_WIKI_PROJECT_BADGE,
      defaultValue: DEFAULT_WIKI_PROJECT_BADGE,
      description: 'Identificador curto exibido ao lado do título do Wiki-site no cabeçalho (deixe vazio para ocultar).',
    },
  ],
  manifestJson: {
    name: 'SiteTitle',
    version: '1.0.0',
    type: 'ui',
    license_name: 'GPL-2.0-or-later',
    default_sitename: DEFAULT_WIKI_SITE_TITLE,
  },
  lastUpdated: '2026-11-21',
};

export interface SiteTitleConfig {
  extensionEnabled: boolean;
  siteTitle: string;
  siteSubtitle: string;
  projectBadge: string;
  fullBrandName: string;
}

/**
 * Obtém o título configurado do Wiki-site a partir das extensões carregadas do Firebase.
 */
export function getSiteTitleConfig(extensions?: WikiExtension[]): SiteTitleConfig {
  let ext: WikiExtension | undefined = siteTitleExtension;

  if (extensions && extensions.length > 0) {
    const found = extensions.find(
      e => e.id === siteTitleExtension.id || e.name.toLowerCase() === 'sitetitle'
    );
    if (found) ext = found;
  } else if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem('notmediawiki_extensions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const found = parsed.find(
            (e: any) => e?.id === siteTitleExtension.id || String(e?.name || '').toLowerCase() === 'sitetitle'
          );
          if (found) ext = found;
        }
      }
    } catch {
      // Ignore storage access errors
    }
  }

  const extensionEnabled = Boolean(ext?.enabled ?? true);

  if (!extensionEnabled) {
    return {
      extensionEnabled: false,
      siteTitle: DEFAULT_WIKI_SITE_TITLE,
      siteSubtitle: DEFAULT_WIKI_SITE_SUBTITLE,
      projectBadge: DEFAULT_WIKI_PROJECT_BADGE,
      fullBrandName: `${DEFAULT_WIKI_SITE_TITLE} | ${DEFAULT_WIKI_SITE_SUBTITLE}`,
    };
  }

  const findConfig = (key: string, fallback: string): string => {
    const param = ext?.config?.find(c => c.key === key);
    if (param && param.value !== undefined && param.value !== null) {
      return String(param.value);
    }
    return fallback;
  };

  const rawTitle = findConfig('$wgSitename', DEFAULT_WIKI_SITE_TITLE).trim();
  const siteTitle = (rawTitle || DEFAULT_WIKI_SITE_TITLE).slice(0, 80);

  const rawSubtitle = findConfig('$wgSiteSubtitle', DEFAULT_WIKI_SITE_SUBTITLE).trim();
  const siteSubtitle = rawSubtitle.slice(0, 120);

  const rawBadge = findConfig('$wgSiteProjectBadge', DEFAULT_WIKI_PROJECT_BADGE).trim();
  const projectBadge = rawBadge.slice(0, 40);

  const fullBrandName = siteSubtitle ? `${siteTitle} | ${siteSubtitle}` : siteTitle;

  return {
    extensionEnabled,
    siteTitle,
    siteSubtitle,
    projectBadge,
    fullBrandName,
  };
}
