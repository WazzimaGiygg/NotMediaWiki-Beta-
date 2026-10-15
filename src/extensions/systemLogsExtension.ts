import { WikiExtension } from '../types';

/**
 * PARÂMETRO DE ATIVAÇÃO/DESATIVAÇÃO:
 * Altere a propriedade `enabled` abaixo para true ou false para habilitar ou desabilitar
 * a extensão e o recurso "Logs de Microsserviços" no NotMediaWiki.
 */
export const EXTENSION_SYSTEM_LOGS_ENABLED = true;

export const systemLogsExtension: WikiExtension = {
  id: 'ext-system-logs',
  name: 'MicroserviceLogs',
  namePt: 'Logs de Microsserviços',
  version: '2.5.0',
  category: 'infra',
  author: 'NotMediaWiki Telemetry & DevOps Team',
  description: 'Auditoria e monitoramento de logs em tempo real para os microsserviços Node.js/Go, capturando níveis DEBUG, INFO, WARN, ERROR e FATAL com distributed tracing.',
  enabled: EXTENSION_SYSTEM_LOGS_ENABLED,
  type: 'service',
  url: 'https://www.mediawiki.org/wiki/Manual:Structured_logging',
  license: 'Apache-2.0',
  hooks: [
    {
      name: 'SystemLogEmit',
      handler: 'MicroserviceLogger::onLogEmit',
      description: 'Intercepta e persiste emissão de logs em tempo real no buffer do sistema e no Firestore.',
    },
    {
      name: 'SystemLogFilter',
      handler: 'MicroserviceLogger::onLogFilter',
      description: 'Filtra logs de microsserviços por severidade, serviço e traceId.',
    },
  ],
  config: [
    {
      key: '$wgSystemLogsEnabled',
      type: 'boolean',
      value: EXTENSION_SYSTEM_LOGS_ENABLED,
      defaultValue: true,
      description: 'Habilita ou desabilita o painel e streaming de Logs de Microsserviços.',
    },
    {
      key: '$wgSystemLogsRetentionDays',
      type: 'number',
      value: 30,
      defaultValue: 30,
      description: 'Dias de retenção para logs estruturados na nuvem.',
    },
  ],
  manifestJson: {
    name: 'MicroserviceLogs',
    version: '2.5.0',
    type: 'infra',
    license_name: 'Apache-2.0',
  },
  lastUpdated: '2026-04-10',
};
