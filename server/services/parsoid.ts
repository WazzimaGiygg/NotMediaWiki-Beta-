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
  ast: any[];
  parseTimeMs: number;
}

export class ParsoidService {
  /**
   * Transforms Wikitext markup into semantic HTML5, TOC, references and AST
   */
  public parse(wikitext: string, pageTitle: string = 'Page'): ParseResult {
    const startTime = performance.now();
    const categories: string[] = [];
    const internalLinks: string[] = [];
    const externalLinks: string[] = [];
    const references: string[] = [];
    const toc: TocItem[] = [];
    const ast: any[] = [];

    let processed = wikitext;

    // 1. Extract and process Categories: [[Category:Foo]]
    processed = processed.replace(/\[\[Category:([^\]]+)\]\]/gi, (_, cat) => {
      const cleanCat = cat.trim();
      categories.push(cleanCat);
      ast.push({ type: 'Category', name: cleanCat });
      return '';
    });

    // 2. Extract <ref> tags (supporting <ref>, <ref name="...">, <ref name="..." />, <ref group="...">)
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

    // Remove standalone <references /> or {{reflist}} tags from inline content
    processed = processed.replace(/<references\s*\/?>/gi, '');
    processed = processed.replace(/\{\{reflist\}\}/gi, '');

    // 3. Process Infoboxes: {{Infobox ... }}
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

      let infoboxHtml = `<aside class="infobox float-right clear-right ml-6 mb-4 w-72 md:w-80 border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 rounded p-4 text-sm shadow-sm">`;
      infoboxHtml += `<div class="font-bold text-center text-base pb-2 mb-3 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">${rows.find(r => r.key === 'name')?.value || pageTitle}</div>`;
      
      infoboxHtml += `<table class="w-full text-xs border-collapse">`;
      for (const row of rows) {
        if (row.key === 'name') continue;
        const prettyKey = row.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        // Clean inner formatting
        const formattedVal = row.value
          .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => label || target)
          .replace(/\[(https?:\/\/[^\s]+)\s+([^\]]+)\]/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 underline">$2</a>');
        
