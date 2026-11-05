import { WikiExtension } from '../types';

export const EXTENSION_EXTERNAL_REDIRECT_ENABLED = true;

/**
 * 3.05.3.c - Extensão de Redirecionamento de Links Externos
 * Permite desativar o redirecionador global ou alterar o link do UID redirecionador
 * (padrão é: https://wazzimagiygg.com/rv/?uid=)
 */
export const externalRedirectExtension: WikiExtension = {
  id: 'ext-external-redirect',
  name: 'ExternalLinkRedirector',
  namePt: 'Redirecionador de Links Externos',
  version: '2.3.0',
  category: 'security',
  author: 'NotMediaWiki Security & Privacy Team',
  description: 'Controla a política de navegação para links externos. Adiciona o prefixo oficial UID WazzimaGiygg contra phishing e páginas maliciosas. Permite desativar o redirecionamento ou alterar o link do UID redirecionador nas configurações da extensão.',
  enabled: true,
  type: 'extension',
  url: 'https://wazzimagiygg.com/rv/',
  license: 'GPL-2.0-or-later',
  hooks: [
    {
      name: 'LinkerMakeExternalImage',
      handler: 'ExternalRedirectHooks::onLinkerMakeExternalLink',
      description: 'Intercepta e prefixa hiperlinks que apontam para fora do domínio NotMediaWiki.',
    },
    {
      name: 'BeforePageDisplay',
      handler: 'ExternalRedirectHooks::onBeforePageDisplay',
      description: 'Aplica a política no DOM do leitor de artigos e nos links das referências.',
    },
  ],
  config: [
    {
      key: '$wgEnableExternalRedirect',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Ativa ou desativa o redirecionador de links externos globalmente no sistema.',
    },
    {
      key: '$wgExternalRedirectPrefix',
      type: 'string',
      value: 'https://wazzimagiygg.com/rv/?uid=',
      defaultValue: 'https://wazzimagiygg.com/rv/?uid=',
      description: 'Prefixo do link UID utilizado para redirecionar acessos externos (padrão: https://wazzimagiygg.com/rv/?uid=).',
    },
    {
      key: '$wgBypassAllowedDomains',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Se ativado, domínios autorizados e confiáveis cadastrados pelo burocrata abrem diretamente sem prefixo.',
    },
    {
      key: '$wgWarnOnExternalRedirect',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Exibe indicador visual ou aviso de segurança ao sair para websites externos.',
    },
  ],
  manifestJson: {
    name: 'ExternalLinkRedirector',
    version: '2.3.0',
    type: 'security',
    license_name: 'GPL-2.0-or-later',
    default_prefix: 'https://wazzimagiygg.com/rv/?uid=',
  },
  lastUpdated: '2026-11-05',
};

/**
 * Obtém a configuração ativa do redirecionador de links externos
 */
export function getExternalRedirectConfig(extensions?: WikiExtension[]): {
  extensionEnabled: boolean;
  redirectActive: boolean;
  prefix: string;
  bypassAllowedDomains: boolean;
  warnOnRedirect: boolean;
} {
  let ext: WikiExtension | undefined = externalRedirectExtension;

  if (extensions && extensions.length > 0) {
    const found = extensions.find(e => e.id === externalRedirectExtension.id);
    if (found) ext = found;
  } else {
    try {
      const raw = localStorage.getItem('notmediawiki_extensions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const found = parsed.find((e: any) => e.id === externalRedirectExtension.id);
          if (found) ext = found;
        }
      }
    } catch {}
  }

  const isExtEnabled = Boolean(ext?.enabled);

  const findConfig = (key: string, fallback: any) => {
    const p = ext?.config.find(c => c.key === key);
    return p !== undefined && p.value !== undefined ? p.value : fallback;
  };

  const redirectActive = isExtEnabled && Boolean(findConfig('$wgEnableExternalRedirect', true));
  const rawPrefix = String(findConfig('$wgExternalRedirectPrefix', 'https://wazzimagiygg.com/rv/?uid=')).trim();
  const prefix = rawPrefix || 'https://wazzimagiygg.com/rv/?uid=';
  const bypassAllowedDomains = Boolean(findConfig('$wgBypassAllowedDomains', true));
  const warnOnRedirect = Boolean(findConfig('$wgWarnOnExternalRedirect', true));

  return {
    extensionEnabled: isExtEnabled,
    redirectActive,
    prefix,
    bypassAllowedDomains,
    warnOnRedirect,
  };
}
