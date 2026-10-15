import { WikiExtension } from '../types';

/**
 * 3.05.3.af - Adicionar extensão de Checklist diário para cada usuário realizar, para acumular pontos
 * 3.05.8.b - Inserir checklist baseado em pontos diários que o usuário pode receber, acumulados durante o mês:
 * 3.05.8.b.a - Fazer login no Wiki-Site (1 ponto)
 * 3.05.8.b.b - Fazer uma contribuição (0.20 pontos)
 * 3.05.8.b.c - Fazer avaliação de um artigo (1 ponto)
 *
 * PARÂMETRO DE ATIVAÇÃO/DESATIVAÇÃO:
 * Altere a propriedade `enabled` abaixo para true ou false para habilitar ou desabilitar
 * a extensão "DailyChecklist" no NotMediaWiki.
 */
export const EXTENSION_DAILY_CHECKLIST_ENABLED = true;

export const dailyChecklistExtension: WikiExtension = {
  id: 'ext-daily-checklist',
  name: 'DailyChecklist',
  namePt: 'Checklist Diário & Gamificação de Pontos Mensais (3.05.3.af / 3.05.8.b)',
  version: '1.0.0',
  category: 'engagement',
  author: 'NotMediaWiki Community & Gamification Core Team',
  description:
    '3.05.3.af - Extensão de Checklist diário para cada usuário realizar e acumular pontos mensais (3.05.8.b): 3.05.8.b.a Login (1 pt), 3.05.8.b.b Contribuição (0.20 pt) e 3.05.8.b.c Avaliação de Artigo (1 pt). Sincronizado em tempo real no Firebase Firestore.',
  enabled: EXTENSION_DAILY_CHECKLIST_ENABLED,
  type: 'extension',
  url: 'https://wazzimagiygg.com',
  license: 'GPL-2.0-or-later',
  hooks: [
    {
      name: 'UserLoginDailyChecklist',
      handler: 'DailyChecklistHooks::onUserLogin',
      description: '3.05.8.b.a: Concede 1 ponto diário quando o usuário realiza login no Wiki-Site.',
    },
    {
      name: 'ArticleContributionChecklist',
      handler: 'DailyChecklistHooks::onArticleSave',
      description: '3.05.8.b.b: Concede 0.20 ponto diário quando o usuário contribui ou edita artigos no Wiki.',
    },
    {
      name: 'ArticleRatingChecklist',
      handler: 'DailyChecklistHooks::onArticleRate',
      description: '3.05.8.b.c: Concede 1 ponto diário quando o usuário submete a avaliação de qualidade de um artigo.',
    },
    {
      name: 'MonthlyPointsLedgerAccumulator',
      handler: 'DailyChecklistHooks::onMonthlyPointsAccumulate',
      description: 'Acumula e consolida a pontuação dos checklists ao longo de cada mês com histórico contábil no Firestore.',
    },
  ],
  config: [
    {
      key: '$wgDailyChecklistEnabled',
      type: 'boolean',
      value: EXTENSION_DAILY_CHECKLIST_ENABLED,
      defaultValue: true,
      description: 'Habilita ou desabilita o checklist diário de missões e acúmulo de pontos mensais.',
    },
    {
      key: '$wgDailyChecklistLoginPoints',
      type: 'number',
      value: 1.0,
      defaultValue: 1.0,
      description: 'Pontos concedidos diariamente por fazer login no Wiki (3.05.8.b.a).',
    },
    {
      key: '$wgDailyChecklistContribPoints',
      type: 'number',
      value: 0.2,
      defaultValue: 0.2,
      description: 'Pontos concedidos diariamente por fazer uma contribuição (3.05.8.b.b).',
    },
    {
      key: '$wgDailyChecklistRatingPoints',
      type: 'number',
      value: 1.0,
      defaultValue: 1.0,
      description: 'Pontos concedidos diariamente por fazer avaliação de um artigo (3.05.8.b.c).',
    },
    {
      key: '$wgDailyChecklistMaxDailyPoints',
      type: 'number',
      value: 2.2,
      defaultValue: 2.2,
      description: 'Pontuação diária máxima obtenível ao completar todos os 3 itens do checklist.',
    },
  ],
  manifestJson: {
    name: 'DailyChecklist',
    version: '1.0.0',
    type: 'gamification',
    license_name: 'GPL-2.0-or-later',
    author: ['NotMediaWiki Gamification Team', 'WazzimaGiygg'],
    descriptionmsg: 'daily_checklist_desc',
  },
  lastUpdated: '2026-10-14',
};
