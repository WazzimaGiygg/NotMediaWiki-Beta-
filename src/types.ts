export interface Article {
  id: string;
  slug: string;
  title: string;
  namespace: number;
  wikitext: string;
  summary: string;
  latestRevisionId: string;
  createdAt: string;
  updatedAt: string;
  categories: string[];
  views: number;
  isProtected?: boolean;
}

export interface RenderedArticleResponse {
  article: Article;
  html: string;
  toc: TocItem[];
  categories: string[];
  parseTimeMs: number;
  internalLinks?: string[];
  externalLinks?: string[];
  references?: string[];
  ast?: any[];
  cached?: boolean;
}

export interface ParsoidAstReferenceNode {
  type: 'Reference';
  index: number;
  name?: string;
  group?: string;
  text: string;
  refId: string;
  noteId: string;
  occurrence?: number;
}

export interface CitationBacklink {
  id: string;
  label: string;
  title?: string;
}

export interface CitationFootnote {
  index: number;
  name?: string;
  group?: string;
  rawText: string;
  formattedHtml: string;
  noteId: string;
  backlinks: CitationBacklink[];
  urls: string[];
  primaryUrl?: string;
  domain?: string;
  author?: string;
  year?: string;
  title?: string;
}

export interface TocItem {
  id: string;
  level: number;
  text: string;
  number: string;
}

export interface Revision {
  id: string;
  articleSlug: string;
  parentRevisionId: string | null;
  wikitext: string;
  comment: string;
  author: {
    id: string;
    name: string;
    isBot: boolean;
    ip?: string;
    username?: string;
    avatar?: string;
    role?: string;
  };
  timestamp: string;
  sha256: string;
  byteSize: number;
  isMinor: boolean;
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumberOld?: number;
  lineNumberNew?: number;
}

export interface DiffResult {
  fromRevId: string;
  toRevId: string;
  lines: DiffLine[];
  stats: {
    added: number;
    removed: number;
    unchanged: number;
    byteDelta: number;
  };
}

export type UserRole = 'sysop' | 'bureaucrat' | 'moderator' | 'editor' | 'reader' | 'bot';

export interface UserSession {
  id: string;
  username: string;
  userTag?: string;
  discriminator?: string;
  userPageSlug?: string;
  role: UserRole;
  editCount: number;
  avatar: string;
  email?: string;
  bio?: string;
  location?: string;
  isBanned?: boolean;
  banReason?: string;
  bannedAt?: string;
  isGoogleUser?: boolean;
  photoURL?: string;
  provider?: string;
  lastLoginAt?: string;
  syncedToCloudAt?: string;
}

export interface UserBoxItem {
  id: string;
  label: string;
  text: string;
  bgClass: string;
  textClass: string;
}

export interface UserPageTalkPost {
  id: string;
  authorId: string;
  authorUsername: string;
  authorTag?: string;
  authorAvatar?: string;
  authorRole?: string;
  text: string;
  timestamp: string;
}

export interface UserPage {
  id: string; // document id, e.g. userpage_{userId}
  userId: string;
  username: string;
  userTag: string; // e.g. "#1100"
  displayName: string; // e.g. "Mafersao#1100"
  slug: string; // e.g. "Usuário:Mafersao#1100"
  wikitext: string;
  html?: string;
  role: UserRole;
  avatar: string;
  email?: string;
  photoURL?: string;
  location?: string;
  badges: string[];
  userboxes: UserBoxItem[];
  talkPosts: UserPageTalkPost[];
  createdAt: string;
  updatedAt: string;
}

export interface VpnDetectionLog {
  id: string;
  userId?: string;
  username?: string;
  ip: string;
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  isDatacenter: boolean;
  riskScore: number; // 0 - 100
  confidence: 'baixo' | 'medio' | 'alto' | 'critico';
  asn?: string;
  isp?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  webrtcLeakIp?: string;
  timezoneMismatch?: boolean;
  browserTimezone?: string;
  ipTimezone?: string;
  reasons: string[];
  status: 'permitido' | 'alerta' | 'bloqueado';
  detectedAt: string;
}

