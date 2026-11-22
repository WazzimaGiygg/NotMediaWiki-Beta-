import { Article } from '../types';
import { BUILTIN_MEDIAWIKI_TEMPLATES } from '../data/defaultTemplates';
import { parseTitle } from './namespaces';

export interface TemplateExpansionOptions {
  pageTitle?: string;
  siteName?: string;
  customTemplates?: Article[];
  isTemplatePage?: boolean;
  maxDepth?: number;
}

export interface TemplateExpansionResult {
  wikitext: string;
  usedTemplates: string[];
  missingTemplates: string[];
  errors: string[];
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

/**
 * Replaces {{{param|default}}} placeholders cleanly, supporting nested {{{...}}} and {{...}}.
 */
export function substituteTemplateParameters(
  templateWikitext: string,
  params: Record<string, string>
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
          output += substituteTemplateParameters(defaultRaw, params);
        } else if (directMatch !== undefined) {
          output += '';
        } else {
          output += `{{{${rawKey}}}}`;
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

/**
 * Renders built-in standard MediaWiki Predefinições to clean semantic HTML.
 * Follows editorial design discipline: crisp all-around hairline borders (zero thick border-l-4),
 * explicit status labels, and full dark/theme support.
 */
function renderBuiltinTemplate(
  call: ParsedTemplateCall,
  normalizedKey: string,
  pageTitle: string
): string | null {
  // Never intercept {{Infobox <subtype>}} (e.g. {{Infobox software}} / {{Infobox user}}); ClientParsoidService handles those natively.
  if (/^infobox\s+/i.test(call.name.trim())) {
    return null;
  }

  // 1. {{Aviso}} / {{Ambox}} / {{Alerta}}
  if (['aviso', 'ambox', 'caixa de aviso', 'alerta'].includes(normalizedKey)) {
    const tipoRaw = getParam(call, ['tipo', 'type', '1'], 'info').toLowerCase();
    const titulo = getParam(call, ['título', 'titulo', 'title', 'cabeçalho'], 'Aviso Editorial');
    const texto = getParam(call, ['texto', 'text', 'mensagem', '2'], 'Este artigo possui uma sinalização editorial da comunidade.');

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

    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-ambox not-prose my-4 rounded-lg border p-4 ${toneClass}" role="note" data-template="Aviso">
        <div class="flex items-start gap-3">
          <span class="shrink-0 w-7 h-7 rounded-md border flex items-center justify-center text-sm font-bold ${badgeClass}" aria-hidden="true">${iconChar}</span>
          <div class="min-w-0 flex-1 font-sans">
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <span class="text-[10px] font-mono uppercase tracking-wider font-semibold opacity-75">${labelText}</span>
              <span class="text-xs font-bold">${titulo}</span>
            </div>
            <div class="text-xs leading-relaxed opacity-90">${texto}</div>
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

  // 7. {{Artigo principal}} / {{AP}} / {{Main}}
  if (['artigo principal', 'ap', 'main'].includes(normalizedKey)) {
    const targets = [
      ...call.positional,
      ...[call.named['artigo'], call.named['1'], call.named['2'], call.named['3']].filter(Boolean),
    ]
      .map(t => t.trim())
      .filter(Boolean);

    if (targets.length === 0) return '';
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
    if (targets.length === 0) return '';
    const linksHtml = targets
      .map(t => `<a href="#/wiki/${encodeURIComponent(t.replace(/\s+/g, '_'))}" class="wiki-link font-semibold text-blue-700 dark:text-blue-400 hover:underline">${t}</a>`)
      .join(', ');

    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-hatnote not-prose pl-3 py-1 my-2 text-xs italic text-slate-600 dark:text-slate-400 font-sans" data-template="Veja também">
        ↳ Veja também: ${linksHtml}
      </div>`
    );
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
    if (!texto) return '';
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
    if (!texto) return '';

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
    const titulo = getParam(call, ['título', 'titulo', 'title', 'nome', 'name'], pageTitle);
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

    return compactHtmlBlock(
      `<aside class="wiki-template infobox float-right clear-right ml-6 mb-4 w-72 md:w-80 border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 rounded-lg p-4 text-sm shadow-xs font-sans" data-template="Infocaixa">
        <div class="text-center pb-2 mb-3 border-b border-slate-200 dark:border-slate-800">
          <div class="font-bold text-base text-slate-900 dark:text-slate-100">${titulo}</div>
          ${subtitulo ? `<div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${subtitulo}</div>` : ''}
        </div>
        ${imgBlock}
        ${rowsHtml ? `<table class="w-full text-xs border-collapse">${rowsHtml}</table>` : ''}
      </aside>`
    );
  }

  // 15. {{Navbox}} / {{Caixa de navegação}}
  if (['navbox', 'navegação', 'navegacao', 'caixa de navegação', 'caixa de navegacao'].includes(normalizedKey)) {
    const titulo = getParam(call, ['título', 'titulo', 'title'], 'Navegação');
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

    return compactHtmlBlock(
      `<div class="wiki-template wiki-template-navbox my-6 rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden font-sans text-xs shadow-2xs" role="navigation" aria-label="${escapeHtmlAttr(titulo)}" data-template="Navbox">
        <div class="bg-slate-200/80 dark:bg-slate-800 px-4 py-2 font-bold text-center text-slate-900 dark:text-slate-100 tracking-wide">
          ${titulo}
        </div>
        ${rowsHtml ? `<table class="w-full border-collapse">${rowsHtml}</table>` : ''}
      </div>`
    );
  }

  // 16. {{Reflist}} / {{Referências}}
  if (['reflist', 'referências', 'referencias', 'listaref'].includes(normalizedKey)) {
    return `<div class="wiki-template-reflist-anchor" data-template="Reflist"></div>`;
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
  _stack: Set<string> = new Set()
): TemplateExpansionResult {
  const pageTitle = options.pageTitle || 'Artigo';
  const siteName = options.siteName || 'NotMediaWiki';
  const maxDepth = options.maxDepth ?? MAX_RECURSION_DEPTH;

  const usedTemplates = new Set<string>();
  const missingTemplates = new Set<string>();
  const errors: string[] = [];

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
    // Skip wikitable syntax `{|`
    if (source.startsWith('{|', i)) {
      result += '{|';
      i += 2;
      continue;
    }

    // Ignore parameter triple braces `{{{...}}}` when scanning page top-level
    if (source.startsWith('{{{', i)) {
      result += '{{{';
      i += 3;
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
        const rawInner = source.slice(i + 2, j - 2);
        const call = parseTemplateCallBody(rawInner);
        const rawCallName = call.name;

        // 1. Magic words
        const magicVal = resolveMagicWord(rawCallName, pageTitle, siteName);
        if (magicVal !== null) {
          result += magicVal;
          i = j;
          continue;
        }

        // 2. Preserve {{Infobox <subtype>}} for ClientParsoidService native Infobox handler
        if (/^infobox\s+/i.test(rawCallName)) {
          result += source.slice(i, j);
          i = j;
          continue;
        }

        // Recursively expand nested template calls inside argument values first
        const expandValue = (val: string): string => {
          if (!val || !val.includes('{{')) return val;
          if (_depth + 1 > maxDepth) return val;
          const nested = expandWikitextTemplates(val, { ...options, isTemplatePage: false }, _depth + 1, _stack);
          nested.usedTemplates.forEach(t => usedTemplates.add(t));
          nested.missingTemplates.forEach(t => missingTemplates.add(t));
          errors.push(...nested.errors);
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
            result += `<span class="wiki-template-error inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">${escapeHtmlAttr(cycleMsg)}</span>`;
            i = j;
            continue;
          }

          const nextStack = new Set(_stack);
          nextStack.add(normKey);

          const rawBody = applyIncludeDirectives(customTemplate.wikitext || '', true).trim();
          const substituted = substituteTemplateParameters(rawBody, expandedCall.params);
          const expandedNested = expandWikitextTemplates(
            substituted,
            { ...options, isTemplatePage: false },
            _depth + 1,
            nextStack
          );
          expandedNested.usedTemplates.forEach(t => usedTemplates.add(t));
          expandedNested.missingTemplates.forEach(t => missingTemplates.add(t));
          errors.push(...expandedNested.errors);

          result += expandedNested.wikitext;
          i = j;
          continue;
        }

        // 4. Built-in MediaWiki standard templates
        const builtinHtml = renderBuiltinTemplate(expandedCall, normKey, pageTitle);
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
        const editHref = `#/edit/${encodeURIComponent(canonicalTarget.replace(/\s+/g, '_'))}`;
        result += `<a href="${editHref}" class="wiki-redlink text-rose-700 dark:text-rose-400 underline decoration-dotted hover:text-rose-900 dark:hover:text-rose-300 font-medium" title="Predefinição inexistente (${escapeHtmlAttr(canonicalTarget)}) — clique para criar">${canonicalTarget}</a>`;
        i = j;
        continue;
      }
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
