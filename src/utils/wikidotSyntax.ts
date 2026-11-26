function escapeHtmlAttr(value: string): string {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlText(value: string): string {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeSafeClasses(rawClass: string): string {
  return (rawClass || '')
    .split(/\s+/)
    .map(c => c.replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter(Boolean)
    .join(' ');
}

function parseWikidotAttrs(rawAttrs: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))/g;
  let m: RegExpExecArray | null;
  while ((m = attrRegex.exec(rawAttrs || '')) !== null) {
    const key = m[1].toLowerCase();
    const val = m[2] ?? m[3] ?? m[4] ?? '';
    attrs[key] = val;
  }
  return attrs;
}

function compactHtml(html: string): string {
  return html
    .replace(/>\s+</g, '><')
    .replace(/\r?\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatWikidotBody(rawBody: string): string {
  return rawBody
    .trim()
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n+/g, '<br/>');
}

/**
 * Protects <nowiki>, <syntaxhighlight>, <source>, <pre>, and inline `code` spans
 * so documentation examples of Wikidot syntax remain literal.
 */
function withProtectedCodeSpans(
  input: string,
  transform: (safeText: string) => string
): string {
  const protectedBlocks: string[] = [];
  let source = input || '';

  const protect = (pattern: RegExp) => {
    source = source.replace(pattern, match => {
      const idx = protectedBlocks.length;
      protectedBlocks.push(match);
      return `@@WIKIDOT_PROTECTED_${idx}@@`;
    });
  };

  protect(/<nowiki>[\s\S]*?<\/nowiki>/gi);
  protect(/<(?:syntaxhighlight|source)(?:\s+[^>]*)?>[\s\S]*?<\/(?:syntaxhighlight|source)>/gi);
  protect(/<pre(?:\s+[^>]*)?>[\s\S]*?<\/pre>/gi);
  protect(/```[\s\S]*?```/g);
  protect(/`[^`\n]+`/g);

  const transformed = transform(source);

  return transformed.replace(/@@WIKIDOT_PROTECTED_(\d+)@@/g, (_, idxStr) => {
    return protectedBlocks[Number(idxStr)] ?? '';
  });
}

/**
 * Converts Wikidot [[footnote]]...[[/footnote]] tags to MediaWiki <ref>...</ref>
 * prior to Parsoid citation extraction.
 */
export function convertWikidotFootnotes(wikitext: string): string {
  if (!wikitext || !wikitext.includes('[[footnote')) return wikitext;
  return withProtectedCodeSpans(wikitext, text =>
    text.replace(/\[\[footnote\]\]([\s\S]*?)\[\[\/footnote\]\]/gi, (_, body) => {
      return `<ref>${body.trim()}</ref>`;
    })
  );
}

/**
 * Expands common Wikidot markup blocks and modules into clean semantic HTML5:
 * - [[note]]...[[/note]] & [[callout ...]]...[[/callout]]
 * - [[collapsible show="..." hide="..."]]...[[/collapsible]]
 * - [[tabview]][[tab Title]]...[[/tab]][[/tabview]]
 * - [[quote]]...[[/quote]]
 * - [[code type="..."]]...[[/code]]
 * - [[div class="infobox|navbox|warning|..."]]...[[/div]]
 * - [[module Rate]], [[module ListPages ...]], [[toc]], [[size ...]], [[span ...]]
 */
export function expandWikidotSyntax(wikitext: string): string {
  if (!wikitext || !wikitext.includes('[[')) return wikitext;

  return withProtectedCodeSpans(wikitext, text => {
    let out = text;

    // 1. [[code type="..."]]...[[/code]] (transform first and protect inner text)
    const codePlaceholders: string[] = [];
    out = out.replace(/\[\[code(?:\s+([^\]]*))?\]\]([\s\S]*?)\[\[\/code\]\]/gi, (_, rawAttrs, body) => {
      const attrs = parseWikidotAttrs(rawAttrs || '');
      const lang = (attrs.type || attrs.lang || 'markup').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'markup';
      const cleanCode = body.replace(/^[\r\n]+|[\r\n]+$/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const idx = codePlaceholders.length;
      codePlaceholders.push(`<pre class="language-${lang}" data-wikidot="code"><code class="language-${lang}">${cleanCode}</code></pre>`);
      return `@@WIKIDOT_CODE_${idx}@@`;
    });

    // 2. [[toc]] or [[toc title="..."]]
    out = out.replace(/\[\[toc(?:\s+([^\]]*))?\]\]/gi, (_, rawAttrs) => {
      const attrs = parseWikidotAttrs(rawAttrs || '');
      const title = attrs.title || 'Índice de Seções (TOC)';
      return compactHtml(
        `<div class="wiki-wikidot-toc not-prose my-3 px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-xs font-sans text-slate-700 dark:text-slate-300" data-wikidot="toc">
          <strong class="font-semibold">${escapeHtmlText(title)}</strong> <span class="text-slate-500 dark:text-slate-400">· Sincronizado com os títulos desta página</span>
        </div>`
      );
    });

    // 3. [[note]]...[[/note]]
    out = out.replace(/\[\[note\]\]([\s\S]*?)\[\[\/note\]\]/gi, (_, body) => {
      return compactHtml(
        `<div class="wiki-wikidot-note not-prose my-4 rounded-lg border border-amber-300 dark:border-amber-800/80 bg-amber-50/85 dark:bg-amber-950/35 p-4 text-xs text-amber-950 dark:text-amber-100 font-sans flex items-start gap-3" role="note" data-wikidot="note">
          <span class="shrink-0 w-7 h-7 rounded-md border border-amber-200 dark:border-amber-800 bg-white/90 dark:bg-amber-900/40 flex items-center justify-center font-bold text-amber-700 dark:text-amber-300" aria-hidden="true">✎</span>
          <div class="leading-relaxed min-w-0 flex-1">${formatWikidotBody(body)}</div>
        </div>`
      );
    });

    // 4. [[callout type="..." title="..."]]...[[/callout]]
    out = out.replace(/\[\[callout(?:\s+([^\]]*))?\]\]([\s\S]*?)\[\[\/callout\]\]/gi, (_, rawAttrs, body) => {
      const attrs = parseWikidotAttrs(rawAttrs || '');
      const type = (attrs.type || 'info').toLowerCase();
      const title = attrs.title || (type === 'warning' ? 'Aviso' : type === 'danger' || type === 'error' ? 'Alerta Crítico' : type === 'success' ? 'Concluído' : 'Informação');

      let toneClass = 'border-sky-200 dark:border-sky-800/80 bg-sky-50/85 dark:bg-sky-950/35 text-sky-950 dark:text-sky-100';
      let icon = 'ℹ';
      if (type === 'warning' || type === 'aviso') {
        toneClass = 'border-amber-300 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/35 text-amber-950 dark:text-amber-100';
        icon = '⚠';
      } else if (type === 'danger' || type === 'error' || type === 'erro') {
        toneClass = 'border-rose-300 dark:border-rose-800/80 bg-rose-50/90 dark:bg-rose-950/35 text-rose-950 dark:text-rose-100';
        icon = '✕';
      } else if (type === 'success' || type === 'ok' || type === 'sucesso') {
        toneClass = 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/90 dark:bg-emerald-950/35 text-emerald-950 dark:text-emerald-100';
        icon = '✓';
      }

      return compactHtml(
        `<div class="wiki-wikidot-callout not-prose my-4 rounded-lg border p-4 text-xs font-sans flex items-start gap-3 ${toneClass}" role="note" data-wikidot="callout">
          <span class="shrink-0 w-7 h-7 rounded-md border border-current/20 bg-white/85 dark:bg-slate-900/40 flex items-center justify-center font-bold" aria-hidden="true">${icon}</span>
          <div class="min-w-0 flex-1 leading-relaxed">
            <div class="font-bold mb-0.5">${escapeHtmlText(title)}</div>
            <div class="opacity-90">${formatWikidotBody(body)}</div>
          </div>
        </div>`
      );
    });

    // 5. [[quote]] or [[quote author="..." source="..."]]...[[/quote]]
    out = out.replace(/\[\[quote(?:\s+([^\]]*))?\]\]([\s\S]*?)\[\[\/quote\]\]/gi, (_, rawAttrs, body) => {
      const attrs = parseWikidotAttrs(rawAttrs || '');
      const author = attrs.author ? `<strong>${escapeHtmlText(attrs.author)}</strong>` : '';
      const source = attrs.source ? `<em>${escapeHtmlText(attrs.source)}</em>` : '';
      const attrLine = [author, source].filter(Boolean).join(', ');
      return compactHtml(
        `<blockquote class="wiki-wikidot-quote my-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/70 px-5 py-3.5 text-sm font-serif italic text-slate-800 dark:text-slate-200" data-wikidot="quote">
          <div>${formatWikidotBody(body)}</div>
          ${attrLine ? `<footer class="mt-2 text-xs font-sans not-italic text-slate-500 dark:text-slate-400">— ${attrLine}</footer>` : ''}
        </blockquote>`
      );
    });

    // 6. [[collapsible show="..." hide="..."]]...[[/collapsible]]
    out = out.replace(/\[\[collapsible(?:\s+([^\]]*))?\]\]([\s\S]*?)\[\[\/collapsible\]\]/gi, (_, rawAttrs, body) => {
      const attrs = parseWikidotAttrs(rawAttrs || '');
      const showLabel = attrs.show || '+ Mostrar conteúdo';
      return compactHtml(
        `<details class="wiki-wikidot-collapsible not-prose my-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-900/65 font-sans text-xs overflow-hidden" data-wikidot="collapsible">
          <summary class="px-3.5 py-2 font-semibold text-blue-700 dark:text-blue-400 bg-slate-100/90 dark:bg-slate-800/80 cursor-pointer select-none hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors">${escapeHtmlText(showLabel)}</summary>
          <div class="p-3.5 text-slate-700 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-800">${body.trim().replace(/\n+/g, '<br/>')}</div>
        </details>`
      );
    });

    // 7. [[tabview]][[tab Title]]...[[/tab]][[/tabview]]
    out = out.replace(/\[\[tabview\]\]([\s\S]*?)\[\[\/tabview\]\]/gi, (_, inner) => {
      const tabs: Array<{ title: string; content: string }> = [];
      const tabRegex = /\[\[tab(?:\s+([^\]]*))?\]\]([\s\S]*?)\[\[\/tab\]\]/gi;
      let m: RegExpExecArray | null;
      while ((m = tabRegex.exec(inner)) !== null) {
        const rawTitle = (m[1] || `Aba ${tabs.length + 1}`).replace(/^title\s*=\s*/i, '').replace(/^["']|["']$/g, '').trim();
        tabs.push({ title: rawTitle || `Aba ${tabs.length + 1}`, content: m[2].trim() });
      }
      if (tabs.length === 0) {
        return `<div class="wiki-wikidot-tabview not-prose my-4 rounded-lg border border-slate-200 dark:border-slate-800 p-4 text-xs font-sans" data-wikidot="tabview">${inner.trim()}</div>`;
      }
      const sectionsHtml = tabs
        .map(
          (t, idx) =>
            `<details ${idx === 0 ? 'open' : ''} class="border-b border-slate-200 dark:border-slate-800 last:border-0">
              <summary class="px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-800/80 cursor-pointer select-none hover:bg-slate-200/70 dark:hover:bg-slate-700/70">${escapeHtmlText(t.title)}</summary>
              <div class="p-3.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900/60">${t.content.replace(/\n+/g, '<br/>')}</div>
            </details>`
        )
        .join('');
      return compactHtml(
        `<div class="wiki-wikidot-tabview not-prose my-4 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden font-sans" data-wikidot="tabview">
          ${sectionsHtml}
        </div>`
      );
    });

    // 8. [[div class="..."]]...[[/div]] (supports infobox, navbox, warning, or generic structural containers; handles nesting inside-out)
    for (let pass = 0; pass < 3; pass++) {
      const prev = out;
      out = out.replace(/\[\[div(?:\s+([^\]]*))?\]\]((?:(?!\[\[div\b)[\s\S])*?)\[\[\/div\]\]/gi, (_, rawAttrs, body) => {
        const attrs = parseWikidotAttrs(rawAttrs || '');
        const safeCls = sanitizeSafeClasses(attrs.class || '');
        const lowerCls = safeCls.toLowerCase();

        if (lowerCls.includes('infobox')) {
          return compactHtml(
            `<aside class="wiki-wikidot-div infobox float-right clear-right ml-6 mb-4 w-72 md:w-80 border border-slate-200 dark:border-slate-800 bg-slate-50/85 dark:bg-slate-900/80 rounded-lg p-4 text-xs shadow-xs font-sans ${safeCls}" data-wikidot="div-infobox">
              ${formatWikidotBody(body)}
            </aside>`
          );
        }
        if (lowerCls.includes('navbox')) {
          return compactHtml(
            `<div class="wiki-wikidot-div wiki-template-navbox my-5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/85 dark:bg-slate-900/75 p-3.5 text-xs font-sans ${safeCls}" role="navigation" data-wikidot="div-navbox">
              ${formatWikidotBody(body)}
            </div>`
          );
        }
        if (lowerCls.includes('warning') || lowerCls.includes('alert')) {
          return compactHtml(
            `<div class="wiki-wikidot-div not-prose my-4 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/35 p-4 text-xs text-amber-950 dark:text-amber-100 font-sans ${safeCls}" role="note" data-wikidot="div-alert">
              ${formatWikidotBody(body)}
            </div>`
          );
        }
        return compactHtml(
          `<div class="wiki-wikidot-div not-prose my-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 p-3.5 text-xs text-slate-700 dark:text-slate-300 font-sans ${safeCls}" data-wikidot="div">
            ${formatWikidotBody(body)}
          </div>`
        );
      });
      if (out === prev) break;
    }

    // 9. [[module ...]] common Wikidot modules
    out = out.replace(/\[\[module\s+([a-zA-Z0-9_-]+)(?:\s+([^\]]*))?\]\]/gi, (_, modName, rawArgs) => {
      const modLower = modName.toLowerCase();
      if (modLower === 'rate') {
        const attrs = parseWikidotAttrs(rawArgs || '');
        const label = attrs.label || 'Avaliação da comunidade';
        return compactHtml(
          `<div class="wiki-wikidot-module not-prose my-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 text-xs font-sans text-slate-700 dark:text-slate-200" data-wikidot="module-rate">
            <span class="font-semibold">${escapeHtmlText(label)}</span>
            <span class="font-mono text-emerald-700 dark:text-emerald-400 font-bold">+1 / -1</span>
          </div>`
        );
      }
      if (modLower === 'listpages') {
        const attrs = parseWikidotAttrs(rawArgs || '');
        const scope = attrs.category || attrs.tags || 'todos os verbetes';
        return compactHtml(
          `<div class="wiki-wikidot-module not-prose my-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-3.5 text-xs font-sans text-slate-700 dark:text-slate-300" data-wikidot="module-listpages">
            <strong class="block font-semibold text-slate-900 dark:text-slate-100 mb-0.5">Módulo ListPages (Wikidot)</strong>
            <span>Índice dinâmico filtrado por: <span class="font-mono">${escapeHtmlText(scope)}</span></span>
          </div>`
        );
      }
      if (modLower === 'childpages' || modLower === 'backlinks') {
        return compactHtml(
          `<div class="wiki-wikidot-module not-prose my-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-3 text-xs font-sans text-slate-700 dark:text-slate-300" data-wikidot="module-${escapeHtmlAttr(modLower)}">
            <strong>Módulo ${escapeHtmlText(modName)}:</strong> Lista de páginas associadas a este verbete.
          </div>`
        );
      }
      return compactHtml(
        `<div class="wiki-wikidot-module not-prose my-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-3 text-xs font-sans text-slate-700 dark:text-slate-300" data-wikidot="module">
          <span class="font-mono font-semibold">[[module ${escapeHtmlText(modName)}]]</span>
        </div>`
      );
    });

    // 10. [[size ...]]...[[/size]] and [[span class="..."]]...[[/span]]
    out = out.replace(/\[\[size\s+([^\]]+)\]\]([\s\S]*?)\[\[\/size\]\]/gi, (_, rawSize, body) => {
      const safeSize = rawSize.trim().replace(/[^a-zA-Z0-9.%-]/g, '');
      const sizeClass =
        safeSize === 'larger' || safeSize === 'large'
          ? 'text-base'
          : safeSize === 'smaller' || safeSize === 'small'
          ? 'text-xs'
          : '';
      return sizeClass
        ? `<span class="wiki-wikidot-size ${sizeClass}" data-wikidot="size">${body}</span>`
        : `<span class="wiki-wikidot-size" style="font-size:${escapeHtmlAttr(safeSize || 'inherit')}" data-wikidot="size">${body}</span>`;
    });

    out = out.replace(/\[\[span(?:\s+([^\]]*))?\]\]([\s\S]*?)\[\[\/span\]\]/gi, (_, rawAttrs, body) => {
      const attrs = parseWikidotAttrs(rawAttrs || '');
      const safeCls = sanitizeSafeClasses(attrs.class || '');
      return `<span class="wiki-wikidot-span ${safeCls}" data-wikidot="span">${body}</span>`;
    });

    // Restore protected [[code]] blocks
    out = out.replace(/@@WIKIDOT_CODE_(\d+)@@/g, (_, idxStr) => codePlaceholders[Number(idxStr)] ?? '');

    return out;
  });
}
