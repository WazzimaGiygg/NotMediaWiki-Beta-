import { CitationFootnote, CitationBacklink, ParsoidAstReferenceNode } from '../types';
import { wrapExternalUrl } from './urlHelper';

export type CitationStyle = 'wiki' | 'abnt' | 'apa' | 'bibtex';

export interface StructuredCitationFields {
  type?: 'web' | 'book' | 'journal';
  author?: string;
  title?: string;
  year?: string;
  publisher?: string;
  url?: string;
  accessDate?: string;
  name?: string;
  group?: string;
}

/**
 * Parses MediaWiki citation templates such as {{cite web|...}}, {{citar web|...}},
 * {{cite book|...}}, {{citar livro|...}}, {{cite journal|...}}, {{citar periódico|...}}.
 */
export function parseCitationTemplate(rawText: string): StructuredCitationFields | null {
  if (!rawText) return null;
  const tplMatch = rawText.trim().match(/^\{\{\s*(cite|citar)\s+([^|}]+)([\s\S]*?)\}\}$/i);
  if (!tplMatch) return null;

  const rawType = tplMatch[2].trim().toLowerCase();
  const paramsStr = tplMatch[3] || '';
  const params: Record<string, string> = {};

  paramsStr.split('|').forEach(part => {
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) {
      const key = part.slice(0, eqIdx).trim().toLowerCase();
      const val = part.slice(eqIdx + 1).trim();
      if (key && val) {
        params[key] = val;
      }
    }
  });

  const author =
    params.author ||
    params.autor ||
    params.autores ||
    (params.last && params.first ? `${params.last}, ${params.first}` : params.last) ||
    (params.sobrenome && params.nome ? `${params.sobrenome}, ${params.nome}` : params.sobrenome);

  const title = params.title || params.título || params.titulo;
  const url = params.url || params.link;
  const rawDate = params.year || params.ano || params.date || params.data;
  const yearMatch = rawDate ? rawDate.match(/\b(19\d\d|20\d\d)\b/) : null;
  const year = yearMatch ? yearMatch[1] : rawDate;
  const publisher =
    params.publisher ||
    params.editora ||
    params.website ||
    params.site ||
    params.publicado ||
    params.obra ||
    params.journal ||
    params.periódico;
  const accessDate = params['access-date'] || params.accessdate || params.acessodata;

  let type: 'web' | 'book' | 'journal' = 'web';
  if (rawType.includes('book') || rawType.includes('livro')) type = 'book';
  else if (rawType.includes('journal') || rawType.includes('periódico') || rawType.includes('periodico') || rawType.includes('artigo')) type = 'journal';

  return { type, author, title, year, publisher, url, accessDate };
}

/**
 * Builds clean MediaWiki <ref> markup from structured bibliographic fields.
 */
export function buildRefMarkup(fields: StructuredCitationFields): string {
  const attrs: string[] = [];
  if (fields.name?.trim()) {
    attrs.push(`name="${fields.name.trim().replace(/"/g, '')}"`);
  }
  if (fields.group?.trim()) {
    attrs.push(`group="${fields.group.trim().replace(/"/g, '')}"`);
  }
  const attrStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';

  const templateName =
    fields.type === 'book'
      ? 'citar livro'
      : fields.type === 'journal'
      ? 'citar periódico'
      : 'citar web';

  const parts: string[] = [];
  if (fields.author?.trim()) parts.push(`autor=${fields.author.trim()}`);
  if (fields.title?.trim()) parts.push(`título=${fields.title.trim()}`);
  if (fields.publisher?.trim()) parts.push(`publicado=${fields.publisher.trim()}`);
  if (fields.year?.trim()) parts.push(`data=${fields.year.trim()}`);
  if (fields.url?.trim()) parts.push(`url=${fields.url.trim()}`);
  if (fields.accessDate?.trim()) parts.push(`acessodata=${fields.accessDate.trim()}`);

  const body = parts.length > 0 ? `{{${templateName}|${parts.join('|')}}}` : '';
  return `<ref${attrStr}>${body}</ref>`;
}

