/**
 * Native Browser Print API PDF Exporter.
 *
 * Uses `window.print()` together with the `@media print` rules defined in `src/index.css`
 * to generate a vector-quality PDF document of the current wiki article without
 * rasterizing the DOM to canvas.
 */

export interface PrintPdfExportOptions {
  title: string;
  slug?: string;
  siteName?: string;
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
  /** Fallback cleanup delay (ms) if the browser does not fire `afterprint`. */
  cleanupTimeoutMs?: number;
}

export interface PrintPdfExportResult {
  success: boolean;
  documentTitle: string;
  usedNativePrintApi: boolean;
  error?: string;
}

/**
 * Builds a clean, filesystem-safe document title used by browsers as the default
 * suggested filename when saving via "Print -> Save as PDF".
 */
export function buildPrintDocumentTitle(
  articleTitle: string,
  slug?: string,
  siteName = 'NotMediaWiki'
): string {
  const base = (articleTitle || slug || 'artigo')
    .trim()
    .replace(/[/\\?%*:|"<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const safeBase = base || 'artigo';
  return siteName ? `${safeBase} - ${siteName}` : safeBase;
}

/**
 * Checks whether the current runtime supports the browser Print API.
 */
export function isPrintApiSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.print === 'function';
}

/**
 * Exports the current article as a PDF using the native Browser Print API (`window.print`),
 * leveraging the existing `@media print` stylesheet rules in `src/index.css`.
 *
 * - Temporarily updates `document.title` so "Save as PDF" proposes the article's title.
 * - Temporarily disables the root `dark` class so printed output always uses crisp light paper styling.
 * - Marks `<html>` with `print-export-active` for print lifecycle styling hooks.
 * - Restores all DOM state cleanly on `afterprint` (with a safe fallback timer).
 */
export function exportArticleToPdfViaPrint(
  options: PrintPdfExportOptions
): Promise<PrintPdfExportResult> {
  const {
    title,
    slug,
    siteName = 'NotMediaWiki',
    onBeforePrint,
    onAfterPrint,
    cleanupTimeoutMs = 1500,
  } = options;

  const targetTitle = buildPrintDocumentTitle(title, slug, siteName);

  if (!isPrintApiSupported() || typeof document === 'undefined') {
    return Promise.resolve({
      success: false,
      documentTitle: targetTitle,
      usedNativePrintApi: false,
      error: 'A API de impressão do navegador não está disponível neste ambiente.',
    });
  }

  return new Promise<PrintPdfExportResult>((resolve) => {
    const previousTitle = document.title;
    const rootEl = document.documentElement;
    const hadDarkClass = rootEl.classList.contains('dark');
    let cleanedUp = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;

      if (fallbackTimer !== null) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }

      window.removeEventListener('afterprint', cleanup);
      document.title = previousTitle;
      rootEl.classList.remove('print-export-active');
      if (hadDarkClass) {
        rootEl.classList.add('dark');
      }

      onAfterPrint?.();
      resolve({
        success: true,
        documentTitle: targetTitle,
        usedNativePrintApi: true,
      });
    };

    try {
      onBeforePrint?.();
      document.title = targetTitle;
      rootEl.classList.add('print-export-active');
      if (hadDarkClass) {
        rootEl.classList.remove('dark');
      }

      window.addEventListener('afterprint', cleanup, { once: true });
      fallbackTimer = setTimeout(cleanup, cleanupTimeoutMs);

      window.print();
    } catch (err) {
      cleanup();
      resolve({
        success: false,
        documentTitle: targetTitle,
        usedNativePrintApi: true,
        error: err instanceof Error ? err.message : 'Falha ao acionar a impressão do navegador.',
      });
    }
  });
}
