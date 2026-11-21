export interface WikiThemePalettePreview {
  canvas: string;
  surface: string;
  text: string;
  accent: string;
  border: string;
}

export interface WikiThemeParodyEntry {
  title: string;
  subtitle: string;
}

export interface WikiThemeParodyMetadata {
  foundationName: string;
  parodyTitle: string;
  parodyTagline: string;
  entries: WikiThemeParodyEntry[];
}

export interface WikiThemeDefinition {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  colorScheme: 'light' | 'dark';
  addedInVersion: string;
  author: string;
  preview: WikiThemePalettePreview;
  cssVariables?: Record<string, string>;
  parodyMetadata?: WikiThemeParodyMetadata;
}

/**
 * Registro central e extensível de temas disponíveis no Wiki-site.
 * Novos temas e skins podem ser inseridos gradualmente nesta lista
 * à medida que o Wiki-site for aprimorado.
 */
export const WIKI_THEMES_REGISTRY: WikiThemeDefinition[] = [
  {
    id: 'vector-light',
    name: 'Vector Claro (Padrão)',
    shortLabel: 'Vector Claro',
    description:
      'Aparência enciclopédica diurna com fundo branco limpo, leitura confortável e foco em clareza tipográfica.',
    colorScheme: 'light',
    addedInVersion: '1.0.0',
    author: 'WazzimaGiygg UI Core',
    preview: {
      canvas: '#f8fafc',
      surface: '#ffffff',
      text: '#0f172a',
      accent: '#2563eb',
      border: '#e2e8f0',
    },
  },
  {
    id: 'vector-dark',
    name: 'Vector Noturno (Escuro)',
    shortLabel: 'Vector Escuro',
    description:
      'Tema escuro em tons de ardósia para reduzir a fadiga ocular em sessões prolongadas de leitura e edição.',
    colorScheme: 'dark',
    addedInVersion: '1.0.0',
    author: 'WazzimaGiygg UI Core',
    preview: {
      canvas: '#0f172a',
      surface: '#1e293b',
      text: '#f1f5f9',
      accent: '#60a5fa',
      border: '#334155',
    },
  },
  {
    id: 'archival-sepia',
    name: 'Pergaminho Editorial (Sépia)',
    shortLabel: 'Pergaminho',
    description:
      'Papel quente de acervo e tipografia clássica de monografia com contrastes suaves para leitura contínua.',
    colorScheme: 'light',
    addedInVersion: '1.1.0',
    author: 'Acervo Editorial WazzimaGiygg',
    preview: {
      canvas: '#fbf7ee',
      surface: '#f5efe2',
      text: '#292524',
      accent: '#9a3412',
      border: '#e5dcc8',
    },
  },
  {
    id: 'monobook-classic',
    name: 'Monobook Clássico',
    shortLabel: 'Monobook',
    description:
      'Estilo tradicional de enciclopédia livre inspirado no layout clássico histórico com bordas nítidas e títulos serifados.',
    colorScheme: 'light',
    addedInVersion: '1.2.0',
    author: 'Preservação Wiki',
    preview: {
      canvas: '#eef2f6',
      surface: '#ffffff',
      text: '#111827',
      accent: '#1d4ed8',
      border: '#cbd5e1',
    },
  },
  {
    id: 'high-contrast-dark',
    name: 'Alto Contraste (OLED)',
    shortLabel: 'Alto Contraste',
    description:
      'Fundo preto profundo e tipografia branca de altíssimo contraste para acessibilidade visual máxima.',
    colorScheme: 'dark',
    addedInVersion: '1.3.0',
    author: 'Acessibilidade WazzimaGiygg',
    preview: {
      canvas: '#05070a',
      surface: '#0d1117',
      text: '#ffffff',
      accent: '#38bdf8',
      border: '#334155',
    },
  },
  {
    id: 'wikidiota',
    name: 'Wikidiota (Edição Paródia)',
    shortLabel: 'Wikidiota',
    description:
      'Tema satírico de paródia institucional da Wikiomite Foundation, com crônica editorial do Feudo de LittleSunshine, Ditadura de Conde Edmond Dantès, Corrupção de Johannnes89 e Reinado do Chronus.',
    colorScheme: 'light',
    addedInVersion: '1.4.0',
    author: 'Sátira Editorial — Wikiomite Parody Press',
    preview: {
      canvas: '#f4f1ea',
      surface: '#fdfbf7',
      text: '#1f1c18',
      accent: '#b91c1c',
      border: '#d6cfc2',
    },
    parodyMetadata: {
      foundationName: 'Wikiomite Foundation',
      parodyTitle: 'Wikidiota',
      parodyTagline: 'A enciclopédia satírica de fachada da Wikiomite Foundation',
      entries: [
        {
          title: 'Wikiomite Foundation',
          subtitle: 'Conglomerado satírico de burocracia infinita, comitês invisíveis e editais perpétuos.',
        },
        {
          title: 'Feudo de LittleSunshine',
          subtitle: 'Província de dominação territorial, fronteiras fechadas e censura seletiva de verbetes.',
        },
        {
          title: 'Ditadura de Conde Edmond Dantès',
          subtitle: 'Regime de decretos sumários, bloqueios sem contraditório e tribunais de exceção.',
        },
        {
          title: 'Corrupção de Johannnes89',
          subtitle: 'Esquema satírico de privilégios internos, favorecimento em votações e proteção de aliados.',
        },
        {
          title: 'Reinado do Chronus',
          subtitle: 'Monarquia editorial absoluta sobre o tempo histórico, eliminações rápidas e consenso fabricado.',
        },
      ],
    },
  },
];