/**
 * Parses and extracts metadata (URL, domain, author, year, title) from citation text.
 */
export function parseCitationMetadata(rawText: string): {
  urls: string[];
  primaryUrl?: string;
  domain?: string;
  author?: string;
  year?: string;
  title?: string;
} {
  const tpl = parseCitationTemplate(rawText);
  const urls: string[] = [];
  if (tpl?.url) {
    urls.push(tpl.url);
  }
  const urlRegex = /https?:\/\/[^\s\]"'>|}]+/gi;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(rawText)) !== null) {
    if (!urls.includes(match[0])) {
      urls.push(match[0]);
    }
  }

  const primaryUrl = urls[0];
  let domain: string | undefined;

  if (primaryUrl) {
    try {
      const parsed = new URL(primaryUrl);
      domain = parsed.hostname.replace(/^www\./, '');
    } catch {
      domain = undefined;
    }
  }

  // Extract year e.g. (2025) or 2024
  let year: string | undefined = tpl?.year;
  if (!year) {
    const yearMatch = rawText.match(/\b(19\d\d|20\d\d)\b/);
    if (yearMatch) {
      year = yearMatch[1];
    }
  }

  // Extract author if formatted as: "LastName, FirstName" or "Author Name (Year)"
  let author: string | undefined = tpl?.author;
  if (!author) {
    const authorMatch = rawText.match(/^([A-ZÀ-Ý][a-zA-ZÀ-ÿ\s,.-]+?)(?:\s*\(\d{4}\)|\.|\:)/);
    if (authorMatch && authorMatch[1].length > 2 && authorMatch[1].length < 60) {
      author = authorMatch[1].trim();
    }
  }

  // Extract title if enclosed in quotes: "Title" or “Title”
  let title: string | undefined = tpl?.title;
  if (!title) {
    const titleMatch = rawText.match(/["“]([^"”]+)["”]/);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }
  }

  return { urls, primaryUrl, domain, author, year, title };
}

/**
 * Formats raw citation wikitext/markup into accessible, safe HTML.
 * Handles {{citar web|...}} / {{cite web|...}} templates, external links [https://... Text],
 * bare URLs, internal wiki links [[...]], bold '''...''', and italics ''...''.
 */
