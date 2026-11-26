import { Article, TemplateDiagnostic, TemplateDiagnosticType } from '../types';
import { BUILTIN_MEDIAWIKI_TEMPLATES } from '../data/defaultTemplates';
import { parseTitle } from './namespaces';

export interface TemplateExpansionOptions {
  pageTitle?: string;
  siteName?: string;
  customTemplates?: Article[];
  isTemplatePage?: boolean;
  maxDepth?: number;
  highlightDiagnostics?: boolean;
}

export interface TemplateExpansionResult {
  wikitext: string;
  usedTemplates: string[];
  missingTemplates: string[];
  errors: string[];
  diagnostics: TemplateDiagnostic[];
}

export interface ParsedTemplateCall {
  name: string;
  positional: string[];
  named: Record<string, string>;
  params: Record<string, string>;
  rawBody: string;
}

const MAX_RECURSION_DEPTH = 5;

export function normalizeTemplateKey(rawName: string): string {
  let clean = (rawName || '').trim();
  // Strip optional leading colon (e.g. {{:Predefinição:Teste}})
  if (clean.startsWith(':')) clean = clean.slice(1).trim();
  // Strip Namespace 10 prefixes
  clean = clean.replace(/^(?:predefinição|predef|template)\s*:/i, '').trim();
  return clean
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function escapeHtmlAttr(value: string): string {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escapes HTML special characters AND Parsoid wiki-markup delimiters inside diagnostic spans/titles
 * so Parsoid never parses brackets, quotes, backticks, or emphasis inside debug highlights.
 */
function escapeDiagnosticText(value: string): string {
  return (value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;')
    .replace(/`/g, '&#96;')
    .replace(/\*/g, '&#42;')
    .replace(/=/g, '&#61;');
}

function isInsideTagOrWikilink(textBefore: string): boolean {
  const lastOpenTag = textBefore.lastIndexOf('<');
  const lastCloseTag = textBefore.lastIndexOf('>');
  if (lastOpenTag > lastCloseTag) return true;

  const lastOpenLink = textBefore.lastIndexOf('[[');
  const lastCloseLink = textBefore.lastIndexOf(']]');
  if (lastOpenLink > lastCloseLink) return true;

  return false;
}

function buildInvalidBraceHtml(
  snippet: string,
  issueType: Extract<TemplateDiagnosticType, 'unclosed_braces' | 'unmatched_closing' | 'invalid_name'>,
  message: string,
  diagId?: string
): string {
  const safeSnippet = escapeDiagnosticText(snippet);
  const safeMsg = escapeDiagnosticText(message);
  const idAttr = diagId ? ` id="${escapeHtmlAttr(diagId)}" data-template-diagnostic-id="${escapeHtmlAttr(diagId)}"` : '';
  return `<span${idAttr} class="wiki-template-debug wiki-template-invalid-braces inline-flex items-baseline gap-1 px-1 py-0.5 rounded border border-rose-300 dark:border-rose-700/80 bg-rose-50/90 dark:bg-rose-950/45 text-rose-800 dark:text-rose-200 underline decoration-wavy decoration-rose-500 font-mono text-[0.88em]" data-template-issue="${issueType}" title="${safeMsg}"><span aria-hidden="true" class="select-none text-[0.85em] font-bold">✕</span>${safeSnippet}</span>`;
}

function buildMissingParamHtml(
  label: string,
  missingParams: string[],
  issueType: Extract<TemplateDiagnosticType, 'unresolved_param' | 'missing_required_param'>,
  message: string,
  diagId?: string,
  inlineMode = true
): string {
  const safeLabel = escapeDiagnosticText(label);
  const safeMsg = escapeDiagnosticText(message);
  const safeParams = escapeHtmlAttr(missingParams.join(', '));
  const idAttr = diagId ? ` id="${escapeHtmlAttr(diagId)}" data-template-diagnostic-id="${escapeHtmlAttr(diagId)}"` : '';
  const layoutClass = inlineMode
    ? 'inline-flex items-baseline gap-1 px-1.5 py-0.5'
    : 'mt-2 inline-flex flex-wrap items-center gap-1.5 px-2 py-0.5';
  return `<span${idAttr} class="wiki-template-debug wiki-template-missing-param ${layoutClass} rounded border border-amber-300 dark:border-amber-700/80 bg-amber-50/90 dark:bg-amber-950/45 text-amber-900 dark:text-amber-200 underline decoration-wavy decoration-amber-500 font-mono text-[11px] not-italic" data-template-issue="${issueType}" data-missing-param="${safeParams}" title="${safeMsg}"><span aria-hidden="true" class="select-none font-bold">⚠</span>${safeLabel}</span>`;
}

function sanitizeImageSrc(src: string): string {
  const trimmed = (src || '').trim();
  if (/^(?:https?:\/\/|\/assets\/)/i.test(trimmed)) {
    return escapeHtmlAttr(trimmed);
  }
  return '';
}

function compactHtmlBlock(html: string): string {
  return html
    .replace(/>\s+</g, '><')
    .replace(/\r?\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Processes <onlyinclude>, <noinclude>, and <includeonly> directives faithfully.
 * - isTransclusion = true: extracts onlyinclude if present, strips <noinclude>, unwraps <includeonly>
 * - isTransclusion = false (viewing the Template: page directly): strips <includeonly>, unwraps <noinclude> and <onlyinclude>
 */
export function applyIncludeDirectives(rawWikitext: string, isTransclusion: boolean): string {
  let text = rawWikitext || '';

  if (isTransclusion) {
    const onlyMatches = Array.from(text.matchAll(/<onlyinclude>([\s\S]*?)<\/onlyinclude>/gi));
    if (onlyMatches.length > 0) {
      text = onlyMatches.map(m => m[1]).join('');
    }
    text = text.replace(/<noinclude>[\s\S]*?<\/noinclude>/gi, '');
    text = text.replace(/<\/?includeonly>/gi, '');
    text = text.replace(/<\/?onlyinclude>/gi, '');
    return text;
  }

  // Viewing Template: page directly
  text = text.replace(/<includeonly>[\s\S]*?<\/includeonly>/gi, '');
  text = text.replace(/<\/?noinclude>/gi, '');
  text = text.replace(/<\/?onlyinclude>/gi, '');
  return text;
}

/**
 * Splits content on top-level `|` characters, ignoring nested {{...}}, {{{...}}}, [[...]], and {|...|}.
 */
export function splitTopLevelPipes(body: string): string[] {
  const parts: string[] = [];
  let current = '';
  let braceDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    const next = body[i + 1];

    if (ch === '{' && next === '{') {
      braceDepth += 2;
      current += '{{';
      i++;
      continue;
    }
    if (ch === '}' && next === '}') {
      braceDepth = Math.max(0, braceDepth - 2);
      current += '}}';
      i++;
      continue;
    }
    if (ch === '{' && next === '|') {
      braceDepth += 2;
      current += '{|';
      i++;
      continue;
    }
    if (ch === '|' && next === '}' && braceDepth >= 2) {
      braceDepth = Math.max(0, braceDepth - 2);
      current += '|}';
      i++;
      continue;
    }
    if (ch === '[' && next === '[') {
      bracketDepth += 2;
      current += '[[';
      i++;
      continue;
    }
    if (ch === ']' && next === ']') {
      bracketDepth = Math.max(0, bracketDepth - 2);
      current += ']]';
      i++;
      continue;
    }

    if (ch === '|' && braceDepth === 0 && bracketDepth === 0) {
      parts.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  parts.push(current);
  return parts;
}

/**
 * Finds the first `=` at top level (outside {{...}} and [[...]]).
 */
function findTopLevelEquals(segment: string): number {
  let braceDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    const next = segment[i + 1];

    if (ch === '{' && next === '{') {
      braceDepth += 2;
      i++;
      continue;
    }
    if (ch === '}' && next === '}') {
      braceDepth = Math.max(0, braceDepth - 2);
      i++;
      continue;
    }
    if (ch === '[' && next === '[') {
      bracketDepth += 2;
      i++;
      continue;
    }
    if (ch === ']' && next === ']') {
      bracketDepth = Math.max(0, bracketDepth - 2);
      i++;
      continue;
    }

    if (ch === '=' && braceDepth === 0 && bracketDepth === 0) {
      return i;
    }
  }

  return -1;
}

export function parseTemplateCallBody(rawBody: string): ParsedTemplateCall {
  const segments = splitTopLevelPipes(rawBody);
  const name = (segments[0] || '').trim();
  const positional: string[] = [];
  const named: Record<string, string> = {};
  const params: Record<string, string> = {};

  let posIdx = 1;
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    const eqIdx = findTopLevelEquals(seg);
    if (eqIdx !== -1) {
      const key = seg.slice(0, eqIdx).trim();
      const val = seg.slice(eqIdx + 1).trim();
      if (key) {
        named[key] = val;
        params[key] = val;
        params[key.toLowerCase()] = val;
      }
    } else {
      const val = seg.trim();
      positional.push(val);
      params[String(posIdx)] = val;
      posIdx++;
    }
  }

  return { name, positional, named, params, rawBody };
}

export interface SubstituteParamsOptions {
  highlightUnresolved?: boolean;
  onUnresolvedParam?: (paramName: string, rawSnippet: string) => string | void;
}

/**
 * Replaces {{{param|default}}} placeholders cleanly, supporting nested {{{...}}} and {{...}}.
 */
export function substituteTemplateParameters(
  templateWikitext: string,
  params: Record<string, string>,
  options?: SubstituteParamsOptions
): string {
  let output = '';
  let i = 0;

  while (i < templateWikitext.length) {
    if (templateWikitext.startsWith('{{{', i)) {
      // Find matching }}} using stack of 2/3 brace openings
      const stack: number[] = [3];
      let j = i + 3;

      while (j < templateWikitext.length && stack.length > 0) {
        if (templateWikitext[j] === '{') {
          let openCount = 0;
          while (templateWikitext[j + openCount] === '{') openCount++;
          let rem = openCount;
          while (rem >= 2) {
            if (rem === 3 || (rem >= 5 && rem % 2 === 1)) {
              stack.push(3);
              rem -= 3;
            } else {
              stack.push(2);
              rem -= 2;
            }
          }
          j += openCount;
          continue;
        }
        if (templateWikitext[j] === '}') {
          let closeCount = 0;
          while (templateWikitext[j + closeCount] === '}') closeCount++;
          let consumed = 0;
          while (stack.length > 0 && closeCount - consumed >= stack[stack.length - 1]) {
            const top = stack.pop()!;
            consumed += top;
          }
          j += consumed > 0 ? consumed : closeCount;
          continue;
        }
        j++;
      }

      if (stack.length === 0) {
        const inner = templateWikitext.slice(i + 3, j - 3);
        const parts = splitTopLevelPipes(inner);
        const rawKey = (parts[0] || '').trim();
        const hasDefault = parts.length > 1;
        const defaultRaw = hasDefault ? parts.slice(1).join('|') : '';

        const directMatch = params[rawKey] ?? params[rawKey.toLowerCase()];
        if (directMatch !== undefined && directMatch !== '') {
          output += directMatch;
        } else if (hasDefault) {
          output += substituteTemplateParameters(defaultRaw, params, options);
        } else if (directMatch !== undefined) {
          output += '';
        } else {
          const rawPlaceholder = `{{{${rawKey}}}}`;
          const diagId = options?.onUnresolvedParam?.(rawKey, rawPlaceholder);
          if (options?.highlightUnresolved && !isInsideTagOrWikilink(output)) {
            output += buildMissingParamHtml(
              rawPlaceholder,
              [rawKey],
              'unresolved_param',
              `Parâmetro ausente sem valor padrão: ${rawPlaceholder}`,
              typeof diagId === 'string' ? diagId : undefined,
              true
            );
          } else {
            output += rawPlaceholder;
          }
        }
        i = j;
        continue;
      }
    }

    output += templateWikitext[i];
    i++;
  }

  return output;
}

/**
 * Extracts all parameter placeholder names declared in a Namespace 10 template wikitext.
 */
export function extractTemplateDeclaredParams(templateWikitext: string): string[] {
  const found = new Set<string>();
  const matches = templateWikitext.matchAll(/\{\{\{([^{}|]+)/g);
  for (const m of matches) {
    const name = m[1].trim();
    if (name) found.add(name);
  }
  return Array.from(found);
}

/**
 * Evaluates standard MediaWiki magic words like {{PAGENAME}}, {{SITENAME}}, {{CURRENTYEAR}}, etc.
 */
function resolveMagicWord(
  rawName: string,
  pageTitle: string,
  siteName: string
): string | null {
  const upper = rawName.trim().toUpperCase().replace(/\s+/g, '');
  const parsed = parseTitle(pageTitle || 'Artigo');
  const now = new Date();
  const monthsPt = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];

  switch (upper) {
    case 'PAGENAME':
    case 'NOMEDAPAGINA':
      return parsed.baseTitle || pageTitle;
    case 'FULLPAGENAME':
    case 'NOMECOMPLETODAPAGINA':
      return parsed.fullTitle || pageTitle;
    case 'NAMESPACE':
    case 'DOMINIO':
      return parsed.namespaceDef.localized || parsed.namespaceDef.canonical || '';
    case 'SITENAME':
    case 'NOMEDOSITE':
      return siteName || 'NotMediaWiki';
    case 'CURRENTYEAR':
    case 'ANOATUAL':
      return String(now.getFullYear());
    case 'CURRENTMONTH':
    case 'MESATUAL':
      return String(now.getMonth() + 1).padStart(2, '0');
    case 'CURRENTMONTHNAME':
    case 'NOMEDOMESATUAL':
      return monthsPt[now.getMonth()];
    case 'CURRENTDAY':
    case 'DIAATUAL':
      return String(now.getDate());
    case 'CURRENTDATE':
      return `${now.getDate()} de ${monthsPt[now.getMonth()]} de ${now.getFullYear()}`;
    default:
      return null;
  }
}

function getParam(call: ParsedTemplateCall, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const val = call.params[key] ?? call.params[key.toLowerCase()];
    if (val !== undefined && val.trim() !== '') {
      return val.trim();
    }
  }
  return fallback;
}

function escapeTemplateHtml(value: string): string {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderStructuredInfoboxCard(opts: {
  templateAttr: string;
  title: string;
  subtitle?: string;
  imageSrc?: string;
  imageCaption?: string;
  rows: Array<{ label: string; value: string; italicValue?: boolean }>;
  headerBgClass?: string;
  missingParams?: string[];
  missingWarnHtml?: string;
}): string {
  const safeImg = opts.imageSrc ? sanitizeImageSrc(opts.imageSrc) : '';
  const imgHtml = safeImg
    ? `<div class="mb-3 flex flex-col items-center gap-1.5 pb-2 border-b border-slate-200/70 dark:border-slate-800/70"><img src="${safeImg}" alt="${escapeHtmlAttr(opts.title)}" class="max-h-32 w-auto object-contain rounded" />${opts.imageCaption ? `<span class="text-[11px] text-slate-500 dark:text-slate-400 text-center">${escapeTemplateHtml(opts.imageCaption)}</span>` : ''}</div>`
    : '';
  const rowsHtml = opts.rows
    .map(
      r =>
        `<tr class="border-b border-slate-100 dark:border-slate-800/70 last:border-0"><th class="text-left font-semibold py-1.5 pr-2 align-top text-slate-700 dark:text-slate-300 w-2/5">${escapeTemplateHtml(r.label)}</th><td class="py-1.5 text-slate-600 dark:text-slate-400 break-words ${r.italicValue ? 'italic' : ''}">${escapeTemplateHtml(r.value)}</td></tr>`
    )
    .join('');

  return compactHtmlBlock(
    `<aside class="wiki-template infobox ${opts.missingParams && opts.missingParams.length > 0 ? 'wiki-template-has-missing-params ring-1 ring-amber-400/70 dark:ring-amber-600/70' : ''} float-right clear-right ml-6 mb-4 w-72 md:w-80 border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 rounded-lg p-4 text-sm shadow-xs font-sans" data-template="${escapeHtmlAttr(opts.templateAttr)}">
      <div class="text-center pb-2 mb-3 border-b border-slate-200 dark:border-slate-800 ${opts.headerBgClass || ''}">
        <div class="font-bold text-base text-slate-900 dark:text-slate-100">${escapeTemplateHtml(opts.title)}</div>
        ${opts.subtitle ? `<div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${escapeTemplateHtml(opts.subtitle)}</div>` : ''}
        ${opts.missingWarnHtml || ''}
      </div>
      ${imgHtml}
      ${rowsHtml ? `<table class="w-full text-xs border-collapse">${rowsHtml}</table>` : ''}
    </aside>`
  );
}

function convertWikipediaUnit(value: number, fromRaw: string, toRaw?: string): { primary: string; converted: string } | null {
  const from = (fromRaw || '').trim().toLowerCase();
  const to = (toRaw || '').trim().toLowerCase();
  const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(1).replace(/\.0$/, '') : n.toFixed(2).replace(/\.?0+$/, ''));

  if ((from === 'km' && (!to || to === 'mi'))) {
    return { primary: `${fmt(value)} km`, converted: `${fmt(value * 0.621371)} mi` };
  }
  if ((from === 'mi' && (!to || to === 'km'))) {
    return { primary: `${fmt(value)} mi`, converted: `${fmt(value * 1.60934)} km` };
  }
  if ((from === 'm' && (!to || to === 'ft'))) {
    return { primary: `${fmt(value)} m`, converted: `${fmt(value * 3.28084)} ft` };
  }
  if ((from === 'ft' && (!to || to === 'm'))) {
    return { primary: `${fmt(value)} ft`, converted: `${fmt(value * 0.3048)} m` };
  }
  if ((from === 'kg' && (!to || to === 'lb'))) {
    return { primary: `${fmt(value)} kg`, converted: `${fmt(value * 2.20462)} lb` };
  }
  if ((from === 'lb' && (!to || to === 'kg'))) {
    return { primary: `${fmt(value)} lb`, converted: `${fmt(value * 0.453592)} kg` };
  }
  if ((from === 'c' || from === '°c') && (!to || to === 'f' || to === '°f')) {
    return { primary: `${fmt(value)} °C`, converted: `${fmt((value * 9) / 5 + 32)} °F` };
  }
  if ((from === 'f' || from === '°f') && (!to || to === 'c' || to === '°c')) {
    return { primary: `${fmt(value)} °F`, converted: `${fmt(((value - 32) * 5) / 9)} °C` };
  }
  if ((from === 'km2' || from === 'km²') && (!to || to === 'mi2' || to === 'mi²' || to === 'sqmi')) {
    return { primary: `${fmt(value)} km²`, converted: `${fmt(value * 0.386102)} mi²` };
  }
  if ((from === 'mi2' || from === 'mi²' || from === 'sqmi') && (!to || to === 'km2' || to === 'km²')) {
    return { primary: `${fmt(value)} mi²`, converted: `${fmt(value * 2.58999)} km²` };
  }
  if ((from === 'l' && (!to || to === 'gal'))) {
    return { primary: `${fmt(value)} L`, converted: `${fmt(value * 0.264172)} gal` };
  }
  if ((from === 'gal' && (!to || to === 'l'))) {
    return { primary: `${fmt(value)} gal`, converted: `${fmt(value * 3.78541)} L` };
  }
  return null;
}

/**
 * Renders built-in standard MediaWiki Predefinições to clean semantic HTML.
 * Follows editorial design discipline: crisp all-around hairline borders (zero thick border-l-4),
 * explicit status labels, and full dark/theme support.
 */
function renderBuiltinTemplate(
  call: ParsedTemplateCall,
  normalizedKey: string,
  pageTitle: string,
  registerMissingRequired?: (templateLabel: string, missingParams: string[]) => string | undefined,
  highlightDiagnostics = true
): string | null {
  // Never intercept {{Infobox <subtype>}} (e.g. {{Infobox software}} / {{Infobox user}}); ClientParsoidService handles those natively.
  if (/^infobox\s+/i.test(call.name.trim())) {
    return null;
  }

  // 1. {{Aviso}} / {{Ambox}} / {{Alerta}}
  if (['aviso', 'ambox', 'caixa de aviso', 'alerta'].includes(normalizedKey)) {
    const tipoRaw = getParam(call, ['tipo', 'type', '1'], 'info').toLowerCase();
    const rawTitulo = getParam(call, ['título', 'titulo', 'title', 'cabeçalho'], '');
    const rawTexto = getParam(call, ['texto', 'text', 'mensagem', '2'], '');
    const missingParams = [!rawTitulo ? 'título' : '', !rawTexto ? 'texto' : ''].filter(Boolean);
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Aviso', missingParams) : undefined;
    const titulo = rawTitulo || 'Aviso Editorial';
    const texto = rawTexto || 'Este artigo possui uma sinalização editorial da comunidade.';

    let toneClass = 'bg-sky-50/85 dark:bg-sky-950/35 border-sky-200 dark:border-sky-800/80 text-sky-950 dark:text-sky-100';
    let badgeClass = 'text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800 bg-white/80 dark:bg-sky-900/40';
    let labelText = 'INFORMAÇÃO';
    let iconChar = 'ℹ';

    if (['aviso', 'cuidado', 'warning', 'content'].includes(tipoRaw)) {
      toneClass = 'bg-amber-50/90 dark:bg-amber-950/35 border-amber-300 dark:border-amber-800/80 text-amber-950 dark:text-amber-100';
      badgeClass = 'text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 bg-white/85 dark:bg-amber-900/40';
      labelText = 'AVISO';
      iconChar = '⚠';
    } else if (['erro', 'grave', 'critical', 'delete', 'eliminacao'].includes(tipoRaw)) {
      toneClass = 'bg-rose-50/90 dark:bg-rose-950/35 border-rose-300 dark:border-rose-800/80 text-rose-950 dark:text-rose-100';
      badgeClass = 'text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800 bg-white/85 dark:bg-rose-900/40';
      labelText = 'ATENÇÃO CRÍTICA';
      iconChar = '✕';
    } else if (['sucesso', 'ok', 'aprovado'].includes(tipoRaw)) {
      toneClass = 'bg-emerald-50/90 dark:bg-emerald-950/35 border-emerald-300 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-100';
      badgeClass = 'text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 bg-white/85 dark:bg-emerald-900/40';
      labelText = 'VERIFICADO';
      iconChar = '✓';
    } else if (['manutencao', 'manutenção', 'estilo', 'style'].includes(tipoRaw)) {
      toneClass = 'bg-violet-50/85 dark:bg-violet-950/35 border-violet-200 dark:border-violet-800/80 text-violet-950 dark:text-violet-100';
      badgeClass = 'text-violet-800 dark:text-violet-300 border-violet-200 dark:border-violet-800 bg-white/85 dark:bg-violet-900/40';
      labelText = 'MANUTENÇÃO';
      iconChar = '⚙';
    }

    const missingHtml =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml(
            `Parâmetro(s) obrigatório(s) ausente(s) em {{Aviso}}: ${missingParams.join(', ')}`,
            missingParams,
            'missing_required_param',
            `Preencha ${missingParams.map(p => `${p}=...`).join(' e ')} em {{Aviso}}`,
            diagId,
            false
          )
        : '';

    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-ambox ${missingParams.length > 0 ? 'wiki-template-has-missing-params ring-1 ring-amber-400/70 dark:ring-amber-600/70' : ''} not-prose my-4 rounded-lg border p-4 ${toneClass}" role="note" data-template="Aviso">
        <div class="flex items-start gap-3">
          <span class="shrink-0 w-7 h-7 rounded-md border flex items-center justify-center text-sm font-bold ${badgeClass}" aria-hidden="true">${iconChar}</span>
          <div class="min-w-0 flex-1 font-sans">
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <span class="text-[10px] font-mono uppercase tracking-wider font-semibold opacity-75">${labelText}</span>
              <span class="text-xs font-bold">${titulo}</span>
            </div>
            <div class="text-xs leading-relaxed opacity-90">${texto}</div>
            ${missingHtml}
          </div>
        </div>
      </div>`
    );
  }

  // 2. {{Esboço}} / {{Stub}}
  if (['esboço', 'esboco', 'stub', 'mínimo', 'minimo'].includes(normalizedKey)) {
    const tema = getParam(call, ['1', 'tema', 'topic'], '');
    const temaSegment = tema ? ` sobre <strong>${tema}</strong>` : '';
    const editTarget = encodeURIComponent(pageTitle.replace(/\s+/g, '_'));
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-stub not-prose my-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/70 p-3.5 text-xs text-slate-700 dark:text-slate-300 font-sans flex items-center gap-3" role="note" data-template="Esboço">
        <span class="shrink-0 w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-sm" aria-hidden="true">✎</span>
        <div class="leading-relaxed">
          <em>Este artigo${temaSegment} é um <strong>esboço</strong>. Você pode ajudar a enciclopédia <a href="#/edit/${editTarget}" class="text-blue-700 dark:text-blue-400 hover:underline font-medium">expandindo-o</a>.</em>
        </div>
      </div>`
    );
  }

  // 3. {{Sem fontes}} / {{Unreferenced}}
  if (['sem fontes', 'sem referências', 'sem referencias', 'falta de fontes', 'unreferenced'].includes(normalizedKey)) {
    const data = getParam(call, ['data', 'date', '1'], '');
    const dataNote = data ? ` <span class="text-[11px] font-mono opacity-75">(${data})</span>` : '';
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-unreferenced not-prose my-4 rounded-lg border border-amber-300 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/35 p-4 text-amber-950 dark:text-amber-100 font-sans" role="note" data-template="Sem fontes">
        <div class="flex items-start gap-3">
          <span class="shrink-0 w-7 h-7 rounded-md border border-amber-200 dark:border-amber-800 bg-white/90 dark:bg-amber-900/40 flex items-center justify-center text-sm font-bold text-amber-700 dark:text-amber-300" aria-hidden="true">?</span>
          <div class="text-xs leading-relaxed">
            <strong class="block font-bold mb-0.5">Este artigo ou seção não cita fontes confiáveis.${dataNote}</strong>
            <span>Ajude a melhorar este verbete adicionando referências com <code>&lt;ref&gt;...&lt;/ref&gt;</code> para garantir verificabilidade.</span>
          </div>
        </div>
      </div>`
    );
  }

  // 4. {{Em construção}} / {{WIP}}
  if (['em construção', 'em construcao', 'em edição', 'em edicao', 'wip', 'under construction'].includes(normalizedKey)) {
    const usuario = getParam(call, ['usuário', 'usuario', 'user', '1'], '');
    const nota = getParam(call, ['nota', 'motivo', 'note', '2'], '');
    const who = usuario ? ` por <strong>${usuario}</strong>` : '';
    const extra = nota ? `<div class="mt-1 opacity-90">${nota}</div>` : '';
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-wip not-prose my-4 rounded-lg border border-blue-200 dark:border-blue-800/80 bg-blue-50/85 dark:bg-blue-950/35 p-4 text-blue-950 dark:text-blue-100 font-sans text-xs" role="note" data-template="Em construção">
        <div class="flex items-start gap-3">
          <span class="shrink-0 w-7 h-7 rounded-md border border-blue-200 dark:border-blue-800 bg-white/90 dark:bg-blue-900/40 flex items-center justify-center text-sm text-blue-700 dark:text-blue-300" aria-hidden="true">⚒</span>
          <div class="leading-relaxed">
            <strong>Esta página encontra-se em construção ou expansão ativa${who}.</strong>
            ${extra}
          </div>
        </div>
      </div>`
    );
  }

  // 5. {{Desambiguação}}
  if (['desambiguação', 'desambiguacao', 'disambig', 'desambig'].includes(normalizedKey)) {
    const termo = getParam(call, ['termo', '1'], pageTitle);
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-disambig not-prose my-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 p-3.5 text-xs text-slate-700 dark:text-slate-300 font-sans flex items-center gap-3" role="note" data-template="Desambiguação">
        <span class="shrink-0 w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center font-mono font-bold text-slate-700 dark:text-slate-200" aria-hidden="true">⇄</span>
        <div>Esta é uma página de <strong>desambiguação</strong> que lista artigos com títulos semelhantes ou associados a <strong>${termo}</strong>.</div>
      </div>`
    );
  }

  // 6. {{Spoiler}}
  if (['spoiler', 'revelação', 'revelacao'].includes(normalizedKey)) {
    const obra = getParam(call, ['obra', '1'], '');
    const obraText = obra ? ` sobre <strong>${obra}</strong>` : '';
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-spoiler not-prose my-4 rounded-lg border border-rose-200 dark:border-rose-800/80 bg-rose-50/80 dark:bg-rose-950/30 p-3.5 text-xs text-rose-950 dark:text-rose-100 font-sans flex items-center gap-3" role="note" data-template="Spoiler">
        <span class="shrink-0 w-7 h-7 rounded-md border border-rose-200 dark:border-rose-800 bg-white/90 dark:bg-rose-900/40 flex items-center justify-center font-bold text-rose-700 dark:text-rose-300" aria-hidden="true">!</span>
        <div><strong>Aviso editorial:</strong> esta seção contém revelações sobre o enredo${obraText} (<em>spoilers</em>).</div>
      </div>`
    );
  }

  // 6b. {{Em tradução}} / {{Tradução}}
  if (['em tradução', 'em traducao', 'tradução', 'traducao', 'translating'].includes(normalizedKey)) {
    const idioma = getParam(call, ['idioma', '1', 'lang'], 'outro idioma');
    const artigo = getParam(call, ['artigo', '2', 'article'], '');
    const artigoText = artigo ? ` a partir do verbete <em>${artigo}</em>` : '';
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-translating not-prose my-4 rounded-lg border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/80 dark:bg-indigo-950/35 p-3.5 text-xs text-indigo-950 dark:text-indigo-100 font-sans flex items-center gap-3" role="note" data-template="Em tradução">
        <span class="shrink-0 w-7 h-7 rounded-md border border-indigo-200 dark:border-indigo-800 bg-white/90 dark:bg-indigo-900/40 flex items-center justify-center font-mono font-bold text-indigo-700 dark:text-indigo-300" aria-hidden="true">文</span>
        <div class="leading-relaxed"><strong>Em tradução:</strong> este artigo está sendo traduzido do <strong>${idioma}</strong>${artigoText}. Algumas seções podem ainda estar em adaptação.</div>
      </div>`
    );
  }

  // 6c. {{Evento atual}} / {{Current}}
  if (['evento atual', 'current', 'notícia recente', 'noticia recente'].includes(normalizedKey)) {
    const assunto = getParam(call, ['assunto', '1', 'subject'], '');
    const data = getParam(call, ['data', '2', 'date'], '');
    const assuntoText = assunto ? ` sobre <strong>${assunto}</strong>` : '';
    const dataNote = data ? ` <span class="text-[11px] font-mono opacity-75">(${data})</span>` : '';
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-current not-prose my-4 rounded-lg border border-sky-200 dark:border-sky-800/80 bg-sky-50/85 dark:bg-sky-950/35 p-3.5 text-xs text-sky-950 dark:text-sky-100 font-sans flex items-center gap-3" role="note" data-template="Evento atual">
        <span class="shrink-0 w-7 h-7 rounded-md border border-sky-200 dark:border-sky-800 bg-white/90 dark:bg-sky-900/40 flex items-center justify-center font-bold text-sky-700 dark:text-sky-300" aria-hidden="true">⏱</span>
        <div class="leading-relaxed"><strong>Evento atual${dataNote}:</strong> este artigo documenta um acontecimento em curso${assuntoText}; as informações podem evoluir rapidamente conforme novas fontes surgem.</div>
      </div>`
    );
  }

  // 6d. {{Parcial}} / {{NPOV}}
  if (['parcial', 'npov', 'parcialidade', 'pov'].includes(normalizedKey)) {
    const motivo = getParam(call, ['motivo', '1', 'reason'], 'A neutralidade deste verbete ou seção foi questionada pela comunidade.');
    const data = getParam(call, ['data', '2', 'date'], '');
    const dataNote = data ? ` <span class="text-[11px] font-mono opacity-75">(${data})</span>` : '';
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-npov not-prose my-4 rounded-lg border border-amber-300 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/35 p-4 text-xs text-amber-950 dark:text-amber-100 font-sans flex items-start gap-3" role="note" data-template="Parcial">
        <span class="shrink-0 w-7 h-7 rounded-md border border-amber-200 dark:border-amber-800 bg-white/90 dark:bg-amber-900/40 flex items-center justify-center font-bold text-amber-700 dark:text-amber-300" aria-hidden="true">⚖</span>
        <div class="leading-relaxed">
          <strong class="block font-bold mb-0.5">Aviso de Imparcialidade (NPOV)${dataNote}</strong>
          <span>${motivo}</span>
        </div>
      </div>`
    );
  }

  // 6e. {{Revisão}} / {{Cleanup}}
  if (['revisão', 'revisao', 'reciclagem', 'cleanup'].includes(normalizedKey)) {
    const motivo = getParam(call, ['motivo', '1', 'reason'], 'Esta página requer revisão ortográfica, formatação wiki e organização de referências.');
    const data = getParam(call, ['data', '2', 'date'], '');
    const dataNote = data ? ` <span class="text-[11px] font-mono opacity-75">(${data})</span>` : '';
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-cleanup not-prose my-4 rounded-lg border border-violet-200 dark:border-violet-800/80 bg-violet-50/85 dark:bg-violet-950/35 p-4 text-xs text-violet-950 dark:text-violet-100 font-sans flex items-start gap-3" role="note" data-template="Revisão">
        <span class="shrink-0 w-7 h-7 rounded-md border border-violet-200 dark:border-violet-800 bg-white/90 dark:bg-violet-900/40 flex items-center justify-center font-bold text-violet-700 dark:text-violet-300" aria-hidden="true">✎</span>
        <div class="leading-relaxed">
          <strong class="block font-bold mb-0.5">Revisão Editorial Solicitada${dataNote}</strong>
          <span>${motivo}</span>
        </div>
      </div>`
    );
  }

  // 7. {{Artigo principal}} / {{AP}} / {{Main}}
  if (['artigo principal', 'ap', 'main'].includes(normalizedKey)) {
    const targets = [
      ...call.positional,
      ...[call.named['artigo'], call.named['1'], call.named['2'], call.named['3']].filter(Boolean),
    ]
      .map(t => t.trim())
      .filter(Boolean);

    if (targets.length === 0) {
      const diagId = registerMissingRequired?.('Artigo principal', ['1']);
      if (!highlightDiagnostics) return '';
      return compactHtmlBlock(
        `<div class="wiki-template wiki-template-hatnote not-prose my-2" data-template="Artigo principal">${buildMissingParamHtml(
          '{{Artigo principal}}: parâmetro obrigatório ausente (1)',
          ['1'],
          'missing_required_param',
          'Informe o título do artigo principal, ex: {{Artigo principal|MediaWiki}}',
          diagId,
          true
        )}</div>`
      );
    }
    const linksHtml = targets
      .map(t => `<a href="#/wiki/${encodeURIComponent(t.replace(/\s+/g, '_'))}" class="wiki-link font-semibold text-blue-700 dark:text-blue-400 hover:underline">${t}</a>`)
      .join(', ');

    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-hatnote not-prose pl-3 py-1 my-2 text-xs italic text-slate-600 dark:text-slate-400 font-sans" data-template="Artigo principal">
        ↳ Ver ${targets.length > 1 ? 'artigos principais' : 'artigo principal'}: ${linksHtml}
      </div>`
    );
  }

  // 8. {{Veja também}} / {{Ver também}}
  if (['veja também', 'veja tambem', 'ver também', 'ver tambem', 'see also'].includes(normalizedKey)) {
    const targets = call.positional.map(t => t.trim()).filter(Boolean);
    if (targets.length === 0) {
      const diagId = registerMissingRequired?.('Veja também', ['1']);
      if (!highlightDiagnostics) return '';
      return compactHtmlBlock(
        `<div class="wiki-template wiki-template-hatnote not-prose my-2" data-template="Veja também">${buildMissingParamHtml(
          '{{Veja também}}: parâmetro obrigatório ausente (1)',
          ['1'],
          'missing_required_param',
          'Informe ao menos um artigo recomendado, ex: {{Veja também|Parsoid}}',
          diagId,
          true
        )}</div>`
      );
    }
    const linksHtml = targets
      .map(t => `<a href="#/wiki/${encodeURIComponent(t.replace(/\s+/g, '_'))}" class="wiki-link font-semibold text-blue-700 dark:text-blue-400 hover:underline">${t}</a>`)
      .join(', ');

    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-hatnote not-prose pl-3 py-1 my-2 text-xs italic text-slate-600 dark:text-slate-400 font-sans" data-template="Veja também">
        ↳ Veja também: ${linksHtml}
      </div>`
    );
  }

  // 8b. {{Sem saída}} / {{Deadend}}
  if (['sem saída', 'sem saida', 'deadend'].includes(normalizedKey)) {
    const data = getParam(call, ['data', '1', 'date'], '');
    const dataNote = data ? ` <span class="text-[11px] font-mono opacity-75">(${data})</span>` : '';
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-deadend not-prose my-4 rounded-lg border border-amber-200 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/30 p-3.5 text-xs text-amber-950 dark:text-amber-100 font-sans flex items-center gap-3" role="note" data-template="Sem saída">
        <span class="shrink-0 w-7 h-7 rounded-md border border-amber-200 dark:border-amber-800 bg-white/90 dark:bg-amber-900/40 flex items-center justify-center font-mono font-bold text-amber-700 dark:text-amber-300" aria-hidden="true">⇄</span>
        <div><strong>Página sem saída${dataNote}:</strong> este artigo contém poucas ou nenhuma ligação interna (<code>[[artigo]]</code>) para outros verbetes da enciclopédia.</div>
      </div>`
    );
  }

  // 8c. {{Predefinição|Nome|p1|p2}} / {{Tl|Nome}}
  if (['predefinição', 'predefinicao', 'predef', 'tl', 'template link'].includes(normalizedKey)) {
    const rawTargetName = getParam(call, ['1', 'nome'], '').replace(/^(?:Predefinição|Predef|Template):/i, '').trim();
    if (!rawTargetName) {
      const diagId = registerMissingRequired?.('Predefinição', ['1']);
      if (highlightDiagnostics) {
        return buildMissingParamHtml(
          '{{Predefinição}}: parâmetro obrigatório ausente (1)',
          ['1'],
          'missing_required_param',
          'Informe o nome da pré-definição, ex: {{Predefinição|Aviso}}',
          diagId,
          true
        );
      }
    }
    const targetName = rawTargetName || 'Aviso';
    const targetSlug = `Predefinição:${targetName.replace(/\s+/g, '_')}`;
    const extraParams = call.positional.slice(1).map(p => p.trim()).filter(Boolean);
    const paramsSuffix = extraParams.length > 0 ? `|${extraParams.join('|')}` : '';
    return `<code class="wiki-template-tl font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200" data-template="Predefinição">{{<a href="#/wiki/${encodeURIComponent(targetSlug)}" class="wiki-link text-blue-700 dark:text-blue-400 hover:underline font-semibold">${targetName}</a>${paramsSuffix}}}</code>`;
  }

  // 9. {{Carece de fontes}} / {{Citation needed}} (inline)
  if (['carece de fontes', 'citation needed', 'cn', 'sem fonte'].includes(normalizedKey)) {
    const data = getParam(call, ['data', 'date', '1'], '');
    const titleAttr = data ? `Esta afirmação carece de fontes desde ${escapeHtmlAttr(data)}` : 'Esta afirmação carece de fontes confiáveis';
    return `<sup class="wiki-template-inline noprint font-sans text-[10px] text-slate-500 dark:text-slate-400 ml-0.5 select-none" data-template="Carece de fontes" title="${titleAttr}">[<i>carece de fontes</i>]</sup>`;
  }

  // 10. {{Ligação inativa}} / {{Dead link}} (inline)
  if (['ligação inativa', 'ligacao inativa', 'link quebrado', 'dead link'].includes(normalizedKey)) {
    const data = getParam(call, ['data', 'date', '1'], '');
    const titleAttr = data ? `Ligação externa inativa verificada em ${escapeHtmlAttr(data)}` : 'Ligação externa indisponível ou quebrada';
    return `<sup class="wiki-template-inline noprint font-sans text-[10px] text-rose-600 dark:text-rose-400 ml-0.5 select-none" data-template="Ligação inativa" title="${titleAttr}">[<i>ligação inativa</i>]</sup>`;
  }

  // 11. {{Citação}} / {{Quote}}
  if (['citação', 'citacao', 'quote', 'cquote'].includes(normalizedKey)) {
    const texto = getParam(call, ['texto', '1', 'quote'], '');
    const autor = getParam(call, ['autor', '2', 'author'], '');
    const fonte = getParam(call, ['fonte', '3', 'source'], '');
    if (!texto) {
      const diagId = registerMissingRequired?.('Citação', ['texto']);
      if (!highlightDiagnostics) return '';
      return compactHtmlBlock(
        `<div class="wiki-template wiki-template-quote my-4" data-template="Citação">${buildMissingParamHtml(
          '{{Citação}}: parâmetro obrigatório ausente (texto)',
          ['texto'],
          'missing_required_param',
          'Informe texto=... em {{Citação}}',
          diagId,
          true
        )}</div>`
      );
    }
    const attribution = [autor ? `<strong>${autor}</strong>` : '', fonte ? `<em>${fonte}</em>` : '']
      .filter(Boolean)
      .join(', ');

    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-quote my-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-900/70 px-5 py-4" data-template="Citação">
        <div class="font-serif italic text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">“${texto}”</div>
        ${attribution ? `<div class="mt-2 text-xs font-sans text-slate-500 dark:text-slate-400">— ${attribution}</div>` : ''}
      </div>`
    );
  }

  // 12. {{Nota}} / {{Note}}
  if (['nota', 'note', 'callout', 'observação', 'observacao'].includes(normalizedKey)) {
    const tipo = getParam(call, ['tipo', 'type'], 'info').toLowerCase();
    const titulo = getParam(call, ['título', 'titulo', 'title'], 'Nota');
    const texto = getParam(call, ['texto', 'text', '1'], '');
    if (!texto) {
      const diagId = registerMissingRequired?.('Nota', ['texto']);
      if (!highlightDiagnostics) return '';
      return compactHtmlBlock(
        `<div class="wiki-template wiki-template-note not-prose my-4" data-template="Nota">${buildMissingParamHtml(
          '{{Nota}}: parâmetro obrigatório ausente (texto)',
          ['texto'],
          'missing_required_param',
          'Informe texto=... em {{Nota}}',
          diagId,
          true
        )}</div>`
      );
    }

    let colorClass = 'border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200';
    if (tipo === 'dica' || tipo === 'tip') {
      colorClass = 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100';
    } else if (tipo === 'alerta' || tipo === 'warn') {
      colorClass = 'border-amber-200 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100';
    }

    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-note not-prose my-4 rounded-lg border p-3.5 text-xs font-sans ${colorClass}" data-template="Nota">
        <div class="font-bold mb-1">${titulo}</div>
        <div class="leading-relaxed opacity-95">${texto}</div>
      </div>`
    );
  }

  // 13. {{Destaque}} / {{Artigo destacado}}
  if (['destaque', 'artigo destacado', 'featured article'].includes(normalizedKey)) {
    const data = getParam(call, ['data', 'date', '1'], '');
    const texto = getParam(call, ['texto', '2'], 'Este artigo recebeu reconhecimento editorial de destaque pela comunidade.');
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-featured not-prose my-4 rounded-lg border border-amber-300 dark:border-amber-800/80 bg-amber-50/75 dark:bg-amber-950/30 p-3.5 text-xs text-amber-950 dark:text-amber-100 font-sans flex items-center gap-3" data-template="Destaque">
        <span class="shrink-0 w-7 h-7 rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-300 font-bold" aria-hidden="true">★</span>
        <div>
          <strong>Artigo em Destaque${data ? ` (${data})` : ''}:</strong> ${texto}
        </div>
      </div>`
    );
  }

  // 14. {{Infocaixa}} / {{Ficha técnica}} / bare {{Infobox|...}}
  if (['infocaixa', 'infobox genérica', 'infobox generica', 'ficha técnica', 'ficha tecnica', 'infobox'].includes(normalizedKey)) {
    const rawTitulo = getParam(call, ['título', 'titulo', 'title', 'nome', 'name'], '');
    const missingParams = !rawTitulo ? ['título'] : [];
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Infocaixa', missingParams) : undefined;
    const titulo = rawTitulo || pageTitle;
    const subtitulo = getParam(call, ['subtítulo', 'subtitulo', 'subtitle'], '');
    const rawImg = getParam(call, ['imagem', 'image', 'logo'], '');
    const safeImg = sanitizeImageSrc(rawImg);
    const legenda = getParam(call, ['legenda', 'caption'], '');

    const rows: Array<{ label: string; value: string }> = [];
    const consumedKeys = new Set(['título', 'titulo', 'title', 'nome', 'name', 'subtítulo', 'subtitulo', 'subtitle', 'imagem', 'image', 'logo', 'legenda', 'caption']);

    // Numbered rótuloN / dadosN pairs (1..12)
    for (let idx = 1; idx <= 12; idx++) {
      const rKey = `rótulo${idx}`;
      const rAltKey = `rotulo${idx}`;
      const rEnKey = `label${idx}`;
      const dKey = `dados${idx}`;
      const dEnKey = `data${idx}`;
      const label = getParam(call, [rKey, rAltKey, rEnKey], '');
      const value = getParam(call, [dKey, dEnKey], '');
      consumedKeys.add(rKey);
      consumedKeys.add(rAltKey);
      consumedKeys.add(rEnKey);
      consumedKeys.add(dKey);
      consumedKeys.add(dEnKey);
      if (label && value) {
        rows.push({ label, value });
      }
    }

    // Any remaining custom named parameters
    for (const [k, v] of Object.entries(call.named)) {
      if (consumedKeys.has(k.toLowerCase()) || !v.trim()) continue;
      rows.push({ label: k, value: v.trim() });
    }

    let imgBlock = '';
    if (safeImg) {
      imgBlock = `<div class="mb-3 flex flex-col items-center gap-1.5 pb-2 border-b border-slate-200/70 dark:border-slate-800/70">
        <img src="${safeImg}" alt="${escapeHtmlAttr(titulo)}" class="max-h-28 w-auto object-contain rounded" />
        ${legenda ? `<span class="text-[11px] text-slate-500 dark:text-slate-400 text-center">${legenda}</span>` : ''}
      </div>`;
    }

    const rowsHtml = rows
      .map(
        r =>
          `<tr class="border-b border-slate-100 dark:border-slate-800/70 last:border-0">
            <th class="text-left font-semibold py-1.5 pr-2 align-top text-slate-700 dark:text-slate-300 w-2/5">${r.label}</th>
            <td class="py-1.5 text-slate-600 dark:text-slate-400 break-words">${r.value}</td>
          </tr>`
      )
      .join('');

    const missingWarnHtml =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml(
            `Parâmetro ausente em {{Infocaixa}}: ${missingParams.join(', ')}`,
            missingParams,
            'missing_required_param',
            'Informe título=... na {{Infocaixa}}',
            diagId,
            false
          )
        : '';

    return compactHtmlBlock(
      `<aside class="wiki-template infobox ${missingParams.length > 0 ? 'wiki-template-has-missing-params ring-1 ring-amber-400/70 dark:ring-amber-600/70' : ''} float-right clear-right ml-6 mb-4 w-72 md:w-80 border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 rounded-lg p-4 text-sm shadow-xs font-sans" data-template="Infocaixa">
        <div class="text-center pb-2 mb-3 border-b border-slate-200 dark:border-slate-800">
          <div class="font-bold text-base text-slate-900 dark:text-slate-100">${titulo}</div>
          ${subtitulo ? `<div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${subtitulo}</div>` : ''}
          ${missingWarnHtml}
        </div>
        ${imgBlock}
        ${rowsHtml ? `<table class="w-full text-xs border-collapse">${rowsHtml}</table>` : ''}
      </aside>`
    );
  }

  // 14b. {{Infocaixa pessoa}} / {{Infobox pessoa}} / {{Infobox biografia}}
  if (['infocaixa pessoa', 'infobox pessoa', 'infobox biografia'].includes(normalizedKey)) {
    const rawNome = getParam(call, ['nome', 'name', 'título', 'titulo', '1'], '');
    const missingParams = !rawNome ? ['nome'] : [];
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Infocaixa pessoa', missingParams) : undefined;
    const nome = rawNome || pageTitle;
    const subtitulo = getParam(call, ['subtítulo', 'subtitulo', 'subtitle'], '');
    const rawImg = getParam(call, ['imagem', 'image', 'foto'], '');
    const safeImg = sanitizeImageSrc(rawImg);
    const legenda = getParam(call, ['legenda', 'caption'], '');
    const bioFields: Array<{ label: string; keys: string[] }> = [
      { label: 'Nascimento', keys: ['nascimento', 'data_nascimento', 'birth_date'] },
      { label: 'Local', keys: ['local', 'local_nascimento', 'birth_place'] },
      { label: 'Ocupação', keys: ['ocupação', 'ocupacao', 'occupation', 'profissão', 'profissao'] },
      { label: 'Nacionalidade', keys: ['nacionalidade', 'nationality'] },
      { label: 'Contribuições', keys: ['obras', 'obras_notáveis', 'obras_notaveis', 'notable_works'] },
      { label: 'Website', keys: ['website', 'site'] },
    ];
    const rows = bioFields
      .map(f => ({ label: f.label, value: getParam(call, f.keys, '') }))
      .filter(r => r.value);

    const imgHtml = safeImg
      ? `<div class="mb-3 flex flex-col items-center gap-1.5 pb-2 border-b border-slate-200/70 dark:border-slate-800/70"><img src="${safeImg}" alt="${escapeHtmlAttr(nome)}" class="max-h-32 w-auto object-contain rounded" />${legenda ? `<span class="text-[11px] text-slate-500 dark:text-slate-400 text-center">${legenda}</span>` : ''}</div>`
      : '';
    const rowsHtml = rows
      .map(
        r =>
          `<tr class="border-b border-slate-100 dark:border-slate-800/70 last:border-0"><th class="text-left font-semibold py-1.5 pr-2 align-top text-slate-700 dark:text-slate-300 w-2/5">${r.label}</th><td class="py-1.5 text-slate-600 dark:text-slate-400 break-words">${r.value}</td></tr>`
      )
      .join('');

    const missingWarnHtml =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml(
            `Parâmetro ausente em {{Infocaixa pessoa}}: ${missingParams.join(', ')}`,
            missingParams,
            'missing_required_param',
            'Informe nome=... em {{Infocaixa pessoa}}',
            diagId,
            false
          )
        : '';

    return compactHtmlBlock(
      `<aside class="wiki-template infobox ${missingParams.length > 0 ? 'wiki-template-has-missing-params ring-1 ring-amber-400/70 dark:ring-amber-600/70' : ''} float-right clear-right ml-6 mb-4 w-72 md:w-80 border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 rounded-lg p-4 text-sm shadow-xs font-sans" data-template="Infocaixa pessoa">
        <div class="text-center pb-2 mb-3 border-b border-slate-200 dark:border-slate-800">
          <div class="font-bold text-base text-slate-900 dark:text-slate-100">${nome}</div>
          ${subtitulo ? `<div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${subtitulo}</div>` : ''}
          ${missingWarnHtml}
        </div>
        ${imgHtml}
        ${rowsHtml ? `<table class="w-full text-xs border-collapse">${rowsHtml}</table>` : ''}
      </aside>`
    );
  }

  // 14c. {{Infocaixa organização}} / {{Infobox empresa}}
  if (['infocaixa organização', 'infocaixa organizacao', 'infobox organização', 'infobox organizacao', 'infobox empresa'].includes(normalizedKey)) {
    const rawNome = getParam(call, ['nome', 'name', 'título', 'titulo', '1'], '');
    const missingParams = !rawNome ? ['nome'] : [];
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Infocaixa organização', missingParams) : undefined;
    const nome = rawNome || pageTitle;
    const subtitulo = getParam(call, ['subtítulo', 'subtitulo', 'tipo', 'type'], '');
    const rawImg = getParam(call, ['imagem', 'image', 'logo'], '');
    const safeImg = sanitizeImageSrc(rawImg);
    const legenda = getParam(call, ['legenda', 'caption'], '');
    const orgFields: Array<{ label: string; keys: string[] }> = [
      { label: 'Tipo', keys: ['tipo', 'type'] },
      { label: 'Fundação', keys: ['fundação', 'fundacao', 'founded'] },
      { label: 'Sede', keys: ['sede', 'headquarters', 'local'] },
      { label: 'Fundadores', keys: ['fundadores', 'founders'] },
      { label: 'Área de atuação', keys: ['área', 'area', 'industry'] },
      { label: 'Website', keys: ['website', 'site'] },
    ];
    const rows = orgFields
      .map(f => ({ label: f.label, value: getParam(call, f.keys, '') }))
      .filter(r => r.value);

    const imgHtml = safeImg
      ? `<div class="mb-3 flex flex-col items-center gap-1.5 pb-2 border-b border-slate-200/70 dark:border-slate-800/70"><img src="${safeImg}" alt="${escapeHtmlAttr(nome)}" class="max-h-24 w-auto object-contain rounded" />${legenda ? `<span class="text-[11px] text-slate-500 dark:text-slate-400 text-center">${legenda}</span>` : ''}</div>`
      : '';
    const rowsHtml = rows
      .map(
        r =>
          `<tr class="border-b border-slate-100 dark:border-slate-800/70 last:border-0"><th class="text-left font-semibold py-1.5 pr-2 align-top text-slate-700 dark:text-slate-300 w-2/5">${r.label}</th><td class="py-1.5 text-slate-600 dark:text-slate-400 break-words">${r.value}</td></tr>`
      )
      .join('');

    const missingWarnHtml =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml(
            `Parâmetro ausente em {{Infocaixa organização}}: ${missingParams.join(', ')}`,
            missingParams,
            'missing_required_param',
            'Informe nome=... em {{Infocaixa organização}}',
            diagId,
            false
          )
        : '';

    return compactHtmlBlock(
      `<aside class="wiki-template infobox ${missingParams.length > 0 ? 'wiki-template-has-missing-params ring-1 ring-amber-400/70 dark:ring-amber-600/70' : ''} float-right clear-right ml-6 mb-4 w-72 md:w-80 border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 rounded-lg p-4 text-sm shadow-xs font-sans" data-template="Infocaixa organização">
        <div class="text-center pb-2 mb-3 border-b border-slate-200 dark:border-slate-800">
          <div class="font-bold text-base text-slate-900 dark:text-slate-100">${nome}</div>
          ${subtitulo ? `<div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${subtitulo}</div>` : ''}
          ${missingWarnHtml}
        </div>
        ${imgHtml}
        ${rowsHtml ? `<table class="w-full text-xs border-collapse">${rowsHtml}</table>` : ''}
      </aside>`
    );
  }

  // 15. {{Navbox}} / {{Caixa de navegação}}
  if (['navbox', 'navegação', 'navegacao', 'caixa de navegação', 'caixa de navegacao'].includes(normalizedKey)) {
    const rawTitulo = getParam(call, ['título', 'titulo', 'title'], '');
    const missingParams = !rawTitulo ? ['título'] : [];
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Navbox', missingParams) : undefined;
    const titulo = rawTitulo || 'Navegação';
    const groups: Array<{ label: string; list: string }> = [];

    for (let idx = 1; idx <= 8; idx++) {
      const label = getParam(call, [`grupo${idx}`, `group${idx}`], '');
      const list = getParam(call, [`lista${idx}`, `list${idx}`], '');
      if (label || list) {
        groups.push({ label: label || `Tópico ${idx}`, list });
      }
    }

    const rowsHtml = groups
      .map(
        g =>
          `<tr class="border-t border-slate-200 dark:border-slate-800">
            <th class="bg-slate-100/90 dark:bg-slate-800/80 text-right font-semibold px-3 py-2 text-slate-700 dark:text-slate-200 w-36 align-middle">${g.label}</th>
            <td class="px-3 py-2 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900/50">${g.list}</td>
          </tr>`
      )
      .join('');

    const missingWarnHtml =
      missingParams.length > 0 && highlightDiagnostics
        ? `<div class="px-3 py-2 border-t border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30">${buildMissingParamHtml(
            `Parâmetro ausente em {{Navbox}}: ${missingParams.join(', ')}`,
            missingParams,
            'missing_required_param',
            'Informe título=... na {{Navbox}}',
            diagId,
            true
          )}</div>`
        : '';

    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-navbox ${missingParams.length > 0 ? 'wiki-template-has-missing-params ring-1 ring-amber-400/70 dark:ring-amber-600/70' : ''} my-6 rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden font-sans text-xs shadow-2xs" role="navigation" aria-label="${escapeHtmlAttr(titulo)}" data-template="Navbox">
        <div class="bg-slate-200/80 dark:bg-slate-800 px-4 py-2 font-bold text-center text-slate-900 dark:text-slate-100 tracking-wide">
          ${titulo}
        </div>
        ${rowsHtml ? `<table class="w-full border-collapse">${rowsHtml}</table>` : ''}
        ${missingWarnHtml}
      </div>`
    );
  }

  // 16. {{Esclarecimento necessário}} / {{Clarify}} (inline)
  if (['esclarecimento necessário', 'esclarecimento necessario', 'clarify', 'esclarecer'].includes(normalizedKey)) {
    const razao = getParam(call, ['razão', 'razao', 'reason', '1'], '');
    const data = getParam(call, ['data', 'date', '2'], '');
    const tipParts = [razao || 'Este trecho necessita de esclarecimento editorial', data ? `(${data})` : ''].filter(Boolean);
    return `<sup class="wiki-template-inline noprint font-sans text-[10px] text-amber-700 dark:text-amber-400 ml-0.5 select-none" data-template="Esclarecimento necessário" title="${escapeHtmlAttr(tipParts.join(' '))}">[<i>esclarecimento necessário</i>]</sup>`;
  }

  // 17. {{Tecla}} / {{Kbd}} (inline keyboard shortcuts)
  if (['tecla', 'kbd', 'teclado'].includes(normalizedKey)) {
    const keys = call.positional.map(k => k.trim()).filter(Boolean);
    const singleNamed = getParam(call, ['tecla', 'key'], '');
    if (keys.length === 0 && !singleNamed) {
      const diagId = registerMissingRequired?.('Tecla', ['1']);
      if (highlightDiagnostics) {
        return buildMissingParamHtml(
          '{{Tecla}}: parâmetro obrigatório ausente (1)',
          ['1'],
          'missing_required_param',
          'Informe ao menos uma tecla, ex: {{Tecla|Ctrl|K}}',
          diagId,
          true
        );
      }
    }
    const effectiveKeys = keys.length > 0 ? keys : singleNamed ? [singleNamed] : ['Enter'];
    const renderedKeys = effectiveKeys
      .map(
        k =>
          `<kbd class="inline-block px-1.5 py-0.5 text-[11px] font-mono font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded shadow-2xs">${k}</kbd>`
      )
      .join('<span class="mx-0.5 text-slate-400 font-mono text-[10px]">+</span>');
    return `<span class="wiki-template-kbd inline-flex items-center align-baseline" data-template="Tecla">${renderedKeys}</span>`;
  }

  // 18. {{Citar web}} / {{Cite web}} (inline formatted bibliographic citation)
  if (['citar web', 'cite web', 'referência web', 'referencia web'].includes(normalizedKey)) {
    const rawTitulo = getParam(call, ['título', 'titulo', 'title', '1'], '');
    const url = getParam(call, ['url', 'link', '2'], '');
    const autor = getParam(call, ['autor', 'author'], '');
    const publicado = getParam(call, ['publicado', 'publisher', 'obra', 'work'], '');
    const data = getParam(call, ['data', 'ano', 'date', 'year'], '');
    const missingParams = [!rawTitulo ? 'título' : '', !url ? 'url' : ''].filter(Boolean);
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Citar web', missingParams) : undefined;
    const titulo = rawTitulo || 'Documento Web';
    const safeHref = /^https?:\/\//i.test(url) ? escapeHtmlAttr(url) : '';
    const titlePart = safeHref
      ? `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="text-blue-700 dark:text-blue-400 hover:underline font-medium">«${titulo}»</a>`
      : `<span>«${titulo}»</span>`;
    const missingBadge =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml(
            `parâmetro ausente: ${missingParams.join(', ')}`,
            missingParams,
            'missing_required_param',
            `Preencha ${missingParams.map(p => `${p}=...`).join(' e ')} em {{Citar web}}`,
            diagId,
            true
          )
        : '';
    const meta = [autor ? `${autor}.` : '', titlePart, publicado ? `<em>${publicado}</em>` : '', data ? `(${data})` : '', missingBadge]
      .filter(Boolean)
      .join(' ');
    return `<cite class="wiki-template-citation not-italic text-xs font-sans text-slate-700 dark:text-slate-300" data-template="Citar web">${meta}</cite>`;
  }

  // 19. {{Colunas}} / {{Lista de colunas}} / {{Div col}}
  if (['colunas', 'lista de colunas', 'div col'].includes(normalizedKey)) {
    const colCountRaw = Number(getParam(call, ['colunas', 'cols', '2'], '2'));
    const colClass = colCountRaw === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
    const rawContent = getParam(call, ['1', 'conteúdo', 'conteudo', 'content'], '');
    if (!rawContent) {
      const diagId = registerMissingRequired?.('Colunas', ['1']);
      if (!highlightDiagnostics) return '';
      return compactHtmlBlock(
        `<div class="wiki-template wiki-template-columns my-4" data-template="Colunas">${buildMissingParamHtml(
          '{{Colunas}}: parâmetro obrigatório ausente (1 / conteúdo)',
          ['1'],
          'missing_required_param',
          'Informe itens separados por · ou quebra de linha em {{Colunas}}',
          diagId,
          true
        )}</div>`
      );
    }
    const items = rawContent
      .split(/\s*·\s*|\n+/)
      .map(s => s.replace(/^\*\s*/, '').trim())
      .filter(Boolean);
    const itemsHtml = items
      .map(item => `<div class="py-0.5 text-xs text-slate-700 dark:text-slate-300">• ${item}</div>`)
      .join('');
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-columns my-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 p-3.5 grid grid-cols-1 ${colClass} gap-x-6 gap-y-1 font-sans" data-template="Colunas">
        ${itemsHtml}
      </div>`
    );
  }

  // 20. {{Reflist}} / {{Referências}}
  if (['reflist', 'referências', 'referencias', 'listaref'].includes(normalizedKey)) {
    return `<div class="wiki-template-reflist-anchor" data-template="Reflist"></div>`;
  }

  // 21. {{Mais fontes}} / {{More citations needed}}
  if (['mais fontes', 'sem notas', 'faltam fontes', 'more citations needed', 'refimprove'].includes(normalizedKey)) {
    const data = getParam(call, ['data', 'date', '1'], '');
    const assunto = getParam(call, ['assunto', 'seção', 'secao', 'topic', '2'], '');
    const dataNote = data ? ` <span class="text-[11px] font-mono opacity-75">(${escapeTemplateHtml(data)})</span>` : '';
    const assuntoNote = assunto ? ` Na seção <strong>${escapeTemplateHtml(assunto)}</strong>.` : '';
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-ambox not-prose my-4 rounded-lg border border-amber-300 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/35 p-4 text-xs text-amber-950 dark:text-amber-100 font-sans flex items-start gap-3" role="note" data-template="Mais fontes">
        <span class="shrink-0 w-7 h-7 rounded-md border border-amber-200 dark:border-amber-800 bg-white/90 dark:bg-amber-900/40 flex items-center justify-center font-bold text-amber-700 dark:text-amber-300" aria-hidden="true">+</span>
        <div class="leading-relaxed">
          <strong class="block font-bold mb-0.5">Este artigo precisa de fontes adicionais para verificação.${dataNote}</strong>
          <span>Ajude a melhorar este verbete citando referências confiáveis e independentes.${assuntoNote}</span>
        </div>
      </div>`
    );
  }

  // 22. {{Wikificação}} / {{Wikificar}} / {{Wikify}}
  if (['wikificação', 'wikificacao', 'wikificar', 'formatar', 'wikify'].includes(normalizedKey)) {
    const data = getParam(call, ['data', 'date', '1'], '');
    const motivo = getParam(call, ['motivo', 'reason', '2'], 'Recomenda-se formatar seções, ligações internas ([[wikilinks]]) e referências segundo o manual de estilo.');
    const dataNote = data ? ` <span class="text-[11px] font-mono opacity-75">(${escapeTemplateHtml(data)})</span>` : '';
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-ambox not-prose my-4 rounded-lg border border-violet-200 dark:border-violet-800/80 bg-violet-50/85 dark:bg-violet-950/35 p-4 text-xs text-violet-950 dark:text-violet-100 font-sans flex items-start gap-3" role="note" data-template="Wikificação">
        <span class="shrink-0 w-7 h-7 rounded-md border border-violet-200 dark:border-violet-800 bg-white/90 dark:bg-violet-900/40 flex items-center justify-center font-mono font-bold text-violet-700 dark:text-violet-300" aria-hidden="true">[[]]</span>
        <div class="leading-relaxed">
          <strong class="block font-bold mb-0.5">Este verbete precisa ser wikificado.${dataNote}</strong>
          <span>${escapeTemplateHtml(motivo)}</span>
        </div>
      </div>`
    );
  }

  // 23. {{Fusão}} / {{Fundir com}} / {{Merge}}
  if (['fusão', 'fusao', 'fundir', 'fundir com', 'merge'].includes(normalizedKey)) {
    const alvo = getParam(call, ['1', 'artigo', 'destino', 'target'], '');
    const data = getParam(call, ['data', 'date'], '');
    const motivo = getParam(call, ['motivo', 'reason'], '');
    if (!alvo) {
      const diagId = registerMissingRequired?.('Fusão', ['1']);
      if (!highlightDiagnostics) return '';
      return compactHtmlBlock(
        `<div class="wiki-template wiki-template-ambox my-4" data-template="Fusão">${buildMissingParamHtml(
          '{{Fusão}}: parâmetro obrigatório ausente (1)',
          ['1'],
          'missing_required_param',
          'Informe o artigo de destino, ex: {{Fusão|Artigo Destino}}',
          diagId,
          true
        )}</div>`
      );
    }
    const targetHref = `#/wiki/${encodeURIComponent(alvo.replace(/\s+/g, '_'))}`;
    const dataNote = data ? ` <span class="text-[11px] font-mono opacity-75">(${escapeTemplateHtml(data)})</span>` : '';
    const motivoHtml = motivo ? ` <span class="opacity-90">Motivo: ${escapeTemplateHtml(motivo)}</span>` : '';
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-ambox not-prose my-4 rounded-lg border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/85 dark:bg-indigo-950/35 p-4 text-xs text-indigo-950 dark:text-indigo-100 font-sans flex items-start gap-3" role="note" data-template="Fusão">
        <span class="shrink-0 w-7 h-7 rounded-md border border-indigo-200 dark:border-indigo-800 bg-white/90 dark:bg-indigo-900/40 flex items-center justify-center font-bold text-indigo-700 dark:text-indigo-300" aria-hidden="true">⇄</span>
        <div class="leading-relaxed">
          <strong class="block font-bold mb-0.5">Proposta de fusão de conteúdo${dataNote}</strong>
          <span>Foi sugerido que este artigo seja fundido com <a href="${targetHref}" class="wiki-link font-semibold text-blue-700 dark:text-blue-400 hover:underline">${escapeTemplateHtml(alvo)}</a>.${motivoHtml}</span>
        </div>
      </div>`
    );
  }

  // 24. {{Atualizar}} / {{Desatualizado}} / {{Update}}
  if (['atualizar', 'desatualizado', 'update', 'out of date'].includes(normalizedKey)) {
    const data = getParam(call, ['data', 'date', '1'], '');
    const parte = getParam(call, ['parte', 'part', 'motivo', '2'], '');
    const dataNote = data ? ` <span class="text-[11px] font-mono opacity-75">(${escapeTemplateHtml(data)})</span>` : '';
    const parteHtml = parte ? ` Trecho sinalizado: <strong>${escapeTemplateHtml(parte)}</strong>.` : '';
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-ambox not-prose my-4 rounded-lg border border-amber-300 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/35 p-4 text-xs text-amber-950 dark:text-amber-100 font-sans flex items-start gap-3" role="note" data-template="Atualizar">
        <span class="shrink-0 w-7 h-7 rounded-md border border-amber-200 dark:border-amber-800 bg-white/90 dark:bg-amber-900/40 flex items-center justify-center font-bold text-amber-700 dark:text-amber-300" aria-hidden="true">↻</span>
        <div class="leading-relaxed">
          <strong class="block font-bold mb-0.5">Este artigo ou seção necessita de atualização.${dataNote}</strong>
          <span>Algumas informações podem estar desatualizadas em relação a eventos ou versões recentes.${parteHtml}</span>
        </div>
      </div>`
    );
  }

  // 25. {{Publicidade}} / {{Advert}}
  if (['publicidade', 'propaganda', 'advert', 'tom promocional'].includes(normalizedKey)) {
    const data = getParam(call, ['data', 'date', '1'], '');
    const motivo = getParam(call, ['motivo', 'reason', '2'], 'O texto parece conter linguagem promocional e deve ser reescrito em tom enciclopédico neutro.');
    const dataNote = data ? ` <span class="text-[11px] font-mono opacity-75">(${escapeTemplateHtml(data)})</span>` : '';
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-ambox not-prose my-4 rounded-lg border border-rose-200 dark:border-rose-800/80 bg-rose-50/85 dark:bg-rose-950/35 p-4 text-xs text-rose-950 dark:text-rose-100 font-sans flex items-start gap-3" role="note" data-template="Publicidade">
        <span class="shrink-0 w-7 h-7 rounded-md border border-rose-200 dark:border-rose-800 bg-white/90 dark:bg-rose-900/40 flex items-center justify-center font-bold text-rose-700 dark:text-rose-300" aria-hidden="true">!</span>
        <div class="leading-relaxed">
          <strong class="block font-bold mb-0.5">Aviso de redação promocional ou publicitária.${dataNote}</strong>
          <span>${escapeTemplateHtml(motivo)}</span>
        </div>
      </div>`
    );
  }

  // 26. {{Controverso}} / {{Disputed}}
  if (['controverso', 'polêmico', 'polemico', 'disputado', 'disputed'].includes(normalizedKey)) {
    const motivo = getParam(call, ['motivo', 'reason', '1'], 'A exatidão factual de afirmações neste artigo está em debate editorial.');
    const data = getParam(call, ['data', 'date', '2'], '');
    const dataNote = data ? ` <span class="text-[11px] font-mono opacity-75">(${escapeTemplateHtml(data)})</span>` : '';
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-ambox not-prose my-4 rounded-lg border border-amber-300 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/35 p-4 text-xs text-amber-950 dark:text-amber-100 font-sans flex items-start gap-3" role="note" data-template="Controverso">
        <span class="shrink-0 w-7 h-7 rounded-md border border-amber-200 dark:border-amber-800 bg-white/90 dark:bg-amber-900/40 flex items-center justify-center font-bold text-amber-700 dark:text-amber-300" aria-hidden="true">?</span>
        <div class="leading-relaxed">
          <strong class="block font-bold mb-0.5">Exatidão factual contestada.${dataNote}</strong>
          <span>${escapeTemplateHtml(motivo)}</span>
        </div>
      </div>`
    );
  }

  // 27. {{Protegido}} / {{Pp}} / {{Protected}}
  if (['protegido', 'pp', 'semiprotegido', 'protected'].includes(normalizedKey)) {
    const nivel = getParam(call, ['nível', 'nivel', 'level', '1'], 'semiproteção');
    const motivo = getParam(call, ['motivo', 'reason', '2'], 'Página protegida conforme política editorial de preservação.');
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-protected not-prose my-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-900/80 p-3.5 text-xs text-slate-800 dark:text-slate-200 font-sans flex items-center gap-3" role="note" data-template="Protegido">
        <span class="shrink-0 w-7 h-7 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200" aria-hidden="true">🔒</span>
        <div class="leading-relaxed">
          <strong>Página sob ${escapeTemplateHtml(nivel)}:</strong> ${escapeTemplateHtml(motivo)}
        </div>
      </div>`
    );
  }

  // 28. {{Redireciona}} / {{Redirect}}
  if (['redireciona', 'redirect', 'redir'].includes(normalizedKey)) {
    const termo = getParam(call, ['1', 'termo'], '');
    const destino = getParam(call, ['2', 'destino'], '');
    if (!termo) {
      const diagId = registerMissingRequired?.('Redireciona', ['1']);
      if (!highlightDiagnostics) return '';
      return compactHtmlBlock(
        `<div class="wiki-template wiki-template-hatnote my-2" data-template="Redireciona">${buildMissingParamHtml(
          '{{Redireciona}}: parâmetro obrigatório ausente (1)',
          ['1'],
          'missing_required_param',
          'Informe o termo redirecionado, ex: {{Redireciona|Wiki|Wiki (desambiguação)}}',
          diagId,
          true
        )}</div>`
      );
    }
    const targetName = destino || `${termo} (desambiguação)`;
    const href = `#/wiki/${encodeURIComponent(targetName.replace(/\s+/g, '_'))}`;
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-hatnote not-prose pl-3 py-1 my-2 text-xs italic text-slate-600 dark:text-slate-400 font-sans" data-template="Redireciona">
        ↳ “${escapeTemplateHtml(termo)}” redireciona para este artigo. Para outros significados, veja <a href="${href}" class="wiki-link font-semibold text-blue-700 dark:text-blue-400 hover:underline">${escapeTemplateHtml(targetName)}</a>.
      </div>`
    );
  }

  // 29. {{Sobre}} / {{About}} / {{Ver desambiguação}}
  if (['sobre', 'ver desambiguação', 'ver desambiguacao', 'about', 'outros usos'].includes(normalizedKey)) {
    const assunto = getParam(call, ['1', 'assunto'], '');
    const outroUso = getParam(call, ['2'], 'outros significados');
    const destino = getParam(call, ['3', 'destino'], `${pageTitle} (desambiguação)`);
    if (!assunto) {
      const diagId = registerMissingRequired?.('Sobre', ['1']);
      if (!highlightDiagnostics) return '';
      return compactHtmlBlock(
        `<div class="wiki-template wiki-template-hatnote my-2" data-template="Sobre">${buildMissingParamHtml(
          '{{Sobre}}: parâmetro obrigatório ausente (1)',
          ['1'],
          'missing_required_param',
          'Informe o assunto deste artigo, ex: {{Sobre|o software|outros significados|Termo (desambiguação)}}',
          diagId,
          true
        )}</div>`
      );
    }
    const href = `#/wiki/${encodeURIComponent(destino.replace(/\s+/g, '_'))}`;
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-hatnote not-prose pl-3 py-1 my-2 text-xs italic text-slate-600 dark:text-slate-400 font-sans" data-template="Sobre">
        ↳ Este artigo é sobre ${escapeTemplateHtml(assunto)}. Para ${escapeTemplateHtml(outroUso)}, veja <a href="${href}" class="wiki-link font-semibold text-blue-700 dark:text-blue-400 hover:underline">${escapeTemplateHtml(destino)}</a>.
      </div>`
    );
  }

  // 30. {{Distinguir}} / {{Não confundir}} / {{Distinguish}}
  if (['distinguir', 'não confundir', 'nao confundir', 'distinguish'].includes(normalizedKey)) {
    const targets = call.positional.map(t => t.trim()).filter(Boolean);
    if (targets.length === 0) {
      const diagId = registerMissingRequired?.('Distinguir', ['1']);
      if (!highlightDiagnostics) return '';
      return compactHtmlBlock(
        `<div class="wiki-template wiki-template-hatnote my-2" data-template="Distinguir">${buildMissingParamHtml(
          '{{Distinguir}}: parâmetro obrigatório ausente (1)',
          ['1'],
          'missing_required_param',
          'Informe ao menos um termo semelhante, ex: {{Distinguir|JavaScript|TypeScript}}',
          diagId,
          true
        )}</div>`
      );
    }
    const linksHtml = targets
      .map(t => `<a href="#/wiki/${encodeURIComponent(t.replace(/\s+/g, '_'))}" class="wiki-link font-semibold text-blue-700 dark:text-blue-400 hover:underline">${escapeTemplateHtml(t)}</a>`)
      .join(' ou ');
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-hatnote not-prose pl-3 py-1 my-2 text-xs italic text-slate-600 dark:text-slate-400 font-sans" data-template="Distinguir">
        ↳ Não confundir com ${linksHtml}.
      </div>`
    );
  }

  // 31. {{Portal}} / {{Portais}}
  if (['portal', 'portais', 'portal3'].includes(normalizedKey)) {
    const portals = call.positional.map(p => p.trim()).filter(Boolean);
    if (portals.length === 0) {
      const diagId = registerMissingRequired?.('Portal', ['1']);
      if (!highlightDiagnostics) return '';
      return compactHtmlBlock(
        `<div class="wiki-template wiki-template-portal my-3" data-template="Portal">${buildMissingParamHtml(
          '{{Portal}}: parâmetro obrigatório ausente (1)',
          ['1'],
          'missing_required_param',
          'Informe ao menos um portal, ex: {{Portal|Tecnologia|Ciência}}',
          diagId,
          true
        )}</div>`
      );
    }
    const chipsHtml = portals
      .map(p => {
        const target = `Portal:${p.replace(/^Portal:/i, '').trim()}`;
        const href = `#/wiki/${encodeURIComponent(target.replace(/\s+/g, '_'))}`;
        return `<a href="${href}" class="wiki-link inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"><span aria-hidden="true">❖</span>Portal ${escapeTemplateHtml(p.replace(/^Portal:/i, '').trim())}</a>`;
      })
      .join(' ');
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-portal not-prose my-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 px-3.5 py-2.5 flex flex-wrap items-center gap-2 font-sans" data-template="Portal">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">Portais:</span>
        ${chipsHtml}
      </div>`
    );
  }

  // 32. {{Correlatos}} / {{Wikimedia}}
  if (['correlatos', 'projetos irmãos', 'projetos irmaos', 'wikimedia', 'sister project links'].includes(normalizedKey)) {
    const projects: Array<{ label: string; value: string; baseUrl: string }> = [
      { label: 'Wikimedia Commons', value: getParam(call, ['commons', '1'], ''), baseUrl: 'https://commons.wikimedia.org/wiki/' },
      { label: 'Wikiquote', value: getParam(call, ['wikiquote', '2'], ''), baseUrl: 'https://pt.wikiquote.org/wiki/' },
      { label: 'Wikcionário', value: getParam(call, ['wikcionario', 'wikcionário', 'wiktionary', '3'], ''), baseUrl: 'https://pt.wiktionary.org/wiki/' },
      { label: 'Wikisource', value: getParam(call, ['wikisource', '4'], ''), baseUrl: 'https://pt.wikisource.org/wiki/' },
    ].filter(p => p.value);

    const items = projects.length > 0 ? projects : [{ label: 'Wikimedia Commons', value: pageTitle, baseUrl: 'https://commons.wikimedia.org/wiki/' }];
    const listHtml = items
      .map(
        p =>
          `<li class="flex items-center justify-between gap-2 py-1 border-b border-slate-100 dark:border-slate-800 last:border-0"><span class="text-slate-600 dark:text-slate-400">${p.label}</span><a href="${escapeHtmlAttr(p.baseUrl + encodeURIComponent(p.value.replace(/\s+/g, '_')))}" target="_blank" rel="noopener noreferrer" class="font-medium text-blue-700 dark:text-blue-400 hover:underline truncate">${escapeTemplateHtml(p.value)}</a></li>`
      )
      .join('');
    return compactHtmlBlock(
      `<aside class="wiki-template wiki-template-sister not-prose my-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/75 p-3.5 text-xs font-sans max-w-md" data-template="Correlatos">
        <div class="font-bold text-slate-800 dark:text-slate-200 pb-1.5 mb-1.5 border-b border-slate-200 dark:border-slate-800">Projetos correlatos Wikimedia</div>
        <ul class="m-0 p-0 list-none">${listHtml}</ul>
      </aside>`
    );
  }

  // 33. {{Controle de autoridade}} / {{Authority control}}
  if (['controle de autoridade', 'authority control', 'autoridade'].includes(normalizedKey)) {
    const entries: Array<{ label: string; value: string; url: string }> = [
      { label: 'VIAF', value: getParam(call, ['VIAF', 'viaf'], ''), url: 'https://viaf.org/viaf/' },
      { label: 'ISNI', value: getParam(call, ['ISNI', 'isni'], ''), url: 'https://isni.org/isni/' },
      { label: 'ORCID', value: getParam(call, ['ORCID', 'orcid'], ''), url: 'https://orcid.org/' },
      { label: 'LCCN', value: getParam(call, ['LCCN', 'lccn'], ''), url: 'https://id.loc.gov/authorities/names/' },
      { label: 'GND', value: getParam(call, ['GND', 'gnd'], ''), url: 'https://d-nb.info/gnd/' },
      { label: 'Wikidata', value: getParam(call, ['Wikidata', 'wikidata'], ''), url: 'https://www.wikidata.org/wiki/' },
    ].filter(e => e.value);

    const chipsHtml =
      entries.length > 0
        ? entries
            .map(
              e =>
                `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px]"><strong class="text-slate-600 dark:text-slate-300">${e.label}:</strong> <a href="${escapeHtmlAttr(e.url + encodeURIComponent(e.value.replace(/\s+/g, '')))}" target="_blank" rel="noopener noreferrer" class="font-mono text-blue-700 dark:text-blue-400 hover:underline">${escapeTemplateHtml(e.value)}</a></span>`
            )
            .join(' ')
        : `<span class="text-slate-500 dark:text-slate-400 italic">Sem identificadores externos informados.</span>`;

    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-authority not-prose my-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/85 dark:bg-slate-900/75 px-4 py-2.5 font-sans text-xs flex flex-wrap items-center gap-2" role="navigation" aria-label="Controle de autoridade" data-template="Controle de autoridade">
        <span class="font-bold text-slate-700 dark:text-slate-200 mr-1">Controle de autoridade</span>
        ${chipsHtml}
      </div>`
    );
  }

  // 34. {{Infocaixa país}} / {{Info/País}}
  if (['infocaixa país', 'infocaixa pais', 'info/país', 'info/pais'].includes(normalizedKey)) {
    const rawNome = getParam(call, ['nome', 'name', 'título', 'titulo', '1'], '');
    const missingParams = !rawNome ? ['nome'] : [];
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Infocaixa país', missingParams) : undefined;
    const nome = rawNome || pageTitle;
    const rows = [
      { label: 'Capital', value: getParam(call, ['capital'], '') },
      { label: 'Idioma oficial', value: getParam(call, ['idioma', 'língua', 'lingua', 'idiomas'], '') },
      { label: 'Governo', value: getParam(call, ['governo', 'sistema'], '') },
      { label: 'População', value: getParam(call, ['população', 'populacao'], '') },
      { label: 'Área total', value: getParam(call, ['área', 'area'], '') },
      { label: 'Moeda', value: getParam(call, ['moeda', 'currency'], '') },
    ].filter(r => r.value);
    const missingWarnHtml =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml('Parâmetro ausente em {{Infocaixa país}}: nome', missingParams, 'missing_required_param', 'Informe nome=... em {{Infocaixa país}}', diagId, false)
        : '';
    return renderStructuredInfoboxCard({
      templateAttr: 'Infocaixa país',
      title: nome,
      subtitle: 'País / Território',
      imageSrc: getParam(call, ['imagem', 'bandeira', 'image'], ''),
      rows,
      missingParams,
      missingWarnHtml,
    });
  }

  // 35. {{Infocaixa município}} / {{Info/Município}} / {{Infocaixa cidade}}
  if (['infocaixa município', 'infocaixa municipio', 'info/município', 'info/municipio', 'infocaixa cidade', 'info/cidade'].includes(normalizedKey)) {
    const rawNome = getParam(call, ['nome', 'name', 'título', 'titulo', '1'], '');
    const missingParams = !rawNome ? ['nome'] : [];
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Infocaixa município', missingParams) : undefined;
    const nome = rawNome || pageTitle;
    const rows = [
      { label: 'Estado', value: getParam(call, ['estado', 'uf', 'província', 'provincia'], '') },
      { label: 'País', value: getParam(call, ['país', 'pais', 'country'], '') },
      { label: 'Fundação', value: getParam(call, ['fundação', 'fundacao'], '') },
      { label: 'População', value: getParam(call, ['população', 'populacao'], '') },
      { label: 'Área', value: getParam(call, ['área', 'area'], '') },
      { label: 'Fuso horário', value: getParam(call, ['fuso', 'timezone'], '') },
      { label: 'Website', value: getParam(call, ['website', 'site'], '') },
    ].filter(r => r.value);
    const missingWarnHtml =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml('Parâmetro ausente em {{Infocaixa município}}: nome', missingParams, 'missing_required_param', 'Informe nome=... em {{Infocaixa município}}', diagId, false)
        : '';
    return renderStructuredInfoboxCard({
      templateAttr: 'Infocaixa município',
      title: nome,
      subtitle: 'Município / Cidade',
      imageSrc: getParam(call, ['imagem', 'brasão', 'brasao', 'image'], ''),
      rows,
      missingParams,
      missingWarnHtml,
    });
  }

  // 36. {{Infocaixa filme}} / {{Info/Filme}}
  if (['infocaixa filme', 'info/filme', 'infocaixa cinema'].includes(normalizedKey)) {
    const rawTitulo = getParam(call, ['título', 'titulo', 'title', 'nome', '1'], '');
    const missingParams = !rawTitulo ? ['título'] : [];
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Infocaixa filme', missingParams) : undefined;
    const titulo = rawTitulo || pageTitle;
    const rows = [
      { label: 'Direção', value: getParam(call, ['direção', 'direcao', 'diretor', 'director'], '') },
      { label: 'Roteiro', value: getParam(call, ['roteiro', 'writer'], '') },
      { label: 'Elenco', value: getParam(call, ['elenco', 'starring'], '') },
      { label: 'Gênero', value: getParam(call, ['gênero', 'genero', 'genre'], '') },
      { label: 'Duração', value: getParam(call, ['duração', 'duracao', 'runtime'], '') },
      { label: 'Ano', value: getParam(call, ['ano', 'lançamento', 'lancamento', 'year'], '') },
      { label: 'País', value: getParam(call, ['país', 'pais', 'country'], '') },
    ].filter(r => r.value);
    const missingWarnHtml =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml('Parâmetro ausente em {{Infocaixa filme}}: título', missingParams, 'missing_required_param', 'Informe título=... em {{Infocaixa filme}}', diagId, false)
        : '';
    return renderStructuredInfoboxCard({
      templateAttr: 'Infocaixa filme',
      title: titulo,
      subtitle: 'Filme',
      imageSrc: getParam(call, ['imagem', 'poster', 'image'], ''),
      rows,
      missingParams,
      missingWarnHtml,
    });
  }

  // 37. {{Infocaixa livro}} / {{Info/Livro}}
  if (['infocaixa livro', 'info/livro', 'infocaixa obra'].includes(normalizedKey)) {
    const rawTitulo = getParam(call, ['título', 'titulo', 'title', 'nome', '1'], '');
    const missingParams = !rawTitulo ? ['título'] : [];
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Infocaixa livro', missingParams) : undefined;
    const titulo = rawTitulo || pageTitle;
    const rows = [
      { label: 'Autor', value: getParam(call, ['autor', 'author'], '') },
      { label: 'Gênero', value: getParam(call, ['gênero', 'genero', 'genre'], '') },
      { label: 'Editora', value: getParam(call, ['editora', 'publisher'], '') },
      { label: 'Lançamento', value: getParam(call, ['ano', 'lançamento', 'lancamento', 'year'], '') },
      { label: 'Páginas', value: getParam(call, ['páginas', 'paginas', 'pages'], '') },
      { label: 'ISBN', value: getParam(call, ['isbn'], '') },
      { label: 'Idioma', value: getParam(call, ['idioma', 'language'], '') },
    ].filter(r => r.value);
    const missingWarnHtml =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml('Parâmetro ausente em {{Infocaixa livro}}: título', missingParams, 'missing_required_param', 'Informe título=... em {{Infocaixa livro}}', diagId, false)
        : '';
    return renderStructuredInfoboxCard({
      templateAttr: 'Infocaixa livro',
      title: titulo,
      subtitle: 'Obra Literária',
      imageSrc: getParam(call, ['imagem', 'capa', 'image'], ''),
      rows,
      missingParams,
      missingWarnHtml,
    });
  }

  // 38. {{Infocaixa jogo}} / {{Info/Jogo}}
  if (['infocaixa jogo', 'info/jogo', 'infocaixa videojogo', 'info/videojogo'].includes(normalizedKey)) {
    const rawTitulo = getParam(call, ['título', 'titulo', 'title', 'nome', '1'], '');
    const missingParams = !rawTitulo ? ['título'] : [];
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Infocaixa jogo', missingParams) : undefined;
    const titulo = rawTitulo || pageTitle;
    const rows = [
      { label: 'Desenvolvedora', value: getParam(call, ['desenvolvedora', 'developer'], '') },
      { label: 'Publicadora', value: getParam(call, ['publicadora', 'publisher'], '') },
      { label: 'Gênero', value: getParam(call, ['gênero', 'genero', 'genre'], '') },
      { label: 'Plataformas', value: getParam(call, ['plataformas', 'plataforma', 'platforms'], '') },
      { label: 'Lançamento', value: getParam(call, ['lançamento', 'lancamento', 'ano', 'release'], '') },
      { label: 'Modos', value: getParam(call, ['modos', 'modes'], '') },
    ].filter(r => r.value);
    const missingWarnHtml =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml('Parâmetro ausente em {{Infocaixa jogo}}: título', missingParams, 'missing_required_param', 'Informe título=... em {{Infocaixa jogo}}', diagId, false)
        : '';
    return renderStructuredInfoboxCard({
      templateAttr: 'Infocaixa jogo',
      title: titulo,
      subtitle: 'Jogo Eletrônico',
      imageSrc: getParam(call, ['imagem', 'capa', 'image'], ''),
      rows,
      missingParams,
      missingWarnHtml,
    });
  }

  // 39. {{Infocaixa álbum}} / {{Info/Álbum}}
  if (['infocaixa álbum', 'infocaixa album', 'info/álbum', 'info/album', 'infocaixa disco'].includes(normalizedKey)) {
    const rawNome = getParam(call, ['nome', 'título', 'titulo', 'name', '1'], '');
    const missingParams = !rawNome ? ['nome'] : [];
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Infocaixa álbum', missingParams) : undefined;
    const nome = rawNome || pageTitle;
    const tipo = getParam(call, ['tipo', 'type'], 'Álbum musical');
    const rows = [
      { label: 'Artista', value: getParam(call, ['artista', 'artist', 'banda'], '') },
      { label: 'Lançamento', value: getParam(call, ['lançamento', 'lancamento', 'ano', 'released'], '') },
      { label: 'Gênero', value: getParam(call, ['gênero', 'genero', 'genre'], '') },
      { label: 'Duração', value: getParam(call, ['duração', 'duracao', 'length'], '') },
      { label: 'Gravadora', value: getParam(call, ['gravadora', 'label'], '') },
    ].filter(r => r.value);
    const missingWarnHtml =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml('Parâmetro ausente em {{Infocaixa álbum}}: nome', missingParams, 'missing_required_param', 'Informe nome=... em {{Infocaixa álbum}}', diagId, false)
        : '';
    return renderStructuredInfoboxCard({
      templateAttr: 'Infocaixa álbum',
      title: nome,
      subtitle: tipo,
      imageSrc: getParam(call, ['imagem', 'capa', 'cover', 'image'], ''),
      rows,
      missingParams,
      missingWarnHtml,
    });
  }

  // 40. {{Infocaixa taxonomia}} / {{Info/Taxonomia}} / {{Taxocaixa}}
  if (['infocaixa taxonomia', 'info/taxonomia', 'taxocaixa', 'taxobox'].includes(normalizedKey)) {
    const rawNome = getParam(call, ['nome', 'name', 'título', 'titulo', '1'], '');
    const missingParams = !rawNome ? ['nome'] : [];
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Infocaixa taxonomia', missingParams) : undefined;
    const nome = rawNome || pageTitle;
    const estado = getParam(call, ['estado', 'conservação', 'conservacao', 'status'], '');
    const rows: Array<{ label: string; value: string; italicValue?: boolean }> = [
      { label: 'Reino', value: getParam(call, ['reino', 'regnum'], '') },
      { label: 'Filo', value: getParam(call, ['filo', 'divisão', 'divisao', 'phylum'], '') },
      { label: 'Classe', value: getParam(call, ['classe', 'classis'], '') },
      { label: 'Ordem', value: getParam(call, ['ordem', 'ordo'], '') },
      { label: 'Família', value: getParam(call, ['família', 'familia', 'familia'], '') },
      { label: 'Gênero', value: getParam(call, ['gênero', 'genero', 'genus'], ''), italicValue: true },
      { label: 'Espécie', value: getParam(call, ['espécie', 'especie', 'species', 'binomial'], ''), italicValue: true },
    ].filter(r => r.value);
    const missingWarnHtml =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml('Parâmetro ausente em {{Infocaixa taxonomia}}: nome', missingParams, 'missing_required_param', 'Informe nome=... em {{Infocaixa taxonomia}}', diagId, false)
        : '';
    return renderStructuredInfoboxCard({
      templateAttr: 'Infocaixa taxonomia',
      title: nome,
      subtitle: estado ? `Conservação: ${estado}` : 'Classificação científica',
      imageSrc: getParam(call, ['imagem', 'image'], ''),
      rows,
      missingParams,
      missingWarnHtml,
    });
  }

  // 41. {{Quem?}} / {{Quando?}} / {{Por quê?}} (inline editorial markers)
  if (['quem?', 'quem', 'who'].includes(normalizedKey)) {
    const data = getParam(call, ['data', 'date', '1'], '');
    const tip = data ? `Atribuição vaga sinalizada em ${escapeHtmlAttr(data)}` : 'Quem afirma isso? Requer atribuição específica';
    return `<sup class="wiki-template-inline noprint font-sans text-[10px] text-slate-500 dark:text-slate-400 ml-0.5 select-none" data-template="Quem?" title="${tip}">[<i>quem?</i>]</sup>`;
  }

  if (['quando?', 'quando', 'when'].includes(normalizedKey)) {
    const data = getParam(call, ['data', 'date', '1'], '');
    const tip = data ? `Referência temporal vaga sinalizada em ${escapeHtmlAttr(data)}` : 'Quando isso ocorreu? Especificar período ou data';
    return `<sup class="wiki-template-inline noprint font-sans text-[10px] text-slate-500 dark:text-slate-400 ml-0.5 select-none" data-template="Quando?" title="${tip}">[<i>quando?</i>]</sup>`;
  }

  if (['por quê?', 'por que?', 'por quê', 'por que', 'why'].includes(normalizedKey)) {
    const razao = getParam(call, ['razão', 'razao', 'reason', '1'], '');
    const data = getParam(call, ['data', 'date', '2'], '');
    const tipParts = [razao || 'Por quê? Necessita justificativa ou explicação causal', data ? `(${data})` : ''].filter(Boolean);
    return `<sup class="wiki-template-inline noprint font-sans text-[10px] text-amber-700 dark:text-amber-400 ml-0.5 select-none" data-template="Por quê?" title="${escapeHtmlAttr(tipParts.join(' '))}">[<i>por quê?</i>]</sup>`;
  }

  // 42. {{Caixa de diálogo}} / {{Ocultar}} / {{Collapse}}
  if (['caixa de diálogo', 'caixa de dialogo', 'ocultar', 'collapse', 'cot'].includes(normalizedKey)) {
    const titulo = getParam(call, ['título', 'titulo', 'title'], 'Conteúdo recolhido');
    const conteudo = getParam(call, ['1', 'conteúdo', 'conteudo', 'content', 'texto'], '');
    if (!conteudo) {
      const diagId = registerMissingRequired?.('Caixa de diálogo', ['1']);
      if (!highlightDiagnostics) return '';
      return compactHtmlBlock(
        `<div class="wiki-template my-4" data-template="Caixa de diálogo">${buildMissingParamHtml(
          '{{Caixa de diálogo}}: parâmetro obrigatório ausente (1 / conteúdo)',
          ['1'],
          'missing_required_param',
          'Informe o conteúdo oculto em {{Caixa de diálogo|título=...|1=...}}',
          diagId,
          true
        )}</div>`
      );
    }
    return compactHtmlBlock(
      `<details class="wiki-template wiki-template-collapse not-prose my-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 font-sans text-xs overflow-hidden" data-template="Caixa de diálogo">
        <summary class="px-3.5 py-2 font-semibold text-slate-800 dark:text-slate-200 bg-slate-100/90 dark:bg-slate-800/80 cursor-pointer select-none hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors">${escapeTemplateHtml(titulo)}</summary>
        <div class="p-3.5 text-slate-700 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-800">${escapeTemplateHtml(conteudo)}</div>
      </details>`
    );
  }

  // 43. {{Sem quebra}} / {{Nowrap}}
  if (['sem quebra', 'nowrap', 'nobr'].includes(normalizedKey)) {
    const texto = getParam(call, ['1', 'texto'], '');
    if (!texto) {
      const diagId = registerMissingRequired?.('Sem quebra', ['1']);
      if (highlightDiagnostics) {
        return buildMissingParamHtml('{{Sem quebra}}: parâmetro obrigatório ausente (1)', ['1'], 'missing_required_param', 'Informe o texto, ex: {{Sem quebra|100 km/h}}', diagId, true);
      }
      return '';
    }
    return `<span class="wiki-template-nowrap whitespace-nowrap" data-template="Sem quebra">${escapeTemplateHtml(texto)}</span>`;
  }

  // 44. {{Símbolo}} / {{Done}} / {{Feito}} / {{Não feito}}
  if (['símbolo', 'simbolo', 'done', 'feito', 'não feito', 'nao feito', 'check', 'cross'].includes(normalizedKey)) {
    const defaultMode = ['não feito', 'nao feito', 'cross'].includes(normalizedKey) ? 'nao' : 'feito';
    const estadoRaw = getParam(call, ['1', 'estado', 'status'], defaultMode).toLowerCase();
    const defaultLabel = estadoRaw === 'nao' || estadoRaw === 'não' ? 'Não feito' : estadoRaw === 'pendente' ? 'Pendente' : estadoRaw === 'atencao' || estadoRaw === 'atenção' ? 'Atenção' : 'Feito';
    const label = getParam(call, ['2', 'texto', 'label'], ['done', 'feito', 'não feito', 'nao feito'].includes(normalizedKey) ? defaultLabel : '');
    let icon = '✓';
    let colorClass = 'text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40';
    if (['nao', 'não', 'cross', 'no', 'x'].includes(estadoRaw)) {
      icon = '✕';
      colorClass = 'text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40';
    } else if (['pendente', 'neutro', 'pending', '?'].includes(estadoRaw)) {
      icon = '◔';
      colorClass = 'text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40';
    } else if (['atencao', 'atenção', 'warn', '!'].includes(estadoRaw)) {
      icon = '⚠';
      colorClass = 'text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40';
    }
    return `<span class="wiki-template-symbol inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-sans font-semibold ${colorClass}" data-template="Símbolo"><span aria-hidden="true">${icon}</span>${label ? `<span>${escapeTemplateHtml(label)}</span>` : ''}</span>`;
  }

  // 45. {{Citar livro}} / {{Cite book}}
  if (['citar livro', 'cite book', 'referência livro', 'referencia livro'].includes(normalizedKey)) {
    const rawTitulo = getParam(call, ['título', 'titulo', 'title', '1'], '');
    const autor = getParam(call, ['autor', 'author', 'sobrenome'], '');
    const editora = getParam(call, ['editora', 'publisher'], '');
    const local = getParam(call, ['local', 'location'], '');
    const ano = getParam(call, ['ano', 'data', 'year', 'date'], '');
    const paginas = getParam(call, ['páginas', 'paginas', 'pages', 'p'], '');
    const isbn = getParam(call, ['isbn'], '');
    const missingParams = !rawTitulo ? ['título'] : [];
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Citar livro', missingParams) : undefined;
    const titulo = rawTitulo || 'Obra impressa';
    const missingBadge =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml('parâmetro ausente: título', missingParams, 'missing_required_param', 'Informe título=... em {{Citar livro}}', diagId, true)
        : '';
    const parts = [
      autor ? `${escapeTemplateHtml(autor)}.` : '',
      `<em>${escapeTemplateHtml(titulo)}</em>.`,
      local && editora ? `${escapeTemplateHtml(local)}: ${escapeTemplateHtml(editora)},` : editora ? `${escapeTemplateHtml(editora)},` : local ? `${escapeTemplateHtml(local)},` : '',
      ano ? `${escapeTemplateHtml(ano)}.` : '',
      paginas ? `p. ${escapeTemplateHtml(paginas)}.` : '',
      isbn ? `<span class="font-mono text-[11px] opacity-85">ISBN ${escapeTemplateHtml(isbn)}</span>` : '',
      missingBadge,
    ].filter(Boolean);
    return `<cite class="wiki-template-citation not-italic text-xs font-sans text-slate-700 dark:text-slate-300" data-template="Citar livro">${parts.join(' ')}</cite>`;
  }

  // 46. {{Citar periódico}} / {{Citar jornal}} / {{Cite journal}}
  if (['citar periódico', 'citar periodico', 'citar jornal', 'cite journal', 'cite paper'].includes(normalizedKey)) {
    const rawTitulo = getParam(call, ['título', 'titulo', 'title', '1'], '');
    const rawJornal = getParam(call, ['jornal', 'periódico', 'periodico', 'revista', 'journal'], '');
    const autor = getParam(call, ['autor', 'author'], '');
    const volume = getParam(call, ['volume', 'vol'], '');
    const numero = getParam(call, ['número', 'numero', 'issue'], '');
    const paginas = getParam(call, ['páginas', 'paginas', 'pages'], '');
    const ano = getParam(call, ['ano', 'data', 'year', 'date'], '');
    const doi = getParam(call, ['doi'], '');
    const missingParams = [!rawTitulo ? 'título' : '', !rawJornal ? 'jornal' : ''].filter(Boolean);
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Citar periódico', missingParams) : undefined;
    const titulo = rawTitulo || 'Artigo científico';
    const jornal = rawJornal || 'Periódico';
    const issueMeta = [volume ? `v. ${escapeTemplateHtml(volume)}` : '', numero ? `n. ${escapeTemplateHtml(numero)}` : '', paginas ? `p. ${escapeTemplateHtml(paginas)}` : ''].filter(Boolean).join(', ');
    const doiHtml = doi ? ` <a href="${escapeHtmlAttr(`https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//i, '')}`)}" target="_blank" rel="noopener noreferrer" class="font-mono text-[11px] text-blue-700 dark:text-blue-400 hover:underline">doi:${escapeTemplateHtml(doi)}</a>` : '';
    const missingBadge =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml(`parâmetro ausente: ${missingParams.join(', ')}`, missingParams, 'missing_required_param', `Informe ${missingParams.map(p => `${p}=...`).join(' e ')} em {{Citar periódico}}`, diagId, true)
        : '';
    const parts = [
      autor ? `${escapeTemplateHtml(autor)}.` : '',
      `«${escapeTemplateHtml(titulo)}».`,
      `<em>${escapeTemplateHtml(jornal)}</em>`,
      issueMeta ? `(${issueMeta})` : '',
      ano ? `(${escapeTemplateHtml(ano)}).` : '',
      doiHtml,
      missingBadge,
    ].filter(Boolean);
    return `<cite class="wiki-template-citation not-italic text-xs font-sans text-slate-700 dark:text-slate-300" data-template="Citar periódico">${parts.join(' ')}</cite>`;
  }

  // 47. {{Citar notícia}} / {{Cite news}}
  if (['citar notícia', 'citar noticia', 'cite news', 'referência notícia', 'referencia noticia'].includes(normalizedKey)) {
    const rawTitulo = getParam(call, ['título', 'titulo', 'title', '1'], '');
    const jornal = getParam(call, ['jornal', 'publicado', 'newspaper', 'work'], '');
    const url = getParam(call, ['url', 'link'], '');
    const autor = getParam(call, ['autor', 'author'], '');
    const data = getParam(call, ['data', 'ano', 'date', 'year'], '');
    const missingParams = !rawTitulo ? ['título'] : [];
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Citar notícia', missingParams) : undefined;
    const titulo = rawTitulo || 'Notícia';
    const safeHref = /^https?:\/\//i.test(url) ? escapeHtmlAttr(url) : '';
    const titleHtml = safeHref
      ? `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="text-blue-700 dark:text-blue-400 hover:underline font-medium">«${escapeTemplateHtml(titulo)}»</a>`
      : `<span>«${escapeTemplateHtml(titulo)}»</span>`;
    const missingBadge =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml('parâmetro ausente: título', missingParams, 'missing_required_param', 'Informe título=... em {{Citar notícia}}', diagId, true)
        : '';
    const parts = [
      autor ? `${escapeTemplateHtml(autor)}.` : '',
      titleHtml,
      jornal ? `<em>${escapeTemplateHtml(jornal)}</em>` : '',
      data ? `(${escapeTemplateHtml(data)})` : '',
      missingBadge,
    ].filter(Boolean);
    return `<cite class="wiki-template-citation not-italic text-xs font-sans text-slate-700 dark:text-slate-300" data-template="Citar notícia">${parts.join(' ')}</cite>`;
  }

  // 48. {{Coord}} / {{Coordenadas}}
  if (['coord', 'coordenadas', 'geocoord'].includes(normalizedKey)) {
    const latRaw = getParam(call, ['1', 'lat', 'latitude'], '');
    const lonRaw = getParam(call, ['2', 'lon', 'lng', 'longitude'], '');
    const nome = getParam(call, ['nome', 'name', 'title'], '');
    const missingParams = [!latRaw ? '1' : '', !lonRaw ? '2' : ''].filter(Boolean);
    if (missingParams.length > 0) {
      const diagId = registerMissingRequired?.('Coord', missingParams);
      if (highlightDiagnostics) {
        return buildMissingParamHtml('{{Coord}}: latitude/longitude ausentes', missingParams, 'missing_required_param', 'Informe latitude e longitude, ex: {{Coord|-15.79|-47.88}}', diagId, true);
      }
      return '';
    }
    const latNum = Number(latRaw);
    const lonNum = Number(lonRaw);
    const formatted =
      Number.isFinite(latNum) && Number.isFinite(lonNum)
        ? `${Math.abs(latNum).toFixed(4)}° ${latNum >= 0 ? 'N' : 'S'}, ${Math.abs(lonNum).toFixed(4)}° ${lonNum >= 0 ? 'L' : 'O'}`
        : `${latRaw}, ${lonRaw}`;
    const mapHref =
      Number.isFinite(latNum) && Number.isFinite(lonNum)
        ? `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(latNum))}&mlon=${encodeURIComponent(String(lonNum))}#map=12/${encodeURIComponent(String(latNum))}/${encodeURIComponent(String(lonNum))}`
        : '';
    const labelHtml = nome ? ` (${escapeTemplateHtml(nome)})` : '';
    return mapHref
      ? `<a href="${escapeHtmlAttr(mapHref)}" target="_blank" rel="noopener noreferrer" class="wiki-template-coord inline-flex items-center gap-1 font-mono text-xs text-blue-700 dark:text-blue-400 hover:underline" data-template="Coord" title="Abrir coordenadas no mapa">📍 ${escapeTemplateHtml(formatted)}${labelHtml}</a>`
      : `<span class="wiki-template-coord font-mono text-xs" data-template="Coord">📍 ${escapeTemplateHtml(formatted)}${labelHtml}</span>`;
  }

  // 49. {{Converter}} / {{Convert}}
  if (['converter', 'convert', 'conversão', 'conversao'].includes(normalizedKey)) {
    const valRaw = getParam(call, ['1', 'valor'], '');
    const unitFrom = getParam(call, ['2', 'de'], '');
    const unitTo = getParam(call, ['3', 'para'], '');
    const numVal = Number(valRaw.replace(',', '.'));
    if (!valRaw || !unitFrom || !Number.isFinite(numVal)) {
      const missingParams = [!valRaw ? '1' : '', !unitFrom ? '2' : ''].filter(Boolean);
      const diagId = registerMissingRequired?.('Converter', missingParams.length ? missingParams : ['1']);
      if (highlightDiagnostics) {
        return buildMissingParamHtml('{{Converter}}: valor ou unidade inválida', missingParams.length ? missingParams : ['1'], 'missing_required_param', 'Use {{Converter|100|km|mi}}', diagId, true);
      }
      return escapeTemplateHtml(`${valRaw} ${unitFrom}`.trim());
    }
    const converted = convertWikipediaUnit(numVal, unitFrom, unitTo);
    if (!converted) {
      return `<span class="wiki-template-convert" data-template="Converter">${escapeTemplateHtml(valRaw)} ${escapeTemplateHtml(unitFrom)}</span>`;
    }
    return `<span class="wiki-template-convert" data-template="Converter">${escapeTemplateHtml(converted.primary)} (${escapeTemplateHtml(converted.converted)})</span>`;
  }

  // 50. {{Dni}} / {{Data}} / {{Birth date and age}}
  if (['dni', 'data', 'idade', 'birth date and age'].includes(normalizedKey)) {
    const d = Number(getParam(call, ['1', 'dia'], ''));
    const m = Number(getParam(call, ['2', 'mes', 'mês'], ''));
    const y = Number(getParam(call, ['3', 'ano'], ''));
    if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y) || d < 1 || m < 1 || m > 12 || y < 1) {
      const diagId = registerMissingRequired?.('Dni', ['1', '2', '3']);
      if (highlightDiagnostics) {
        return buildMissingParamHtml('{{Dni}}: informe dia|mês|ano', ['1', '2', '3'], 'missing_required_param', 'Use {{Dni|15|1|2001}}', diagId, true);
      }
      return '';
    }
    const monthsPt = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const now = new Date();
    let age = now.getFullYear() - y;
    const beforeBirthday = now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d);
    if (beforeBirthday) age -= 1;
    const ageText = age >= 0 && y >= 1800 ? ` (${age} anos)` : '';
    return `<time class="wiki-template-date" datetime="${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}" data-template="Dni">${d} de ${monthsPt[m - 1]} de ${y}${ageText}</time>`;
  }

  // 51. {{Lang}} / {{Língua}}
  if (['lang', 'língua', 'lingua', 'idioma', 'langx'].includes(normalizedKey)) {
    const code = getParam(call, ['1', 'lang', 'código', 'codigo'], '');
    const text = getParam(call, ['2', 'texto', 'text'], '');
    if (!code || !text) {
      const missing = [!code ? '1' : '', !text ? '2' : ''].filter(Boolean);
      const diagId = registerMissingRequired?.('Lang', missing);
      if (highlightDiagnostics) {
        return buildMissingParamHtml('{{Lang}}: informe código e texto', missing, 'missing_required_param', 'Use {{Lang|en|open knowledge}}', diagId, true);
      }
      return escapeTemplateHtml(text);
    }
    return `<span class="wiki-template-lang italic" lang="${escapeHtmlAttr(code)}" title="Idioma: ${escapeHtmlAttr(code)}" data-template="Lang">${escapeTemplateHtml(text)}</span>`;
  }

  // 52. {{Site oficial}} / {{Official website}}
  if (['site oficial', 'oficial', 'official website', 'página oficial', 'pagina oficial'].includes(normalizedKey)) {
    const url = getParam(call, ['1', 'url', 'site'], '');
    const label = getParam(call, ['nome', '2', 'name', 'label'], 'Site oficial');
    if (!url || !/^https?:\/\//i.test(url)) {
      const diagId = registerMissingRequired?.('Site oficial', ['1']);
      if (highlightDiagnostics) {
        return buildMissingParamHtml('{{Site oficial}}: URL inválida ou ausente', ['1'], 'missing_required_param', 'Use {{Site oficial|https://exemplo.org}}', diagId, true);
      }
      return '';
    }
    return `<span class="wiki-template-official inline-flex items-center gap-1 text-xs font-sans" data-template="Site oficial">🌐 <a href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener noreferrer" class="text-blue-700 dark:text-blue-400 hover:underline font-medium">${escapeTemplateHtml(label)}</a></span>`;
  }

  // 53. {{Infocaixa software}} / {{Info/Software}} / {{Ficha de software}}
  if (['infocaixa software', 'info/software', 'ficha de software'].includes(normalizedKey)) {
    const rawNome = getParam(call, ['nome', 'name', 'título', 'titulo', '1'], '');
    const missingParams = !rawNome ? ['nome'] : [];
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Infocaixa software', missingParams) : undefined;
    const nome = rawNome || pageTitle;
    const rows = [
      { label: 'Desenvolvedor', value: getParam(call, ['desenvolvedor', 'developer', 'autor', 'author'], '') },
      { label: 'Versão estável', value: getParam(call, ['versão', 'versao', 'version'], '') },
      { label: 'Lançamento', value: getParam(call, ['lançamento', 'lancamento', 'release'], '') },
      { label: 'Linguagem', value: getParam(call, ['linguagem', 'language', 'programming_language'], '') },
      { label: 'Sistema', value: getParam(call, ['sistema', 'so', 'operating_system', 'plataforma'], '') },
      { label: 'Licença', value: getParam(call, ['licença', 'licenca', 'license'], '') },
      { label: 'Website', value: getParam(call, ['website', 'site'], '') },
    ].filter(r => r.value);
    const missingWarnHtml =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml('Parâmetro ausente em {{Infocaixa software}}: nome', missingParams, 'missing_required_param', 'Informe nome=... em {{Infocaixa software}}', diagId, false)
        : '';
    return renderStructuredInfoboxCard({
      templateAttr: 'Infocaixa software',
      title: nome,
      subtitle: 'Software / Projeto Digital',
      imageSrc: getParam(call, ['imagem', 'logo', 'image'], ''),
      rows,
      missingParams,
      missingWarnHtml,
    });
  }

  // 54. {{Infocaixa artista musical}} / {{Info/Artista musical}} / {{Infocaixa banda}}
  if (['infocaixa artista musical', 'info/artista musical', 'info/música/artista', 'info/musica/artista', 'infocaixa banda'].includes(normalizedKey)) {
    const rawNome = getParam(call, ['nome', 'name', 'título', 'titulo', '1'], '');
    const missingParams = !rawNome ? ['nome'] : [];
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Infocaixa artista musical', missingParams) : undefined;
    const nome = rawNome || pageTitle;
    const rows = [
      { label: 'Origem', value: getParam(call, ['origem', 'origin', 'local'], '') },
      { label: 'Gêneros', value: getParam(call, ['gênero', 'genero', 'gêneros', 'generos', 'genre'], '') },
      { label: 'Atividade', value: getParam(call, ['período', 'periodo', 'years_active', 'atividade'], '') },
      { label: 'Gravadora', value: getParam(call, ['gravadora', 'label'], '') },
      { label: 'Integrantes', value: getParam(call, ['integrantes', 'membros', 'members'], '') },
      { label: 'Website', value: getParam(call, ['website', 'site'], '') },
    ].filter(r => r.value);
    const missingWarnHtml =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml('Parâmetro ausente em {{Infocaixa artista musical}}: nome', missingParams, 'missing_required_param', 'Informe nome=... em {{Infocaixa artista musical}}', diagId, false)
        : '';
    return renderStructuredInfoboxCard({
      templateAttr: 'Infocaixa artista musical',
      title: nome,
      subtitle: 'Artista / Banda Musical',
      imageSrc: getParam(call, ['imagem', 'foto', 'image'], ''),
      rows,
      missingParams,
      missingWarnHtml,
    });
  }

  // 55. {{Infocaixa evento}} / {{Info/Evento}}
  if (['infocaixa evento', 'info/evento', 'infocaixa conferência', 'infocaixa conferencia'].includes(normalizedKey)) {
    const rawTitulo = getParam(call, ['título', 'titulo', 'title', 'nome', '1'], '');
    const missingParams = !rawTitulo ? ['título'] : [];
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Infocaixa evento', missingParams) : undefined;
    const titulo = rawTitulo || pageTitle;
    const tipo = getParam(call, ['tipo', 'type'], 'Evento');
    const rows = [
      { label: 'Data', value: getParam(call, ['data', 'date', 'período', 'periodo'], '') },
      { label: 'Local', value: getParam(call, ['local', 'location', 'cidade'], '') },
      { label: 'Participantes', value: getParam(call, ['participantes', 'participants', 'organizadores'], '') },
      { label: 'Website', value: getParam(call, ['website', 'site'], '') },
    ].filter(r => r.value);
    const missingWarnHtml =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml('Parâmetro ausente em {{Infocaixa evento}}: título', missingParams, 'missing_required_param', 'Informe título=... em {{Infocaixa evento}}', diagId, false)
        : '';
    return renderStructuredInfoboxCard({
      templateAttr: 'Infocaixa evento',
      title: titulo,
      subtitle: tipo,
      imageSrc: getParam(call, ['imagem', 'logo', 'image'], ''),
      rows,
      missingParams,
      missingWarnHtml,
    });
  }

  // 56. {{Infocaixa universidade}} / {{Info/Universidade}} / {{Info/Instituição de ensino}}
  if (['infocaixa universidade', 'info/universidade', 'info/instituição de ensino', 'info/instituicao de ensino'].includes(normalizedKey)) {
    const rawNome = getParam(call, ['nome', 'name', 'título', 'titulo', '1'], '');
    const missingParams = !rawNome ? ['nome'] : [];
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Infocaixa universidade', missingParams) : undefined;
    const nome = rawNome || pageTitle;
    const sigla = getParam(call, ['sigla', 'acronym'], '');
    const rows = [
      { label: 'Fundação', value: getParam(call, ['fundação', 'fundacao', 'founded'], '') },
      { label: 'Tipo', value: getParam(call, ['tipo', 'type'], '') },
      { label: 'Localização', value: getParam(call, ['localização', 'localizacao', 'local', 'sede'], '') },
      { label: 'Reitor', value: getParam(call, ['reitor', 'diretor'], '') },
      { label: 'Estudantes', value: getParam(call, ['estudantes', 'alunos', 'students'], '') },
      { label: 'Website', value: getParam(call, ['website', 'site'], '') },
    ].filter(r => r.value);
    const missingWarnHtml =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml('Parâmetro ausente em {{Infocaixa universidade}}: nome', missingParams, 'missing_required_param', 'Informe nome=... em {{Infocaixa universidade}}', diagId, false)
        : '';
    return renderStructuredInfoboxCard({
      templateAttr: 'Infocaixa universidade',
      title: nome,
      subtitle: sigla ? `Instituição de Ensino (${sigla})` : 'Instituição de Ensino Superior',
      imageSrc: getParam(call, ['imagem', 'brasão', 'brasao', 'logo'], ''),
      rows,
      missingParams,
      missingWarnHtml,
    });
  }

  // 57. {{Infocaixa empresa}} / {{Info/Empresa}}
  if (['infocaixa empresa', 'info/empresa'].includes(normalizedKey)) {
    const rawNome = getParam(call, ['nome', 'name', 'título', 'titulo', '1'], '');
    const missingParams = !rawNome ? ['nome'] : [];
    const diagId = missingParams.length > 0 ? registerMissingRequired?.('Infocaixa empresa', missingParams) : undefined;
    const nome = rawNome || pageTitle;
    const tipo = getParam(call, ['tipo', 'type'], 'Empresa');
    const rows = [
      { label: 'Setor', value: getParam(call, ['setor', 'área', 'area', 'industry'], '') },
      { label: 'Fundação', value: getParam(call, ['fundação', 'fundacao', 'founded'], '') },
      { label: 'Sede', value: getParam(call, ['sede', 'headquarters', 'local'], '') },
      { label: 'Fundadores', value: getParam(call, ['fundadores', 'founders'], '') },
      { label: 'Website', value: getParam(call, ['website', 'site'], '') },
    ].filter(r => r.value);
    const missingWarnHtml =
      missingParams.length > 0 && highlightDiagnostics
        ? buildMissingParamHtml('Parâmetro ausente em {{Infocaixa empresa}}: nome', missingParams, 'missing_required_param', 'Informe nome=... em {{Infocaixa empresa}}', diagId, false)
        : '';
    return renderStructuredInfoboxCard({
      templateAttr: 'Infocaixa empresa',
      title: nome,
      subtitle: tipo,
      imageSrc: getParam(call, ['imagem', 'logo', 'image'], ''),
      rows,
      missingParams,
      missingWarnHtml,
    });
  }

  // 58. {{Artigo bom}} / {{Bom artigo}} / {{Good article}}
  if (['artigo bom', 'bom artigo', 'good article'].includes(normalizedKey)) {
    const data = getParam(call, ['data', 'date', '1'], '');
    const texto = getParam(call, ['texto', '2'], 'Este artigo cumpriu os critérios editoriais de Artigo Bom pela qualidade de suas fontes e redação.');
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-good not-prose my-4 rounded-lg border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/75 dark:bg-emerald-950/30 p-3.5 text-xs text-emerald-950 dark:text-emerald-100 font-sans flex items-center gap-3" role="note" data-template="Artigo bom">
        <span class="shrink-0 w-7 h-7 rounded-md border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-300 font-bold" aria-hidden="true">✦</span>
        <div><strong>Artigo Bom${data ? ` (${escapeTemplateHtml(data)})` : ''}:</strong> ${escapeTemplateHtml(texto)}</div>
      </div>`
    );
  }

  // 59. {{Escopo global}} / {{Globalizar}}
  if (['escopo global', 'globalizar', 'globalize', 'visão mundial', 'visao mundial'].includes(normalizedKey)) {
    const regiao = getParam(call, ['região', 'regiao', 'region', '1'], 'específica');
    const data = getParam(call, ['data', 'date', '2'], '');
    const motivo = getParam(call, ['motivo', 'reason'], '');
    const dataNote = data ? ` <span class="text-[11px] font-mono opacity-75">(${escapeTemplateHtml(data)})</span>` : '';
    const motivoHtml = motivo ? ` ${escapeTemplateHtml(motivo)}` : '';
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-ambox not-prose my-4 rounded-lg border border-sky-200 dark:border-sky-800/80 bg-sky-50/85 dark:bg-sky-950/35 p-4 text-xs text-sky-950 dark:text-sky-100 font-sans flex items-start gap-3" role="note" data-template="Escopo global">
        <span class="shrink-0 w-7 h-7 rounded-md border border-sky-200 dark:border-sky-800 bg-white/90 dark:bg-sky-900/40 flex items-center justify-center font-bold text-sky-700 dark:text-sky-300" aria-hidden="true">🌐</span>
        <div class="leading-relaxed">
          <strong class="block font-bold mb-0.5">Perspectiva geográfica limitada (${escapeTemplateHtml(regiao)})${dataNote}</strong>
          <span>Os exemplos e dados deste verbete refletem principalmente uma visão regional e podem ser ampliados para escopo mundial.${motivoHtml}</span>
        </div>
      </div>`
    );
  }

  // 60. {{Fonte primária}} / {{Primary sources}}
  if (['fonte primária', 'fonte primaria', 'fontes primárias', 'fontes primarias', 'primary sources'].includes(normalizedKey)) {
    const data = getParam(call, ['data', 'date', '1'], '');
    const assunto = getParam(call, ['assunto', 'seção', 'secao', '2'], '');
    const dataNote = data ? ` <span class="text-[11px] font-mono opacity-75">(${escapeTemplateHtml(data)})</span>` : '';
    const assuntoNote = assunto ? ` Seção: <strong>${escapeTemplateHtml(assunto)}</strong>.` : '';
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-ambox not-prose my-4 rounded-lg border border-amber-300 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/35 p-4 text-xs text-amber-950 dark:text-amber-100 font-sans flex items-start gap-3" role="note" data-template="Fonte primária">
        <span class="shrink-0 w-7 h-7 rounded-md border border-amber-200 dark:border-amber-800 bg-white/90 dark:bg-amber-900/40 flex items-center justify-center font-bold text-amber-700 dark:text-amber-300" aria-hidden="true">☷</span>
        <div class="leading-relaxed">
          <strong class="block font-bold mb-0.5">Dependência de fontes primárias${dataNote}</strong>
          <span>Este artigo apoia-se majoritariamente em fontes primárias. Adicione análises secundárias independentes e revisadas por terceiros.${assuntoNote}</span>
        </div>
      </div>`
    );
  }

  // 61. {{Traduzido de}} / {{Translated page}}
  if (['traduzido de', 'tradução de', 'traducao de', 'translated page'].includes(normalizedKey)) {
    const langCode = getParam(call, ['1', 'idioma', 'lang'], '');
    const originTitle = getParam(call, ['2', 'artigo', 'title'], '');
    const versao = getParam(call, ['versao', 'versão', 'data', 'version'], '');
    if (!langCode || !originTitle) {
      const missing = [!langCode ? '1' : '', !originTitle ? '2' : ''].filter(Boolean);
      const diagId = registerMissingRequired?.('Traduzido de', missing);
      if (!highlightDiagnostics) return '';
      return compactHtmlBlock(
        `<div class="wiki-template my-3" data-template="Traduzido de">${buildMissingParamHtml('{{Traduzido de}}: informe idioma e artigo original', missing, 'missing_required_param', 'Use {{Traduzido de|en|Article}}', diagId, true)}</div>`
      );
    }
    const safeLang = encodeURIComponent(langCode.toLowerCase());
    const safeUrl = `https://${safeLang}.wikipedia.org/wiki/${encodeURIComponent(originTitle.replace(/\s+/g, '_'))}`;
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-translated not-prose my-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/70 px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-300 font-sans flex items-center gap-2.5" role="note" data-template="Traduzido de">
        <span class="font-mono font-bold text-indigo-700 dark:text-indigo-300" aria-hidden="true">⇄</span>
        <span>Conteúdo inicialmente traduzido de <a href="${escapeHtmlAttr(safeUrl)}" target="_blank" rel="noopener noreferrer" class="text-blue-700 dark:text-blue-400 hover:underline font-semibold">${escapeTemplateHtml(originTitle)}</a> (<span class="font-mono uppercase">${escapeTemplateHtml(langCode)}</span>${versao ? ` · ${escapeTemplateHtml(versao)}` : ''}).</span>
      </div>`
    );
  }

  // 62. {{Anexo}} / {{Ver anexo}}
  if (['anexo', 'ver anexo', 'appendix'].includes(normalizedKey)) {
    const targets = call.positional.map(t => t.trim()).filter(Boolean);
    if (targets.length === 0) {
      const diagId = registerMissingRequired?.('Anexo', ['1']);
      if (!highlightDiagnostics) return '';
      return compactHtmlBlock(
        `<div class="wiki-template wiki-template-hatnote my-2" data-template="Anexo">${buildMissingParamHtml('{{Anexo}}: parâmetro obrigatório ausente (1)', ['1'], 'missing_required_param', 'Use {{Anexo|Anexo:Lista}}', diagId, true)}</div>`
      );
    }
    const linksHtml = targets
      .map(t => `<a href="#/wiki/${encodeURIComponent(t.replace(/\s+/g, '_'))}" class="wiki-link font-semibold text-blue-700 dark:text-blue-400 hover:underline">${escapeTemplateHtml(t)}</a>`)
      .join(', ');
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-hatnote not-prose pl-3 py-1 my-2 text-xs italic text-slate-600 dark:text-slate-400 font-sans" data-template="Anexo">
        ↳ Ver lista detalhada em: ${linksHtml}
      </div>`
    );
  }

  // 63. {{Cronologia}} / {{Timeline}}
  if (['cronologia', 'timeline', 'linha do tempo'].includes(normalizedKey)) {
    const titulo = getParam(call, ['título', 'titulo', 'title'], 'Linha do Tempo');
    const items: string[] = [];
    for (let idx = 1; idx <= 10; idx++) {
      const item = getParam(call, [`item${idx}`, `${idx}`], '');
      if (item) items.push(item);
    }
    if (items.length === 0) {
      const diagId = registerMissingRequired?.('Cronologia', ['item1']);
      if (!highlightDiagnostics) return '';
      return compactHtmlBlock(
        `<div class="wiki-template my-4" data-template="Cronologia">${buildMissingParamHtml('{{Cronologia}}: informe ao menos item1=...', ['item1'], 'missing_required_param', 'Informe item1=... em {{Cronologia}}', diagId, true)}</div>`
      );
    }
    const listHtml = items
      .map(
        it =>
          `<li class="relative pl-4 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0 text-xs text-slate-700 dark:text-slate-300"><span class="absolute left-0 top-2.5 w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" aria-hidden="true"></span>${escapeTemplateHtml(it)}</li>`
      )
      .join('');
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-timeline not-prose my-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-900/70 p-4 font-sans" data-template="Cronologia">
        <div class="font-bold text-xs text-slate-900 dark:text-slate-100 pb-2 mb-2 border-b border-slate-200 dark:border-slate-800">${escapeTemplateHtml(titulo)}</div>
        <ol class="m-0 p-0 list-none">${listHtml}</ol>
      </div>`
    );
  }

  // 64. {{Galeria}} / {{Gallery}}
  if (['galeria', 'gallery', 'galeria de imagens'].includes(normalizedKey)) {
    const titulo = getParam(call, ['título', 'titulo', 'title'], '');
    const cards: Array<{ src: string; caption: string }> = [];
    for (let idx = 1; idx <= 8; idx++) {
      const src = sanitizeImageSrc(getParam(call, [`img${idx}`, `imagem${idx}`], ''));
      const caption = getParam(call, [`leg${idx}`, `legenda${idx}`, `caption${idx}`], '');
      if (src) cards.push({ src, caption });
    }
    if (cards.length === 0) {
      const diagId = registerMissingRequired?.('Galeria', ['img1']);
      if (!highlightDiagnostics) return '';
      return compactHtmlBlock(
        `<div class="wiki-template my-4" data-template="Galeria">${buildMissingParamHtml('{{Galeria}}: informe ao menos img1=https://...', ['img1'], 'missing_required_param', 'Use {{Galeria|img1=https://...|leg1=Descrição}}', diagId, true)}</div>`
      );
    }
    const gridHtml = cards
      .map(
        c =>
          `<figure class="m-0 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-2 flex flex-col items-center gap-1.5"><img src="${c.src}" alt="${escapeHtmlAttr(c.caption || 'Imagem da galeria')}" class="max-h-36 w-auto object-contain rounded" />${c.caption ? `<figcaption class="text-[11px] text-slate-600 dark:text-slate-400 text-center">${escapeTemplateHtml(c.caption)}</figcaption>` : ''}</figure>`
      )
      .join('');
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-gallery not-prose my-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 p-3.5 font-sans" data-template="Galeria">
        ${titulo ? `<div class="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2.5">${escapeTemplateHtml(titulo)}</div>` : ''}
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">${gridHtml}</div>
      </div>`
    );
  }

  // 65. {{Imagem dupla}} / {{Multiple image}}
  if (['imagem dupla', 'multiple image', 'double image'].includes(normalizedKey)) {
    const titulo = getParam(call, ['título', 'titulo', 'title'], '');
    const img1 = sanitizeImageSrc(getParam(call, ['img1', 'imagem1', 'image1'], ''));
    const img2 = sanitizeImageSrc(getParam(call, ['img2', 'imagem2', 'image2'], ''));
    const leg1 = getParam(call, ['leg1', 'legenda1', 'caption1'], '');
    const leg2 = getParam(call, ['leg2', 'legenda2', 'caption2'], '');
    if (!img1 || !img2) {
      const missing = [!img1 ? 'img1' : '', !img2 ? 'img2' : ''].filter(Boolean);
      const diagId = registerMissingRequired?.('Imagem dupla', missing);
      if (!highlightDiagnostics) return '';
      return compactHtmlBlock(
        `<div class="wiki-template my-4" data-template="Imagem dupla">${buildMissingParamHtml('{{Imagem dupla}}: informe img1 e img2 válidos', missing, 'missing_required_param', 'Use {{Imagem dupla|img1=https://...|img2=https://...}}', diagId, true)}</div>`
      );
    }
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-double-image not-prose my-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-900/70 p-3.5 font-sans max-w-2xl" data-template="Imagem dupla">
        ${titulo ? `<div class="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 text-center">${escapeTemplateHtml(titulo)}</div>` : ''}
        <div class="grid grid-cols-2 gap-3">
          <figure class="m-0 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-2 flex flex-col items-center gap-1"><img src="${img1}" alt="${escapeHtmlAttr(leg1 || 'Imagem 1')}" class="max-h-40 w-auto object-contain rounded" />${leg1 ? `<figcaption class="text-[11px] text-slate-600 dark:text-slate-400 text-center">${escapeTemplateHtml(leg1)}</figcaption>` : ''}</figure>
          <figure class="m-0 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-2 flex flex-col items-center gap-1"><img src="${img2}" alt="${escapeHtmlAttr(leg2 || 'Imagem 2')}" class="max-h-40 w-auto object-contain rounded" />${leg2 ? `<figcaption class="text-[11px] text-slate-600 dark:text-slate-400 text-center">${escapeTemplateHtml(leg2)}</figcaption>` : ''}</figure>
        </div>
      </div>`
    );
  }

  // 66. {{Voto}} / {{Apoio}} / {{Contra}} / {{Neutro}}
  if (['voto', 'apoio', 'contra', 'neutro'].includes(normalizedKey)) {
    const defaultPos = ['apoio', 'contra', 'neutro'].includes(normalizedKey) ? normalizedKey : 'apoio';
    const posRaw = getParam(call, ['1', 'posição', 'posicao', 'tipo'], defaultPos).toLowerCase();
    const comentario = getParam(call, ['2', 'comentário', 'comentario', 'texto'], '');
    let label = 'Apoio';
    let symbol = '✓';
    let tone = 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200';
    if (['contra', 'oppose', 'nao'].includes(posRaw)) {
      label = 'Contra';
      symbol = '✕';
      tone = 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200';
    } else if (['neutro', 'neutral', 'abstenção', 'abstencao'].includes(posRaw)) {
      label = 'Neutro';
      symbol = '●';
      tone = 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200';
    } else if (['comentario', 'comentário', 'comment'].includes(posRaw)) {
      label = 'Comentário';
      symbol = '💬';
      tone = 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200';
    }
    return `<span class="wiki-template-vote inline-flex items-center gap-1.5 text-xs font-sans" data-template="Voto"><span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-semibold ${tone}"><span aria-hidden="true">${symbol}</span>${label}</span>${comentario ? `<span class="text-slate-700 dark:text-slate-300">${escapeTemplateHtml(comentario)}</span>` : ''}</span>`;
  }

  // 67. {{Etiqueta}} / {{Badge}} / {{Tag}} / {{Marcador}}
  if (['etiqueta', 'badge', 'tag', 'marcador'].includes(normalizedKey)) {
    const texto = getParam(call, ['1', 'texto', 'label'], '');
    const tipo = getParam(call, ['tipo', 'type', '2'], 'info').toLowerCase();
    if (!texto) {
      const diagId = registerMissingRequired?.('Etiqueta', ['1']);
      if (highlightDiagnostics) {
        return buildMissingParamHtml('{{Etiqueta}}: texto ausente', ['1'], 'missing_required_param', 'Use {{Etiqueta|Estável|ok}}', diagId, true);
      }
      return '';
    }
    let tone = 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200';
    if (['ok', 'sucesso', 'success'].includes(tipo)) {
      tone = 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200';
    } else if (['aviso', 'warn', 'warning'].includes(tipo)) {
      tone = 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200';
    } else if (['erro', 'danger', 'error'].includes(tipo)) {
      tone = 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200';
    } else if (['neutro', 'neutral'].includes(tipo)) {
      tone = 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
    }
    return `<span class="wiki-template-badge inline-flex items-center px-1.5 py-0.5 rounded border text-[11px] font-mono font-semibold ${tone}" data-template="Etiqueta">${escapeTemplateHtml(texto)}</span>`;
  }

  // 68. {{Áudio}} / {{Audio}} / {{Som}}
  if (['áudio', 'audio', 'som', 'pronúncia', 'pronuncia'].includes(normalizedKey)) {
    const srcRaw = getParam(call, ['1', 'arquivo', 'url'], '');
    const label = getParam(call, ['2', 'rótulo', 'rotulo', 'label'], 'Ouvir áudio');
    if (!srcRaw) {
      const diagId = registerMissingRequired?.('Áudio', ['1']);
      if (highlightDiagnostics) {
        return buildMissingParamHtml('{{Áudio}}: arquivo ou URL ausente', ['1'], 'missing_required_param', 'Use {{Áudio|https://...|Ouvir pronúncia}}', diagId, true);
      }
      return '';
    }
    const isUrl = /^https?:\/\//i.test(srcRaw);
    return isUrl
      ? `<a href="${escapeHtmlAttr(srcRaw)}" target="_blank" rel="noopener noreferrer" class="wiki-template-audio inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-sans text-blue-700 dark:text-blue-400 hover:underline" data-template="Áudio"><span aria-hidden="true">🔊</span><span>${escapeTemplateHtml(label)}</span></a>`
      : `<span class="wiki-template-audio inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-sans text-slate-700 dark:text-slate-300" data-template="Áudio"><span aria-hidden="true">🔊</span><span>${escapeTemplateHtml(label)} (${escapeTemplateHtml(srcRaw)})</span></span>`;
  }

  // 69. {{IPA}} / {{AFI}} / {{Pronúncia IPA}}
  if (['ipa', 'afi', 'pronúncia ipa', 'pronuncia ipa'].includes(normalizedKey)) {
    const ipaText = getParam(call, ['1', 'transcrição', 'transcricao'], '');
    const lang = getParam(call, ['lang', 'idioma', '2'], '');
    if (!ipaText) {
      const diagId = registerMissingRequired?.('IPA', ['1']);
      if (highlightDiagnostics) {
        return buildMissingParamHtml('{{IPA}}: transcrição ausente', ['1'], 'missing_required_param', 'Use {{IPA|ˈwiki|pt}}', diagId, true);
      }
      return '';
    }
    return `<span class="wiki-template-ipa font-mono text-xs px-1 py-0.5 rounded bg-slate-100/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200" title="${lang ? `Pronúncia AFI (${escapeHtmlAttr(lang)})` : 'Alfabeto Fonético Internacional (IPA)'}" data-template="IPA">${lang ? `<span class="text-[10px] text-slate-500 mr-1">${escapeTemplateHtml(lang)}:</span>` : ''}/${escapeTemplateHtml(ipaText.replace(/^[/[\]]+|[/[\]]+$/g, ''))}/</span>`;
  }

  // 70. {{Moeda}} / {{Preço}} / {{Currency}}
  if (['moeda', 'preço', 'preco', 'currency'].includes(normalizedKey)) {
    const amountRaw = getParam(call, ['1', 'valor'], '');
    const codeRaw = getParam(call, ['2', 'moeda', 'code'], 'BRL').toUpperCase();
    if (!amountRaw) {
      const diagId = registerMissingRequired?.('Moeda', ['1']);
      if (highlightDiagnostics) {
        return buildMissingParamHtml('{{Moeda}}: valor ausente', ['1'], 'missing_required_param', 'Use {{Moeda|1500|BRL}}', diagId, true);
      }
      return '';
    }
    const symbols: Record<string, string> = { BRL: 'R$', USD: 'US$', EUR: '€', GBP: '£', JPY: '¥', BTC: '₿' };
    const sym = symbols[codeRaw] || codeRaw;
    return `<span class="wiki-template-currency whitespace-nowrap font-sans font-medium text-slate-900 dark:text-slate-100" data-template="Moeda" title="Moeda: ${escapeHtmlAttr(codeRaw)}">${escapeTemplateHtml(sym)} ${escapeTemplateHtml(amountRaw)}</span>`;
  }

  // 71. {{Barra de progresso}} / {{Progresso}} / {{Progress bar}}
  if (['barra de progresso', 'progresso', 'progress bar'].includes(normalizedKey)) {
    const rawPct = Number(getParam(call, ['1', 'percentual', 'value'], '0').replace('%', '').trim());
    const pct = Number.isFinite(rawPct) ? Math.max(0, Math.min(100, rawPct)) : 0;
    const titulo = getParam(call, ['título', 'titulo', 'title'], 'Progresso');
    const cor = getParam(call, ['cor', 'color'], 'emerald').toLowerCase();
    let barColor = 'bg-emerald-600 dark:bg-emerald-500';
    if (cor === 'blue') barColor = 'bg-blue-600 dark:bg-blue-500';
    else if (cor === 'amber') barColor = 'bg-amber-500 dark:bg-amber-400';
    else if (cor === 'rose') barColor = 'bg-rose-600 dark:bg-rose-500';
    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-progress not-prose my-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-900/70 p-3 font-sans max-w-md" data-template="Barra de progresso">
        <div class="flex items-center justify-between text-xs mb-1.5">
          <span class="font-semibold text-slate-800 dark:text-slate-200">${escapeTemplateHtml(titulo)}</span>
          <span class="font-mono font-bold text-slate-700 dark:text-slate-300">${pct}%</span>
        </div>
        <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          <div class="h-full ${barColor}" style="width: ${pct}%"></div>
        </div>
      </div>`
    );
  }

  // 72. {{Matemática}} / {{Math}} / {{Fórmula}}
  if (['matemática', 'matematica', 'math', 'fórmula', 'formula'].includes(normalizedKey)) {
    const rawSegments = splitTopLevelPipes(call.rawBody).slice(1);
    const explicitNamed = getParam(call, ['expressão', 'expressao', 'expr'], '');
    const rawFirst = (rawSegments[0] || '').replace(/^1\s*=/, '').trim();
    const expr = explicitNamed || getParam(call, ['1'], '') || rawFirst;
    if (!expr) {
      const diagId = registerMissingRequired?.('Matemática', ['1']);
      if (highlightDiagnostics) {
        return buildMissingParamHtml('{{Matemática}}: expressão ausente', ['1'], 'missing_required_param', 'Use {{Matemática|E = mc²}}', diagId, true);
      }
      return '';
    }
    return `<span class="wiki-template-math font-serif italic px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100" data-template="Matemática">${escapeTemplateHtml(expr)}</span>`;
  }

  // 73. {{Código}} / {{Code}}
  if (['código', 'codigo', 'code', 'inline code'].includes(normalizedKey)) {
    const rawSegments = splitTopLevelPipes(call.rawBody).slice(1);
    const explicitNamed = getParam(call, ['código', 'codigo', 'code'], '');
    const rawFirst = (rawSegments[0] || '').replace(/^1\s*=/, '').trim();
    const snippet = explicitNamed || getParam(call, ['1'], '') || rawFirst;
    const lang = getParam(call, ['lang', 'linguagem', '2'], '') || (rawSegments[1] && !rawSegments[1].includes('=') ? rawSegments[1].trim() : '');
    if (!snippet) {
      const diagId = registerMissingRequired?.('Código', ['1']);
      if (highlightDiagnostics) {
        return buildMissingParamHtml('{{Código}}: trecho ausente', ['1'], 'missing_required_param', 'Use {{Código|npm run build}}', diagId, true);
      }
      return '';
    }
    return `<code class="wiki-template-code font-mono text-xs px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100" ${lang ? `title="Linguagem: ${escapeHtmlAttr(lang)}"` : ''} data-template="Código">${escapeTemplateHtml(snippet)}</code>`;
  }

  // 74. {{ISBN}}
  if (normalizedKey === 'isbn') {
    const isbn = getParam(call, ['1', 'isbn', 'código', 'codigo'], '');
    if (!isbn) {
      const diagId = registerMissingRequired?.('ISBN', ['1']);
      if (highlightDiagnostics) {
        return buildMissingParamHtml('{{ISBN}}: código ausente', ['1'], 'missing_required_param', 'Use {{ISBN|978-85-359-0277-8}}', diagId, true);
      }
      return '';
    }
    const cleanIsbn = isbn.replace(/[^0-9Xx]/g, '');
    const href = `https://openlibrary.org/isbn/${encodeURIComponent(cleanIsbn || isbn)}`;
    return `<span class="wiki-template-isbn font-mono text-xs whitespace-nowrap" data-template="ISBN">ISBN <a href="${escapeHtmlAttr(href)}" target="_blank" rel="noopener noreferrer" class="text-blue-700 dark:text-blue-400 hover:underline">${escapeTemplateHtml(isbn)}</a></span>`;
  }

  // 75. {{DOI}}
  if (normalizedKey === 'doi') {
    const doi = getParam(call, ['1', 'doi', 'id'], '');
    const titulo = getParam(call, ['título', 'titulo', 'title', '2'], '');
    if (!doi) {
      const diagId = registerMissingRequired?.('DOI', ['1']);
      if (highlightDiagnostics) {
        return buildMissingParamHtml('{{DOI}}: identificador ausente', ['1'], 'missing_required_param', 'Use {{DOI|10.1000/182}}', diagId, true);
      }
      return '';
    }
    const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, '').trim();
    const href = `https://doi.org/${encodeURIComponent(cleanDoi).replace(/%2F/g, '/')}`;
    return `<span class="wiki-template-doi font-mono text-xs whitespace-nowrap" data-template="DOI">${titulo ? `${escapeTemplateHtml(titulo)} (` : ''}doi:<a href="${escapeHtmlAttr(href)}" target="_blank" rel="noopener noreferrer" class="text-blue-700 dark:text-blue-400 hover:underline">${escapeTemplateHtml(cleanDoi)}</a>${titulo ? ')' : ''}</span>`;
  }

  return null;
}

