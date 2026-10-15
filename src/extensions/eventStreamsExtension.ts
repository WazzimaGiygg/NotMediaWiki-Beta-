import { WikiExtension } from '../types';

/**
 * PARÂMETRO DE ATIVAÇÃO/DESATIVAÇÃO:
 * Altere a propriedade `enabled` abaixo para true ou false para habilitar ou desabilitar
 * a extensão e o recurso "EventStreams" no NotMediaWiki.
 */
export const EXTENSION_EVENT_STREAMS_ENABLED = true;

export const eventStreamsExtension: WikiExtension = {
  id: 'ext-eventstream',
  name: 'EventStreams',
  namePt: 'EventStreams',
  version: '3.1.0',
  category: 'infra',
  author: 'Petr Pchelko, Eric Evans, Wikimedia Infrastructure & EventGate Team',
  description: 'Barramento de eventos em tempo real transmitindo registros de revisões de artigos, criações, reversões e telemetria via Server-Sent Events (SSE), Kafka e Firestore.',
  enabled: EXTENSION_EVENT_STREAMS_ENABLED,
  type: 'service',
  url: 'https://www.mediawiki.org/wiki/EventStreams',
  license: 'Apache-2.0',
  hooks: [
    {
      name: 'PageSaveComplete',
      handler: 'EventStreamHooks::onPageSaveComplete',
      description: 'Dispara evento no tópico mediawiki.recentchange com metadados da revisão.',
    },
    {
      name: 'ArticleRollbackComplete',
      handler: 'EventStreamHooks::onArticleRollback',
      description: 'Emite notificação de auditoria quando uma revisão é revertida.',
    },
  ],
  config: [
    {
      key: '$wgEventStreamsEnabled',
      type: 'boolean',
      value: EXTENSION_EVENT_STREAMS_ENABLED,
      defaultValue: true,
      description: 'Habilita ou desabilita o barramento de eventos em tempo real EventStreams.',
    },
    {
      key: '$wgEventStreamBufferSize',
      type: 'number',
      value: 100,
      defaultValue: 50,
      description: 'Quantidade de eventos mantidos em buffer na memória do stream.',
    },
  ],
  manifestJson: {
    name: 'EventStreams',
    version: '3.1.0',
    type: 'infra',
    license_name: 'Apache-2.0',
  },
  lastUpdated: '2026-04-10',
};