export function formatCitationHtml(rawText: string): string {
  if (!rawText) return '';

  const tpl = parseCitationTemplate(rawText);
  if (tpl) {
    const segments: string[] = [];
    if (tpl.author) {
      segments.push(`<span class="font-medium text-slate-900 dark:text-slate-100">${tpl.author}</span>.`);
    }
    if (tpl.title) {
      if (tpl.url) {
        const safe = wrapExternalUrl(tpl.url);
        segments.push(
          `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="citation-external-link text-blue-600 dark:text-blue-400 underline decoration-blue-300 dark:decoration-blue-600 underline-offset-2 inline-flex items-center gap-1 hover:text-blue-800 dark:hover:text-blue-300 font-medium">“${tpl.title}”<span class="text-[10px] text-slate-400 select-none">↗</span></a>.`
        );
      } else {
        segments.push(`<em class="italic text-slate-800 dark:text-slate-200">“${tpl.title}”</em>.`);
      }
    } else if (tpl.url) {
      const safe = wrapExternalUrl(tpl.url);
      segments.push(
        `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="citation-external-link text-blue-600 dark:text-blue-400 underline decoration-blue-300 dark:decoration-blue-600 underline-offset-2 inline-flex items-center gap-1 hover:text-blue-800 dark:hover:text-blue-300">${tpl.url}<span class="text-[10px] text-slate-400 select-none">↗</span></a>.`
      );
    }
    if (tpl.publisher) {
      segments.push(`<span class="italic text-slate-700 dark:text-slate-300">${tpl.publisher}</span>.`);
    }
    if (tpl.year) {
      segments.push(`<span>(${tpl.year})</span>.`);
    }
    if (tpl.accessDate) {
      segments.push(`<span class="text-slate-500 dark:text-slate-400">Acesso em: ${tpl.accessDate}.</span>`);
    }
    if (segments.length > 0) {
      return segments.join(' ');
    }
  }

  let text = rawText.trim();

  // 1. External links with label: [https://example.com Link label]
  text = text.replace(/\[(https?:\/\/[^\s]+)\s+([^\]]+)\]/g, (_, url, label) => {
    const safe = wrapExternalUrl(url);
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="citation-external-link text-blue-600 dark:text-blue-400 underline decoration-blue-300 dark:decoration-blue-600 underline-offset-2 inline-flex items-center gap-1 hover:text-blue-800 dark:hover:text-blue-300">${label}<span class="text-[10px] text-slate-400 select-none">↗</span></a>`;
  });

  // 2. Bare external links in brackets: [https://example.com]
  text = text.replace(/\[(https?:\/\/[^\s\]]+)\]/g, (_, url) => {
    const safe = wrapExternalUrl(url);
    let display = url;
    try {
      const u = new URL(url);
      display = u.hostname.replace(/^www\./, '');
    } catch {
      display = url;
    }
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="citation-external-link text-blue-600 dark:text-blue-400 underline decoration-blue-300 dark:decoration-blue-600 underline-offset-2 inline-flex items-center gap-1 hover:text-blue-800 dark:hover:text-blue-300">${display}<span class="text-[10px] text-slate-400 select-none">↗</span></a>`;
  });

  // 3. Internal wiki links: [[Target|Label]] or [[Target]]
  text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
    const cleanTarget = target.trim();
    const display = (label || target).trim();
    const slug = encodeURIComponent(cleanTarget.replace(/\s+/g, '_'));
    return `<a href="#/wiki/${slug}" class="citation-internal-link text-blue-700 dark:text-blue-400 hover:underline font-medium">${display}</a>`;
  });

  // 4. Bold '''text'''
  text = text.replace(/'''([\s\S]+?)'''/g, '<strong class="font-semibold text-slate-900 dark:text-slate-100">$1</strong>');

  // 5. Italics ''text''
  text = text.replace(/''([\s\S]+?)''/g, '<em class="italic text-slate-800 dark:text-slate-200">$1</em>');

  // 6. Bare URLs without brackets: https://...
  text = text.replace(/(^|[^"'>])(https?:\/\/[^\s<\]]+)/g, (match, prefix, url) => {
    // If it's already inside an <a> tag href, don't re-wrap
    if (prefix.includes('href=')) return match;
    const safe = wrapExternalUrl(url);
    let display = url;
    try {
      const u = new URL(url);
      display = u.hostname.replace(/^www\./, '');
    } catch {
      display = url;
    }
    return `${prefix}<a href="${safe}" target="_blank" rel="noopener noreferrer" class="citation-external-link text-blue-600 dark:text-blue-400 underline decoration-blue-300 dark:decoration-blue-600 underline-offset-2 inline-flex items-center gap-1 hover:text-blue-800 dark:hover:text-blue-300">${display}<span class="text-[10px] text-slate-400 select-none">↗</span></a>`;
  });

  return text;
}

/**
 * Extracts and maps <ref> tags from Parsoid AST into structured CitationFootnote objects.
 * Handles named references, multiple occurrences (backlinks: ^ a b c), groups, and formatting.
 *
 * @param ast Parsoid Abstract Syntax Tree nodes array
 * @param wikitext Optional fallback wikitext to extract references if AST is missing or empty
 * @param references Optional array of raw reference strings
 */
