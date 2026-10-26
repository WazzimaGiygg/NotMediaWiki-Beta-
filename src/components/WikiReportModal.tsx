import React, { useRef } from 'react';
import {
  Printer,
  Download,
  X,
  ShieldCheck,
  FileText,
  Clock,
  User,
  ExternalLink,
  CheckCircle2,
  Calendar,
  Layers,
  Puzzle,
  Hash,
  Database,
  QrCode,
  Award,
} from 'lucide-react';
import { Article, Revision, UserSession, WikiExtension } from '../types';
import { wrapExternalUrl } from '../utils/urlHelper';
import { ReportMetadata } from '../utils/reportGenerator';
import { FIRESTORE_DATABASE_ID } from '../firebaseConfig';

interface WikiReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: ReportMetadata;
  article?: Article | null;
  revisions?: Revision[];
  extensions?: WikiExtension[];
  htmlContent?: string;
  currentUser?: UserSession | null;
}

export const WikiReportModal: React.FC<WikiReportModalProps> = ({
  isOpen,
  onClose,
  metadata,
  article,
  revisions = [],
  extensions = [],
  htmlContent = '',
  currentUser,
}) => {
  const printableRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHtml = () => {
    if (!printableRef.current) return;
    const reportHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${metadata.title} - NotMediaWiki</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.5; color: #0f172a; margin: 0; padding: 20px; }
    @media print { body { padding: 0; } }
    .report-container { max-width: 900px; margin: 0 auto; border: 1px solid #cbd5e1; padding: 30px; background: #ffffff; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 12px; }
    th { background: #f1f5f9; font-weight: 600; text-transform: uppercase; font-size: 11px; }
    .badge { display: inline-block; padding: 2px 8px; font-size: 10px; font-weight: 600; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="report-container">
    ${printableRef.current.innerHTML}
  </div>
</body>
</html>`;

    const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${metadata.reportId}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Print-specific style tag injected for flawless standard A4 PDF output */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #wiki-printable-report, #wiki-printable-report * {
            visibility: visible !important;
          }
          #wiki-printable-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm 15mm !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            font-size: 11pt !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Top Action Toolbar (Hidden during print) */}
        <div className="no-print bg-slate-100 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-blue-600 text-white">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Padrão Oficial de Relatórios • NotMediaWiki</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  WazzimaGiygg Standard
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Protocolo: <span className="font-mono font-semibold">{metadata.reportId}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Abrir diálogo de impressão e salvar como PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / Salvar como PDF</span>
            </button>

            <button
              onClick={handleDownloadHtml}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Baixar arquivo HTML do relatório"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar HTML</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Fechar janela"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50 dark:bg-slate-950">
          {/* Printable Report Canvas (Follows the strict official PDF standard) */}
          <div
            id="wiki-printable-report"
            ref={printableRef}
            className="bg-white text-slate-900 border border-slate-300 rounded-lg p-6 sm:p-10 max-w-3xl mx-auto shadow-sm space-y-6 font-sans print:p-0 print:border-none print:shadow-none"
          >
            {/* 1. CABEÇALHO INSTITUCIONAL PADRONIZADO */}
            <div className="border-b-2 border-slate-800 pb-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-600" />
                    <span className="text-xl font-bold tracking-tight text-slate-900 font-serif">
                      NotMediaWiki
                    </span>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                      WazzimaGiygg
                    </span>
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mt-1">
                    Sistema de Gestão de Conhecimento e Microsserviços Wiki
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Faz parte do desenvolvimento de projetos <strong>WazzimaGiygg</strong>, do site{' '}
                    <a
                      href={wrapExternalUrl('https://wazzimagiygg.com')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 underline font-medium"
                    >
                      wazzimagiygg.com
                    </a>
                  </div>
                </div>

                <div className="text-right sm:text-right shrink-0">
                  <div className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200 inline-block">
                    {metadata.reportId}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    Emissão: {metadata.generatedAt}
                  </div>
                </div>
              </div>

              {/* Tarja de Segurança e Classificação Oficial */}
              <div className="mt-4 bg-slate-900 text-white px-3 py-1.5 rounded flex items-center justify-between text-[11px] font-semibold tracking-wide">
                <span>{metadata.classification}</span>
                <span className="font-mono text-[10px] opacity-80">VALIDAÇÃO ELETRÔNICA</span>
              </div>
            </div>

            {/* 2. SUMÁRIO EXECUTIVO & FICHA TÉCNICA */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 page-break-avoid">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1.5 flex items-center justify-between">
                <span>Ficha Técnica e Metadados do Registro</span>
                <span className="text-[10px] font-mono font-normal text-slate-500">
                  ISO-27001 / Wiki Standard
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Documento / Título</span>
                  <span className="font-semibold text-slate-900 break-words">
                    {article?.title || metadata.title}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Ambiente</span>
                  <span className="font-medium text-slate-800">Cluster Node.js</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Emitido Por</span>
                  <span className="font-medium text-slate-800">
                    {metadata.generatedBy} ({metadata.generatedByRole})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Banco de Dados</span>
                  <span className="font-mono text-[11px] text-slate-700 truncate block" title={metadata.databaseId}>
                    Firebase Firestore
                  </span>
                </div>
              </div>

              {metadata.sha256 && (
                <div className="pt-2 border-t border-slate-200 text-[11px] flex items-center justify-between font-mono">
                  <span className="text-slate-500">Hash SHA-256 de Integridade:</span>
                  <span className="font-bold text-slate-800 truncate max-w-sm" title={metadata.sha256}>
                    {metadata.sha256}
                  </span>
                </div>
              )}
            </div>

            {/* 3. CONTEÚDO PRINCIPAL DO RELATÓRIO */}

            {/* CASO A: RELATÓRIO DE ARTIGO ENCICLOPÉDICO */}
            {metadata.reportType === 'article' && article && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-serif font-bold text-slate-900 tracking-tight pb-2 border-b border-slate-200">
                    {article.title}
                  </h1>
                  <div className="text-xs text-slate-500 font-sans mt-1 flex flex-wrap items-center gap-2">
                    <span>Namespace: {article.namespace === 0 ? 'Principal (Artigo)' : article.namespace}</span>
                    <span>·</span>
                    <span>Visualizações: {(article.views ?? 0).toLocaleString()}</span>
                    <span>·</span>
                    <span>Revisão Ativa: {article.latestRevisionId}</span>
                    <span>·</span>
                    <span>Categorias: {article.categories?.join(', ') || 'Geral'}</span>
                  </div>
                </div>

                {/* Conteúdo Renderizado do Artigo */}
                <div
                  className="prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed font-serif"
                  dangerouslySetInnerHTML={{ __html: htmlContent || article.wikitext }}
                />

                {/* Histórico Recente de Revisões do Artigo */}
                {revisions.length > 0 && (
                  <div className="pt-6 border-t border-slate-200 page-break-avoid space-y-2">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Registro Cronológico de Edições ({revisions.length})
                    </h3>
                    <table className="w-full text-left text-xs border border-slate-200">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 font-semibold text-[10px] uppercase">
                          <th className="py-2 px-3 border-b border-slate-200">ID Revisão</th>
                          <th className="py-2 px-3 border-b border-slate-200">Data / Hora</th>
                          <th className="py-2 px-3 border-b border-slate-200">Autor</th>
                          <th className="py-2 px-3 border-b border-slate-200">Comentário</th>
                          <th className="py-2 px-3 border-b border-slate-200">Bytes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {revisions.slice(0, 5).map(rev => (
                          <tr key={rev.id}>
                            <td className="py-2 px-3 font-mono text-[11px]">{rev.id}</td>
                            <td className="py-2 px-3 text-[11px]">
                              {new Date(rev.timestamp).toLocaleDateString('pt-BR')} {new Date(rev.timestamp).toLocaleTimeString('pt-BR')}
                            </td>
                            <td className="py-2 px-3 font-medium">{rev.author.name}</td>
                            <td className="py-2 px-3 text-slate-600 italic">{rev.comment || 'Edição regular'}</td>
                            <td className="py-2 px-3 font-mono text-[11px]">{rev.byteSize} B</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* CASO B: RELATÓRIO OFICIAL DE EXTENSÕES & GOVERNANÇA (BUROCRATA) */}
            {metadata.reportType === 'extensions' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 pb-1 border-b border-slate-200">
                    Registro de Módulos e Extensões do NotMediaWiki
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Auditoria completa do inventário de extensões sincronizadas com o Firebase Firestore pelo Burocrata.
                  </p>
                </div>

                {/* Métricas do inventário de extensões */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                    <span className="block text-lg font-bold font-mono text-slate-900">{extensions.length}</span>
                    <span className="text-[10px] text-slate-500 uppercase">Instaladas</span>
                  </div>
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded">
                    <span className="block text-lg font-bold font-mono text-emerald-700">
                      {extensions.filter(e => e.enabled).length}
                    </span>
                    <span className="text-[10px] text-emerald-700 uppercase font-semibold">Ativas</span>
                  </div>
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded">
                    <span className="block text-lg font-bold font-mono text-amber-700">
                      {extensions.filter(e => !e.enabled).length}
                    </span>
                    <span className="text-[10px] text-amber-700 uppercase">Inativas</span>
                  </div>
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded">
                    <span className="block text-lg font-bold font-mono text-blue-700">
                      {extensions.reduce((acc, e) => acc + (e.enabled ? e.hooks.length : 0), 0)}
                    </span>
                    <span className="text-[10px] text-blue-700 uppercase">Ganchos Ativos</span>
                  </div>
                </div>

                {/* Tabela Oficial das Extensões */}
                <table className="w-full text-left text-xs border border-slate-200 page-break-avoid">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold text-[10px] uppercase">
                      <th className="py-2.5 px-3 border-b border-slate-200">Status</th>
                      <th className="py-2.5 px-3 border-b border-slate-200">Nome / Módulo</th>
                      <th className="py-2.5 px-3 border-b border-slate-200">Versão</th>
                      <th className="py-2.5 px-3 border-b border-slate-200">Categoria</th>
                      <th className="py-2.5 px-3 border-b border-slate-200">Hooks Interceptados</th>
                      <th className="py-2.5 px-3 border-b border-slate-200">Licença</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {extensions.map(ext => (
                      <tr key={ext.id}>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              ext.enabled
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {ext.enabled ? 'ATIVADA' : 'INATIVA'}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900">{ext.name}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-xs">{ext.description}</div>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px]">v{ext.version}</td>
                        <td className="py-2 px-3 uppercase text-[10px] text-slate-600 font-medium">
                          {ext.category}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-blue-700">
                          {ext.hooks.map(h => h.name).join(', ')}
                        </td>
                        <td className="py-2 px-3 font-mono text-[10px] text-slate-500">{ext.license}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* CASO C: RELATÓRIO DE HISTÓRICO DE REVISÕES */}
            {metadata.reportType === 'history' && article && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 pb-1 border-b border-slate-200">
                    Livro de Auditoria de Revisões: {article.title}
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Trilha de auditoria criptográfica e cronológica de modificações no documento.
                  </p>
                </div>

                <table className="w-full text-left text-xs border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold text-[10px] uppercase">
                      <th className="py-2.5 px-3 border-b border-slate-200">Revisão</th>
                      <th className="py-2.5 px-3 border-b border-slate-200">Timestamp</th>
                      <th className="py-2.5 px-3 border-b border-slate-200">Autor</th>
                      <th className="py-2.5 px-3 border-b border-slate-200">Sumário de Edição</th>
                      <th className="py-2.5 px-3 border-b border-slate-200">Tamanho</th>
                      <th className="py-2.5 px-3 border-b border-slate-200">SHA-256</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {revisions.map(rev => (
                      <tr key={rev.id}>
                        <td className="py-2 px-3 font-mono font-bold text-blue-700">{rev.id}</td>
                        <td className="py-2 px-3 text-[11px] text-slate-600">
                          {new Date(rev.timestamp).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-2 px-3 font-medium">{rev.author.name}</td>
                        <td className="py-2 px-3 text-slate-700 italic">{rev.comment || 'Nenhum resumo'}</td>
                        <td className="py-2 px-3 font-mono text-[11px]">{rev.byteSize} bytes</td>
                        <td className="py-2 px-3 font-mono text-[10px] text-slate-500 truncate max-w-[120px]" title={rev.sha256}>
                          {rev.sha256.slice(0, 16)}...
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 4. CARIMBO DIGITAL, DECLARAÇÃO DE INTEGRIDADE & ASSINATURA */}
            <div className="pt-6 border-t-2 border-slate-800 page-break-avoid space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* Declaração Jurídica e Técnica */}
                <div className="text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Declaração de Autenticidade e Governança</span>
                  </div>
                  <p>
                    Documento gerado e certificado digitalmente pela plataforma <strong>NotMediaWiki</strong>. Todos os registros foram validados pelo pipeline de Parsoid AST e sincronizados com a instância cloud <code>{FIRESTORE_DATABASE_ID}</code>.
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Validação de links: https://wazzimagiygg.com/rv/?uid= • NotMediaWiki WazzimaGiygg
                  </p>
                </div>

                {/* Campo de Assinatura do Burocrata */}
                <div className="border border-slate-300 rounded-md p-3 text-center bg-slate-50/50">
                  <div className="h-10 border-b border-dashed border-slate-400 mb-1 flex items-end justify-center pb-1">
                    <span className="font-serif italic text-xs text-slate-700">
                      {currentUser?.username || 'NodeArchitect (Burocrata)'}
                    </span>
                  </div>
                  <div className="text-[10px] uppercase font-bold text-slate-800">
                    {currentUser?.username || 'Burocrata do Sistema'}
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    Cargo: {currentUser?.role?.toUpperCase() || 'BUROCRATA'} · Autenticado em Nuvem
                  </div>
                </div>
              </div>
            </div>

            {/* 5. RODAPÉ INSTITUCIONAL PADRONIZADO EM TODAS AS PÁGINAS */}
            <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-500 font-sans flex flex-col sm:flex-row items-center justify-between gap-2">
              <div>
                NotMediaWiki — Faz parte do desenvolvimento de projetos{' '}
                <a
                  href={wrapExternalUrl('https://wazzimagiygg.com')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-blue-700 hover:underline"
                >
                  WazzimaGiygg
                </a>
                , do site wazzimagiygg.com.
              </div>
              <div className="font-mono text-slate-400">
                Página 1 de 1 · {metadata.reportId}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
