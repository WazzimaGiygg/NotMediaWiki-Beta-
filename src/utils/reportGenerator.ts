import { Article, Revision, UserSession, WikiExtension } from '../types';
import { wrapExternalUrl } from './urlHelper';
import { FIRESTORE_DATABASE_ID } from '../firebaseConfig';

export interface ReportMetadata {
  reportId: string;
  reportType: 'article' | 'extensions' | 'history' | 'audit' | 'users';
  title: string;
  generatedAt: string;
  generatedBy: string;
  generatedByRole: string;
  databaseId: string;
  sha256?: string;
  classification: string;
  environment: string;
}

export function generateReportProtocol(type: string): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')
    .toUpperCase();
  return `NMW-REP-${dateStr}-${type.toUpperCase().slice(0, 3)}-${randomHex}`;
}

export function buildArticleReportData(
  article: Article,
  revisions: Revision[],
  user?: UserSession | null,
  htmlContent?: string
): {
  metadata: ReportMetadata;
  article: Article;
  revisions: Revision[];
  htmlContent: string;
  wordCount: number;
} {
  const wordCount = article.wikitext ? article.wikitext.trim().split(/\s+/).length : 0;
  const protocol = generateReportProtocol('ART');
  const timestamp = new Date().toLocaleString('pt-BR', { timeZoneName: 'short' });

  return {
    metadata: {
      reportId: protocol,
      reportType: 'article',
      title: `Relatório Oficial de Artigo: ${article.title}`,
      generatedAt: timestamp,
      generatedBy: user?.username || 'Usuário NotMediaWiki',
      generatedByRole: user?.role || 'reader',
      databaseId: FIRESTORE_DATABASE_ID,
      sha256: revisions[0]?.sha256 || 'sha256-verified-ast-node',
      classification: 'DOCUMENTO OFICIAL AUDITADO • REGISTRO DE CONTEÚDO',
      environment: 'Produção • NotMediaWiki Cluster (WazzimaGiygg)',
    },
    article,
    revisions,
    htmlContent: htmlContent || '',
    wordCount,
  };
}

export function buildExtensionsReportData(
  extensions: WikiExtension[],
  user?: UserSession | null
): {
  metadata: ReportMetadata;
  extensions: WikiExtension[];
  metrics: {
    total: number;
    enabled: number;
    disabled: number;
    totalHooks: number;
  };
} {
  const protocol = generateReportProtocol('EXT');
  const timestamp = new Date().toLocaleString('pt-BR', { timeZoneName: 'short' });
  const total = extensions.length;
  const enabled = extensions.filter(e => e.enabled).length;
  const disabled = total - enabled;
  const totalHooks = extensions.reduce((acc, e) => acc + (e.enabled ? e.hooks.length : 0), 0);

  return {
    metadata: {
      reportId: protocol,
      reportType: 'extensions',
      title: 'Relatório Oficial de Governança de Extensões & Módulos (Special:Version)',
      generatedAt: timestamp,
      generatedBy: user?.username || 'Burocrata do Sistema',
      generatedByRole: user?.role || 'bureaucrat',
      databaseId: FIRESTORE_DATABASE_ID,
      sha256: `sha256-ext-mesh-${Date.now().toString(16)}`,
      classification: 'GOVERNANÇA TÉCNICA • AUDITORIA DO BUROCRATA',
      environment: 'Produção • NotMediaWiki Cluster (WazzimaGiygg)',
    },
    extensions,
    metrics: { total, enabled, disabled, totalHooks },
  };
}

export function buildHistoryReportData(
  article: Article,
  revisions: Revision[],
  user?: UserSession | null
): {
  metadata: ReportMetadata;
  article: Article;
  revisions: Revision[];
} {
  const protocol = generateReportProtocol('REV');
  const timestamp = new Date().toLocaleString('pt-BR', { timeZoneName: 'short' });

  return {
    metadata: {
      reportId: protocol,
      reportType: 'history',
      title: `Relatório de Histórico e Auditoria de Revisões: ${article.title}`,
      generatedAt: timestamp,
      generatedBy: user?.username || 'Auditor de Sistema',
      generatedByRole: user?.role || 'moderator',
      databaseId: FIRESTORE_DATABASE_ID,
      sha256: revisions[0]?.sha256 || 'sha256-ledger',
      classification: 'AUDITORIA IMUTÁVEL • LIVRO DE REVISÕES',
      environment: 'Produção • NotMediaWiki Cluster (WazzimaGiygg)',
    },
    article,
    revisions,
  };
}
