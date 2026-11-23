import { WikiExtension } from '../types';

export const templatesExtension: WikiExtension = {
  id: 'ext-templates',
  name: 'MediaWikiTemplates',
  namePt: 'Predefinições & Transclusão (Templates)',
  version: '2.3.0',
  category: 'parser',
  author: 'NotMediaWiki Parser Team',
  description:
    'Motor de pré-definições MediaWiki ({{Aviso}}, {{Esboço}}, {{Navbox}}, {{Infocaixa}}) e transclusão dinâmica do Namespace 10 (Predefinição:) com parâmetros nomeados, posicionais e valores padrão.',
  enabled: true,
  type: 'extension',
  url: 'https://www.mediawiki.org/wiki/Help:Templates',
  license: 'GPL-2.0-or-later',
  hooks: [
    {
      name: 'ParserBeforeInternalParse',
      handler: 'TemplateEngineHooks::onExpandTemplates',
      description: 'Expande chamadas {{Nome|parâmetro}} antes da geração do AST no Parsoid.',
    },
  ],
  config: [
    {
      key: '$wgMaxTemplateDepth',
      type: 'number',
      value: 20,
      defaultValue: 20,
      description: 'Profundidade máxima permitida de transclusão recursiva de pré-definições.',
    },
  ],
  manifestJson: {
    name: 'MediaWikiTemplates',
    version: '2.3.0',
    type: 'parserhook',
    license_name: 'GPL-2.0-or-later',
  },
  lastUpdated: '2026-04-12',
};

export const infoboxExtension: WikiExtension = {
  id: 'ext-infobox',
  name: 'InfoboxBuilder',
  namePt: 'Infobox Software & Cartões Estruturados',
  version: '1.7.0',
  category: 'parser',
  author: 'NotMediaWiki UI & Parser Guild',
  description:
    'Analisador de cartões laterais {{Infobox ...}} e assistente visual no editor para criação rápida de fichas técnicas de software, projetos e entidades enciclopédicas.',
  enabled: true,
  type: 'extension',
  url: 'https://www.mediawiki.org/wiki/Extension:PortableInfobox',
  license: 'MIT',
  hooks: [
    {
      name: 'ParserBeforeTidy',
      handler: 'InfoboxHooks::onRenderInfobox',
      description: 'Converte blocos {{Infobox ...}} em cartões laterais responsivos.',
    },
  ],
  config: [
    {
      key: '$wgInfoboxHideEmptyRows',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Oculta automaticamente linhas de parâmetros sem valor preenchido.',
    },
  ],
  manifestJson: {
    name: 'InfoboxBuilder',
    version: '1.7.0',
    type: 'parserhook',
    license_name: 'MIT',
  },
  lastUpdated: '2026-04-10',
};

export const focusReadingModeExtension: WikiExtension = {
  id: 'ext-focus-mode',
  name: 'FocusReadingMode',
  namePt: 'Modo Foco, Modo Zen & Barra de Progresso',
  version: '1.5.0',
  category: 'ui',
  author: 'NotMediaWiki UX Team',
  description:
    'Oferece modos de leitura sem distrações (Modo Foco, Modo Zen e Modo de Leitura com controle tipográfico) além do indicador de progresso de leitura no cabeçalho.',
  enabled: true,
  type: 'extension',
  url: 'https://wazzimagiygg.com',
  license: 'MIT',
  hooks: [
    {
      name: 'BeforePageDisplay',
      handler: 'FocusModeHooks::onBeforePageDisplay',
      description: 'Habilita controles de leitura imersiva e barra de progresso.',
    },
  ],
  config: [
    {
      key: '$wgFocusModeShowProgress',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Exibe barra de progresso de leitura fixa na base do cabeçalho.',
    },
  ],
  manifestJson: {
    name: 'FocusReadingMode',
    version: '1.5.0',
    type: 'ui',
    license_name: 'MIT',
  },
  lastUpdated: '2026-04-10',
};