/**
 * Expands MediaWiki templates (`{{...}}`) in Wikitext:
 * - Magic words (`{{PAGENAME}}`, `{{SITENAME}}`, `{{CURRENTYEAR}}`, ...)
 * - Built-in standard MediaWiki templates (`{{Aviso}}`, `{{Esboço}}`, `{{Infocaixa}}`, `{{Navbox}}`, `{{Carece de fontes}}`, ...)
 * - Custom community templates stored in Namespace 10 (`Predefinição:<Nome>` / `Template:<Nome>`)
 * - Cycle detection (`maxDepth = 5`) and MediaWiki redlinks for non-existent templates
 */
export function expandWikitextTemplates(
  rawWikitext: string,
  options: TemplateExpansionOptions = {},
  _depth = 0,
  _stack: Set<string> = new Set(),
  _diagCounter: { count: number } = { count: 0 }
): TemplateExpansionResult {
  const pageTitle = options.pageTitle || 'Artigo';
  const siteName = options.siteName || 'NotMediaWiki';
  const maxDepth = options.maxDepth ?? MAX_RECURSION_DEPTH;
  const highlightDiagnostics = options.highlightDiagnostics !== false;

  const usedTemplates = new Set<string>();
  const missingTemplates = new Set<string>();
  const errors: string[] = [];
  const diagnostics: TemplateDiagnostic[] = [];

  const pushDiagnostic = (
    item: Omit<TemplateDiagnostic, 'id'>
  ): string => {
    _diagCounter.count += 1;
    const id = `tpl-diag-${_diagCounter.count}`;
    diagnostics.push({ id, ...item });
    return id;
  };

  // Map custom Namespace 10 articles by normalized base title
  const customMap = new Map<string, Article>();
  if (options.customTemplates) {
    for (const art of options.customTemplates) {
      const parsedTitle = parseTitle(art.title || art.slug);
      if (art.namespace === 10 || parsedTitle.namespaceId === 10) {
        const key = normalizeTemplateKey(parsedTitle.baseTitle || art.title || art.slug);
        if (key) customMap.set(key, art);
      }
    }
  }

  // Apply include/noinclude directives if viewing or transcluding
  let source = applyIncludeDirectives(rawWikitext || '', !options.isTemplatePage);

  // Protect code blocks and <nowiki> so documentation examples of {{...}} are preserved verbatim
  const protectedBlocks: string[] = [];
  const protect = (pattern: RegExp) => {
    source = source.replace(pattern, match => {
      const idx = protectedBlocks.length;
      protectedBlocks.push(match);
      return `@@WIKI_PROTECTED_${idx}@@`;
    });
  };

  protect(/<nowiki>([\s\S]*?)<\/nowiki>/gi);
  protect(/<(?:syntaxhighlight|source)(?:\s+[^>]*)?>[\s\S]*?<\/(?:syntaxhighlight|source)>/gi);
  protect(/<pre(?:\s+[^>]*)?>[\s\S]*?<\/pre>/gi);
  protect(/```[\s\S]*?```/g);
  protect(/`[^`\n]+`/g);

  let result = '';
  let i = 0;

  while (i < source.length) {
    // Preserve wikitable syntax `{| ... |}` without triggering template or brace diagnostics
    if (source.startsWith('{|', i)) {
      result += '{|';
      i += 2;
      continue;
    }

    if (source.startsWith('|}', i)) {
      result += '|}';
      i += 2;
      continue;
    }

    // Handle top-level triple-brace parameters `{{{...}}}`
    if (source.startsWith('{{{', i)) {
      const stack: number[] = [3];
      let j = i + 3;

      while (j < source.length && stack.length > 0) {
        // Parameter placeholders {{{...}}} cannot cross blank paragraph breaks
        if (source.startsWith('\n\n', j) || source.startsWith('\r\n\r\n', j)) {
          break;
        }
        if (source[j] === '{') {
          let openCount = 0;
          while (source[j + openCount] === '{') openCount++;
          let rem = openCount;
          while (rem >= 2) {
            if (rem === 3 || (rem >= 5 && rem % 2 === 1)) {
              stack.push(3);
              rem -= 3;
            } else {
              stack.push(2);
              rem -= 2;
            }
          }
          j += openCount;
          continue;
        }
        if (source[j] === '}') {
          let closeCount = 0;
          while (source[j + closeCount] === '}') closeCount++;
          let consumed = 0;
          while (stack.length > 0 && closeCount - consumed >= stack[stack.length - 1]) {
            const top = stack.pop()!;
            consumed += top;
          }
          j += consumed > 0 ? consumed : closeCount;
          continue;
        }
        j++;
      }

      if (stack.length === 0) {
        const rawWhole = source.slice(i, j);
        const inner = source.slice(i + 3, j - 3);
        const parts = splitTopLevelPipes(inner);
        const rawKey = (parts[0] || '').trim() || 'parametro';

        if (!options.isTemplatePage && highlightDiagnostics) {
          const msg = `Chave de parâmetro "{{{${rawKey}}}}" sem valor definido neste contexto.`;
          const diagId = pushDiagnostic({
            type: 'unresolved_param',
            severity: 'warning',
            templateName: pageTitle,
            snippet: rawWhole,
            missingParams: [rawKey],
            message: msg,
          });
          if (!isInsideTagOrWikilink(result)) {
            result += buildMissingParamHtml(rawWhole, [rawKey], 'unresolved_param', msg, diagId, true);
          } else {
            result += rawWhole;
          }
        } else {
          result += rawWhole;
        }
        i = j;
        continue;
      }

      // Unclosed triple braces `{{{...`
      const lineEnd = source.indexOf('\n', i);
      const snippetEnd = lineEnd === -1 ? Math.min(source.length, i + 100) : Math.min(lineEnd, i + 100);
      const unclosedSnippet = source.slice(i, snippetEnd);
      const msg = `Chave de parâmetro "${unclosedSnippet}" não foi fechada com "}}}".`;
      errors.push(msg);
      const diagId = pushDiagnostic({
        type: 'unclosed_braces',
        severity: 'error',
        templateName: pageTitle,
        snippet: unclosedSnippet,
        message: msg,
      });
      result +=
        highlightDiagnostics && !isInsideTagOrWikilink(result)
          ? buildInvalidBraceHtml(unclosedSnippet, 'unclosed_braces', msg, diagId)
          : unclosedSnippet;
      i = snippetEnd;
      continue;
    }

    // Handle unmatched closing `}}}` or `}}` at top level (outside valid templates & wikitables)
    if (source.startsWith('}}', i)) {
      const len = source.startsWith('}}}', i) ? 3 : 2;
      const stray = source.slice(i, i + len);
      const msg = `Chaves de fechamento "${stray}" sem abertura "{{${len === 3 ? '{' : ''}" correspondente.`;
      errors.push(msg);
      const diagId = pushDiagnostic({
        type: 'unmatched_closing',
        severity: 'error',
        templateName: pageTitle,
        snippet: stray,
        message: msg,
      });
      result +=
        highlightDiagnostics && !isInsideTagOrWikilink(result)
          ? buildInvalidBraceHtml(stray, 'unmatched_closing', msg, diagId)
          : stray;
      i += len;
      continue;
    }

    if (source.startsWith('{{', i)) {
      // Find matching `}}` via brace stack
      const stack: number[] = [2];
      let j = i + 2;

      while (j < source.length && stack.length > 0) {
        if (source.startsWith('{|', j)) {
          j += 2;
          continue;
        }
        if (source.startsWith('|}', j)) {
          j += 2;
          continue;
        }
        if (source[j] === '{') {
          let openCount = 0;
          while (source[j + openCount] === '{') openCount++;
          let rem = openCount;
          while (rem >= 2) {
            if (rem === 3 || (rem >= 5 && rem % 2 === 1)) {
              stack.push(3);
              rem -= 3;
            } else {
              stack.push(2);
              rem -= 2;
            }
          }
          j += openCount;
          continue;
        }
        if (source[j] === '}') {
          let closeCount = 0;
          while (source[j + closeCount] === '}') closeCount++;
          let consumed = 0;
          while (stack.length > 0 && closeCount - consumed >= stack[stack.length - 1]) {
            const top = stack.pop()!;
            consumed += top;
          }
          j += consumed > 0 ? consumed : closeCount;
          continue;
        }
        j++;
      }

      if (stack.length === 0) {
        const rawWhole = source.slice(i, j);
        const rawInner = source.slice(i + 2, j - 2);
        const call = parseTemplateCallBody(rawInner);
        const rawCallName = call.name;

        // 0. Invalid / empty template name or forbidden title delimiters
        if (!rawCallName || /[#<>[\]{}\n]/.test(rawCallName)) {
          const msg = !rawCallName
            ? `Chave de pré-definição vazia ou sem nome: "${rawWhole}".`
            : `Nome de pré-definição inválido ("${rawCallName}") contém caracteres proibidos (#, <, >, [, ], {, }).`;
          errors.push(msg);
          const diagId = pushDiagnostic({
            type: 'invalid_name',
            severity: 'error',
            templateName: rawCallName || '(vazio)',
            snippet: rawWhole,
            message: msg,
          });
          result +=
            highlightDiagnostics && !isInsideTagOrWikilink(result)
              ? buildInvalidBraceHtml(rawWhole, 'invalid_name', msg, diagId)
              : rawWhole;
          i = j;
          continue;
        }

        // 1. Magic words
        const magicVal = resolveMagicWord(rawCallName, pageTitle, siteName);
        if (magicVal !== null) {
          result += magicVal;
          i = j;
          continue;
        }

        // 2. Preserve {{Infobox <subtype>}} for ClientParsoidService native Infobox handler
        if (/^infobox\s+/i.test(rawCallName)) {
          result += rawWhole;
          i = j;
          continue;
        }

        // Recursively expand nested template calls inside argument values first
        const expandValue = (val: string): string => {
          if (!val || !val.includes('{{')) return val;
          if (_depth + 1 > maxDepth) return val;
          const nested = expandWikitextTemplates(
            val,
            { ...options, isTemplatePage: false },
            _depth + 1,
            _stack,
            _diagCounter
          );
          nested.usedTemplates.forEach(t => usedTemplates.add(t));
          nested.missingTemplates.forEach(t => missingTemplates.add(t));
          errors.push(...nested.errors);
          diagnostics.push(...nested.diagnostics);
          return nested.wikitext;
        };

        const expandedCall: ParsedTemplateCall = {
          ...call,
          positional: call.positional.map(expandValue),
          named: Object.fromEntries(Object.entries(call.named).map(([k, v]) => [k, expandValue(v)])),
          params: Object.fromEntries(Object.entries(call.params).map(([k, v]) => [k, expandValue(v)])),
        };

        const normKey = normalizeTemplateKey(rawCallName);
        usedTemplates.add(rawCallName.replace(/^(?:Predefinição|Predef|Template):/i, '').trim() || rawCallName);

        // 3. Check custom Namespace 10 Firestore template FIRST (allows wiki community overrides!)
        const customTemplate = customMap.get(normKey);
        if (customTemplate) {
          if (_depth >= maxDepth || _stack.has(normKey)) {
            const cycleMsg = `Ciclo ou profundidade máxima de predefinição detectada: Predefinição:${rawCallName}`;
            errors.push(cycleMsg);
            const diagId = pushDiagnostic({
              type: 'recursion_cycle',
              severity: 'error',
              templateName: rawCallName,
              snippet: rawWhole,
              message: cycleMsg,
            });
            result += `<span id="${escapeHtmlAttr(diagId)}" data-template-diagnostic-id="${escapeHtmlAttr(diagId)}" data-template-issue="recursion_cycle" class="wiki-template-error wiki-template-debug inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 underline decoration-wavy decoration-rose-500">${escapeHtmlAttr(cycleMsg)}</span>`;
            i = j;
            continue;
          }

          const nextStack = new Set(_stack);
          nextStack.add(normKey);

          const rawBody = applyIncludeDirectives(customTemplate.wikitext || '', true).trim();
          const substituted = substituteTemplateParameters(rawBody, expandedCall.params, {
            highlightUnresolved: highlightDiagnostics && !options.isTemplatePage,
            onUnresolvedParam: (paramName, rawPlaceholder) => {
              const msg = `Parâmetro "{{{${paramName}}}}" ausente na chamada de {{${rawCallName}}}.`;
              return pushDiagnostic({
                type: 'unresolved_param',
                severity: 'warning',
                templateName: rawCallName,
                snippet: rawPlaceholder,
                missingParams: [paramName],
                message: msg,
              });
            },
          });
          const expandedNested = expandWikitextTemplates(
            substituted,
            { ...options, isTemplatePage: false },
            _depth + 1,
            nextStack,
            _diagCounter
          );
          expandedNested.usedTemplates.forEach(t => usedTemplates.add(t));
          expandedNested.missingTemplates.forEach(t => missingTemplates.add(t));
          errors.push(...expandedNested.errors);
          diagnostics.push(...expandedNested.diagnostics);

          result += expandedNested.wikitext;
          i = j;
          continue;
        }

        // 4. Built-in MediaWiki standard templates (validate required params too)
        const builtinHtml = renderBuiltinTemplate(
          expandedCall,
          normKey,
          pageTitle,
          (templateLabel, missingParams) =>
            pushDiagnostic({
              type: 'missing_required_param',
              severity: 'warning',
              templateName: templateLabel,
              snippet: rawWhole,
              missingParams,
              message: `Pré-definição {{${templateLabel}}} sem parâmetro(s) obrigatório(s): ${missingParams.join(', ')}.`,
            }),
          highlightDiagnostics
        );
        if (builtinHtml !== null) {
          result += builtinHtml;
          i = j;
          continue;
        }

        // 5. Missing template -> MediaWiki authentic red link pointing to editor for Namespace 10
        const displayName = rawCallName.replace(/^:/, '').trim();
        const canonicalTarget = /^(?:predefinição|predef|template):/i.test(displayName)
          ? displayName.replace(/^(?:predefinição|predef|template):/i, 'Predefinição:')
          : `Predefinição:${displayName}`;
        missingTemplates.add(canonicalTarget);
        const missingMsg = `Pré-definição inexistente: ${canonicalTarget} (clique para criar no Namespace 10).`;
        const diagId = pushDiagnostic({
          type: 'missing_template',
          severity: 'error',
          templateName: canonicalTarget,
          snippet: rawWhole,
          message: missingMsg,
        });
        const editHref = `#/edit/${encodeURIComponent(canonicalTarget.replace(/\s+/g, '_'))}`;
        result += `<a id="${escapeHtmlAttr(diagId)}" data-template-diagnostic-id="${escapeHtmlAttr(diagId)}" data-template-issue="missing_template" href="${editHref}" class="wiki-redlink wiki-template-debug text-rose-700 dark:text-rose-400 underline decoration-dotted hover:text-rose-900 dark:hover:text-rose-300 font-medium bg-rose-50/75 dark:bg-rose-950/35 px-1 rounded border border-rose-200/80 dark:border-rose-800/70" title="${escapeDiagnosticText(missingMsg)}">${escapeDiagnosticText(canonicalTarget)}</a>`;
        i = j;
        continue;
      }

      // 6. Unclosed opening `{{...` (stack.length > 0)
      const lineEnd = source.indexOf('\n', i);
      const snippetEnd = lineEnd === -1 ? Math.min(source.length, i + 120) : Math.min(lineEnd, i + 120);
      const unclosedSnippet = source.slice(i, snippetEnd);
      const rawNameGuess = unclosedSnippet
        .slice(2)
        .split('|')[0]
        .trim();
      const msg = `Chave de pré-definição não fechada ("}}" ausente): ${unclosedSnippet}`;
      errors.push(msg);
      const diagId = pushDiagnostic({
        type: 'unclosed_braces',
        severity: 'error',
        templateName: rawNameGuess || '(sem fechamento)',
        snippet: unclosedSnippet,
        message: msg,
      });
      result +=
        highlightDiagnostics && !isInsideTagOrWikilink(result)
          ? buildInvalidBraceHtml(unclosedSnippet, 'unclosed_braces', msg, diagId)
          : unclosedSnippet;
      i = snippetEnd;
      continue;
    }

    result += source[i];
    i++;
  }

  // Restore protected <nowiki>, code, and <pre> blocks (stripping <nowiki> tags cleanly)
  result = result.replace(/@@WIKI_PROTECTED_(\d+)@@/g, (_, idxStr) => {
    const block = protectedBlocks[Number(idxStr)] ?? '';
    return block.replace(/^<nowiki>([\s\S]*?)<\/nowiki>$/i, '$1');
  });

  return {
    wikitext: result,
    usedTemplates: Array.from(usedTemplates),
    missingTemplates: Array.from(missingTemplates),
    errors,
    diagnostics,
  };
}

/**
 * Checks whether a built-in template matches a given name/alias.
 */
export function findBuiltinTemplate(name: string) {
  const norm = normalizeTemplateKey(name);
  return BUILTIN_MEDIAWIKI_TEMPLATES.find(
    tpl =>
      normalizeTemplateKey(tpl.name) === norm ||
      (tpl.aliases || []).some(a => normalizeTemplateKey(a) === norm)
  );
}
