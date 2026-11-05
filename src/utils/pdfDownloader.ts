import { Article } from '../types';

async function getHtml2Pdf() {
  if (typeof globalThis !== 'undefined' && typeof (globalThis as any).self === 'undefined') {
    (globalThis as any).self = globalThis;
  }
  // @ts-ignore
  const mod = await import('html2pdf.js');
  return mod.default || mod;
}

/**
 * Returns the exact print CSS rules extracted from src/index.css @media print.
 */
export function getPrintStyles(): string {
  return `
    .notmediawiki-pdf-export-root {
      background: #ffffff !important;
      color: #111827 !important;
      font-family: Georgia, Cambria, "Times New Roman", Times, serif !important;
      font-size: 11pt !important;
      line-height: 1.6 !important;
      padding: 0 !important;
      margin: 0 !important;
      width: 760px !important;
      box-sizing: border-box !important;
    }

    .notmediawiki-pdf-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .notmediawiki-pdf-header h1 {
      font-family: Georgia, serif !important;
      font-size: 24pt !important;
      font-weight: bold !important;
      color: #000000 !important;
      margin: 0 0 6px 0 !important;
      line-height: 1.2 !important;
    }

    .notmediawiki-pdf-header .meta {
      font-size: 9pt !important;
      color: #64748b !important;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    /* Core Wiki Content */
    .notmediawiki-pdf-body {
      font-family: Georgia, Cambria, "Times New Roman", Times, serif !important;
      font-size: 11.5pt !important;
      line-height: 1.6 !important;
      color: #0f172a !important;
    }

    .notmediawiki-pdf-body p {
      margin-bottom: 1.15rem !important;
      text-align: justify !important;
    }

    .notmediawiki-pdf-body h1,
    .notmediawiki-pdf-body h2 {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 16pt !important;
      font-weight: bold !important;
      color: #0f172a !important;
      border-bottom: 1px solid #94a3b8 !important;
      padding-bottom: 4px !important;
      margin-top: 1.75rem !important;
      margin-bottom: 0.75rem !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    .notmediawiki-pdf-body h3 {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 13pt !important;
      font-weight: 600 !important;
      color: #1e293b !important;
      margin-top: 1.25rem !important;
      margin-bottom: 0.5rem !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    .notmediawiki-pdf-body h4 {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 11pt !important;
      font-weight: 600 !important;
      color: #1e293b !important;
      margin-top: 1rem !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    .notmediawiki-pdf-body ul {
      list-style-type: disc !important;
      padding-left: 1.5rem !important;
      margin-bottom: 1rem !important;
    }

    .notmediawiki-pdf-body ol {
      list-style-type: decimal !important;
      padding-left: 1.5rem !important;
      margin-bottom: 1rem !important;
    }

    .notmediawiki-pdf-body li {
      margin-bottom: 0.25rem !important;
    }

    .notmediawiki-pdf-body a {
      color: #0f172a !important;
      text-decoration: none !important;
    }

    .notmediawiki-pdf-body .reference a {
      color: #2563eb !important;
      font-family: ui-monospace, monospace !important;
      font-size: 9pt !important;
      font-weight: bold !important;
      text-decoration: none !important;
    }

    /* Tables */
    .notmediawiki-pdf-body .wikitable,
    .notmediawiki-pdf-body table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 1.25rem 0 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .notmediawiki-pdf-body .wikitable th,
    .notmediawiki-pdf-body th {
      background-color: #f1f5f9 !important;
      color: #0f172a !important;
      border: 1px solid #cbd5e1 !important;
      padding: 6px 10px !important;
      font-size: 9.5pt !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-weight: 600 !important;
      text-align: left !important;
    }

    .notmediawiki-pdf-body .wikitable td,
    .notmediawiki-pdf-body td {
      border: 1px solid #cbd5e1 !important;
      padding: 6px 10px !important;
      font-size: 9.5pt !important;
      color: #1e293b !important;
    }

    /* Code Blocks */
    .notmediawiki-pdf-body .code-block-wrapper {
      background-color: #f8fafc !important;
      border: 1px solid #cbd5e1 !important;
      border-radius: 4px !important;
      color: #0f172a !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      margin: 1rem 0 !important;
      overflow: hidden !important;
    }

    .notmediawiki-pdf-body .code-block-header {
      background-color: #e2e8f0 !important;
      border-bottom: 1px solid #cbd5e1 !important;
      padding: 4px 8px !important;
      font-family: monospace !important;
      font-size: 8pt !important;
      color: #334155 !important;
    }

    .notmediawiki-pdf-body .code-line-numbers,
    .notmediawiki-pdf-body .copy-code-btn,
    .notmediawiki-pdf-body .toggle-lines-btn {
      display: none !important;
    }

    .notmediawiki-pdf-body pre {
      background: transparent !important;
      color: #0f172a !important;
      padding: 8px 12px !important;
      margin: 0 !important;
      font-family: ui-monospace, Menlo, Consolas, monospace !important;
      font-size: 8.5pt !important;
      white-space: pre-wrap !important;
      word-break: break-all !important;
    }

    .notmediawiki-pdf-body code {
      background-color: #f1f5f9 !important;
      color: #0f172a !important;
      font-family: ui-monospace, Menlo, Consolas, monospace !important;
      font-size: 9pt !important;
      padding: 1px 4px !important;
      border-radius: 2px !important;
    }

    .notmediawiki-pdf-body blockquote {
      border-left: 3px solid #64748b !important;
      color: #334155 !important;
      background: #f8fafc !important;
      padding: 0.5rem 1rem !important;
      margin: 1rem 0 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .notmediawiki-pdf-body .infobox {
      border: 1px solid #94a3b8 !important;
      background: #f8fafc !important;
      color: #0f172a !important;
      font-size: 9pt !important;
      float: right !important;
      clear: right !important;
      margin: 0 0 1rem 1rem !important;
      width: 260px !important;
      padding: 8px !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* Footnotes and Citations */
    .notmediawiki-pdf-footnotes {
      page-break-inside: avoid !important;
      border-top: 1px solid #cbd5e1 !important;
      margin-top: 2rem !important;
      padding-top: 1rem !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 9pt !important;
      color: #334155 !important;
    }

    .notmediawiki-pdf-footnotes h2,
    .notmediawiki-pdf-footnotes h3 {
      font-size: 13pt !important;
      font-weight: bold !important;
      color: #0f172a !important;
      margin-bottom: 0.5rem !important;
      border-bottom: none !important;
    }

    .notmediawiki-pdf-footnotes ol {
      padding-left: 1.25rem !important;
      margin: 0.5rem 0 !important;
    }

    .notmediawiki-pdf-footnotes li {
      margin-bottom: 0.4rem !important;
      line-height: 1.4 !important;
    }

    .notmediawiki-pdf-footnotes button,
    .notmediawiki-pdf-footnotes input,
    .notmediawiki-pdf-footnotes .no-print {
      display: none !important;
    }

    /* Footer stamp */
    .notmediawiki-pdf-footer {
      border-top: 1px solid #e2e8f0;
      margin-top: 2rem;
      padding-top: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 8pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  `;
}

