import { wrapExternalUrl } from '../utils/urlHelper';
import { getInfoboxFieldLabel, formatInfoboxFieldValue } from '../utils/infoboxSoftware';
import {
  templateService,
  ServiceTemplateExpansionOptions,
} from './templateService';
import { convertWikidotFootnotes, expandWikidotSyntax } from '../utils/wikidotSyntax';
import { isRuntimeExtensionEnabled } from '../extensions';

import { TemplateDiagnostic } from '../types';

export interface ParsoidParseOptions extends ServiceTemplateExpansionOptions {
  skipTemplateExpansion?: boolean;
  parsoidEnabled?: boolean;
  citeEnabled?: boolean;
  templatesEnabled?: boolean;
  infoboxEnabled?: boolean;
  syntaxEnabled?: boolean;
  preExpandedTemplates?: {
    usedTemplates: string[];
    missingTemplates: string[];
    diagnostics?: TemplateDiagnostic[];
  };
}

export interface TocItem {
  id: string;
  level: number;
  text: string;
  number: string;
}

export interface ParseResult {
  html: string;
  toc: TocItem[];
  categories: string[];
  internalLinks: string[];
  externalLinks: string[];
  references: string[];
  usedTemplates?: string[];
  missingTemplates?: string[];
  templateDiagnostics?: TemplateDiagnostic[];
  categorySortKeys?: Record<string, string>;
  interwikiLinks?: Array<{ lang: string; title: string }>;
  pageSettings?: {
    noToc?: boolean;
    forceToc?: boolean;
    noEditSection?: boolean;
    noGallery?: boolean;
    disambig?: boolean;
    noIndex?: boolean;
    hiddenCat?: boolean;
    displayTitle?: string;
    defaultSort?: string;
  };
  ast: any[];
  parseTimeMs: number;
}

const escapeAttrAndText = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatMathExpression = (latex: string): string => {
  return escapeAttrAndText(latex.trim())
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '<span class="inline-flex flex-col items-center align-middle mx-1 text-xs leading-tight"><span class="border-b border-current px-1">$1</span><span class="px-1">$2</span></span>')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\sum/g, '∑')
    .replace(/\\prod/g, '∏')
    .replace(/\\int/g, '∫')
    .replace(/\\infty/g, '∞')
    .replace(/\\pi/g, 'π')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\theta/g, 'θ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\Omega/g, 'Ω')
    .replace(/\\omega/g, 'ω')
    .replace(/\\pm/g, '±')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\to|\\rightarrow/g, '→')
    .replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>')
    .replace(/\^([a-zA-Z0-9])/g, '<sup>$1</sup>')
    .replace(/_\{([^}]+)\}/g, '<sub>$1</sub>')
    .replace(/_([a-zA-Z0-9])/g, '<sub>$1</sub>');
};

const formatChemExpression = (formula: string): string => {
  return escapeAttrAndText(formula.trim())
    .replace(/&lt;-&gt;/g, '↔')
    .replace(/-&gt;/g, '→')
    .replace(/&lt;=&gt;/g, '⇌')
    .replace(/([A-Za-z\)])(\d+)/g, '$1<sub>$2</sub>')
    .replace(/\^([0-9]*[+-])/g, '<sup>$1</sup>');
};

