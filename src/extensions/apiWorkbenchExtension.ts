import { WikiExtension } from '../types';

/**
 * PARÂMETRO DE ATIVAÇÃO/DESATIVAÇÃO:
 * Altere a propriedade `enabled` abaixo para true ou false para habilitar ou desabilitar
 * a extensão e o recurso "API Workbench" no NotMediaWiki.
 */
export const EXTENSION_API_WORKBENCH_ENABLED = true;

export const apiWorkbenchExtension: WikiExtension = {
  id: 'ext-api-workbench',
  name: 'ApiWorkbench',
  namePt: 'API Workbench',
  version: '2.4.0',
  category: 'infra',
  author: 'NotMediaWiki API Development & OpenAPI Console Team',
  description: 'Bancada interativa de testes de chamadas REST/HTTP para inspecionar endpoints dos microsserviços (Parsoid parse/tokenize, CirrusSearch, Diff, Telemetria).',
  enabled: EXTENSION_API_WORKBENCH_ENABLED,
  type: 'service',
  url: 'https://www.mediawiki.org/wiki/API:Main_page',
  license: 'MIT',
  hooks: [
    {
      name: 'ApiEndpointDispatch',
      handler: 'ApiWorkbenchDispatcher::onDispatch',
      description: 'Executa requisições de teste nos endpoints da malha de microsserviços.',
    },
    {
      name: 'ApiPresetRegister',
      handler: 'ApiWorkbenchDispatcher::onPresetRegister',
      description: 'Registra novos templates de endpoints REST para simulação interativa.',
    },
  ],
  config: [
    {
      key: '$wgApiWorkbenchEnabled',
      type: 'boolean',
      value: EXTENSION_API_WORKBENCH_ENABLED,
      defaultValue: true,
      description: 'Habilita ou desabilita a bancada de testes interativa API Workbench.',
    },
    {
      key: '$wgApiWorkbenchTimeoutMs',
      type: 'number',
      value: 5000,
      defaultValue: 5000,
      description: 'Tempo limite em milissegundos para requisições de teste na bancada.',
    },
  ],
  manifestJson: {
    name: 'ApiWorkbench',
    version: '2.4.0',
    type: 'infra',
    license_name: 'MIT',
  },
  lastUpdated: '2026-04-10',
};
