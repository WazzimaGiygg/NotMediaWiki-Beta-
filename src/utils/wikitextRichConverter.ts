export interface FormattedInsertOption {
  id: string;
  label: string;
  description: string;
  category: 'estrutura' | 'alinhamento' | 'listas' | 'blocos';
  wikitextSnippet: string;
}

export const FORMATTED_INSERT_OPTIONS: FormattedInsertOption[] = [
  {
    id: 'section',
    label: 'Seção Formatada (H2)',
    description: 'Título de seção principal seguido de parágrafo justificado.',
    category: 'estrutura',
    wikitextSnippet: '\n\n== Nova Seção ==\nEscreva o conteúdo desta seção aqui.\n',
  },
  {
    id: 'subsection',
    label: 'Subseção Formatada (H3)',
    description: 'Subtítulo hierárquico com parágrafo explicativo.',
    category: 'estrutura',
    wikitextSnippet: '\n\n=== Nova Subseção ===\nDesenvolva os detalhes deste tópico aqui.\n',
  },
  {
    id: 'blockquote',
    label: 'Bloco de Citação Simples',
    description: 'Trecho recuado formatado em citação editorial.',
    category: 'estrutura',
    wikitextSnippet: '\n\n<blockquote>Texto citado em destaque no corpo do artigo.</blockquote>\n',
  },
  {
    id: 'justified-paragraph',
    label: 'Parágrafo Justificado (Padrão)',
    description: 'Parágrafo padrão com alinhamento justificado automático.',
    category: 'alinhamento',
    wikitextSnippet: '\n\nNovo parágrafo com alinhamento justificado automático para leitura enciclopédica.\n',
  },
  {
    id: 'centered-paragraph',
    label: 'Parágrafo Centralizado',
    description: 'Bloco de texto centralizado preservando o alinhamento.',
    category: 'alinhamento',
    wikitextSnippet: '\n\n<p style="text-align: center">Texto centralizado em destaque.</p>\n',
  },
  {
    id: 'right-paragraph',
    label: 'Parágrafo à Direita',
    description: 'Assinatura, data ou nota alinhada à direita.',
    category: 'alinhamento',
    wikitextSnippet: '\n\n<p style="text-align: right">Nota ou assinatura alinhada à direita.</p>\n',
  },
  {
    id: 'bullet-list',
    label: 'Lista com Marcadores',
    description: 'Tópicos organizados com marcadores.',
    category: 'listas',
    wikitextSnippet: '\n\n* Primeiro item formatado\n* Segundo item formatado\n* Terceiro item formatado\n',
  },
  {
    id: 'numbered-list',
    label: 'Lista Numerada',
    description: 'Etapas ou itens em ordem numérica.',
    category: 'listas',
    wikitextSnippet: '\n\n# Primeira etapa\n# Segunda etapa\n# Terceira etapa\n',
  },
  {
    id: 'wikitable',
    label: 'Tabela Formatada',
    description: 'Tabela editável com cabeçalho e linhas formatadas.',
    category: 'blocos',
    wikitextSnippet:
      '\n\n{| class="wikitable"\n! Coluna 1 !! Coluna 2 !! Coluna 3\n|-\n| Dado A1 || Dado A2 || Dado A3\n|-\n| Dado B1 || Dado B2 || Dado B3\n|}\n',
  },
  {
    id: 'notice-box',
    label: 'Caixa de Aviso ({{Aviso}})',
    description: 'Banner informativo formatado no estilo MediaWiki.',
    category: 'blocos',
    wikitextSnippet:
      '\n\n{{Aviso|tipo=info|título=Aviso Editorial|texto=Descreva aqui uma informação importante sobre este artigo.}}\n',
  },
  {
    id: 'note-box',
    label: 'Nota Editorial ({{Nota}})',
    description: 'Quadro de dica ou observação destacada.',
    category: 'blocos',
    wikitextSnippet:
      '\n\n{{Nota|tipo=dica|título=Nota|texto=Informação complementar relevante para o leitor.}}\n',
  },
  {
    id: 'quote-template',
    label: 'Citação com Autor ({{Citação}})',
    description: 'Cartão de citação formatada com atribuição.',
    category: 'blocos',
    wikitextSnippet:
      '\n\n{{Citação|texto=Insira aqui a citação completa.|autor=Autor|fonte=Fonte ou Obra}}\n',
  },
  {
    id: 'code-block',
    label: 'Bloco de Código',
    description: 'Trecho de código com destaque de sintaxe.',
    category: 'blocos',
    wikitextSnippet:
      '\n\n<syntaxhighlight lang="typescript">\n// Exemplo de código\nconst exemplo: string = "NotMediaWiki";\n</syntaxhighlight>\n',
  },
  {
    id: 'reference',
    label: 'Referência (<ref>)',
    description: 'Nota de rodapé bibliográfica numerada.',
    category: 'blocos',
    wikitextSnippet: '<ref>Autor ou Organização (2026). Título da fonte consultada.</ref>',
  },
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const BLOCK_TEMPLATE_NAMES = new Set([
  'infobox',
  'infocaixa',
  'ficha técnica',
  'ficha tecnica',
  'aviso',
  'ambox',
  'esboço',
  'esboco',
  'stub',
  'sem fontes',
  'sem referências',
  'sem referencias',
  'em construção',
  'em construcao',
  'wip',
  'desambiguação',
  'desambiguacao',
  'spoiler',
  'em tradução',
  'em traducao',
  'evento atual',
  'parcial',
  'npov',
  'revisão',
  'revisao',
  'artigo principal',
  'ap',
  'main',
  'veja também',
  'veja tambem',
  'ver também',
  'ver tambem',
  'sem saída',
  'sem saida',
  'citação',
  'citacao',
  'quote',
  'nota',
  'note',
  'destaque',
  'artigo destacado',
  'navbox',
  'portal',
  'referências',
  'referencias',
  'reflist',
]);

function extractTemplateRanges(source: string): Array<{ start: number; end: number; raw: string; isBlock: boolean }> {
  const ranges: Array<{ start: number; end: number; raw: string; isBlock: boolean }> = [];
  let i = 0;

  while (i < source.length) {
    if (source[i] === '{' && source[i + 1] === '{' && source[i + 2] !== '{') {
      let depth = 0;
      let j = i;
      let matchedEnd = -1;

      while (j < source.length) {
        if (source[j] === '{' && source[j + 1] === '{') {
          depth++;
          j += 2;
          continue;
        }
        if (source[j] === '}' && source[j + 1] === '}') {
          depth--;
          j += 2;
          if (depth === 0) {
            matchedEnd = j;
            break;
          }
          continue;
        }
        j++;
      }

      if (matchedEnd !== -1) {
        const raw = source.slice(i, matchedEnd);
        const inner = raw.slice(2, -2).trim();
        const firstWord = inner.split(/[|\n:]/)[0].trim().toLowerCase();
        const beforeChar = i === 0 ? '\n' : source[i - 1];
        const afterChar = matchedEnd >= source.length ? '\n' : source[matchedEnd];
        const standaloneOnLine = (beforeChar === '\n' || beforeChar === '\r') && (afterChar === '\n' || afterChar === '\r');
        const isKnownBlock = BLOCK_TEMPLATE_NAMES.has(firstWord) || firstWord.startsWith('infobox');
        const isBlock = raw.includes('\n') || isKnownBlock || standaloneOnLine;

        ranges.push({ start: i, end: matchedEnd, raw, isBlock });
        i = matchedEnd;
        continue;
      }
    }
    i++;
  }

  return ranges;
}

function buildPreservedBlockHtml(raw: string, label: string, previewText?: string): string {
  const encoded = encodeURIComponent(raw);
  const displayPreview = previewText ? escapeHtml(previewText) : escapeHtml(raw.slice(0, 140));
  return `<div class="wiki-rich-preserved my-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/35 px-3 py-2 text-xs font-sans text-indigo-950 dark:text-indigo-100 select-none" contenteditable="false" data-wikitext-raw="${encoded}"><div class="flex items-center justify-between gap-2"><span class="font-semibold text-[11px] text-indigo-700 dark:text-indigo-300">${escapeHtml(label)}</span><span class="text-[10px] font-mono text-indigo-500/80 dark:text-indigo-400/80">bloco preservado</span></div><div class="mt-0.5 text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate">${displayPreview}</div></div>`;
}

function buildPreservedInlineHtml(raw: string, label: string, titleHint?: string): string {
  const encoded = encodeURIComponent(raw);
  const titleAttr = titleHint ? ` title="${escapeHtml(titleHint)}"` : '';
  return `<span class="wiki-rich-preserved-inline inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono text-[10px] align-baseline select-none" contenteditable="false" data-wikitext-raw="${encoded}"${titleAttr}>${escapeHtml(label)}</span>`;
}

function convertInlineWikitext(line: string): string {
  // Temporarily mask inline preserved placeholders @@WM_INLINE_n@@
  const inlinePlaceholders: string[] = [];
  let text = line.replace(/@@WM_INLINE_(\d+)@@/g, m => {
    inlinePlaceholders.push(m);
    return `@@WMRT_INL_${inlinePlaceholders.length - 1}@@`;
  });

  // Preserve safe inline HTML tags before escaping raw characters
  const safeTags: string[] = [];
  text = text.replace(
    /<(\/?(?:strong|b|em|i|u|code|sup|sub|br)\s*\/?)>/gi,
    (_, inner) => {
      safeTags.push(`<${inner}>`);
      return `@@WMRT_TAG_${safeTags.length - 1}@@`;
    }
  );

  // Escape remaining HTML entities safely
  text = escapeHtml(text);

  // Restore safe inline tags
  text = text.replace(/@@WMRT_TAG_(\d+)@@/g, (_, idx) => safeTags[Number(idx)] || '');

  // Bold + Italic / Bold / Italic
  text = text
    .replace(/'''''([^']+)'''''/g, '<strong><em>$1</em></strong>')
    .replace(/'''([^']+)'''/g, '<strong>$1</strong>')
    .replace(/''([^']+)''/g, '<em>$1</em>');

  // Inline code `...`
  text = text.replace(/`([^`]+)`/g, '<code class="bg-slate-100 dark:bg-slate-800 text-pink-600 dark:text-pink-400 px-1 py-0.5 rounded text-xs font-mono">$1</code>');

  // Internal wiki links [[Target|Label]] or [[Target]]
  text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
    const cleanTarget = unescapeHtml(target).trim();
    const displayLabel = label ? label.trim() : target.trim();
    return `<a href="#/wiki/${encodeURIComponent(cleanTarget.replace(/\s+/g, '_'))}" data-wiki-target="${escapeHtml(cleanTarget)}" class="wiki-link text-blue-700 dark:text-blue-400 underline font-medium">${displayLabel}</a>`;
  });

  // External links [https://... Label] and [https://...]
  text = text.replace(/\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g, (_, rawUrl, label) => {
    const cleanUrl = unescapeHtml(rawUrl).trim();
    return `<a href="${escapeHtml(cleanUrl)}" data-ext-url="${escapeHtml(cleanUrl)}" target="_blank" rel="noopener noreferrer" class="external-link text-blue-600 dark:text-blue-400 underline">${label}</a>`;
  });
  text = text.replace(/\[(https?:\/\/[^\s\]]+)\]/g, (_, rawUrl) => {
    const cleanUrl = unescapeHtml(rawUrl).trim();
    return `<a href="${escapeHtml(cleanUrl)}" data-ext-url="${escapeHtml(cleanUrl)}" target="_blank" rel="noopener noreferrer" class="external-link text-blue-600 dark:text-blue-400 underline">${escapeHtml(cleanUrl)}</a>`;
  });

  // Restore inline placeholder markers
  text = text.replace(/@@WMRT_INL_(\d+)@@/g, (_, idx) => inlinePlaceholders[Number(idx)] || '');

  return text;
}

function parseWikitableToEditableHtml(rawTable: string): string | null {
  // Complex nested wikitables fall back to preserved raw blocks
  const inner = rawTable.slice(2, -2);
  if (inner.includes('{|')) return null;

  const rawRows = inner.split(/\n\|-/);
  let headerHtml = '';
  let bodyHtml = '';

  for (const row of rawRows) {
    const lines = row
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !/^(?:class|style|border|cellpadding|cellspacing)\s*=/i.test(l));
    if (lines.length === 0) continue;

    const cells: Array<{ isHeader: boolean; text: string }> = [];
    for (const line of lines) {
      if (line.startsWith('!')) {
        line
          .substring(1)
          .split('!!')
          .forEach(h => cells.push({ isHeader: true, text: convertInlineWikitext(h.trim()) }));
      } else if (line.startsWith('|')) {
        line
          .substring(1)
          .split('||')
          .forEach(c => cells.push({ isHeader: false, text: convertInlineWikitext(c.trim()) }));
      }
    }

    if (cells.length === 0) continue;
    const allHeaders = cells.every(c => c.isHeader);
    const rowCells = cells
      .map(c =>
        c.isHeader
          ? `<th class="bg-slate-100 dark:bg-slate-800 px-3 py-2 font-semibold text-left border border-slate-300 dark:border-slate-700">${c.text || '<br/>'}</th>`
          : `<td class="px-3 py-2 border border-slate-300 dark:border-slate-700">${c.text || '<br/>'}</td>`
      )
      .join('');
    const rowHtml = `<tr>${rowCells}</tr>`;
    if (allHeaders && !headerHtml && !bodyHtml) {
      headerHtml += rowHtml;
    } else {
      bodyHtml += rowHtml;
    }
  }

  if (!headerHtml && !bodyHtml) return null;
  return `<table class="wikitable w-full border-collapse border border-slate-300 dark:border-slate-700 my-4">${headerHtml ? `<thead>${headerHtml}</thead>` : ''}${bodyHtml ? `<tbody>${bodyHtml}</tbody>` : ''}</table>`;
}

/**
 * Converts MediaWiki Wikitext into interactive HTML suitable for Formatted WYSIWYG editing,
 * while losslessly preserving templates, infoboxes, code blocks, categories, and <ref> tags.
 */
export function wikitextToEditableHtml(wikitext: string): string {
  if (!wikitext || !wikitext.trim()) {
    return '<p><br/></p>';
  }

  const blockTokens: string[] = [];
  const inlineTokens: string[] = [];

  const pushBlock = (html: string): string => {
    const idx = blockTokens.length;
    blockTokens.push(html);
    return `\n\n@@WM_BLOCK_${idx}@@\n\n`;
  };

  const pushInline = (html: string): string => {
    const idx = inlineTokens.length;
    inlineTokens.push(html);
    return `@@WM_INLINE_${idx}@@`;
  };

  let working = wikitext.replace(/\r\n/g, '\n');

  // 1. Preserve <nowiki>...</nowiki>
  working = working.replace(/<nowiki>([\s\S]*?)<\/nowiki>/gi, (full, inner) =>
    pushInline(buildPreservedInlineHtml(full, `nowiki: ${inner.slice(0, 32)}`, full))
  );

  // 2. Preserve code blocks (<syntaxhighlight>, <source>, ```...```, <pre>)
  working = working.replace(
    /<(?:syntaxhighlight|source)(?:\s+lang=["']?([a-zA-Z0-9_-]+)["']?)?>([\s\S]*?)<\/(?:syntaxhighlight|source)>/gi,
    (full, lang, code) =>
      pushBlock(
        buildPreservedBlockHtml(
          full,
          `Bloco de Código (${lang || 'text'})`,
          String(code || '').trim().split('\n')[0] || '(código)'
        )
      )
  );
  working = working.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (full, lang, code) =>
    pushBlock(
      buildPreservedBlockHtml(
        full,
        `Bloco de Código (${lang || 'markup'})`,
        String(code || '').trim().split('\n')[0] || '(código)'
      )
    )
  );
  working = working.replace(/<pre(?:\s+[^>]*)?>([\s\S]*?)<\/pre>/gi, (full, code) =>
    pushBlock(
      buildPreservedBlockHtml(full, 'Bloco <pre>', String(code || '').trim().split('\n')[0] || '(pre)')
    )
  );

  // 3. Preserve <ref> citations inline & <references /> block
  let refCounter = 1;
  working = working.replace(/<ref(?:\s+([^>]*?))?(?:\/>|>([\s\S]*?)<\/ref>)/gi, (full, _attrs, content) => {
    const label = `[ref ${refCounter++}]`;
    return pushInline(buildPreservedInlineHtml(full, label, (content || full).trim()));
  });
  working = working.replace(/<references\s*\/?>/gi, full =>
    pushBlock(buildPreservedBlockHtml(full, 'Lista de Referências (<references />)', '<references />'))
  );

  // 4. Preserve Categories [[Category:...]] / [[Categoria:...]]
  working = working.replace(/\[\[(?:Category|Categoria):([^\]]+)\]\]/gi, (full, catName) =>
    pushBlock(buildPreservedBlockHtml(full, `Categoria: ${catName.trim()}`, full))
  );

  // 5. Convert or preserve Wikitables {| ... |}
  working = working.replace(/\{\|[\s\S]*?\|\}/g, full => {
    const tableHtml = parseWikitableToEditableHtml(full);
    if (tableHtml) {
      return pushBlock(tableHtml);
    }
    return pushBlock(buildPreservedBlockHtml(full, 'Tabela Wikitable', full.split('\n')[0]));
  });

  // 6. Preserve balanced {{...}} templates & Infoboxes
  const tplRanges = extractTemplateRanges(working);
  if (tplRanges.length > 0) {
    let rebuilt = '';
    let cursor = 0;
    for (const range of tplRanges) {
      rebuilt += working.slice(cursor, range.start);
      const inner = range.raw.slice(2, -2).trim();
      const tplName = inner.split(/[|\n:]/)[0].trim() || 'Predefinição';
      if (range.isBlock) {
        const previewLine = inner.replace(/\s+/g, ' ').slice(0, 120);
        rebuilt += pushBlock(buildPreservedBlockHtml(range.raw, `{{${tplName}}}`, previewLine));
      } else {
        rebuilt += pushInline(buildPreservedInlineHtml(range.raw, `{{${tplName}}}`, range.raw));
      }
      cursor = range.end;
    }
    rebuilt += working.slice(cursor);
    working = rebuilt;
  }

  // 7. Preserve explicit alignment blocks (<center>, <p align/style>, <div align/style>, <blockquote>, <hr>)
  working = working.replace(/<center>([\s\S]*?)<\/center>/gi, (_, inner) =>
    pushBlock(`<p style="text-align: center;">${convertInlineWikitext(inner.trim())}</p>`)
  );

  working = working.replace(
    /<(?:p|div)\s+([^>]*?(?:align\s*=|text-align|text-(?:left|center|right|justify))[^>]*)>([\s\S]*?)<\/(?:p|div)>/gi,
    (_, attrs, inner) => {
      let align = '';
      const styleAlign = attrs.match(/text-align\s*:\s*(left|center|right|justify|start|end)/i);
      const attrAlign = attrs.match(/\balign\s*=\s*["']?(left|center|right|justify)["']?/i);
      const classAlign = attrs.match(/\btext-(left|center|right|justify)\b/i);
      align = (styleAlign?.[1] || attrAlign?.[1] || classAlign?.[1] || '').toLowerCase();
      const styleAttr = align && align !== 'justify' ? ` style="text-align: ${align};"` : '';
      return pushBlock(`<p${styleAttr}>${convertInlineWikitext(inner.trim())}</p>`);
    }
  );

  working = working.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, (_, inner) =>
    pushBlock(`<blockquote>${convertInlineWikitext(inner.trim())}</blockquote>`)
  );

  // 8. Parse lines into headings, lists, hr, blockquotes, paragraphs, and restored block tokens
  const lines = working.split('\n');
  const outBlocks: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const joined = paragraphLines.map(l => convertInlineWikitext(l)).join('<br/>');
    outBlocks.push(`<p>${joined}</p>`);
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listType || listItems.length === 0) return;
    const tag = listType;
    outBlocks.push(`<${tag}>${listItems.map(item => `<li>${item}</li>`).join('')}</${tag}>`);
    listType = null;
    listItems = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const blockMatch = trimmed.match(/^@@WM_BLOCK_(\d+)@@$/);
    if (blockMatch) {
      flushParagraph();
      flushList();
      outBlocks.push(blockTokens[Number(blockMatch[1])] || '');
      continue;
    }

    // Horizontal rule
    if (/^(?:----+|<\s*hr\s*\/?>)$/i.test(trimmed)) {
      flushParagraph();
      flushList();
      outBlocks.push('<hr/>');
      continue;
    }

    // Headings == H2 ==, === H3 ===, ==== H4 ====
    const headingMatch = trimmed.match(/^(={2,4})\s*([^=]+?)\s*\1$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      const headingHtml = convertInlineWikitext(headingMatch[2].trim());
      outBlocks.push(`<h${level}>${headingHtml}</h${level}>`);
      continue;
    }

    // Unordered list (* item)
    const ulMatch = trimmed.match(/^\*{1,3}\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(convertInlineWikitext(ulMatch[1].trim()));
      continue;
    }

    // Ordered list (# item)
    const olMatch = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(convertInlineWikitext(olMatch[1].trim()));
      continue;
    }

    // Indented talk / quote (:: text)
    const talkMatch = trimmed.match(/^:{1,4}\s*(.+)$/);
    if (talkMatch) {
      flushParagraph();
      flushList();
      outBlocks.push(`<blockquote>${convertInlineWikitext(talkMatch[1].trim())}</blockquote>`);
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  let html = outBlocks.join('\n');
  // Restore any inline tokens that remained outside lines
  html = html.replace(/@@WM_INLINE_(\d+)@@/g, (_, idx) => inlineTokens[Number(idx)] || '');
  html = html.replace(/@@WM_BLOCK_(\d+)@@/g, (_, idx) => blockTokens[Number(idx)] || '');

  return html.trim() || '<p><br/></p>';
}

interface SimpleDomNode {
  type: 'element' | 'text';
  tag?: string;
  attrs?: Record<string, string>;
  children?: SimpleDomNode[];
  text?: string;
}

function parseAttributesString(rawAttrs: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(rawAttrs)) !== null) {
    const key = match[1].toLowerCase();
    const val = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[key] = unescapeHtml(val);
  }
  return attrs;
}

function parseHtmlToSimpleAst(html: string): SimpleDomNode {
  const root: SimpleDomNode = { type: 'element', tag: 'root', attrs: {}, children: [] };
  const stack: SimpleDomNode[] = [root];
  const voidTags = new Set(['br', 'hr', 'img', 'input']);
  const tokenRegex = /(<\/?[a-zA-Z0-9]+(?:\s+[^>]*)?\s*\/?>)|([^<]+)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(html)) !== null) {
    if (match[2] !== undefined) {
      const parent = stack[stack.length - 1];
      parent.children!.push({ type: 'text', text: unescapeHtml(match[2]) });
      continue;
    }

    const rawTag = match[1];
    if (rawTag.startsWith('</')) {
      const tagName = rawTag.slice(2, -1).trim().toLowerCase();
      for (let k = stack.length - 1; k >= 1; k--) {
        if (stack[k].tag === tagName) {
          stack.length = k;
          break;
        }
      }
      continue;
    }

    const openMatch = rawTag.match(/^<([a-zA-Z0-9]+)([\s\S]*?)(\/?)>$/);
    if (!openMatch) continue;
    const tagName = openMatch[1].toLowerCase();
    const attrs = parseAttributesString(openMatch[2] || '');
    const selfClosing = Boolean(openMatch[3]) || voidTags.has(tagName);
    const node: SimpleDomNode = { type: 'element', tag: tagName, attrs, children: [] };
    stack[stack.length - 1].children!.push(node);

    if (!selfClosing) {
      stack.push(node);
    }
  }

  return root;
}

function domElementToSimpleAst(el: Node): SimpleDomNode | null {
  if (el.nodeType === 3) {
    return { type: 'text', text: el.textContent || '' };
  }
  if (el.nodeType !== 1) return null;
  const element = el as Element;
  const attrs: Record<string, string> = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    attrs[attr.name.toLowerCase()] = attr.value;
  }
  const children: SimpleDomNode[] = [];
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = domElementToSimpleAst(element.childNodes[i]);
    if (child) children.push(child);
  }
  return {
    type: 'element',
    tag: element.tagName.toLowerCase(),
    attrs,
    children,
  };
}

function getExplicitAlign(attrs?: Record<string, string>): 'left' | 'center' | 'right' | 'justify' | null {
  if (!attrs) return null;
  const style = attrs.style || '';
  const styleMatch = style.match(/text-align\s*:\s*(left|center|right|justify|start|end)/i);
  if (styleMatch) {
    const v = styleMatch[1].toLowerCase();
    if (v === 'start') return 'left';
    if (v === 'end') return 'right';
    return v as 'left' | 'center' | 'right' | 'justify';
  }
  const alignAttr = (attrs.align || '').toLowerCase();
  if (alignAttr === 'left' || alignAttr === 'center' || alignAttr === 'right' || alignAttr === 'justify') {
    return alignAttr;
  }
  const cls = attrs.class || '';
  if (/\btext-center\b/.test(cls)) return 'center';
  if (/\btext-right\b/.test(cls)) return 'right';
  if (/\btext-left\b/.test(cls)) return 'left';
  if (/\btext-justify\b/.test(cls)) return 'justify';
  return null;
}

function serializeInlineChildren(children: SimpleDomNode[] = []): string {
  return children.map(serializeInlineNode).join('');
}

function serializeInlineNode(node: SimpleDomNode): string {
  if (node.type === 'text') {
    return node.text || '';
  }

  const tag = node.tag || '';
  const attrs = node.attrs || {};

  if (attrs['data-wikitext-raw'] !== undefined) {
    try {
      return decodeURIComponent(attrs['data-wikitext-raw']);
    } catch {
      return attrs['data-wikitext-raw'];
    }
  }

  if (tag === 'br') return '\n';

  const inner = serializeInlineChildren(node.children);

  if (tag === 'strong' || tag === 'b') {
    if (
      node.children?.length === 1 &&
      node.children[0].type === 'element' &&
      (node.children[0].tag === 'em' || node.children[0].tag === 'i')
    ) {
      const deepInner = serializeInlineChildren(node.children[0].children).trim();
      return deepInner ? `'''''${deepInner}'''''` : '';
    }
    return inner.trim() ? `'''${inner}'''` : '';
  }

  if (tag === 'em' || tag === 'i') {
    return inner.trim() ? `''${inner}''` : '';
  }

  if (tag === 'u') {
    return inner ? `<u>${inner}</u>` : '';
  }

  if (tag === 'code') {
    return inner ? `\`${inner}\`` : '';
  }

  if (tag === 'a') {
    const wikiTarget = attrs['data-wiki-target'];
    const href = attrs.href || '';
    const label = inner.trim();

    if (wikiTarget) {
      return label && label !== wikiTarget ? `[[${wikiTarget}|${label}]]` : `[[${wikiTarget}]]`;
    }
    if (href.startsWith('#/wiki/')) {
      const target = decodeURIComponent(href.replace('#/wiki/', '')).replace(/_/g, ' ');
      return label && label !== target ? `[[${target}|${label}]]` : `[[${target}]]`;
    }
    const extUrl = attrs['data-ext-url'] || href;
    if (/^https?:\/\//i.test(extUrl)) {
      return label && label !== extUrl ? `[${extUrl} ${label}]` : `[${extUrl}]`;
    }
    return label;
  }

  if (tag === 'span' || tag === 'font') {
    const style = attrs.style || '';
    let result = inner;
    if (/font-weight\s*:\s*(?:bold|[6-9]00)/i.test(style) && result.trim()) {
      result = `'''${result}'''`;
    }
    if (/font-style\s*:\s*italic/i.test(style) && result.trim()) {
      result = `''${result}''`;
    }
    return result;
  }

  return inner;
}

function serializeTableNode(tableNode: SimpleDomNode): string {
  const rows: SimpleDomNode[] = [];
  const collectRows = (n: SimpleDomNode) => {
    for (const child of n.children || []) {
      if (child.type !== 'element') continue;
      if (child.tag === 'tr') rows.push(child);
      else if (child.tag === 'thead' || child.tag === 'tbody' || child.tag === 'tfoot') {
        collectRows(child);
      }
    }
  };
  collectRows(tableNode);

  if (rows.length === 0) return '';

  const lines: string[] = ['{| class="wikitable"'];
  rows.forEach((row, idx) => {
    if (idx > 0) lines.push('|-');
    const cells = (row.children || []).filter(
      c => c.type === 'element' && (c.tag === 'th' || c.tag === 'td')
    );
    if (cells.length === 0) return;

    const allHeaders = cells.every(c => c.tag === 'th');
    const cellTexts = cells.map(c =>
      serializeInlineChildren(c.children).replace(/\n+/g, ' ').trim()
    );
    if (allHeaders) {
      lines.push(`! ${cellTexts.join(' !! ')}`);
    } else {
      lines.push(`| ${cellTexts.join(' || ')}`);
    }
  });
  lines.push('|}');
  return lines.join('\n');
}

function serializeListNode(listNode: SimpleDomNode, depth = 1): string[] {
  const markerChar = listNode.tag === 'ol' ? '#' : '*';
  const prefix = markerChar.repeat(Math.min(depth, 3));
  const out: string[] = [];

  for (const child of listNode.children || []) {
    if (child.type !== 'element' || child.tag !== 'li') continue;
    const inlineParts: SimpleDomNode[] = [];
    const nestedLists: SimpleDomNode[] = [];

    for (const liChild of child.children || []) {
      if (liChild.type === 'element' && (liChild.tag === 'ul' || liChild.tag === 'ol')) {
        nestedLists.push(liChild);
      } else {
        inlineParts.push(liChild);
      }
    }

    const lineText = serializeInlineChildren(inlineParts).replace(/\n+/g, ' ').trim();
    if (lineText) {
      out.push(`${prefix} ${lineText}`);
    }
    for (const nested of nestedLists) {
      out.push(...serializeListNode(nested, depth + 1));
    }
  }

  return out;
}

function serializeBlockNodes(nodes: SimpleDomNode[]): string[] {
  const blocks: string[] = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      const txt = (node.text || '').trim();
      if (txt) blocks.push(txt);
      continue;
    }

    const tag = node.tag || '';
    const attrs = node.attrs || {};

    if (attrs['data-wikitext-raw'] !== undefined) {
      try {
        blocks.push(decodeURIComponent(attrs['data-wikitext-raw']));
      } catch {
        blocks.push(attrs['data-wikitext-raw']);
      }
      continue;
    }

    if (tag === 'h1' || tag === 'h2') {
      const content = serializeInlineChildren(node.children).replace(/\n+/g, ' ').trim();
      if (content) blocks.push(`== ${content} ==`);
      continue;
    }
    if (tag === 'h3') {
      const content = serializeInlineChildren(node.children).replace(/\n+/g, ' ').trim();
      if (content) blocks.push(`=== ${content} ===`);
      continue;
    }
    if (tag === 'h4' || tag === 'h5' || tag === 'h6') {
      const content = serializeInlineChildren(node.children).replace(/\n+/g, ' ').trim();
      if (content) blocks.push(`==== ${content} ====`);
      continue;
    }

    if (tag === 'hr') {
      blocks.push('----');
      continue;
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = serializeListNode(node, 1);
      if (items.length > 0) blocks.push(items.join('\n'));
      continue;
    }

    if (tag === 'table') {
      const wt = serializeTableNode(node);
      if (wt) blocks.push(wt);
      continue;
    }

    if (tag === 'blockquote') {
      const inner = serializeInlineChildren(node.children).trim();
      if (inner) blocks.push(`<blockquote>${inner}</blockquote>`);
      continue;
    }

    if (tag === 'pre') {
      const rawText = serializeInlineChildren(node.children).replace(/^\n+|\n+$/g, '');
      if (rawText) {
        blocks.push(`<syntaxhighlight lang="text">\n${rawText}\n</syntaxhighlight>`);
      }
      continue;
    }

    if (tag === 'center') {
      const inner = serializeInlineChildren(node.children).trim();
      if (inner) blocks.push(`<p style="text-align: center">${inner}</p>`);
      continue;
    }

    if (tag === 'p' || tag === 'div') {
      // If div wraps child block elements (lists, headings, tables, nested p), recurse
      const hasBlockChild = (node.children || []).some(
        c =>
          c.type === 'element' &&
          ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'table', 'blockquote', 'hr', 'pre'].includes(
            c.tag || ''
          )
      );
      if (tag === 'div' && hasBlockChild) {
        blocks.push(...serializeBlockNodes(node.children || []));
        continue;
      }

      const text = serializeInlineChildren(node.children).replace(/^\n+|\n+$/g, '').trim();
      if (!text) continue;

      const explicitAlign = getExplicitAlign(attrs);
      if (explicitAlign && explicitAlign !== 'justify') {
        blocks.push(`<p style="text-align: ${explicitAlign}">${text}</p>`);
      } else {
        blocks.push(text);
      }
      continue;
    }

    // Fallback for inline root nodes
    const fallback = serializeInlineNode(node).trim();
    if (fallback) blocks.push(fallback);
  }

  return blocks;
}

/**
 * Converts HTML from the Formatted WYSIWYG Editor back into canonical MediaWiki Wikitext.
 * Works both with a live browser HTMLElement and with raw HTML strings (Node/SSR/Tests).
 */
export function editableHtmlToWikitext(input: string | HTMLElement): string {
  let rootAst: SimpleDomNode | null = null;

  if (typeof input === 'string') {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(`<div>${input}</div>`, 'text/html');
      const wrapper = doc.body.firstElementChild;
      if (wrapper) {
        rootAst = domElementToSimpleAst(wrapper);
      }
    }
    if (!rootAst) {
      rootAst = parseHtmlToSimpleAst(input);
    }
  } else if (input) {
    rootAst = domElementToSimpleAst(input);
  }

  if (!rootAst || !rootAst.children) return '';

  const blocks = serializeBlockNodes(rootAst.children);
  return blocks
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