export function extractCitationsFromAst(
  ast?: any[] | null,
  wikitext?: string,
  references?: string[]
): CitationFootnote[] {
  // If AST has Reference nodes, use them
  const refNodes: ParsoidAstReferenceNode[] = [];

  if (Array.isArray(ast)) {
    for (const node of ast) {
      if (node && node.type === 'Reference') {
        refNodes.push(node as ParsoidAstReferenceNode);
      }
    }
  }

  // Fallback 1: If AST is empty or didn't contain Reference nodes, parse from wikitext
  if (refNodes.length === 0 && wikitext) {
    const parsedFromWikitext = extractCitationsFromWikitext(wikitext);
    if (parsedFromWikitext.citations.length > 0) {
      return parsedFromWikitext.citations;
    }
  }

  // Fallback 2: If references array is provided
  if (refNodes.length === 0 && Array.isArray(references) && references.length > 0) {
    references.forEach((refText, i) => {
      const idx = i + 1;
      refNodes.push({
        type: 'Reference',
        index: idx,
        text: refText,
        refId: `cite_ref-${idx}`,
        noteId: `cite_note-${idx}`,
        occurrence: 0,
      });
    });
  }

  if (refNodes.length === 0) {
    return [];
  }

  // Group references by index (or name) to consolidate multiple occurrences
  const groupedByIndex = new Map<number, {
    index: number;
    name?: string;
    group?: string;
    text: string;
    noteId: string;
    backlinkIds: string[];
  }>();

  for (const node of refNodes) {
    const existing = groupedByIndex.get(node.index);
    const refAnchorId = node.refId || (node.occurrence ? `cite_ref-${node.index}_${node.occurrence}` : `cite_ref-${node.index}`);

    if (existing) {
      // Reused named reference: register additional backlink
      if (!existing.text && node.text) {
        existing.text = node.text;
      }
      if (!existing.name && node.name) {
        existing.name = node.name;
      }
      if (!existing.backlinkIds.includes(refAnchorId)) {
        existing.backlinkIds.push(refAnchorId);
      }
    } else {
      groupedByIndex.set(node.index, {
        index: node.index,
        name: node.name,
        group: node.group,
        text: node.text || '',
        noteId: node.noteId || `cite_note-${node.index}`,
        backlinkIds: [refAnchorId],
      });
    }
  }

  // Convert grouped items to CitationFootnote array
  const footnotes: CitationFootnote[] = [];

  // Sort by index ascending
  const sortedEntries = Array.from(groupedByIndex.values()).sort((a, b) => a.index - b.index);

  for (const entry of sortedEntries) {
    const { urls, primaryUrl, domain, author, year, title } = parseCitationMetadata(entry.text);
    const formattedHtml = formatCitationHtml(entry.text);

    // Build backlinks
    const backlinks: CitationBacklink[] = [];
    if (entry.backlinkIds.length <= 1) {
      backlinks.push({
        id: entry.backlinkIds[0] || `cite_ref-${entry.index}`,
        label: '↑',
        title: 'Voltar para o texto onde a citação é mencionada',
      });
    } else {
      // Multiple occurrences: Wikipedia standard label letters (a, b, c...)
      entry.backlinkIds.forEach((backlinkId, idx) => {
        const letter = String.fromCharCode(97 + idx); // 'a', 'b', 'c'
        backlinks.push({
          id: backlinkId,
          label: letter,
          title: `Voltar para a citação ${entry.index}.${letter} no texto`,
        });
      });
    }

    footnotes.push({
      index: entry.index,
      name: entry.name,
      group: entry.group,
      rawText: entry.text,
      formattedHtml,
      noteId: entry.noteId,
      backlinks,
      urls,
      primaryUrl,
      domain,
      author,
      year,
      title,
    });
  }

  return footnotes;
}

/**
 * Directly extracts <ref> tags from wikitext markup, returning both the AST nodes and CitationFootnote list.
 * Supports:
 *  - Standard pair: <ref>Citation body</ref>
 *  - Named reference: <ref name="source1">Citation body</ref>
 *  - Self-closing reuse: <ref name="source1" /> or <ref name="source1"/>
 *  - Grouping: <ref group="notes">Footnote</ref>
 */