export interface BlpEthicsCase {
  id: string;
  caseNumber: string;
  articleSlug: string;
  articleTitle: string;
  targetPerson: string;
  category: 'difamacao_calunia' | 'invasao_privacidade' | 'falta_fontes_secundarias' | 'direito_esquecimento' | 'conteudo_sensivel_familia' | 'outro';
  complainant: string;
  complainantType: 'sujeito_biografado' | 'representante_legal' | 'editor' | 'leitor';
  status: 'aberto' | 'em_deliberacao' | 'parecer_emitido' | 'artigo_protegido' | 'remocao_cautelar' | 'arquivado';
  severity: 'critica' | 'alta' | 'media' | 'baixa';
  claims: string;
  evidence: string[];
  remedyRequested: 'exclusao_paragrafo' | 'reversao_edicao' | 'supressao_historico' | 'protecao_artigo' | 'eliminacao_completa';
  ethicsBoardNotes?: string;
  decisionSummary?: string;
  deliberators: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DirectChat {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantAvatars?: Record<string, string>;
  participantTags?: Record<string, string>;
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageSenderId?: string;
  unreadCount?: Record<string, number>;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderUsername: string;
  senderTag: string;
  senderAvatar: string;
  senderRole: UserRole;
  text: string;
  timestamp: string;
  read: boolean;
}

export interface WikiEvent {
  id: string;
  meta: {
    uri: string;
    request_id: string;
    id: string;
    dt: string;
    domain: string;
    stream: string;
  };
  database: string;
  page_title: string;
  page_namespace: number;
  rev_id: string;
  rev_timestamp: string;
  rev_sha1: string;
  rev_minor_edit: boolean;
  rev_len: number;
  user_text: string;
  comment: string;
  type: 'edit' | 'new' | 'rollback' | 'categorize' | 'protect';
}

export interface ServiceNode {
  id: string;
  name: string;
  role: string;
  status: 'healthy' | 'degraded' | 'failing';
  circuitBreaker: 'CLOSED' | 'HALF_OPEN' | 'OPEN';
  rps: number;
  latencyMs: {
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  uptimePercent: number;
  memoryUsageMb: number;
  technology: string;
  legacyPhpEquivalent: string;
}

export interface SystemMetrics {
  totalRequests: number;
  aggregateRps: number;
  averageLatencyMs: number;
  totalMemoryMb: number;
  uptimeSeconds: number;
  healthyServicesCount: number;
  totalServicesCount: number;
}

export interface SearchMatch {
  slug: string;
  title: string;
  namespace: number;
  snippet: string;
  score: number;
  categories: string[];
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface SystemLog {
  id: string;
  level: LogLevel;
  service: string;
  message: string;
  timestamp: string;
  traceId?: string;
  details?: Record<string, any>;
}

export interface HomePageMetadata {
  id: string;
  htmlContent: string;
  title?: string;
  updatedBy?: string;
  updatedByRole?: string;
  updatedAt: string;
}

export type ExtensionCategory = 'parser' | 'ui' | 'search' | 'security' | 'infra' | 'media' | 'engagement';

export interface ExtensionHook {
  name: string;
  handler: string;
  description: string;
}

export interface ExtensionConfigParam {
  key: string;
  type: 'boolean' | 'string' | 'number' | 'json';
  value: any;
  defaultValue: any;
  description: string;
}

export interface WikiExtension {
  id: string;
  name: string;
  namePt: string;
  version: string;
  category: ExtensionCategory;
  author: string;
  description: string;
  enabled: boolean;
  type: 'extension' | 'skin' | 'service';
  url?: string;
  license: string;
  hooks: ExtensionHook[];
  config: ExtensionConfigParam[];
  manifestJson?: Record<string, any>;
  lastUpdated?: string;
}

export interface AllowedDomain {
  id: string;
  domain: string;
  description?: string;
  status: 'allowed' | 'trusted' | 'blocked';
  addedBy: string;
  addedByRole: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ArbitrationVote {
  arbitratorName: string;
  vote: 'favor' | 'contra' | 'abstencao';
  comment: string;
  timestamp: string;
}

export interface ArbitrationCase {
  id: string;
  caseNumber: string;
  title: string;
  parties: string[];
  openedBy: string;
  status: 'em_andamento' | 'deliberacao' | 'encerrado' | 'rejeitado';
  description: string;
  evidence: string[];
  sanction?: string;
  verdict?: string;
  votes: ArbitrationVote[];
  createdAt: string;
  closedAt?: string;
}

export interface CheckUserInvestigation {
  id: string;
  caseCode: string;
  primaryUser: string;
  suspectedAccounts: string[];
  status: 'sob_analise' | 'confirmado' | 'inconclusivo' | 'arquivado';
  ipRange: string;
  userAgentMatch: string;
  confidenceScore: number;
  findings: string;
  requestedBy: string;
  auditedBy?: string;
  sanctionsApplied: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UnblockRequest {
  id: string;
  username: string;
  blockedBy: string;
  blockReason: string;
  blockDuration: string;
  userAppeal: string;
  status: 'pendente' | 'em_discussao' | 'deferido' | 'indeferido';
  administratorNotes?: string;
  resolution?: string;
  resolvedBy?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface DataRemovalRequest {
  id: string;
  protocolNumber: string;
  requesterNameOrAlias: string;
  requesterEmail?: string;
  legalBasis: 'LGPD_Art18' | 'MarcoCivil_Art19' | 'Doxxing' | 'Difamacao' | 'OrdemJudicial';
  targetSlug: string;
  targetRevisionId?: string;
  description: string;
  status: 'pendente' | 'processado' | 'rejeitado';
  actionsTaken?: string[];
  processedBy?: string;
  createdAt: string;
  processedAt?: string;
}

export interface EmergencyContactReport {
  id: string;
  protocol: string;
  category: 'vida_integridade' | 'crime_grave' | 'ordem_judicial' | 'vazamento_critico';
  title: string;
  description: string;
  urgency: 'critica_imediata' | 'alta' | 'moderada';
  reportedBy: string;
  contactChannel: string;
  status: 'aberto' | 'atendimento_imediato' | 'resolvido';
  actionsTaken?: string;
  createdAt: string;
}

// 3.05.3.af & 3.05.8.b - Daily Checklist & Monthly Points System
export interface DailyChecklistItem {
  id: 'login' | 'contribution' | 'rating';
  code: string; // '3.05.8.b.a' | '3.05.8.b.b' | '3.05.8.b.c'
  title: string;
  points: number; // 1.0, 0.20, 1.0
  completed: boolean;
  completedAt?: string;
  details?: string;
}

export interface UserDailyChecklist {
  id: string; // doc id: `${userId}_${date}`
  userId: string;
  username: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  items: {
    login: { completed: boolean; completedAt?: string; points: number };
    contribution: { completed: boolean; completedAt?: string; points: number; count?: number; lastArticleSlug?: string };
    rating: { completed: boolean; completedAt?: string; points: number; lastArticleSlug?: string; stars?: number };
  };
  dailyPointsEarned: number; // up to 2.20 pts/dia
  maxPossibleDailyPoints: number; // 2.20
  completedAll: boolean;
  updatedAt: string;
}

export interface MonthlyPointsHistoryItem {
  date: string;
  points: number;
  itemsCompleted: string[];
}

export interface UserMonthlyPointsLedger {
  id: string; // doc id: `${userId}_${month}`
  userId: string;
  username: string;
  month: string; // YYYY-MM
  totalMonthlyPoints: number;
  totalDaysActive: number;
  loginPointsTotal: number;
  contributionPointsTotal: number;
  ratingPointsTotal: number;
  lastActiveDate: string;
  streakDays: number;
  history: MonthlyPointsHistoryItem[];
  updatedAt: string;
}

export interface ArticleRating {
  id: string;
  articleSlug: string;
  userId: string;
  username: string;
  rating: number; // 1-5
  feedback?: string;
  createdAt: string;
}

// =============================================================================
// BOT AGENT & AUTOMATION TYPES (4.1.1.8T.1 - 4.1.1.E0.1)
// =============================================================================

export type BotAgentId =
  | 'citation_bot'
  | 'antivandal_bot'
  | 'category_bot'
  | 'quality_bot'
  | 'link_checker_bot'
  | 'lgpd_bot'
  | 'user_audit_bot';

export interface BotAgentConfig {
  id: BotAgentId;
  code: string; // e.g. '4.1.1.WV.1'
  name: string;
  namePt: string;
  enabled: boolean;
  description: string;
  assignedUserId: string;
  assignedUsername: string;
  mode: 'automatic' | 'manual' | 'dry_run';
  settings: {
    useGemini?: boolean;
    autoRevertVandalism?: boolean;
    byteDropThresholdPercent?: number;
    sensitivityLevel?: 'baixo' | 'medio' | 'alto';
    scanRecentHours?: number; // 4.1.1.1IT.1 (Descontinuado mas configurável)
    autoApplyCategories?: boolean;
    notifyAdminsOnCritical?: boolean;
    minQualityScoreRequired?: number;
  };
  stats: {
    totalRuns: number;
    actionsTaken: number;
    flagsRaised: number;
    lastRunAt?: string;
  };
}

export interface BotUser {
  id: string;
  username: string;
  userTag: string;
  displayName: string;
  avatar: string;
  description: string;
  botFlag: boolean;
  isBot?: boolean;
  role: 'bot';
  status: 'active' | 'paused' | 'disabled';
  permissions: string[];
  assignedBotAgentId: BotAgentId;
  createdAt: string;
  totalEdits: number;
  lastActiveAt?: string;
}

export interface BotScanCondition {
  namespace?: number;
  category?: string;
  query?: string;
  articleSlug?: string;
  authorId?: string;
  recentHours?: number; // 4.1.1.1IT.1
  limit?: number;
  selectedBots?: BotAgentId[];
}

export interface BotScanResult {
  id: string;
  articleSlug: string;
  articleTitle: string;
  botId: BotAgentId;
  botName: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  details: string;
  suggestion?: string;
  suggestedMarkup?: string;
  autoFixAvailable?: boolean;
  actionTaken?: 'none' | 'flagged' | 'reverted' | 'suggested' | 'fixed';
  detectedAt: string;
  metadata?: Record<string, any>;
}

export interface BotActivityLog {
  id: string;
  botId: BotAgentId;
  botName: string;
  action: string;
  targetArticleSlug?: string;
  targetUserId?: string;
  severity: 'info' | 'warning' | 'critical';
  summary: string;
  details?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface UserAbuseAudit {
  id: string;
  userId: string;
  username: string;
  riskScore: number; // 0 - 100
  status: 'clean' | 'suspicious' | 'flagged' | 'restricted';
  flags: string[];
  recentEditsCount: number;
  revertCount: number;
  burstEditsCount: number;
  massDeletionsCount: number;
  profanityDetections: number;
  lastAuditAt: string;
  details: string;
}