export const pdfPrintExportExtension: WikiExtension = {
  id: 'ext-pdf-export',
  name: 'PdfPrintExport',
  namePt: 'Exportação PDF & Relatórios Institucionais',
  version: '1.4.0',
  category: 'media',
  author: 'NotMediaWiki Publishing Team',
  description:
    'Gera relatórios oficiais em PDF, exportação direta em PDF e visualização otimizada para impressão (@media print) nos artigos e painel de extensões.',
  enabled: true,
  type: 'extension',
  url: 'https://www.mediawiki.org/wiki/Extension:ElectronPdfService',
  license: 'GPL-2.0-or-later',
  hooks: [
    {
      name: 'SkinTemplateToolboxEnd',
      handler: 'PdfExportHooks::onToolboxActions',
      description: 'Adiciona ações de Relatório PDF, Impressão e Download PDF nos artigos.',
    },
  ],
  config: [
    {
      key: '$wgPdfIncludeMetadataHeader',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Inclui cabeçalho institucional e carimbo de revisão nos PDFs gerados.',
    },
  ],
  manifestJson: {
    name: 'PdfPrintExport',
    version: '1.4.0',
    type: 'media',
    license_name: 'GPL-2.0-or-later',
  },
  lastUpdated: '2026-04-08',
};

export const articleFeedbackKarmaExtension: WikiExtension = {
  id: 'ext-article-feedback',
  name: 'ArticleRatingAndKarma',
  namePt: 'Avaliação de Artigos & Reputação (Karma)',
  version: '1.6.0',
  category: 'engagement',
  author: 'NotMediaWiki Community Squad',
  description:
    'Sistema de votos úteis, avaliação comunitária em artigos e pontuação de reputação (Karma) exibida no cabeçalho e nos créditos de autoria.',
  enabled: true,
  type: 'extension',
  url: 'https://www.mediawiki.org/wiki/Extension:ArticleFeedbackv5',
  license: 'MIT',
  hooks: [
    {
      name: 'SkinAfterContent',
      handler: 'FeedbackKarmaHooks::onAfterContent',
      description: 'Renderiza o widget de votos positivos/feedback abaixo dos artigos.',
    },
  ],
  config: [
    {
      key: '$wgShowUserKarmaInHeader',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Exibe o contador de Karma do usuário autenticado no cabeçalho.',
    },
  ],
  manifestJson: {
    name: 'ArticleRatingAndKarma',
    version: '1.6.0',
    type: 'engagement',
    license_name: 'MIT',
  },
  lastUpdated: '2026-04-08',
};

export const draftAutosaveRealtimeExtension: WikiExtension = {
  id: 'ext-draft-autosave',
  name: 'DraftAutoSaveRealtime',
  namePt: 'Rascunho Automático & Sincronização Ao Vivo',
  version: '1.5.0',
  category: 'infra',
  author: 'NotMediaWiki Persistence Team',
  description:
    'Salva rascunhos automaticamente no Cloud Firestore/navegador durante a edição de artigos e exibe notificações em tempo real quando colaboradores atualizam o verbete aberto.',
  enabled: true,
  type: 'service',
  url: 'https://wazzimagiygg.com',
  license: 'MIT',
  hooks: [
    {
      name: 'EditPageBeforeEditButtons',
      handler: 'DraftAutosaveHooks::onAutoSave',
      description: 'Dispara salvamento automático periódico e recuperação de rascunhos.',
    },
  ],
  config: [
    {
      key: '$wgDraftAutoSaveInactivityMs',
      type: 'number',
      value: 2500,
      defaultValue: 2500,
      description: 'Intervalo de inatividade (ms) para gravar rascunho automático.',
    },
  ],
  manifestJson: {
    name: 'DraftAutoSaveRealtime',
    version: '1.5.0',
    type: 'service',
    license_name: 'MIT',
  },
  lastUpdated: '2026-04-09',
};