export function buildHeaderHtml(article: Article): string {
  const formattedDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  return `
    <div class="notmediawiki-pdf-header">
      <h1>${article.title}</h1>
      <div class="meta">
        <span>NotMediaWiki · Enciclopédia Livre</span>
        <span>·</span>
        <span>Namespace: ${article.namespace === 0 ? 'Principal' : article.namespace === 1 ? 'Discussão' : article.namespace}</span>
        <span>·</span>
        <span>Revisão: ${article.latestRevisionId || 'atual'}</span>
        <span>·</span>
        <span>Exportado em: ${formattedDate}</span>
      </div>
    </div>
  `;
}

export function buildFooterHtml(): string {
  return `
    <div class="notmediawiki-pdf-footer">
      <span>Projeto NotMediaWiki (wazzimagiygg.com)</span>
      <span>Licença Creative Commons Atribuição-CompartilhaIgual (CC BY-SA 4.0)</span>
    </div>
  `;
}

/**
 * Builds an isolated, print-styled HTML string respecting the exact print
 * stylesheet specifications defined in src/index.css (@media print).
 * Safe to execute in both browser and Node.js environments.
 */
export function buildPrintStyledHtml(article: Article, htmlContent: string, footnotesHtml?: string): string {
  // Strip interactive elements
  const cleanBodyHtml = htmlContent
    .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/class="[^"]*no-print[^"]*"/gi, 'style="display:none"')
    .replace(/role="navigation"/gi, 'style="display:none"');

  const footnotesSection = footnotesHtml
    ? `<div class="notmediawiki-pdf-footnotes">${footnotesHtml.replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, '').replace(/<input\b[^>]*\/?>/gi, '')}</div>`
    : '';

  return `
    <div class="notmediawiki-pdf-export-root" data-article-slug="${article.slug}">
      <style>${getPrintStyles()}</style>
      ${buildHeaderHtml(article)}
      <div class="notmediawiki-pdf-body">${cleanBodyHtml}</div>
      ${footnotesSection}
      ${buildFooterHtml()}
    </div>
  `;
}

