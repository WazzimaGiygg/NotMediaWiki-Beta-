import { WikiExtension } from '../types';

export const EXTENSION_SUPPORT_TICKETS_ENABLED = true;

/**
 * 3.05.3.b - Extensão de Suporte e Tickets
 * Permite modificar o link do suporte nas próprias configurações da extensão
 * (padrão é: https://support.wazzimagiygg.com/)
 */
export const supportTicketsExtension: WikiExtension = {
  id: 'ext-support-tickets',
  name: 'SupportAndTickets',
  namePt: 'Suporte e Tickets WazzimaGiygg',
  version: '2.1.0',
  category: 'ui',
  author: 'WazzimaGiygg Operations & Support Guild',
  description: 'Central de suporte, atendimento a chamados e tickets de suporte da comunidade WazzimaGiygg. Permite alterar o link do suporte diretamente nas configurações da extensão (padrão: https://support.wazzimagiygg.com/).',
  enabled: true,
  type: 'extension',
  url: 'https://support.wazzimagiygg.com/',
  license: 'GPL-2.0-or-later',
  hooks: [
    {
      name: 'SkinTemplateNavigation',
      handler: 'SupportTicketsHooks::onSkinTemplateNavigation',
      description: 'Adiciona botões de acesso à central de tickets na barra de navegação e menu de usuário.',
    },
    {
      name: 'BeforePageDisplay',
      handler: 'SupportTicketsHooks::onBeforePageDisplay',
      description: 'Carrega estilos e atalhos rápidos de atendimento ao usuário.',
    },
  ],
  config: [
    {
      key: '$wgSupportTicketsUrl',
      type: 'string',
      value: 'https://support.wazzimagiygg.com/',
      defaultValue: 'https://support.wazzimagiygg.com/',
      description: 'URL oficial da plataforma de atendimento e abertura de tickets (padrão: https://support.wazzimagiygg.com/).',
    },
    {
      key: '$wgSupportShowInHeader',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Exibe o atalho de Suporte & Tickets diretamente no cabeçalho superior e navegação rápida.',
    },
    {
      key: '$wgSupportOpenInNewTab',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Abre a central de tickets em uma nova aba segura (target="_blank", noopener, noreferrer).',
    },
    {
      key: '$wgSupportButtonLabel',
      type: 'string',
      value: 'Suporte & Tickets',
      defaultValue: 'Suporte & Tickets',
      description: 'Texto exibido no botão da barra de ferramentas e menus de navegação.',
    },
  ],
  manifestJson: {
    name: 'SupportAndTickets',
    version: '2.1.0',
    type: 'ui',
    license_name: 'GPL-2.0-or-later',
    manifest_version: 2,
    support_default_url: 'https://support.wazzimagiygg.com/',
  },
  lastUpdated: '2026-11-05',
};

/**
 * Obtém a configuração ativa de suporte e tickets a partir da lista de extensões
 */
export function getSupportTicketsConfig(extensions?: WikiExtension[]): {
  enabled: boolean;
  url: string;
  showInHeader: boolean;
  openInNewTab: boolean;
  buttonLabel: string;
} {
  let ext: WikiExtension | undefined = supportTicketsExtension;

  if (extensions && extensions.length > 0) {
    const found = extensions.find(e => e.id === supportTicketsExtension.id);
    if (found) ext = found;
  } else {
    try {
      const raw = localStorage.getItem('notmediawiki_extensions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const found = parsed.find((e: any) => e.id === supportTicketsExtension.id);
          if (found) ext = found;
        }
      }
    } catch {}
  }

  if (!ext || !ext.enabled) {
    return {
      enabled: false,
      url: 'https://support.wazzimagiygg.com/',
      showInHeader: false,
      openInNewTab: true,
      buttonLabel: 'Suporte & Tickets',
    };
  }

  const findConfig = (key: string, fallback: any) => {
    const p = ext?.config.find(c => c.key === key);
    return p !== undefined && p.value !== undefined ? p.value : fallback;
  };

  return {
    enabled: Boolean(ext.enabled),
    url: String(findConfig('$wgSupportTicketsUrl', 'https://support.wazzimagiygg.com/')),
    showInHeader: Boolean(findConfig('$wgSupportShowInHeader', true)),
    openInNewTab: Boolean(findConfig('$wgSupportOpenInNewTab', true)),
    buttonLabel: String(findConfig('$wgSupportButtonLabel', 'Suporte & Tickets')),
  };
}