export const communityChatExtension: WikiExtension = {
  id: 'ext-community-chat',
  name: 'CommunityChat',
  namePt: 'Chat Comunitário em Tempo Real',
  version: '1.3.0',
  category: 'engagement',
  author: 'NotMediaWiki Realtime Team',
  description:
    'Gaveta lateral de mensagens instantâneas e salas diretas entre editores, leitores e burocratas sincronizadas via Cloud Firestore.',
  enabled: true,
  type: 'extension',
  url: 'https://wazzimagiygg.com',
  license: 'MIT',
  hooks: [
    {
      name: 'BeforePageDisplay',
      handler: 'CommunityChatHooks::onRenderDrawer',
      description: 'Injeta o botão flutuante e a gaveta global de chat em tempo real.',
    },
  ],
  config: [
    {
      key: '$wgCommunityChatFloatingButton',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Exibe botão flutuante de acesso rápido ao chat no canto inferior direito.',
    },
  ],
  manifestJson: {
    name: 'CommunityChat',
    version: '1.3.0',
    type: 'engagement',
    license_name: 'MIT',
  },
  lastUpdated: '2026-04-05',
};

export const userDirectoryProfilesExtension: WikiExtension = {
  id: 'ext-user-directory',
  name: 'UserDirectoryProfiles',
  namePt: 'Diretório de Usuários & Páginas Pessoais',
  version: '1.4.0',
  category: 'engagement',
  author: 'NotMediaWiki Community Team',
  description:
    'Diretório público de colaboradores (#/usuarios) e páginas pessoais customizáveis no namespace Usuário: com histórico de edições e reputação.',
  enabled: true,
  type: 'extension',
  url: 'https://www.mediawiki.org/wiki/Help:User_page',
  license: 'MIT',
  hooks: [
    {
      name: 'PersonalUrls',
      handler: 'UserProfileHooks::onPersonalUrls',
      description: 'Registra atalhos para Minha Página Pessoal e Diretório de Usuários.',
    },
  ],
  config: [
    {
      key: '$wgEnablePublicUserDirectory',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Permite listar perfis públicos de colaboradores na rota #/usuarios.',
    },
  ],
  manifestJson: {
    name: 'UserDirectoryProfiles',
    version: '1.4.0',
    type: 'engagement',
    license_name: 'MIT',
  },
  lastUpdated: '2026-04-05',
};

export const talkPagesExtension: WikiExtension = {
  id: 'ext-talk-pages',
  name: 'TalkPages',
  namePt: 'Páginas de Discussão (Talk Namespace)',
  version: '1.2.0',
  category: 'engagement',
  author: 'NotMediaWiki Editorial Team',
  description:
    'Habilita a aba Discussão (Talk:) nos artigos para debates editoriais, solicitações de consenso e recados entre colaboradores.',
  enabled: true,
  type: 'extension',
  url: 'https://www.mediawiki.org/wiki/Help:Talk_pages',
  license: 'GPL-2.0-or-later',
  hooks: [
    {
      name: 'SkinTemplateNavigation',
      handler: 'TalkPagesHooks::onNavigationTabs',
      description: 'Renderiza a aba Discussão ao lado da aba principal do artigo.',
    },
  ],
  config: [
    {
      key: '$wgEnableArticleTalkTabs',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Exibe a aba Discussão nos artigos do leitor.',
    },
  ],
  manifestJson: {
    name: 'TalkPages',
    version: '1.2.0',
    type: 'engagement',
    license_name: 'GPL-2.0-or-later',
  },
  lastUpdated: '2026-04-04',
};

export const watchlistSubscriptionsExtension: WikiExtension = {
  id: 'ext-watchlist',
  name: 'WatchlistSubscriptions',
  namePt: 'Páginas Vigiadas (Special:Watchlist)',
  version: '1.5.0',
  category: 'engagement',
  author: 'NotMediaWiki Core Team',
  description:
    'Permite que usuários sigam artigos com o botão Vigiar e gerenciem sua lista de páginas monitoradas em Especial:PáginasVigiadas.',
  enabled: true,
  type: 'extension',
  url: 'https://www.mediawiki.org/wiki/Help:Watchlist',
  license: 'GPL-2.0-or-later',
  hooks: [
    {
      name: 'WatchArticleComplete',
      handler: 'WatchlistHooks::onWatchComplete',
      description: 'Registra assinaturas de monitoramento de artigos no Cloud Firestore.',
    },
  ],
  config: [
    {
      key: '$wgWatchlistAutoSubscribePush',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Integra automaticamente páginas vigiadas às notificações push.',
    },
  ],
  manifestJson: {
    name: 'WatchlistSubscriptions',
    version: '1.5.0',
    type: 'engagement',
    license_name: 'GPL-2.0-or-later',
  },
  lastUpdated: '2026-04-06',
};