export class ClientParsoidService {
  /**
   * Transforms Wikitext markup into semantic HTML5, TOC, references and AST
   */
  public parse(wikitext: string, pageTitle: string = 'Page', options?: ParsoidParseOptions): ParseResult {
    const startTime = performance.now();
    const categories: string[] = [];
    const internalLinks: string[] = [];
    const externalLinks: string[] = [];
    const references: string[] = [];
    const toc: TocItem[] = [];
    const ast: any[] = [];

    const isParsoid = options?.parsoidEnabled ?? isRuntimeExtensionEnabled('ParsoidCompiler');
    if (!isParsoid) {
      const escaped = wikitext
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const parseTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
      return {
        html: `<div class="mb-3 px-3 py-2 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-200">Extensão <strong>ParsoidCompiler</strong> desativada — exibindo wikitexto bruto.</div><pre class="whitespace-pre-wrap font-mono text-xs bg-slate-50 dark:bg-slate-900 p-4 rounded border border-slate-200 dark:border-slate-800 overflow-x-auto">${escaped}</pre>`,
        toc: [],
        categories: [],
        internalLinks: [],
        externalLinks: [],
        references: [],
        usedTemplates: [],
        missingTemplates: [],
        templateDiagnostics: [],
        ast: [],
        parseTimeMs,
      };
    }

    const isCite = options?.citeEnabled ?? isRuntimeExtensionEnabled('Cite');
    const isTemplates = options?.templatesEnabled ?? isRuntimeExtensionEnabled('MediaWikiTemplates');
    const isInfobox = options?.infoboxEnabled ?? isRuntimeExtensionEnabled('InfoboxBuilder');

    let processed = wikitext;
    const interwikiLinks: Array<{ lang: string; title: string }> = [];
    const pageSettings: NonNullable<ParseResult['pageSettings']> = {};

    // Mask <nowiki>, <syntaxhighlight>, <source>, and fenced code blocks early so comments/magic/links inside them are preserved verbatim
    const maskedCodeBlocks: string[] = [];
    const maskCodeBlock = (html: string): string => {
      const idx = maskedCodeBlocks.length;
      maskedCodeBlocks.push(html);
      return `@@PARSOID_CODE_${idx}@@`;
    };

    processed = processed.replace(/<nowiki>([\s\S]*?)<\/nowiki>/gi, (_, inner) => {
      return maskCodeBlock(`<span class="wiki-nowiki">${escapeAttrAndText(inner)}</span>`);
    });

    processed = processed.replace(/<(?:syntaxhighlight|source)(?:\s+lang=["']?([a-zA-Z0-9_-]+)["']?)?>([\s\S]*?)<\/(?:syntaxhighlight|source)>/gi, (_, lang, code) => {
      const language = (lang || 'javascript').toLowerCase();
      const cleanCode = code.replace(/^[\r\n]+|[\r\n]+$/g, '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return maskCodeBlock(`<pre class="language-${language}"><code class="language-${language}">${cleanCode}</code></pre>`);
    });

    processed = processed.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const language = (lang || 'markup').toLowerCase();
      const cleanCode = code.replace(/^[\r\n]+|[\r\n]+$/g, '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return maskCodeBlock(`<pre class="language-${language}"><code class="language-${language}">${cleanCode}</code></pre>`);
    });

    processed = processed.replace(/<pre(?:\s+class=["']?([^"'>]+)["']?)?>([\s\S]*?)<\/pre>/gi, (_, customClass, code) => {
      if (/^<code(?:\s+class="[^"]*")?>/i.test(code.trim())) {
        return maskCodeBlock(`<pre class="${customClass || 'language-none'}">${code}</pre>`);
      }
      const langClass = customClass || 'language-none';
      const cleanCode = code.replace(/^[\r\n]+|[\r\n]+$/g, '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return maskCodeBlock(`<pre class="${langClass}"><code class="${langClass}">${cleanCode}</code></pre>`);
    });

    // 0. Strip editorial HTML comments <!-- ... --> (hidden in article output)
    processed = processed.replace(/<!--[\s\S]*?-->/g, '');

    const categorySortKeys: Record<string, string> = {};

    // 0.5. Extract MediaWiki Page Settings & Metadata Magic Words
    processed = processed
      .replace(/__NOTOC__/g, () => { pageSettings.noToc = true; return ''; })
      .replace(/__FORCETOC__/g, () => { pageSettings.forceToc = true; return ''; })
      .replace(/__NOEDITSECTION__/g, () => { pageSettings.noEditSection = true; return ''; })
      .replace(/__NOGALLERY__/g, () => { pageSettings.noGallery = true; return ''; })
      .replace(/__DISAMBIG__/g, () => { pageSettings.disambig = true; return ''; })
      .replace(/__NOINDEX__/g, () => { pageSettings.noIndex = true; return ''; })
      .replace(/__INDEX__/g, () => { pageSettings.noIndex = false; return ''; })
      .replace(/__HIDDENCAT__/g, () => { pageSettings.hiddenCat = true; return ''; })
      .replace(/\{\{DISPLAYTITLE:([^}]+)\}\}/gi, (_, dt) => { pageSettings.displayTitle = dt.trim(); return ''; })
      .replace(/\{\{DEFAULTSORT:([^}]+)\}\}/gi, (_, ds) => { pageSettings.defaultSort = ds.trim(); return ''; });

    // 0.75. Extract Interwiki Language Links (e.g. [[en:Article]], [[es:Artículo]])
    processed = processed.replace(/\[\[(en|es|fr|de|it|pt|ja|zh|ru|ar|nl|pl|sv|uk):([^\]]+)\]\]/gi, (_, lang, targetTitle) => {
      interwikiLinks.push({ lang: lang.toLowerCase(), title: targetTitle.trim() });
      ast.push({ type: 'InterwikiLink', lang: lang.toLowerCase(), title: targetTitle.trim() });
      return '';
    });