export const USER_THEME_STORAGE_KEY = 'notmediawiki_wiki_theme';

/**
 * Retorna os temas disponíveis no Wiki-site, mesclando opcionalmente temas extras
 * declarados dinamicamente via configuração JSON na extensão.
 */
export function getAvailableWikiThemes(extraThemesJson?: string): WikiThemeDefinition[] {
  const result = [...WIKI_THEMES_REGISTRY];
  if (extraThemesJson && extraThemesJson.trim()) {
    try {
      const parsed = JSON.parse(extraThemesJson);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => {
          if (item && typeof item.id === 'string' && typeof item.name === 'string') {
            const existsIdx = result.findIndex(t => t.id === item.id);
            const normalized: WikiThemeDefinition = {
              id: item.id.trim(),
              name: item.name.trim(),
              shortLabel: String(item.shortLabel || item.name).trim(),
              description: String(item.description || 'Tema personalizado registrado no Wiki-site.'),
              colorScheme: item.colorScheme === 'dark' ? 'dark' : 'light',
              addedInVersion: String(item.addedInVersion || 'Custom'),
              author: String(item.author || 'Burocrata'),
              preview: {
                canvas: String(item.preview?.canvas || (item.colorScheme === 'dark' ? '#0f172a' : '#f8fafc')),
                surface: String(item.preview?.surface || (item.colorScheme === 'dark' ? '#1e293b' : '#ffffff')),
                text: String(item.preview?.text || (item.colorScheme === 'dark' ? '#f8fafc' : '#0f172a')),
                accent: String(item.preview?.accent || '#2563eb'),
                border: String(item.preview?.border || (item.colorScheme === 'dark' ? '#334155' : '#e2e8f0')),
              },
              cssVariables: item.cssVariables && typeof item.cssVariables === 'object' ? item.cssVariables : undefined,
            };
            if (existsIdx >= 0) {
              result[existsIdx] = normalized;
            } else {
              result.push(normalized);
            }
          }
        });
      }
    } catch {
      // Ignore malformed optional JSON
    }
  }
  return result;
}

export function resolveWikiTheme(
  themeId: string | null | undefined,
  themes: WikiThemeDefinition[] = WIKI_THEMES_REGISTRY
): WikiThemeDefinition {
  if (themeId) {
    const match = themes.find(t => t.id === themeId);
    if (match) return match;
  }
  return themes[0] || WIKI_THEMES_REGISTRY[0];
}

export function readStoredUserWikiTheme(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const explicitTheme = window.localStorage.getItem(USER_THEME_STORAGE_KEY);
      if (explicitTheme) return explicitTheme;
      const legacy = window.localStorage.getItem('theme') || window.localStorage.getItem('notmediawiki_theme');
      if (legacy === 'dark') return 'vector-dark';
      if (legacy === 'light') return 'vector-light';
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

export function writeStoredUserWikiTheme(theme: WikiThemeDefinition): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(USER_THEME_STORAGE_KEY, theme.id);
      window.localStorage.setItem('theme', theme.colorScheme);
      window.localStorage.setItem('notmediawiki_theme', theme.colorScheme);
    }
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Aplica o tema ativo ao documento HTML (`data-wiki-theme` + classe `.dark` + variáveis CSS opcionais).
 */
export function applyWikiThemeToDocument(theme: WikiThemeDefinition): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-wiki-theme', theme.id);

  if (theme.colorScheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  if (theme.cssVariables) {
    Object.entries(theme.cssVariables).forEach(([key, val]) => {
      if (key.startsWith('--') && typeof val === 'string') {
        root.style.setProperty(key, val);
      }
    });
  } else {
    root.style.removeProperty('--wiki-canvas');
    root.style.removeProperty('--wiki-surface');
    root.style.removeProperty('--wiki-text');
    root.style.removeProperty('--wiki-accent');
  }
}
