import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildPrintDocumentTitle,
  exportArticleToPdfViaPrint,
} from '../src/utils/printPdfExporter';

describe('Browser Print API PDF Exporter (@media print)', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true });
    Object.defineProperty(globalThis, 'document', { value: originalDocument, configurable: true });
  });

  it('builds sanitized PDF document titles from article title or slug', () => {
    expect(buildPrintDocumentTitle('Arquitetura: NotMediaWiki / v2', 'Arquitetura')).toBe(
      'Arquitetura NotMediaWiki v2 - NotMediaWiki'
    );
    expect(buildPrintDocumentTitle('', 'Guia_Wikitext')).toBe('Guia_Wikitext - NotMediaWiki');
    expect(buildPrintDocumentTitle('   ', '')).toBe('artigo - NotMediaWiki');
  });

  it('invokes window.print, sets document.title, suspends dark mode, and restores state on afterprint', async () => {
    const listeners: Record<string, Array<() => void>> = {};
    const classSet = new Set<string>(['dark']);

    const mockDocument = {
      title: 'Original Page Title',
      documentElement: {
        classList: {
          contains: (cls: string) => classSet.has(cls),
          add: (cls: string) => classSet.add(cls),
          remove: (cls: string) => classSet.delete(cls),
        },
      },
    };

    let titleDuringPrint = '';
    let hadDarkDuringPrint = true;
    let hadPrintActiveDuringPrint = false;

    const mockPrint = vi.fn(() => {
      titleDuringPrint = mockDocument.title;
      hadDarkDuringPrint = classSet.has('dark');
      hadPrintActiveDuringPrint = classSet.has('print-export-active');
      // Simulate browser firing afterprint
      (listeners['afterprint'] || []).forEach(fn => fn());
    });

    const mockWindow = {
      print: mockPrint,
      addEventListener: vi.fn((event: string, cb: () => void) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(cb);
      }),
      removeEventListener: vi.fn((event: string, cb: () => void) => {
        listeners[event] = (listeners[event] || []).filter(fn => fn !== cb);
      }),
    };

    Object.defineProperty(globalThis, 'window', { value: mockWindow, configurable: true });
    Object.defineProperty(globalThis, 'document', { value: mockDocument, configurable: true });

    const beforeSpy = vi.fn();
    const afterSpy = vi.fn();

    const result = await exportArticleToPdfViaPrint({
      title: 'Inteligência Artificial',
      slug: 'Inteligencia_Artificial',
      onBeforePrint: beforeSpy,
      onAfterPrint: afterSpy,
    });

    expect(mockPrint).toHaveBeenCalledTimes(1);
    expect(beforeSpy).toHaveBeenCalledTimes(1);
    expect(afterSpy).toHaveBeenCalledTimes(1);

    // During window.print()
    expect(titleDuringPrint).toBe('Inteligência Artificial - NotMediaWiki');
    expect(hadDarkDuringPrint).toBe(false);
    expect(hadPrintActiveDuringPrint).toBe(true);

    // Restored after afterprint
    expect(mockDocument.title).toBe('Original Page Title');
    expect(classSet.has('dark')).toBe(true);
    expect(classSet.has('print-export-active')).toBe(false);

    expect(result).toEqual({
      success: true,
      documentTitle: 'Inteligência Artificial - NotMediaWiki',
      usedNativePrintApi: true,
    });
  });

  it('returns a graceful error when window.print is unavailable', async () => {
    Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true });

    const result = await exportArticleToPdfViaPrint({
      title: 'Artigo Teste',
      slug: 'Artigo_Teste',
    });

    expect(result.success).toBe(false);
    expect(result.usedNativePrintApi).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
