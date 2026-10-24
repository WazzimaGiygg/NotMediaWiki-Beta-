import { WikiExtension } from '../../types';

/**
 * 4.1.1.13W.2 - Árvore de configurações: BotManagerExtension
 * Gerenciamento mestre de ativação/desativação de bots e contas de automação.
 */
export const EXTENSION_BOT_MANAGER_ENABLED = true;

export const botManagerExtension: WikiExtension = {
  id: 'ext-bot-manager',
  name: 'BotManager',
  namePt: 'Gerenciador Central de Bots & Automação (4.1.1.13W.2)',
  version: '2.5.0',
  category: 'security',
  author: 'NotMediaWiki Automation & Bot Engineering Team',
  description:
    'Extensão principal de orquestração de robôs (4.1.1.13W.2): ativação, desativação e configurações de AntiVandalismBot, CitationCheckerBot, QualityBot, CategorizationBot, BrokenLinksBot e LgpdModerationBot.',
  enabled: EXTENSION_BOT_MANAGER_ENABLED,
  type: 'extension',
  url: 'https://wazzimagiygg.com',
  license: 'GPL-2.0-or-later',
  hooks: [
    {
      name: 'BotPipelineArticleSave',
      handler: 'BotManagerHooks::onArticleSave',
      description: 'Executa a esteira de análise em tempo real com os bots ativos ao salvar artigos.',
    },
    {
      name: 'BotUserSessionGatekeeper',
      handler: 'BotManagerHooks::onBotSessionValidate',
      description: 'Garante que contas de bot realizem edições sinalizadas e rastreadas no histórico.',
    },
    {
      name: 'UserAbuseAuditHook',
      handler: 'BotManagerHooks::onUserAbuseAudit',
      description: 'Auditoria contínua de comportamento e proteção contra esvaziamentos e abusos.',
    },
  ],
  config: [
    {
      key: '$wgBotManagerEnabled',
      type: 'boolean',
      value: EXTENSION_BOT_MANAGER_ENABLED,
      defaultValue: true,
      description: 'Habilita ou desabilita todo o ecossistema de robôs no Wiki-Site.',
    },
    {
      key: '$wgBotAntiVandalismActive',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Habilita a detecção e proteção contra vandalismo (4.1.1.11E.1).',
    },
    {
      key: '$wgBotCitationCheckerActive',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Habilita a checagem de fontes e citações via Gemini 3.8 Flash (4.1.1.WV.1).',
    },
    {
      key: '$wgBotQualityActive',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Habilita a avaliação estrutural de qualidade de artigos (4.1.1.IL.1).',
    },
    {
      key: '$wgBotCategorizationActive',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Habilita a taxonomia e categorização automática (4.1.1.G2.1).',
    },
    {
      key: '$wgBotBrokenLinksActive',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Habilita a verificação de links inativos e IPs inseguros (4.1.1.GW.1).',
    },
    {
      key: '$wgBotLgpdModerationActive',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Habilita a moderação de dados sensíveis e conformidade LGPD (4.1.1.E0.1).',
    },
  ],
  manifestJson: {
    name: 'BotManager',
    version: '2.5.0',
    type: 'bot_orchestrator',
    license_name: 'GPL-2.0-or-later',
    author: ['NotMediaWiki Bot Core Team', 'WazzimaGiygg'],
    descriptionmsg: 'bot_manager_desc',
  },
  lastUpdated: '2026-10-24',
};