export function extractCitationsFromWikitext(wikitext: string): {
  ast: ParsoidAstReferenceNode[];
  citations: CitationFootnote[];
  transformedWikitext: string;
} {
  const ast: ParsoidAstReferenceNode[] = [];
  const namedRefs = new Map<string, { index: number; text: string; group?: string; count: number }>();
  let refCounter = 1;

  // Regex matches both <ref attrs>content</ref> and self-closing <ref attrs />
  const refRegex = /<ref(?:\s+([^>]*?))?(?:\/>|>([\s\S]*?)<\/ref>)/gi;

  const transformedWikitext = wikitext.replace(refRegex, (_, rawAttrs, content) => {
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

    const trimmedContent = content ? content.trim() : '';
    let refIdx: number;
    let refText: string;
    let occurrence = 0;

    if (name && namedRefs.has(name)) {
      const existing = namedRefs.get(name)!;
      refIdx = existing.index;
      refText = existing.text || trimmedContent;
      if (!existing.text && trimmedContent) {
        existing.text = trimmedContent;
      }
      existing.count += 1;
      occurrence = existing.count;
    } else {
      refIdx = refCounter++;
      refText = trimmedContent;
      if (name) {
        namedRefs.set(name, { index: refIdx, text: trimmedContent, group, count: 0 });
      }
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

  const citations = extractCitationsFromAst(ast);

  return {
    ast,
    citations,
    transformedWikitext,
  };
}

/**
 * Strips MediaWiki markup from raw citation text for plain-text bibliographic exports.
 */
export function stripCitationMarkup(rawText: string): string {
  const tpl = parseCitationTemplate(rawText);
  if (tpl) {
    return [tpl.author, tpl.title, tpl.publisher, tpl.year ? `(${tpl.year})` : undefined, tpl.url]
      .filter(Boolean)
      .join('. ')
      .replace(/\.\./g, '.')
      .trim();
  }

  return rawText
    .replace(/\[https?:\/\/[^\s]+\s+([^\]]+)\]/g, '$1')
    .replace(/\[(https?:\/\/[^\s\]]+)\]/g, '$1')
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .trim();
}

/**
 * Formats citation according to ABNT NBR 6023 style.
 */
export function formatCitationAsAbnt(citation: CitationFootnote): string {
  const tpl = parseCitationTemplate(citation.rawText);
  const authorRaw = citation.author || tpl?.author;
  const authorAbnt = authorRaw ? `${authorRaw.toUpperCase()}. ` : '';
  const title = citation.title || tpl?.title || stripCitationMarkup(citation.rawText);
  const publisher = tpl?.publisher ? `${tpl.publisher}, ` : '';
  const year = citation.year || tpl?.year ? `${citation.year || tpl?.year}.` : 's.d.';
  const urlPart = citation.primaryUrl ? ` Disponível em: <${citation.primaryUrl}>.` : '';
  return `${authorAbnt}${title}. ${publisher}${year}${urlPart}`.replace(/\.\./g, '.').trim();
}

/**
 * Formats citation according to APA 7th edition style.
 */
export function formatCitationAsApa(citation: CitationFootnote): string {
  const tpl = parseCitationTemplate(citation.rawText);
  const author = citation.author || tpl?.author || citation.domain || 'NotMediaWiki';
  const year = citation.year || tpl?.year || 'n.d.';
  const title = citation.title || tpl?.title || stripCitationMarkup(citation.rawText);
  const publisher = tpl?.publisher ? ` ${tpl.publisher}.` : '';
  const urlPart = citation.primaryUrl ? ` ${citation.primaryUrl}` : '';
  return `${author} (${year}). ${title}.${publisher}${urlPart}`.replace(/\.\./g, '.').trim();
}

/**
 * Formats citation into BibTeX format for academic citation exports.
 */
export function formatCitationAsBibtex(citation: CitationFootnote): string {
  const tpl = parseCitationTemplate(citation.rawText);
  const key = (citation.name || `ref${citation.index}`).replace(/[^a-zA-Z0-9]/g, '');
  const title = citation.title || tpl?.title || stripCitationMarkup(citation.rawText).slice(0, 80).trim();
  const year = citation.year || tpl?.year || new Date().getFullYear().toString();
  const author = citation.author || tpl?.author || 'Wiki Contributor';
  const publisher = tpl?.publisher ? `,\n  publisher = {${tpl.publisher}}` : '';
  const url = citation.primaryUrl ? `,\n  url = {${citation.primaryUrl}}` : '';

  return `@misc{${key},\n  author = {${author}},\n  title = {${title}},\n  year = {${year}}${publisher}${url}\n}`;
}

/**
 * Formats a citation string according to the chosen bibliographic style.
 */
export function formatCitationByStyle(citation: CitationFootnote, style: CitationStyle): string {
  if (style === 'abnt') return formatCitationAsAbnt(citation);
  if (style === 'apa') return formatCitationAsApa(citation);
  if (style === 'bibtex') return formatCitationAsBibtex(citation);
  return `[${citation.index}] ${stripCitationMarkup(citation.rawText)}`;
}

/**
 * Exports all citations from an article as a complete BibTeX (.bib) file string.
 */
export function exportCitationsAsBibtex(citations: CitationFootnote[], articleTitle?: string): string {
  const header = articleTitle
    ? `% Referências bibliográficas — ${articleTitle} (NotMediaWiki)\n% Gerado automaticamente a partir das tags <ref>\n\n`
    : `% Referências bibliográficas — NotMediaWiki\n\n`;
  return header + citations.map(c => formatCitationAsBibtex(c)).join('\n\n') + '\n';
}

/**
 * Helper to copy citation text to user clipboard in the selected bibliographic style.
 */
export async function copyCitationToClipboard(
  citation: CitationFootnote,
  style: CitationStyle = 'wiki'
): Promise<boolean> {
  const formatted = formatCitationByStyle(citation, style);

  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(formatted);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Parses and replaces any raw inline <ref>...</ref> tags inside HTML into clickable superscript links.
 */
export function parseFootnoteTagsInHtml(html: string): {
  html: string;
  foundRefs: ParsoidAstReferenceNode[];
} {
  if (!html || !/<ref[\s>]/i.test(html)) {
    return { html, foundRefs: [] };
  }

  const foundRefs: ParsoidAstReferenceNode[] = [];
  const namedRefs = new Map<string, { index: number; text: string; group?: string; count: number }>();
  let refCounter = 1;

  const refRegex = /<ref(?:\s+([^>]*?))?(?:\/>|>([\s\S]*?)<\/ref>)/gi;

  const transformedHtml = html.replace(refRegex, (_, rawAttrs, content) => {
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

    const trimmedContent = content ? content.trim() : '';
    let refIdx: number;
    let refText: string;
    let occurrence = 0;

    if (name && namedRefs.has(name)) {
      const existing = namedRefs.get(name)!;
      refIdx = existing.index;
      refText = existing.text || trimmedContent;
      if (!existing.text && trimmedContent) {
        existing.text = trimmedContent;
      }
      existing.count += 1;
      occurrence = existing.count;
    } else {
      refIdx = refCounter++;
      refText = trimmedContent;
      if (name) {
        namedRefs.set(name, { index: refIdx, text: trimmedContent, group, count: 0 });
      }
    }

    const refAnchorId = occurrence === 0 ? `cite_ref-${refIdx}` : `cite_ref-${refIdx}_${occurrence}`;
    const noteAnchorId = `cite_note-${refIdx}`;

    foundRefs.push({
      type: 'Reference',
      index: refIdx,
      name,
      group,
      text: refText,
      refId: refAnchorId,
      noteId: noteAnchorId,
      occurrence,
    });

    return `<sup class="reference" id="${refAnchorId}"><a href="#${noteAnchorId}" class="cite-ref-link text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs font-semibold px-0.5 cursor-pointer" data-ref-index="${refIdx}" title="Ver nota de rodapé [${refIdx}]">[${refIdx}]</a></sup>`;
  });

  return { html: transformedHtml, foundRefs };
}
