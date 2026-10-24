import { WikiExtension } from '../types';

/**
 * 4.1.1.8T.1 - Agente de BOTS dentro do Wiki-Site
 * 4.1.1.PN.1 - Extensão para ativar/desativar bots e gerenciar bot users
 * 4.1.1.1JE.1 - Serviço front-end para varreduras de bots com condições de busca
 * 4.1.1.1IT.1 - Ferramenta de verificação nas últimas 2 horas no login (Descontinuado)
 * 4.1.1.18C.1 - Ferramenta auto carregada por padrão para verificação automática de abuso em contribuições
 * 4.1.1.WV.1 - Bot de verificação de citações com IA Gemini
 * 4.1.1.11E.1 - Bot anti-vandalismo com detecção de perda massiva e reversão
 * 4.1.1.G2.1 - Bot de categorização automática
 * 4.1.1.IL.1 - Bot de qualidade estrutural de artigos
 * 4.1.1.GW.1 - Bot de verificação de links externos quebrados
 * 4.1.1.E0.1 - Bot de LGPD e moderação de conteúdo sensível
 *
 * PARÂMETRO MASTER DE ATIVAÇÃO:
 * Altere EXTENSION_BOT_AGENT_ENABLED para false se desejar desativar o subsistema de bots.
 */
export const EXTENSION_BOT_AGENT_ENABLED = true;

export const botAgentExtension: WikiExtension = {
  id: 'ext-bot-agent',
  name: 'BotAgent',
  namePt: 'Agente de BOTS & Automação Inteligente (4.1.1.8T.1)',
  version: '2.0.0',
  category: 'security',
  author: 'NotMediaWiki Automation & Bot Engineering Team',
  description:
    'Subsistema central de agentes bots (4.1.1.8T.1) com gerenciamento de contas de bots (4.1.1.PN.1), varreduras avançadas (4.1.1.1JE.1), auditoria contínua de abuso de usuários (4.1.1.18C.1), verificação de citações via Gemini (4.1.1.WV.1), anti-vandalismo com reversão automática (4.1.1.11E.1), categorização (4.1.1.G2.1), qualidade (4.1.1.IL.1), checagem de links (4.1.1.GW.1) e conformidade com LGPD (4.1.1.E0.1).',
  enabled: EXTENSION_BOT_AGENT_ENABLED,
  type: 'extension',
  url: 'https://wazzimagiygg.com',
  license: 'GPL-2.0-or-later',
  hooks: [
    {
      name: 'ArticleSaveBotPipeline',
      handler: 'BotAgentHooks::onArticleSave',
      description: 'Executa a esteira de análise dos bots (AntiVandal, Citações, Qualidade, LGPD, Categorias) ao salvar artigos.',
    },
    {
      name: 'UserContributionAuditHook',
      handler: 'BotAgentHooks::onUserContribution',
      description: '4.1.1.18C.1: Audita em tempo real o histórico do usuário buscando abusos, edições em rajada e esvaziamentos.',
    },
    {
      name: 'CitationGeminiVerification',
      handler: 'BotAgentHooks::verifyCitationsWithGemini',
      description: '4.1.1.WV.1: Avalia afirmações sem fontes no wikitext com Gemini 3.8 Flash e sugere tags de citação.',
    },
    {
      name: 'AntiVandalismGuard',
      handler: 'BotAgentHooks::guardVandalismAndRevert',
      description: '4.1.1.11E.1: Detecta esvaziamento massivo (>35% de perda) ou ofensas, aplicando reversão imediata ou alertando admins.',
    },
    {
      name: 'LgpdPrivacyInspector',
      handler: 'BotAgentHooks::inspectLgpdAndPii',
      description: '4.1.1.E0.1: Detecta vazamento de CPF, telefones, RG e dados pessoais sensíveis, solicitando ofuscação.',
    },
    {
      name: 'BrokenLinkInspector',
      handler: 'BotAgentHooks::verifyExternalLinks',
      description: '4.1.1.GW.1: Identifica URLs inativas, protocolos inseguros e hosts mortos nos artigos.',
    },
    {
      name: 'QualityScoreEvaluator',
      handler: 'BotAgentHooks::evaluateArticleQuality',
      description: '4.1.1.IL.1: Verifica introdução, estrutura de seções, referências e imagens para classificar o artigo.',
    },
  ],
  config: [
    {
      key: '$wgBotAgentEnabled',
      type: 'boolean',
      value: EXTENSION_BOT_AGENT_ENABLED,
      defaultValue: true,
      description: 'Master switch para habilitar ou desabilitar o subsistema de Agente de Bots (4.1.1.8T.1).',
    },
    {
      key: '$wgBotCitationGeminiEnabled',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: '4.1.1.WV.1: Habilita análise de citações ausentes e suspeitas usando IA Gemini.',
    },
    {
      key: '$wgBotAntiVandalismEnabled',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: '4.1.1.11E.1: Habilita detecção de vandalismo, remoção massiva de conteúdo e palavras suspeitas.',
    },
    {
      key: '$wgBotAntiVandalAutoRevert',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: '4.1.1.11E.1: Permite ao AntiVandalBot reverter automaticamente edições categorizadas como vandalismo crítico.',
    },
    {
      key: '$wgBotAntiVandalByteLossPercent',
      type: 'number',
      value: 35,
      defaultValue: 35,
      description: 'Percentual de redução de tamanho de bytes para disparar alarme de remoção massiva de conteúdo.',
    },
    {
      key: '$wgBotCategorizationEnabled',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: '4.1.1.G2.1: Habilita sugestão e aplicação automática de categorias nos artigos.',
    },
    {
      key: '$wgBotQualityCheckEnabled',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: '4.1.1.IL.1: Habilita validação de introdução, seções mínimas, imagens e referências.',
    },
    {
      key: '$wgBotBrokenLinksEnabled',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: '4.1.1.GW.1: Habilita inspeção periódica de links externos.',
    },
    {
      key: '$wgBotLgpdModerationEnabled',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: '4.1.1.E0.1: Habilita análise de dados sensíveis (LGPD), CPF, telefones e privacidade.',
    },
    {
      key: '$wgBotUserAuditAutoLoad',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: '4.1.1.18C.1: Ferramenta de bot auto-carregada por padrão para checar abusos de contribuições.',
    },
    {
      key: '$wgBotLoginRecentChangesScanEnabled',
      type: 'boolean',
      value: false,
      defaultValue: false,
      description: '4.1.1.1IT.1: (Descontinuado) Varredura nas últimas 2 horas ativada no momento do login de qualquer usuário.',
    },
  ],
  manifestJson: {
    name: 'BotAgent',
    version: '2.0.0',
    type: 'bot_agent_system',
    license_name: 'GPL-2.0-or-later',
    author: ['NotMediaWiki Bot Core Team', 'WazzimaGiygg'],
    descriptionmsg: 'bot_agent_desc',
  },
  lastUpdated: '2026-10-24',
};