    // 1. Extract and process Categories: [[Category:Foo]] or [[Categoria:Foo|SortKey]]
    processed = processed.replace(/\[\[(?:Category|Categoria):([^\]]+)\]\]/gi, (_, cat) => {
      const pipeIdx = cat.indexOf('|');
      const cleanCat = (pipeIdx === -1 ? cat : cat.slice(0, pipeIdx)).replace(/_/g, ' ').trim();
      const sortKey = pipeIdx === -1 ? undefined : cat.slice(pipeIdx + 1).trim();
      if (!cleanCat) return '';
      if (!categories.includes(cleanCat)) {
        categories.push(cleanCat);
      }
      if (sortKey !== undefined) {
        categorySortKeys[cleanCat] = sortKey;
      }
      ast.push({ type: 'Category', name: cleanCat, ...(sortKey !== undefined ? { sortKey } : {}) });
      return '';
    });

    // 1.5. Convert Wikidot [[footnote]]...[[/footnote]] to <ref>...</ref> before Cite extraction
    processed = convertWikidotFootnotes(processed);

    // 2. Extract <ref> tags (supporting <ref>, <ref name="...">, <ref name="..." />, <ref group="...">)
    if (isCite) {
      let refCounter = 1;
      const namedRefs = new Map<string, { index: number; text: string; group?: string; count: number }>();

      processed = processed.replace(/<ref(?:\s+([^>]*?))?(?:\/>|>([\s\S]*?)<\/ref>)/gi, (_, rawAttrs, content) => {
        let name: string | undefined;
        let group: string | undefined;

        if (rawAttrs) {
          const nameMatch = rawAttrs.match(/name\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s/>]+))/i);
          if (nameMatch) {
            name = (nameMatch[1] || nameMatch[2] || nameMatch[3]).trim();
          }
          const groupMatch = rawAttrs.match(/group\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s/>]+))/i);
          if (groupMatch) {
            group = (groupMatch[1] || groupMatch[2] || groupMatch[3]).trim();
          }
        }

        const trimmed = content ? content.trim() : '';
        let refIdx: number;
        let refText: string;
        let occurrence = 0;

        if (name && namedRefs.has(name)) {
          const existing = namedRefs.get(name)!;
          refIdx = existing.index;
          refText = existing.text || trimmed;
          if (!existing.text && trimmed) {
            existing.text = trimmed;
          }
          existing.count += 1;
          occurrence = existing.count;
        } else {
          refIdx = refCounter++;
          refText = trimmed;
          if (name) {
            namedRefs.set(name, { index: refIdx, text: trimmed, group, count: 0 });
          }
          references.push(refText);
        }

        const refAnchorId = occurrence === 0 ? `cite_ref-${refIdx}` : `cite_ref-${refIdx}_${occurrence}`;
        const noteAnchorId = `cite_note-${refIdx}`;

        ast.push({
          type: 'Reference',
          index: refIdx,
          name,
          group,
          text: refText,
          refId: refAnchorId,
          noteId: noteAnchorId,
          occurrence,
        });

        return `<sup class="reference" id="${refAnchorId}"><a href="#${noteAnchorId}" class="cite-ref-link text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs" data-ref-index="${refIdx}">[${refIdx}]</a></sup>`;
      });

      // Remove standalone <references /> tags from inline content
      processed = processed.replace(/<references\s*\/?>/gi, '');
    }

    // 2.5. Expand MediaWiki Templates ({{Aviso}}, {{Esboço}}, {{Infocaixa}}, {{Navbox}}, Namespace 10 transclusions & magic words)
    const templateExpanded = options?.skipTemplateExpansion || !isTemplates
      ? {
          wikitext: processed,
          usedTemplates: options?.preExpandedTemplates?.usedTemplates || [],
          missingTemplates: options?.preExpandedTemplates?.missingTemplates || [],
          errors: [],
          diagnostics: options?.preExpandedTemplates?.diagnostics || [],
        }
      : templateService.expandTemplates(processed, {
          ...options,
          pageTitle: options?.pageTitle || pageTitle,
        });
    processed = templateExpanded.wikitext;
    for (const tplName of templateExpanded.usedTemplates) {
      ast.push({ type: 'Template', name: tplName });
    }

    // Re-extract any categories introduced via transcluded templates
    processed = processed.replace(/\[\[(?:Category|Categoria):([^\]]+)\]\]/gi, (_, cat) => {
      const pipeIdx = cat.indexOf('|');
      const cleanCat = (pipeIdx === -1 ? cat : cat.slice(0, pipeIdx)).replace(/_/g, ' ').trim();
      const sortKey = pipeIdx === -1 ? undefined : cat.slice(pipeIdx + 1).trim();
      if (!cleanCat) return '';
      if (!categories.includes(cleanCat)) {
        categories.push(cleanCat);
        ast.push({ type: 'Category', name: cleanCat, ...(sortKey !== undefined ? { sortKey } : {}) });
      }
      if (sortKey !== undefined) {
        categorySortKeys[cleanCat] = sortKey;
      }
      return '';
    });

    // 2.6. Expand Wikidot blocks & modules ([[note]], [[callout]], [[collapsible]], [[tabview]], [[div]], [[quote]], [[code]], [[toc]], [[module ...]])
    processed = expandWikidotSyntax(processed);

    // 3. Process Infoboxes: {{Infobox ... }}
    if (isInfobox) {
      processed = processed.replace(/\{\{Infobox\s+([a-zA-Z0-9_\-\s]+)\n([\s\S]*?)\n\}\}/gi, (_, type, body) => {
      const rows: { key: string; value: string }[] = [];
      const lines = body.split('\n');
      let currentKey = '';
      let currentValue = '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('|')) {
          if (currentKey) {
            rows.push({ key: currentKey, value: currentValue.trim() });
          }
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            currentKey = trimmed.substring(1, eqIdx).trim();
            currentValue = trimmed.substring(eqIdx + 1).trim();
          }
        } else if (currentKey) {
          currentValue += '\n' + trimmed;
        }
      }
      if (currentKey) {
        rows.push({ key: currentKey, value: currentValue.trim() });
      }

      ast.push({ type: 'Infobox', subType: type.trim(), rows });

      const titleRow = rows.find(r => ['name', 'nome'].includes(r.key.toLowerCase()) && r.value.trim());
      const logoRow = rows.find(r => ['logo', 'image', 'imagem'].includes(r.key.toLowerCase()) && r.value.trim());
      const captionRow = rows.find(r => ['caption', 'legenda'].includes(r.key.toLowerCase()) && r.value.trim());
      const infoboxTitle = titleRow?.value.trim() || pageTitle;

      let infoboxHtml = `<aside class="infobox float-right clear-right ml-6 mb-4 w-72 md:w-80 border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 rounded p-4 text-sm shadow-sm">`;
      infoboxHtml += `<div class="font-bold text-center text-base pb-2 mb-3 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">${infoboxTitle}</div>`;

      if (logoRow && /^(https?:\/\/|\/assets\/)/i.test(logoRow.value.trim())) {
        const safeSrc = logoRow.value.trim().replace(/"/g, '&quot;');
        infoboxHtml += `<div class="mb-3 flex flex-col items-center gap-1.5 pb-2 border-b border-slate-200/70 dark:border-slate-800/70">`;
        infoboxHtml += `<img src="${safeSrc}" alt="${infoboxTitle.replace(/"/g, '&quot;')}" class="max-h-24 w-auto object-contain rounded" />`;
        if (captionRow) {
          infoboxHtml += `<span class="text-[11px] text-slate-500 dark:text-slate-400 text-center">${captionRow.value.trim()}</span>`;
        }
        infoboxHtml += `</div>`;
      }

      infoboxHtml += `<table class="w-full text-xs border-collapse">`;
      for (const row of rows) {
        const lowerKey = row.key.toLowerCase();
        if (['name', 'nome', 'logo', 'image', 'imagem', 'caption', 'legenda'].includes(lowerKey)) continue;
        if (!row.value || !row.value.trim()) continue;

        const prettyKey = getInfoboxFieldLabel(row.key);
        const formattedVal = formatInfoboxFieldValue(row.key, row.value, wrapExternalUrl);

        infoboxHtml += `<tr class="border-b border-slate-100 dark:border-slate-800/60"><th class="text-left font-semibold py-1.5 pr-2 align-top text-slate-700 dark:text-slate-300 w-2/5">${prettyKey}</th><td class="py-1.5 text-slate-600 dark:text-slate-400 break-words">${formattedVal}</td></tr>`;
      }
      infoboxHtml += `</table></aside>`;
      return infoboxHtml;
      });
    }

    // 4. Tables: {| class="wikitable" ... |}
    processed = processed.replace(/\{\|([\s\S]*?)\|\}/g, (_, tableContent) => {
      const rows = tableContent.split('\n|-');
      let tableHtml = `<div class="overflow-x-auto my-5"><table class="wikitable min-w-full text-left text-sm border border-slate-300 dark:border-slate-700 border-collapse">`;
      
      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const row = rows[rIdx];
        const lines = row.split('\n').filter((l: string) => l.trim().length > 0 && !l.trim().startsWith('class='));
        if (lines.length === 0) continue;

        tableHtml += `<tr class="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/40">`;
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('!')) {
            const headers = trimmed.substring(1).split('!!');
            for (const h of headers) {
              tableHtml += `<th class="bg-slate-100 dark:bg-slate-800 px-3 py-2 font-semibold text-slate-900 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700">${h.trim()}</th>`;
            }
          } else if (trimmed.startsWith('|')) {
            const cells = trimmed.substring(1).split('||');
            for (const c of cells) {
              tableHtml += `<td class="px-3 py-2 text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700">${c.trim()}</td>`;
            }
          }
        }
        tableHtml += `</tr>`;
      }

      tableHtml += `</table></div>`;
      ast.push({ type: 'Table', rowsCount: rows.length });
      return tableHtml;
    });

    // 4.5. Rich Insertable Wiki Blocks: <gallery>, <hiero>, <score>, <chem>/<ce>, <math>, <mapframe>, <graph>, and Signature ~~~~
    const maskedRichBlocks: string[] = [];
    const maskRich = (html: string): string => {
      const idx = maskedRichBlocks.length;
      maskedRichBlocks.push(html);
      return `@@PARSOID_RICH_${idx}@@`;
    };

    processed = processed.replace(/<gallery(?:\s+([^>]*))?>([\s\S]*?)<\/gallery>/gi, (_, _attrs, body) => {
      const items = String(body || '')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
          const [rawFile, ...captionParts] = line.split('|');
          const cleanFile = rawFile.replace(/^(?:File|Image|Arquivo|Imagem):/i, '').trim();
          const caption = escapeAttrAndText(captionParts.join('|').trim() || cleanFile);
          const isSafeUrl = /^(https?:\/\/|\/assets\/)/i.test(cleanFile);
          return `<div class="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 flex flex-col gap-1.5">${
            isSafeUrl
              ? `<img src="${escapeAttrAndText(cleanFile)}" alt="${caption}" class="w-full h-28 object-cover rounded" />`
              : `<div class="w-full h-24 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[11px] font-mono text-slate-500 px-2 text-center">${escapeAttrAndText(cleanFile)}</div>`
          }<span class="text-[11px] text-slate-600 dark:text-slate-400 text-center">${caption}</span></div>`;
        });
      return maskRich(`<div data-wiki-block="gallery" class="my-4 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60"><div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Galeria de Imagens</div><div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">${items.join('') || '<div class="text-xs text-slate-400">Galeria vazia</div>'}</div></div>`);
    });

    processed = processed.replace(/<hiero>([\s\S]*?)<\/hiero>/gi, (_, inner) => {
      const tokens = escapeAttrAndText(String(inner || '').trim());
      return maskRich(`<div data-wiki-block="hiero" class="my-3 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border-2 border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100 font-serif"><span class="text-[10px] font-sans font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Hieróglifos</span><span class="font-mono text-sm tracking-widest">${tokens}</span></div>`);
    });

    processed = processed.replace(/<score(?:\s+[^>]*)?>([\s\S]*?)<\/score>/gi, (_, inner) => {
      const notation = escapeAttrAndText(String(inner || '').trim());
      return maskRich(`<div data-wiki-block="score" class="my-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70"><div class="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1.5"><span>𝄞 Partitura Musical (LilyPond)</span><span class="font-mono text-[10px] text-slate-400">&lt;score&gt;</span></div><pre class="font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">${notation}</pre></div>`);
    });

    processed = processed.replace(/<(?:chem|ce)>([\s\S]*?)<\/(?:chem|ce)>/gi, (_, inner) => {
      return maskRich(`<span data-wiki-block="chem" class="inline-block px-1.5 py-0.5 rounded bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 font-serif text-emerald-900 dark:text-emerald-200">${formatChemExpression(inner)}</span>`);
    });

    processed = processed.replace(/<math(?:\s+[^>]*)?>([\s\S]*?)<\/math>/gi, (_, inner) => {
      return maskRich(`<span data-wiki-block="math" class="inline-block px-2 py-0.5 rounded bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-serif italic text-slate-900 dark:text-slate-100">${formatMathExpression(inner)}</span>`);
    });

    processed = processed.replace(/<mapframe(?:\s+([^>]*))?(?:\/>|>([\s\S]*?)<\/mapframe>)/gi, (_, attrs, body) => {
      const rawAttrs = String(attrs || '');
      const lat = rawAttrs.match(/latitude\s*=\s*["']?([0-9.-]+)["']?/i)?.[1] || '0';
      const lon = rawAttrs.match(/longitude\s*=\s*["']?([0-9.-]+)["']?/i)?.[1] || '0';
      const zoom = rawAttrs.match(/zoom\s*=\s*["']?([0-9]+)["']?/i)?.[1] || '10';
      const caption = escapeAttrAndText(rawAttrs.match(/text\s*=\s*["']([^"']+)["']/i)?.[1] || String(body || '').trim() || 'Mapa Cartográfico');
      return maskRich(`<div data-wiki-block="mapframe" class="my-4 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30"><div class="flex items-center justify-between text-xs font-semibold text-blue-900 dark:text-blue-200"><span>Mapa Interativo (${escapeAttrAndText(lat)}, ${escapeAttrAndText(lon)})</span><span class="font-mono text-[10px]">Zoom ${escapeAttrAndText(zoom)}</span></div><div class="mt-1 text-xs text-slate-600 dark:text-slate-300">${caption}</div></div>`);
    });

    processed = processed.replace(/<graph(?:\s+[^>]*)?>([\s\S]*?)<\/graph>/gi, (_, inner) => {
      const rawSpec = escapeAttrAndText(String(inner || '').trim());
      return maskRich(`<div data-wiki-block="graph" class="my-4 p-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30"><div class="text-xs font-semibold text-purple-900 dark:text-purple-200 mb-1">Gráfico de Dados (&lt;graph&gt;)</div><pre class="text-[11px] font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap overflow-x-auto">${rawSpec}</pre></div>`);
    });

    // 5. Headings: = H1 =, == H2 ==, === H3 ===, ==== H4 ====, ===== H5 =====, ====== H6 ======
    const sectionCounters = [0, 0, 0, 0, 0];
    processed = processed.replace(/^(={1,6})\s*([^=]+?)\s*\1[ \t]*$/gm, (_, levelMarks, headingText) => {
      const level = levelMarks.length;
      const cleanTitle = headingText.trim();
      const slugId = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      if (level === 2) {
        sectionCounters[0]++;
        sectionCounters[1] = 0;
        sectionCounters[2] = 0;
        toc.push({ id: slugId, level: 2, text: cleanTitle, number: `${sectionCounters[0]}` });
      } else if (level === 3) {
        sectionCounters[1]++;
        sectionCounters[2] = 0;
        toc.push({ id: slugId, level: 3, text: cleanTitle, number: `${sectionCounters[0]}.${sectionCounters[1]}` });
      } else if (level === 4) {
        sectionCounters[2]++;
        toc.push({ id: slugId, level: 4, text: cleanTitle, number: `${sectionCounters[0]}.${sectionCounters[1]}.${sectionCounters[2]}` });
      }

      ast.push({ type: 'Heading', level, text: cleanTitle, id: slugId });

      if (level === 1) {
        return `<h1 id="${slugId}" class="text-2xl font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2 mt-6 mb-4">${cleanTitle}</h1>`;
      } else if (level === 2) {
        return `<h2 id="${slugId}" class="group text-xl font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1.5 mt-8 mb-3 flex items-center justify-between"><span>${cleanTitle}</span><a href="#${slugId}" class="opacity-0 group-hover:opacity-100 text-xs text-slate-400 hover:text-blue-500 ml-2">#</a></h2>`;
      } else if (level === 3) {
        return `<h3 id="${slugId}" class="text-lg font-medium text-slate-900 dark:text-slate-100 mt-6 mb-2">${cleanTitle}</h3>`;
      } else if (level === 4) {
        return `<h4 id="${slugId}" class="text-base font-medium text-slate-800 dark:text-slate-200 mt-4 mb-2">${cleanTitle}</h4>`;
      } else if (level === 5) {
        return `<h5 id="${slugId}" class="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-3 mb-1.5">${cleanTitle}</h5>`;
      } else {
        return `<h6 id="${slugId}" class="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mt-3 mb-1">${cleanTitle}</h6>`;
      }
    });

    // 6. Bold, Italics & Inline Emphasis
    processed = processed
      .replace(/'''''([^']+)'''''/g, '<strong><em>$1</em></strong>')
      .replace(/'''([^']+)'''/g, '<strong>$1</strong>')
      .replace(/''([^']+)''/g, '<em>$1</em>')
      .replace(/~~~~/g, '<span class="wiki-signature text-xs text-slate-500 dark:text-slate-400 font-mono">-- Assinatura Editorial</span>');

    // 6.5. Images & Media: [[File:...]], [[Image:...]], [[Arquivo:...]], [[Imagem:...]]
    processed = processed.replace(/\[\[(?:File|Image|Arquivo|Imagem):([^\]|]+)(?:\|([^\]]*))?\]\]/gi, (_, target, rest) => {
      const fileRef = target.trim();
      const parts = rest ? rest.split('|').map((p: string) => p.trim()).filter(Boolean) : [];
      const caption = parts.filter((p: string) => !/^(thumb|thumbnail|frameless|frame|left|right|center|none|\d+px)$/i.test(p)).pop() || '';
      const isSafeUrl = /^(https?:\/\/|\/assets\/)/i.test(fileRef);
      const safeAlt = escapeAttrAndText(caption || fileRef);
      return `<figure class="wiki-media my-4 p-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 max-w-md">${
        isSafeUrl
          ? `<img src="${escapeAttrAndText(fileRef)}" alt="${safeAlt}" class="w-full h-auto rounded object-contain" />`
          : `<div class="py-6 px-3 rounded bg-slate-100 dark:bg-slate-800 text-center text-xs font-mono text-slate-500 dark:text-slate-400">Arquivo de mídia: ${escapeAttrAndText(fileRef)}</div>`
      }${caption ? `<figcaption class="mt-1.5 text-xs text-slate-600 dark:text-slate-400">${escapeAttrAndText(caption)}</figcaption>` : ''}</figure>`;
    });

    // 7. Internal Links: [[Target|Text]], [[Target]], and inline [[:Categoria:Foo]]
    processed = processed.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
      const rawTarget = target.trim();
      const linkTarget = rawTarget.replace(/^:/, '').trim();
      const displayLabel = (label || linkTarget).trim();
      internalLinks.push(linkTarget);
      ast.push({ type: 'InternalLink', target: linkTarget, label: displayLabel });

      if (linkTarget.startsWith('User:')) {
        return `<a href="#/user/${encodeURIComponent(linkTarget.replace('User:', ''))}" class="wiki-link text-blue-700 dark:text-blue-400 hover:underline font-medium">${displayLabel}</a>`;
      }
      return `<a href="#/wiki/${encodeURIComponent(linkTarget.replace(/ /g, '_'))}" class="wiki-link text-blue-700 dark:text-blue-400 hover:underline font-medium">${displayLabel}</a>`;
    });

    // 8. External Links: [http://... Anchor text] and [http://...]
    processed = processed.replace(/\[(https?:\/\/[^\s]+)\s+([^\]]+)\]/g, (_, url, text) => {
      externalLinks.push(url);
      const safeUrl = wrapExternalUrl(url);
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="external-link text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5">${text} <span class="text-[10px] text-slate-400">↗</span></a>`;
    });

    processed = processed.replace(/\[(https?:\/\/[^\s\]]+)\]/g, (_, url) => {
      externalLinks.push(url);
      const safeUrl = wrapExternalUrl(url);
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="external-link text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5">${url} <span class="text-[10px] text-slate-400">↗</span></a>`;
    });

    // 9. Unordered & Ordered Lists
    processed = processed.replace(/^(\*{1,3})\s+(.+)$/gm, (_, stars, item) => {
      const indent = stars.length;
      return `<li class="ml-${indent * 4} list-disc text-slate-700 dark:text-slate-300 my-1">${item.trim()}</li>`;
    });

    processed = processed.replace(/^(#{1,3})\s+(.+)$/gm, (_, hashes, item) => {
      const indent = hashes.length;
      return `<li class="ml-${indent * 4} list-decimal text-slate-700 dark:text-slate-300 my-1">${item.trim()}</li>`;
    });

    // 10. Indented talk replies (like ::Great news!)
    processed = processed.replace(/^(:{1,4})\s*(.+)$/gm, (_, colons, text) => {
      const depth = colons.length * 16;
      return `<div class="border-l-2 border-slate-300 dark:border-slate-700 pl-3 my-2 text-slate-700 dark:text-slate-300" style="margin-left: ${depth}px;">${text.trim()}</div>`;
    });

    // 11. Restore masked rich blocks & code blocks, plus inline `code`
    processed = processed.replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');
    processed = processed.replace(/@@PARSOID_RICH_(\d+)@@/g, (_, idx) => maskedRichBlocks[Number(idx)] || '');
    processed = processed.replace(/@@PARSOID_CODE_(\d+)@@/g, (_, idx) => maskedCodeBlocks[Number(idx)] || '');

    // 12. Paragraphs & Line Breaks
    const paragraphs = processed.split(/\n{2,}/);
    const htmlBlocks = paragraphs.map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (/^<(?:h[1-6]|p|aside|div|details|summary|li|ul|ol|table|pre|blockquote|nav|section|center|figure|hr)(?:\s|>|\/)/i.test(trimmed)) {
        return trimmed;
      }
      return `<p class="leading-relaxed text-slate-800 dark:text-slate-300 mb-4 font-serif text-[16px]">${trimmed.replace(/\n/g, '<br/>')}</p>`;
    });

    let finalHtml = htmlBlocks.join('\n');

    // Note: References are extracted into AST and parsed by citationParser utility
    // to be rendered as dynamic, accessible numbered footnotes by the ArticleFootnotes component.
    // If the article ended with a standalone '== References ==' or '== Referências ==' heading,
    // we convert it to an anchor target so ArticleFootnotes renders the complete interactive section.
    finalHtml = finalHtml.replace(/<h2 id="(?:references|referencias)"[^>]*>[\s\S]*?<\/h2>\s*$/i, '');

    const parseTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      html: finalHtml,
      toc,
      categories,
      internalLinks,
      externalLinks,
      references,
      usedTemplates: templateExpanded.usedTemplates,
      missingTemplates: templateExpanded.missingTemplates,
      templateDiagnostics: templateExpanded.diagnostics,
      categorySortKeys,
      interwikiLinks,
      pageSettings,
      ast,
      parseTimeMs,
    };
  }

  public tokenize(wikitext: string) {
    const tokens: Array<{ type: string; start: number; end: number; preview: string }> = [];
    const lines = wikitext.split('\n');
    let offset = 0;

    for (const line of lines) {
      if (line.match(/^={2,4}\s*.+\s*={2,4}$/)) {
        tokens.push({ type: 'HEADING', start: offset, end: offset + line.length, preview: line });
      } else if (line.includes('{{') && !line.startsWith('{|')) {
        tokens.push({ type: 'TEMPLATE_OPEN', start: offset, end: offset + line.length, preview: line });
      } else if (line.startsWith('{|')) {
        tokens.push({ type: 'TABLE_OPEN', start: offset, end: offset + line.length, preview: line });
      } else if (line.startsWith('*') || line.startsWith('#')) {
        tokens.push({ type: 'LIST_ITEM', start: offset, end: offset + line.length, preview: line });
      } else if (line.includes('[[')) {
        tokens.push({ type: 'WIKILINK', start: offset, end: offset + line.length, preview: line.substring(0, 40) });
      }
      offset += line.length + 1;
    }

    return tokens;
  }
}

export const clientParsoid = new ClientParsoidService();