export const specialPagesHubExtension: WikiExtension = {
  id: 'ext-special-pages',
  name: 'SpecialPagesHub',
  namePt: 'Central de Páginas Especiais & Dump XML',
  version: '2.0.0',
  category: 'infra',
  author: 'NotMediaWiki Core Team',
  description:
    'Hub unificado de páginas especiais (Special:RecentChanges, Special:AllPages, WhatLinksHere, Contribuições) e exportação/importação de dumps XML 0.11.',
  enabled: true,
  type: 'extension',
  url: 'https://www.mediawiki.org/wiki/Help:Special_pages',
  license: 'GPL-2.0-or-later',
  hooks: [
    {
      name: 'SpecialPage_initList',
      handler: 'SpecialPagesHooks::onInitList',
      description: 'Registra a central de Páginas Especiais e rotas de dump XML.',
    },
  ],
  config: [
    {
      key: '$wgEnableXmlDumpInterchange',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Habilita importação e exportação em formato MediaWiki XML 0.11.',
    },
  ],
  manifestJson: {
    name: 'SpecialPagesHub',
    version: '2.0.0',
    type: 'infra',
    license_name: 'GPL-2.0-or-later',
  },
  lastUpdated: '2026-04-07',
};

export const categoryTreeExtension: WikiExtension = {
  id: 'ext-category-tree',
  name: 'CategoryTree',
  namePt: 'Árvore de Categorias & Taxonomia',
  version: '1.4.0',
  category: 'search',
  author: 'Daniel Kinzler & NotMediaWiki Taxonomy',
  description:
    'Exibe tags de categorias clicáveis no rodapé dos artigos e árvore hierárquica expansível no namespace Categoria: e em Páginas Especiais.',
  enabled: true,
  type: 'extension',
  url: 'https://www.mediawiki.org/wiki/Extension:CategoryTree',
  license: 'GPL-2.0-or-later',
  hooks: [
    {
      name: 'OutputPageMakeCategoryLinks',
      handler: 'CategoryTreeHooks::onCategoryLinks',
      description: 'Renderiza rodapé de categorias interativo e árvore de subcategorias.',
    },
  ],
  config: [
    {
      key: '$wgCategoryTreeMaxDepth',
      type: 'number',
      value: 4,
      defaultValue: 4,
      description: 'Profundidade máxima padrão ao expandir subcategorias.',
    },
  ],
  manifestJson: {
    name: 'CategoryTree',
    version: '1.4.0',
    type: 'search',
    license_name: 'GPL-2.0-or-later',
  },
  lastUpdated: '2026-04-03',
};

export const randomArticleExtension: WikiExtension = {
  id: 'ext-random-page',
  name: 'RandomArticle',
  namePt: 'Página Aleatória (Special:Random)',
  version: '1.1.0',
  category: 'search',
  author: 'NotMediaWiki Discovery Team',
  description:
    'Adiciona botões e rota canônica Special:Random (#/random) para sortear e abrir artigos aleatórios da enciclopédia.',
  enabled: true,
  type: 'extension',
  url: 'https://www.mediawiki.org/wiki/Manual:Random_page',
  license: 'MIT',
  hooks: [
    {
      name: 'SpecialRandomGetRandomTitle',
      handler: 'RandomArticleHooks::onGetRandomTitle',
      description: 'Seleciona um artigo aleatório excluindo o artigo atualmente aberto.',
    },
  ],
  config: [
    {
      key: '$wgRandomExcludeTalkNamespace',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Prioriza artigos do namespace principal no sorteio aleatório.',
    },
  ],
  manifestJson: {
    name: 'RandomArticle',
    version: '1.1.0',
    type: 'search',
    license_name: 'MIT',
  },
  lastUpdated: '2026-04-02',
};

