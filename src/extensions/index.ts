import { systemLogsExtension, EXTENSION_SYSTEM_LOGS_ENABLED } from './systemLogsExtension';
import { serviceMeshExtension, EXTENSION_SERVICE_MESH_ENABLED } from './serviceMeshExtension';
import { eventStreamsExtension, EXTENSION_EVENT_STREAMS_ENABLED } from './eventStreamsExtension';
import { phpMigrationExtension, EXTENSION_PHP_MIGRATION_ENABLED } from './phpMigrationExtension';
import { apiWorkbenchExtension, EXTENSION_API_WORKBENCH_ENABLED } from './apiWorkbenchExtension';
import { dailyChecklistExtension, EXTENSION_DAILY_CHECKLIST_ENABLED } from './dailyChecklistExtension';
import { botAgentExtension, EXTENSION_BOT_AGENT_ENABLED } from './botAgentExtension';
import { botManagerExtension, EXTENSION_BOT_MANAGER_ENABLED } from './bots/BotManagerExtension';
import { supportTicketsExtension, getSupportTicketsConfig } from './supportTicketsExtension';
import { externalRedirectExtension, getExternalRedirectConfig } from './externalRedirectExtension';
import { maintenanceModeExtension, getMaintenanceModeConfig } from './maintenanceModeExtension';
import {
  wikiLivrosExtension,
  wikiUniversitarioExtension,
  jornalWazzimaGiyggExtension,
  PORTAL_EXTENSIONS,
  getPortalsConfig,
} from './portalsExtension';

export {
  systemLogsExtension,
  EXTENSION_SYSTEM_LOGS_ENABLED,
  serviceMeshExtension,
  EXTENSION_SERVICE_MESH_ENABLED,
  eventStreamsExtension,
  EXTENSION_EVENT_STREAMS_ENABLED,
  phpMigrationExtension,
  EXTENSION_PHP_MIGRATION_ENABLED,
  apiWorkbenchExtension,
  EXTENSION_API_WORKBENCH_ENABLED,
  dailyChecklistExtension,
  EXTENSION_DAILY_CHECKLIST_ENABLED,
  botAgentExtension,
  EXTENSION_BOT_AGENT_ENABLED,
  botManagerExtension,
  EXTENSION_BOT_MANAGER_ENABLED,
  supportTicketsExtension,
  getSupportTicketsConfig,
  externalRedirectExtension,
  getExternalRedirectConfig,
  maintenanceModeExtension,
  getMaintenanceModeConfig,
  wikiLivrosExtension,
  wikiUniversitarioExtension,
  jornalWazzimaGiyggExtension,
  PORTAL_EXTENSIONS,
  getPortalsConfig,
};

export const MANAGED_FEATURE_EXTENSIONS = [
  systemLogsExtension,
  serviceMeshExtension,
  eventStreamsExtension,
  phpMigrationExtension,
  apiWorkbenchExtension,
  dailyChecklistExtension,
  botAgentExtension,
  botManagerExtension,
  supportTicketsExtension,
  externalRedirectExtension,
  maintenanceModeExtension,
  wikiLivrosExtension,
  wikiUniversitarioExtension,
  jornalWazzimaGiyggExtension,
];

/**
 * Retorna se um recurso específico está habilitado, verificando
 * prioritariamente as extensões ativas (seja no arquivo ou no estado persistido).
 */
export function isFeatureExtensionEnabled(
  featureId: 'logs' | 'mesh' | 'events' | 'migration' | 'workbench' | 'checklist' | 'bots' | 'support' | 'redirect' | 'maintenance' | 'livros' | 'universitario' | 'jornal',
  runtimeExtensions?: { id: string; enabled: boolean }[]
): boolean {
  const idMap: Record<string, { fileEnabled: boolean; extId: string }> = {
    logs: { fileEnabled: EXTENSION_SYSTEM_LOGS_ENABLED, extId: systemLogsExtension.id },
    mesh: { fileEnabled: EXTENSION_SERVICE_MESH_ENABLED, extId: serviceMeshExtension.id },
    events: { fileEnabled: EXTENSION_EVENT_STREAMS_ENABLED, extId: eventStreamsExtension.id },
    migration: { fileEnabled: EXTENSION_PHP_MIGRATION_ENABLED, extId: phpMigrationExtension.id },
    workbench: { fileEnabled: EXTENSION_API_WORKBENCH_ENABLED, extId: apiWorkbenchExtension.id },
    checklist: { fileEnabled: EXTENSION_DAILY_CHECKLIST_ENABLED, extId: dailyChecklistExtension.id },
    bots: { fileEnabled: EXTENSION_BOT_MANAGER_ENABLED && EXTENSION_BOT_AGENT_ENABLED, extId: botManagerExtension.id },
    support: { fileEnabled: true, extId: supportTicketsExtension.id },
    redirect: { fileEnabled: true, extId: externalRedirectExtension.id },
    maintenance: { fileEnabled: true, extId: maintenanceModeExtension.id },
    livros: { fileEnabled: true, extId: wikiLivrosExtension.id },
    universitario: { fileEnabled: true, extId: wikiUniversitarioExtension.id },
    jornal: { fileEnabled: true, extId: jornalWazzimaGiyggExtension.id },
  };

  const meta = idMap[featureId];
  if (!meta) return true;

  if (!meta.fileEnabled) return false;

  if (runtimeExtensions && runtimeExtensions.length > 0) {
    const found = runtimeExtensions.find(e => e.id === meta.extId || (featureId === 'bots' && e.id === botAgentExtension.id));
    if (found !== undefined) {
      return Boolean(found.enabled);
    }
  }

  return meta.fileEnabled;
}