/**
 * Builds an isolated, print-styled HTML container DOM node respecting the exact print
 * stylesheet specifications defined in src/index.css (@media print).
 */
export function buildPrintStyledContainer(article: Article, htmlContent: string, footnotesElement?: HTMLElement | null): HTMLElement {
  if (typeof document === 'undefined') {
    throw new Error('document is not defined in non-browser environment. Use buildPrintStyledHtml instead.');
  }

  const container = document.createElement('div');
  container.className = 'notmediawiki-pdf-export-root';
  container.setAttribute('data-article-slug', article.slug);

  const styleEl = document.createElement('style');
  styleEl.innerHTML = getPrintStyles();
  container.appendChild(styleEl);

  // Article Header
  const headerDiv = document.createElement('div');
  headerDiv.innerHTML = buildHeaderHtml(article);
  container.appendChild(headerDiv.firstElementChild || headerDiv);

  // Article Body
  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'notmediawiki-pdf-body';
  bodyDiv.innerHTML = htmlContent;

  // Strip interactive elements that should not appear in PDF
  bodyDiv.querySelectorAll('button, .no-print, [role="navigation"], script, style').forEach(el => el.remove());
  container.appendChild(bodyDiv);

  // Footnotes & Citations
  if (footnotesElement) {
    const clone = footnotesElement.cloneNode(true) as HTMLElement;
    clone.className = 'notmediawiki-pdf-footnotes';
    // Remove search input and copy buttons from footnotes clone
    clone.querySelectorAll('button, input, [role="toolbar"], .no-print').forEach(el => el.remove());
    container.appendChild(clone);
  }

  // Footer stamp
  const footerDiv = document.createElement('div');
  footerDiv.innerHTML = buildFooterHtml();
  container.appendChild(footerDiv.firstElementChild || footerDiv);

  return container;
}

/**
 * Generates and downloads the current article as a high-fidelity PDF file,
 * strictly adhering to the print styling rules specified in src/index.css.
 */
export async function downloadArticlePdf(params: {
  article: Article;
  htmlContent: string;
  footnotesRef?: HTMLElement | null;
  onProgress?: (stage: string) => void;
}): Promise<void> {
  const { article, htmlContent, footnotesRef, onProgress } = params;

  if (onProgress) onProgress('Preparando estilos de impressão...');

  // Build the print-styled DOM element
  const container = buildPrintStyledContainer(article, htmlContent, footnotesRef);

  // Place off-screen in DOM to allow html2canvas / html2pdf to measure layout accurately
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-9999px';
  container.style.zIndex = '-1000';
  container.style.opacity = '1';
  document.body.appendChild(container);

  try {
    if (onProgress) onProgress('Renderizando páginas do PDF...');

    const cleanFilename = `${(article.title || article.slug || 'artigo')
      .toLowerCase()
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, '_')}.pdf`;

    const opt = {
      margin: [15, 15, 15, 15] as [number, number, number, number],
      filename: cleanFilename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false,
        backgroundColor: '#ffffff',
      },
      jsPDF: {
        unit: 'mm' as const,
        format: 'a4' as const,
        orientation: 'portrait' as const,
      },
      pagebreak: {
        mode: ['avoid-all', 'css', 'legacy'] as string[],
        avoid: ['h1', 'h2', 'h3', 'tr', '.infobox', 'blockquote', '.code-block-wrapper', '.notmediawiki-pdf-footnotes'],
      },
    };

    // Execute PDF compilation and automatic browser download
    const html2pdf = await getHtml2Pdf();
    await html2pdf().set(opt).from(container).save();

    if (onProgress) onProgress('Download concluído!');
  } catch (error) {
    console.error('Falha ao gerar PDF com html2pdf, acionando fallback de impressão:', error);
    // Graceful fallback to browser print if canvas rendering is restricted
    window.print();
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}