export const pwaMobileDesktopAppExtension: WikiExtension = {
  id: 'ext-pwa-app',
  name: 'PwaMobileDesktopApp',
  namePt: 'Aplicativo Mobile & Computador (PWA)',
  version: '1.2.0',
  category: 'infra',
  author: 'NotMediaWiki Platform Team',
  description:
    'Suporte a instalação como aplicativo (Android, iOS, Windows, macOS, Linux), modal de opções do app e indicador de conectividade offline.',
  enabled: true,
  type: 'extension',
  url: 'https://wazzimagiygg.com',
  license: 'MIT',
  hooks: [
    {
      name: 'BeforePageDisplay',
      handler: 'PwaAppHooks::onRegisterInstallPrompt',
      description: 'Habilita controles de instalação PWA e monitoramento de conexão offline.',
    },
  ],
  config: [
    {
      key: '$wgPwaShowOfflineBanner',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Exibe indicador visual quando o dispositivo perde conexão com a internet.',
    },
  ],
  manifestJson: {
    name: 'PwaMobileDesktopApp',
    version: '1.2.0',
    type: 'infra',
    license_name: 'MIT',
  },
  lastUpdated: '2026-04-11',
};

export const promoVideoStudioExtension: WikiExtension = {
  id: 'ext-promo-studio',
  name: 'PromoVideoStudio',
  namePt: 'Estúdio de Vídeo Comercial',
  version: '1.0.0',
  category: 'media',
  author: 'WazzimaGiygg Media Studio',
  description:
    'Estúdio interativo (#/video-comercial) para reprodução e criação de apresentações comerciais e promocionais da enciclopédia.',
  enabled: true,
  type: 'extension',
  url: 'https://wazzimagiygg.com',
  license: 'MIT',
  hooks: [
    {
      name: 'SkinNavigationItems',
      handler: 'PromoStudioHooks::onNavItems',
      description: 'Adiciona a aba Vídeo Comercial na barra principal de navegação.',
    },
  ],
  config: [
    {
      key: '$wgPromoStudioAutoPlayPreview',
      type: 'boolean',
      value: false,
      defaultValue: false,
      description: 'Inicia a pré-visualização automaticamente ao abrir o estúdio.',
    },
  ],
  manifestJson: {
    name: 'PromoVideoStudio',
    version: '1.0.0',
    type: 'media',
    license_name: 'MIT',
  },
  lastUpdated: '2026-04-01',
};

export const wikidiotaParodyBannerExtension: WikiExtension = {
  id: 'ext-parody-banner',
  name: 'WikidiotaParodyBanner',
  namePt: 'Faixa Satírica Wikidiota & Wikiomite',
  version: '1.0.0',
  category: 'ui',
  author: 'Wikiomite Foundation (Paródia)',
  description:
    'Exibe o banner satírico institucional e notas de rodapé temáticas quando o tema de paródia "Wikidiota" está ativo.',
  enabled: true,
  type: 'skin',
  url: 'https://wazzimagiygg.com',
  license: 'MIT',
  hooks: [
    {
      name: 'SiteNoticeAfter',
      handler: 'WikidiotaBannerHooks::onSiteNoticeAfter',
      description: 'Renderiza faixa temática satírica sob o cabeçalho quando o tema Wikidiota está selecionado.',
    },
  ],
  config: [
    {
      key: '$wgWikidiotaShowFooterChronicle',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Exibe crônica satírica complementar no rodapé durante o tema Wikidiota.',
    },
  ],
  manifestJson: {
    name: 'WikidiotaParodyBanner',
    version: '1.0.0',
    type: 'skin',
    license_name: 'MIT',
  },
  lastUpdated: '2026-04-11',
};

