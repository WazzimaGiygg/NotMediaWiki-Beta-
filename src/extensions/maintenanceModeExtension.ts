import { WikiExtension } from '../types';

export const EXTENSION_MAINTENANCE_MODE_ENABLED = true;

/**
 * 3.05.3.e - Extensão de Modo de Manutenção do WikiWorlWeb
 * Define quando o WikiWorlWeb está em manutenção.
 * Quando ativado, bloqueia o acesso geral e permite que apenas o burocrata
 * autentique-se via Google e acerte as configurações do Wiki.
 */
export const maintenanceModeExtension: WikiExtension = {
  id: 'ext-maintenance-mode',
  name: 'WikiMaintenanceMode',
  namePt: 'Modo de Manutenção WikiWorlWeb',
  version: '2.0.0',
  category: 'infra',
  author: 'WazzimaGiygg Systems Architecture & SRE',
  description: 'Coloca o WikiWorlWeb em modo de manutenção restrito. Quando ativo, exibe tela de aviso e bloqueia a navegação de leitores e editores gerais; apenas burocratas autenticados via login Google podem acessar e modificar as configurações do Wiki.',
  enabled: true,
  type: 'extension',
  url: 'https://wazzimagiygg.com/maintenance',
  license: 'GPL-2.0-or-later',
  hooks: [
    {
      name: 'MediaWikiServices',
      handler: 'MaintenanceModeHooks::onMediaWikiServices',
      description: 'Intercepta requisições HTTP antes do carregamento da aplicação para validar modo de manutenção.',
    },
    {
      name: 'UserGetRights',
      handler: 'MaintenanceModeHooks::onUserGetRights',
      description: 'Valida se o usuário autenticado via Google possui perfil de burocrata para liberação de bypass.',
    },
  ],
  config: [
    {
      key: '$wgMaintenanceModeActive',
      type: 'boolean',
      value: false,
      defaultValue: false,
      description: 'Quando ativado (true), coloca todo o WikiWorlWeb em modo de manutenção e bloqueia o público.',
    },
    {
      key: '$wgMaintenanceTitle',
      type: 'string',
      value: 'WikiWorlWeb em Manutenção Programada',
      defaultValue: 'WikiWorlWeb em Manutenção Programada',
      description: 'Título exibido na tela de manutenção.',
    },
    {
      key: '$wgMaintenanceMessage',
      type: 'string',
      value: 'O WikiWorlWeb está passando por uma manutenção preventiva de infraestrutura, sincronização de banco de dados e aprimoramento de extensões. O acesso geral está suspenso temporariamente. Apenas burocratas autorizados podem acessar as configurações utilizando seu login por Google.',
      defaultValue: 'O WikiWorlWeb está passando por uma manutenção preventiva de infraestrutura, sincronização de banco de dados e aprimoramento de extensões. O acesso geral está suspenso temporariamente. Apenas burocratas autorizados podem acessar as configurações utilizando seu login por Google.',
      description: 'Mensagem explicativa exibida aos visitantes durante o período de manutenção.',
    },
    {
      key: '$wgMaintenanceEstimatedEnd',
      type: 'string',
      value: 'Previsão: Conclusão em breve',
      defaultValue: 'Previsão: Conclusão em breve',
      description: 'Estimativa de conclusão do trabalho de manutenção exibida ao público.',
    },
    {
      key: '$wgMaintenanceAllowBureaucratLogin',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Disponibiliza botão de Login Google na tela de manutenção para que burocratas façam login e acessem as configurações.',
    },
  ],
  manifestJson: {
    name: 'WikiMaintenanceMode',
    version: '2.0.0',
    type: 'infra',
    license_name: 'GPL-2.0-or-later',
    maintenance_bypass_role: 'bureaucrat',
  },
  lastUpdated: '2026-11-05',
};

/**
 * Obtém a configuração ativa do modo de manutenção
 */
export function getMaintenanceModeConfig(extensions?: WikiExtension[]): {
  extensionEnabled: boolean;
  isMaintenanceActive: boolean;
  title: string;
  message: string;
  estimatedEnd: string;
  allowBureaucratLogin: boolean;
} {
  let ext: WikiExtension | undefined = maintenanceModeExtension;

  if (extensions && extensions.length > 0) {
    const found = extensions.find(e => e.id === maintenanceModeExtension.id);
    if (found) ext = found;
  } else {
    try {
      const raw = localStorage.getItem('notmediawiki_extensions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const found = parsed.find((e: any) => e.id === maintenanceModeExtension.id);
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

  const isMaintenanceActive = isExtEnabled && Boolean(findConfig('$wgMaintenanceModeActive', false));
  const title = String(findConfig('$wgMaintenanceTitle', 'WikiWorlWeb em Manutenção Programada'));
  const message = String(findConfig('$wgMaintenanceMessage', 'O WikiWorlWeb está temporariamente em manutenção.'));
  const estimatedEnd = String(findConfig('$wgMaintenanceEstimatedEnd', 'Previsão: Conclusão em breve'));
  const allowBureaucratLogin = Boolean(findConfig('$wgMaintenanceAllowBureaucratLogin', true));

  return {
    extensionEnabled: isExtEnabled,
    isMaintenanceActive,
    title,
    message,
    estimatedEnd,
    allowBureaucratLogin,
  };
}
