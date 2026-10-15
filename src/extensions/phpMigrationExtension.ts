import { WikiExtension } from '../types';

/**
 * PARÂMETRO DE ATIVAÇÃO/DESATIVAÇÃO:
 * Altere a propriedade `enabled` abaixo para true ou false para habilitar ou desabilitar
 * a extensão e o recurso "PHP Migration" no NotMediaWiki.
 */
export const EXTENSION_PHP_MIGRATION_ENABLED = true;

export const phpMigrationExtension: WikiExtension = {
  id: 'ext-php-migration',
  name: 'PhpMigrationRosetta',
  namePt: 'PHP Migration',
  version: '2.8.0',
  category: 'infra',
  author: 'NotMediaWiki Modernization Architects & WMF Decoupling Working Group',
  description: 'Matriz comparativa arquitetural Pedra de Roseta e suíte de testes de paridade validando a migração do monolito PHP legado para microsserviços modernos Node.js.',
  enabled: EXTENSION_PHP_MIGRATION_ENABLED,
  type: 'extension',
  url: 'https://www.mediawiki.org/wiki/Microservices',
  license: 'GPL-2.0-or-later',
  hooks: [
    {
      name: 'MigrationParityVerify',
      handler: 'RosettaValidator::onParityVerify',
      description: 'Executa testes automatizados de paridade funcional entre rotas legadas e novas.',
    },
    {
      name: 'MigrationMatrixExport',
      handler: 'RosettaValidator::onMatrixExport',
      description: 'Gera matriz detalhada de migração com ganhos de latência e throughput.',
    },
  ],
  config: [
    {
      key: '$wgPhpMigrationEnabled',
      type: 'boolean',
      value: EXTENSION_PHP_MIGRATION_ENABLED,
      defaultValue: true,
      description: 'Habilita ou desabilita o explorador e verificador de paridade PHP Migration.',
    },
    {
      key: '$wgMigrationAutoParityTests',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Executa bateria de testes de paridade ao carregar a matriz.',
    },
  ],
  manifestJson: {
    name: 'PhpMigrationRosetta',
    version: '2.8.0',
    type: 'infra',
    license_name: 'GPL-2.0-or-later',
  },
  lastUpdated: '2026-04-10',
};
