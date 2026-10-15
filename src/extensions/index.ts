import { systemLogsExtension, EXTENSION_SYSTEM_LOGS_ENABLED } from './systemLogsExtension';
import { serviceMeshExtension, EXTENSION_SERVICE_MESH_ENABLED } from './serviceMeshExtension';
import { eventStreamsExtension, EXTENSION_EVENT_STREAMS_ENABLED } from './eventStreamsExtension';
import { phpMigrationExtension, EXTENSION_PHP_MIGRATION_ENABLED } from './phpMigrationExtension';
import { apiWorkbenchExtension, EXTENSION_API_WORKBENCH_ENABLED } from './apiWorkbenchExtension';
import { dailyChecklistExtension, EXTENSION_DAILY_CHECKLIST_ENABLED } from './dailyChecklistExtension';

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
};

export const MANAGED_FEATURE_EXTENSIONS = [
  systemLogsExtension,
  serviceMeshExtension,
  eventStreamsExtension,
  phpMigrationExtension,
  apiWorkbenchExtension,
  dailyChecklistExtension,
];

/**
 * Retorna se um recurso específico está habilitado, verificando
 * prioritariamente as extensões ativas (seja no arquivo ou no estado persistido).
 */
export function isFeatureExtensionEnabled(
  featureId: 'logs' | 'mesh' | 'events' | 'migration' | 'workbench' | 'checklist',
  runtimeExtensions?: { id: string; enabled: boolean }[]
): boolean {
  const idMap: Record<string, { fileEnabled: boolean; extId: string }> = {
    logs: { fileEnabled: EXTENSION_SYSTEM_LOGS_ENABLED, extId: systemLogsExtension.id },
    mesh: { fileEnabled: EXTENSION_SERVICE_MESH_ENABLED, extId: serviceMeshExtension.id },
    events: { fileEnabled: EXTENSION_EVENT_STREAMS_ENABLED, extId: eventStreamsExtension.id },
    migration: { fileEnabled: EXTENSION_PHP_MIGRATION_ENABLED, extId: phpMigrationExtension.id },
    workbench: { fileEnabled: EXTENSION_API_WORKBENCH_ENABLED, extId: apiWorkbenchExtension.id },
    checklist: { fileEnabled: EXTENSION_DAILY_CHECKLIST_ENABLED, extId: dailyChecklistExtension.id },
  };

  const meta = idMap[featureId];
  if (!meta) return true;

  // Se o próprio arquivo da extensão desabilitou o recurso (false), respeitamos diretamente
  if (!meta.fileEnabled) return false;

  // Se há extensões em tempo de execução fornecidas (do localStorage ou Firestore), respeitamos também seu toggle
  if (runtimeExtensions && runtimeExtensions.length > 0) {
    const found = runtimeExtensions.find(e => e.id === meta.extId);
    if (found !== undefined) {
      return Boolean(found.enabled);
    }
  }

  return meta.fileEnabled;
}