        infoboxHtml += `<tr class="border-b border-slate-100 dark:border-slate-800/60"><th class="text-left font-semibold py-1.5 pr-2 align-top text-slate-700 dark:text-slate-300 w-1/3">${prettyKey}</th><td class="py-1.5 text-slate-600 dark:text-slate-400">${formattedVal}</td></tr>`;
      }
      infoboxHtml += `</table></aside>`;
      return infoboxHtml;
    });

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
            // Header cells: ! Col 1 !! Col 2
            const headers = trimmed.substring(1).split('!!');
            for (const h of headers) {
              tableHtml += `<th class="bg-slate-100 dark:bg-slate-800 px-3 py-2 font-semibold text-slate-900 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700">${h.trim()}</th>`;
            }
          } else if (trimmed.startsWith('|')) {
            // Data cells: | Cell 1 || Cell 2
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

    // 5. Headings: == H2 ==, === H3 ===, ==== H4 ====
    let sectionCounters = [0, 0, 0];
    processed = processed.replace(/^(={2,4})\s*([^=]+?)\s*\1\s*$/gm, (_, levelMarks, headingText) => {
      const level = levelMarks.length; // 2, 3, or 4
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

      if (level === 2) {
        return `<h2 id="${slugId}" class="group text-xl font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1.5 mt-8 mb-3 flex items-center justify-between"><span>${cleanTitle}</span><a href="#${slugId}" class="opacity-0 group-hover:opacity-100 text-xs text-slate-400 hover:text-blue-500 ml-2">#</a></h2>`;
      } else if (level === 3) {
        return `<h3 id="${slugId}" class="text-lg font-medium text-slate-900 dark:text-slate-100 mt-6 mb-2">${cleanTitle}</h3>`;
      } else {
        return `<h4 id="${slugId}" class="text-base font-medium text-slate-800 dark:text-slate-200 mt-4 mb-2">${cleanTitle}</h4>`;
      }
    });

    // 6. Bold & Italics
    processed = processed
      .replace(/'''''([^']+)'''''/g, '<strong><em>$1</em></strong>')
      .replace(/'''([^']+)'''/g, '<strong>$1</strong>')
      .replace(/''([^']+)''/g, '<em>$1</em>');

    // 7. Internal Links: [[Target|Text]] or [[Target]]
    processed = processed.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
      const linkTarget = target.trim();
      const displayLabel = (label || target).trim();
      internalLinks.push(linkTarget);
      ast.push({ type: 'InternalLink', target: linkTarget, label: displayLabel });

      // If user link
      if (linkTarget.startsWith('User:')) {
        return `<a href="#/user/${encodeURIComponent(linkTarget.replace('User:', ''))}" class="wiki-link text-blue-700 dark:text-blue-400 hover:underline font-medium">${displayLabel}</a>`;
      }
      return `<a href="#/wiki/${encodeURIComponent(linkTarget.replace(/ /g, '_'))}" class="wiki-link text-blue-700 dark:text-blue-400 hover:underline font-medium">${displayLabel}</a>`;
    });

    // 8. External Links: [http://... Anchor text]
    processed = processed.replace(/\[(https?:\/\/[^\s]+)\s+([^\]]+)\]/g, (_, url, text) => {
      externalLinks.push(url);
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="external-link text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5">${text} <span class="text-[10px] text-slate-400">↗</span></a>`;
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

    // 11. Code blocks: <syntaxhighlight lang="...">, <source lang="...">, ```lang, <pre>, and inline `code`
    processed = processed.replace(/<(?:syntaxhighlight|source)(?:\s+lang=["']?([a-zA-Z0-9_-]+)["']?)?>([\s\S]*?)<\/(?:syntaxhighlight|source)>/gi, (_, lang, code) => {
      const language = (lang || 'javascript').toLowerCase();
      const cleanCode = code.replace(/^[\r\n]+|[\r\n]+$/g, '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre class="language-${language}"><code class="language-${language}">${cleanCode}</code></pre>`;
    });

    processed = processed.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const language = (lang || 'markup').toLowerCase();
      const cleanCode = code.replace(/^[\r\n]+|[\r\n]+$/g, '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre class="language-${language}"><code class="language-${language}">${cleanCode}</code></pre>`;
    });

    processed = processed.replace(/<pre(?:\s+class=["']?([^"'>]+)["']?)?>([\s\S]*?)<\/pre>/gi, (_, customClass, code) => {
      const langClass = customClass || 'language-none';
      const cleanCode = code.replace(/^[\r\n]+|[\r\n]+$/g, '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre class="${langClass}"><code class="${langClass}">${cleanCode}</code></pre>`;
    });

    processed = processed.replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');

    // 12. Paragraphs & Line Breaks
    const paragraphs = processed.split(/\n{2,}/);
    const htmlBlocks = paragraphs.map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<aside') ||
        trimmed.startsWith('<div') ||
        trimmed.startsWith('<li') ||
        trimmed.startsWith('<table') ||
        trimmed.startsWith('<pre')
      ) {
        return trimmed;
      }
      return `<p class="leading-relaxed text-slate-800 dark:text-slate-300 mb-4 font-serif text-[16px]">${trimmed.replace(/\n/g, '<br/>')}</p>`;
    });

    let finalHtml = htmlBlocks.join('\n');

    // Append references list at the end if references were parsed
    if (references.length > 0 && !finalHtml.includes('id="references"')) {
      let refListHtml = `<div class="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800"><h3 class="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-2">Sources & Citations</h3><ol class="space-y-1 text-xs text-slate-600 dark:text-slate-400">`;
      references.forEach((ref, idx) => {
        const num = idx + 1;
        refListHtml += `<li id="cite_note-${num}" class="flex items-start gap-2"><span class="text-slate-400 select-none">${num}.</span><span>${ref}</span></li>`;
      });
      refListHtml += `</ol></div>`;
      finalHtml += refListHtml;
    }

    const parseTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      html: finalHtml,
      toc,
      categories,
      internalLinks,
      externalLinks,
      references,
      ast,
      parseTimeMs,
    };
  }

  /**
   * Tokenizes wikitext into grammar nodes for AST visualizer
   */
  public tokenize(wikitext: string) {
    const tokens: Array<{ type: string; start: number; end: number; preview: string }> = [];
    const lines = wikitext.split('\n');
    let offset = 0;

    for (const line of lines) {
      if (line.match(/^={2,4}\s*.+\s*={2,4}$/)) {
        tokens.push({ type: 'HEADING', start: offset, end: offset + line.length, preview: line });
      } else if (line.startsWith('{{Infobox')) {
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

export const parsoidService = new ParsoidService();
