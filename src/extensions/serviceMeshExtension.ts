import { WikiExtension } from '../types';

/**
 * PARÂMETRO DE ATIVAÇÃO/DESATIVAÇÃO:
 * Altere a propriedade `enabled` abaixo para true ou false para habilitar ou desabilitar
 * a extensão e o recurso "Service Mesh & Telemetria" no NotMediaWiki.
 */
export const EXTENSION_SERVICE_MESH_ENABLED = true;

export const serviceMeshExtension: WikiExtension = {
  id: 'ext-service-mesh',
  name: 'ServiceMeshTelemetry',
  namePt: 'Service Mesh & Telemetria',
  version: '3.0.0',
  category: 'infra',
  author: 'NotMediaWiki Platform Engineering & Istio/Envoy Integration Team',
  description: 'Topologia de microsserviços distribuídos, monitoramento de latência p50/p95/p99, circuit breakers automáticos (CLOSED/OPEN/HALF_OPEN) e simulação de tráfego resiliente.',
  enabled: EXTENSION_SERVICE_MESH_ENABLED,
  type: 'service',
  url: 'https://www.mediawiki.org/wiki/Service_mesh',
  license: 'Apache-2.0',
  hooks: [
    {
      name: 'ServiceMeshHealthCheck',
      handler: 'MeshObserver::onHealthCheck',
      description: 'Sonda nós da malha de microsserviços e reporta métricas agregadas RPS.',
    },
    {
      name: 'CircuitBreakerTrip',
      handler: 'MeshObserver::onCircuitBreakerTrip',
      description: 'Aciona isolamento de falha em microsserviço com taxa de erro elevada.',
    },
  ],
  config: [
    {
      key: '$wgServiceMeshEnabled',
      type: 'boolean',
      value: EXTENSION_SERVICE_MESH_ENABLED,
      defaultValue: true,
      description: 'Habilita ou desabilita o console de Service Mesh & Telemetria.',
    },
    {
      key: '$wgMeshCircuitBreakerThreshold',
      type: 'number',
      value: 0.15,
      defaultValue: 0.15,
      description: 'Taxa máxima de erro tolerada antes de abrir o disjuntor do serviço.',
    },
  ],
  manifestJson: {
    name: 'ServiceMeshTelemetry',
    version: '3.0.0',
    type: 'infra',
    license_name: 'Apache-2.0',
  },
  lastUpdated: '2026-04-10',
};