export const governanceAndComplianceExtension: WikiExtension = {
  id: 'ext-blp-governance',
  name: 'GovernanceAndCompliance',
  namePt: 'Governança Jurídica, LGPD, WP:BLP & Anti-VPN',
  version: '2.1.0',
  category: 'security',
  author: 'NotMediaWiki Legal & Safety Council',
  description:
    'Agrupa o aviso do Conselho de Ética (WP:BLP) nos artigos, card do Dossiê LGPD/Marco Civil na inicial, detecção de VPN/Proxy no cabeçalho e módulos de governança no painel administrativo.',
  enabled: true,
  type: 'extension',
  url: 'https://wazzimagiygg.com/averdade/',
  license: 'GPL-2.0-or-later',
  hooks: [
    {
      name: 'UserLoginComplete',
      handler: 'GovernanceHooks::onCheckConnectionVpn',
      description: 'Audita conexão de rede/VPN no login e exibe avisos de conformidade.',
    },
    {
      name: 'ArticlePageDataBefore',
      handler: 'GovernanceHooks::onRenderBlpNotice',
      description: 'Exibe selo de conformidade WP:BLP e LGPD nos verbetes.',
    },
  ],
  config: [
    {
      key: '$wgGovernanceShowBlpBanner',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Exibe aviso do Conselho de Ética WP:BLP no topo dos artigos.',
    },
    {
      key: '$wgGovernanceEnableVpnAudit',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Executa verificação automática de VPN/Proxy para contas autenticadas.',
    },
  ],
  manifestJson: {
    name: 'GovernanceAndCompliance',
    version: '2.1.0',
    type: 'security',
    license_name: 'GPL-2.0-or-later',
  },
  lastUpdated: '2026-04-10',
};

export const homePageCustomizerExtension: WikiExtension = {
  id: 'ext-home-customizer',
  name: 'HomePageCustomizer',
  namePt: 'Personalizador HTML da Página Inicial',
  version: '1.3.0',
  category: 'ui',
  author: 'NotMediaWiki UI Team',
  description:
    'Renderiza o portal HTML personalizado da Página Inicial e disponibiliza o editor HTML exclusivo para burocratas com modelos prontos.',
  enabled: true,
  type: 'extension',
  url: 'https://wazzimagiygg.com',
  license: 'MIT',
  hooks: [
    {
      name: 'HomePageBeforeRecentArticles',
      handler: 'HomeCustomizerHooks::onRenderPortal',
      description: 'Renderiza bloco HTML customizado no topo da página inicial.',
    },
  ],
  config: [
    {
      key: '$wgHomeCustomizerAllowBureaucratEdit',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Permite que burocratas editem o HTML da página inicial diretamente na UI.',
    },
  ],
  manifestJson: {
    name: 'HomePageCustomizer',
    version: '1.3.0',
    type: 'ui',
    license_name: 'MIT',
  },
  lastUpdated: '2026-04-06',
};

export const googleOneTapQuickLoginExtension: WikiExtension = {
  id: 'ext-google-onetap',
  name: 'GoogleOneTapQuickLogin',
  namePt: 'Login Rápido Flutuante (Google One Tap)',
  version: '1.1.0',
  category: 'security',
  author: 'NotMediaWiki Auth Team',
  description:
    'Exibe o cartão flutuante de login rápido com Google no canto superior direito para visitantes ainda não autenticados (mantendo o Login Google principal sempre disponível).',
  enabled: true,
  type: 'extension',
  url: 'https://wazzimagiygg.com',
  license: 'MIT',
  hooks: [
    {
      name: 'BeforePageDisplay',
      handler: 'GoogleOneTapHooks::onRenderPopup',
      description: 'Renderiza cartão flutuante Google One Tap para visitantes.',
    },
  ],
  config: [
    {
      key: '$wgGoogleOneTapAutoShow',
      type: 'boolean',
      value: true,
      defaultValue: true,
      description: 'Exibe automaticamente o popup rápido quando não há sessão Google ativa.',
    },
  ],
  manifestJson: {
    name: 'GoogleOneTapQuickLogin',
    version: '1.1.0',
    type: 'security',
    license_name: 'MIT',
  },
  lastUpdated: '2026-04-07',
};

export const WIKI_FEATURE_EXTENSIONS: WikiExtension[] = [
  templatesExtension,
  infoboxExtension,
  focusReadingModeExtension,
  pdfPrintExportExtension,
  articleFeedbackKarmaExtension,
  draftAutosaveRealtimeExtension,
  communityChatExtension,
  userDirectoryProfilesExtension,
  talkPagesExtension,
  watchlistSubscriptionsExtension,
  specialPagesHubExtension,
  categoryTreeExtension,
  randomArticleExtension,
  pwaMobileDesktopAppExtension,
  promoVideoStudioExtension,
  wikidiotaParodyBannerExtension,
  governanceAndComplianceExtension,
  homePageCustomizerExtension,
  googleOneTapQuickLoginExtension,
];
