import { WikiExtension } from '../types';
import {
  getAvailableWikiThemes,
  resolveWikiTheme,
  WikiThemeDefinition,
} from '../themes/themeRegistry';

export const EXTENSION_THEME_APPEARANCE_ENABLED = true;
export const DEFAULT_WIKI_THEME_ID = 'vector-light';

/**
 * Extensão de Aparência & Seletor de Temas ($wgDefaultSkin / ThemeAppearance)
 * Permite alterar a aparência global ou pessoal segundo os temas disponíveis
 * cadastrados no Wiki-site, recebendo novos temas gradualmente conforme o sistema evolui.
 */
export const themeAppearanceExtension: WikiExtension = {
  id: 'ext-theme-appearance',
  name: 'ThemeAppearance',
  namePt: 'Aparência & Temas do Wiki ($wgDefaultSkin)',
  version: '1.0.0',
  category: 'ui',
  author: 'NotMediaWiki UI & Design Architecture',
  description:
    'Permite alterar a aparência visual do Wiki-site entre os temas disponíveis cadastrados no sistema (Vector Claro, Vector Noturno, Pergaminho Editorial, Monobook Clássico, Alto Contraste, Wikidiota [Paródia], Windows 3.1 e futuros temas inseridos gradualmente). O burocrata define o tema padrão e se leitores podem escolher temas pessoais.',
  enabled: true,
  type: 'skin',
  url: 'https://www.mediawiki.org/wiki/Manual:Skins',
  license: 'GPL-2.0-or-later',
  hooks: [
    {
      name: 'BeforePageDisplay',
      handler: 'ThemeAppearanceHooks::onBeforePageDisplay',
      description: 'Injeta variáveis de aparência e atributos data-wiki-theme conforme os temas disponíveis no Wiki-site.',
    },
    {
      name: 'SkinTemplateNavigation',
      handler: 'ThemeAppearanceHooks::onSkinTemplateNavigation',
      description: 'Disponibiliza o seletor interativo de temas no cabeçalho e no rodapé de Aparência & Temas.',
    },
  ],
  config: [
    {
      key: '$wgDefaultTheme',
      type: 'string',
      value: DEFAULT_WIKI_THEME_ID,
      defaultValue: DEFAULT_WIKI_THEME_ID,
      description:
        'ID do tema padrão aplicado na abertura do Wiki-site (ex.: vector-light, vector-dark, archival-sepia, monobook-classic, high-contrast-dark, wikidiota, windows-31).',
    },
    {
      key: '$wgAllowUserThemeSwitch',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description:
        'Permite que usuários e leitores alternem livremente entre os temas disponíveis no Wiki-site. Desative para impor o tema padrão do burocrata.',
    },
    {
      key: '$wgShowThemePickerInHeader',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description:
        'Exibe o botão de acesso rápido à seleção de temas e aparência na barra superior.',
    },
    {
      key: '$wgExtraThemesJson',
      type: 'string',
      value: '[]',
      defaultValue: '[]',
      description:
        'Lista JSON opcional de temas adicionais para expandir gradualmente os temas disponíveis no Wiki-site.',
    },
  ],
  manifestJson: {
    name: 'ThemeAppearance',
    version: '1.0.0',
    type: 'skin',
    license_name: 'GPL-2.0-or-later',
    default_theme: DEFAULT_WIKI_THEME_ID,
  },
  lastUpdated: '2026-11-21',
};

export interface ThemeAppearanceConfig {
  extensionEnabled: boolean;
  defaultThemeId: string;
  defaultTheme: WikiThemeDefinition;
  allowUserThemeSwitch: boolean;
  showThemePickerInHeader: boolean;
  availableThemes: WikiThemeDefinition[];
}

/**
 * Resolve a configuração ativa da extensão de Aparência & Temas a partir do registro Firebase/local.
 */
export function getThemeAppearanceConfig(extensions?: WikiExtension[]): ThemeAppearanceConfig {
  let ext: WikiExtension | undefined = themeAppearanceExtension;

  if (extensions && extensions.length > 0) {
    const found = extensions.find(
      e => e.id === themeAppearanceExtension.id || e.name.toLowerCase() === 'themeappearance'
    );
    if (found) ext = found;
  } else if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem('notmediawiki_extensions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const found = parsed.find(
            (e: any) =>
              e?.id === themeAppearanceExtension.id ||
              String(e?.name || '').toLowerCase() === 'themeappearance'
          );
          if (found) ext = found;
        }
      }
    } catch {
      // Ignore storage access errors
    }
  }

  const findConfig = (key: string, fallback: any) => {
    const p = ext?.config?.find(c => c.key === key);
    return p !== undefined && p.value !== undefined ? p.value : fallback;
  };

  const extensionEnabled = Boolean(ext?.enabled ?? true);
  const extraThemesJson = String(findConfig('$wgExtraThemesJson', '[]'));
  const availableThemes = getAvailableWikiThemes(extraThemesJson);
  const defaultThemeId = String(findConfig('$wgDefaultTheme', DEFAULT_WIKI_THEME_ID)).trim() || DEFAULT_WIKI_THEME_ID;
  const defaultTheme = resolveWikiTheme(defaultThemeId, availableThemes);

  if (!extensionEnabled) {
    return {
      extensionEnabled: false,
      defaultThemeId: DEFAULT_WIKI_THEME_ID,
      defaultTheme: resolveWikiTheme(DEFAULT_WIKI_THEME_ID, availableThemes),
      allowUserThemeSwitch: true,
      showThemePickerInHeader: false,
      availableThemes,
    };
  }

  return {
    extensionEnabled: true,
    defaultThemeId: defaultTheme.id,
    defaultTheme,
    allowUserThemeSwitch: Boolean(findConfig('$wgAllowUserThemeSwitch', true)),
    showThemePickerInHeader: Boolean(findConfig('$wgShowThemePickerInHeader', true)),
    availableThemes,
  };
}
