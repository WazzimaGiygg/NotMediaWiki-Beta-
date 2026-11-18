import Prism from 'prismjs';

// Import essential & popular programming languages in Prism dependency order
import 'prismjs/components/prism-markup'; // HTML / XML / SVG
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-markup-templating'; // Required by PHP
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-graphql';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-regex';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-diff';
import 'prismjs/components/prism-lua';
import 'prismjs/components/prism-powershell';

/**
 * Canonical Prism.js language identifiers registered for .wiki-content code blocks.
 */
export const SUPPORTED_PRISM_LANGUAGES = [
  'markup',
  'css',
  'clike',
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'json',
  'bash',
  'sql',
  'markdown',
  'python',
  'yaml',
  'graphql',
  'docker',
  'regex',
  'c',
  'cpp',
  'csharp',
  'java',
  'kotlin',
  'swift',
  'go',
  'rust',
  'php',
  'ruby',
  'toml',
  'diff',
  'lua',
  'powershell',
] as const;

/**
 * Normalizes common language aliases or MediaWiki syntaxhighlight language codes
 * to canonical Prism.js grammar keys.
 */
export function normalizeLanguage(rawLang?: string | null): string {
  if (!rawLang) return 'code';
  const l = rawLang.trim().toLowerCase();

  const map: Record<string, string> = {
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    mts: 'typescript',
    cts: 'typescript',
    py: 'python',
    python3: 'python',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
    yml: 'yaml',
    html: 'markup',
    xml: 'markup',
    svg: 'markup',
    gql: 'graphql',
    dockerfile: 'docker',
    md: 'markdown',
    rs: 'rust',
    golang: 'go',
    'c++': 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    hpp: 'cpp',
    h: 'c',
    cs: 'csharp',
    'c#': 'csharp',
    dotnet: 'csharp',
    kt: 'kotlin',
    kts: 'kotlin',
    rb: 'ruby',
    ps1: 'powershell',
    pwsh: 'powershell',
    posh: 'powershell',
    pgsql: 'sql',
    postgres: 'sql',
    postgresql: 'sql',
    mysql: 'sql',
    sqlite: 'sql',
    tsql: 'sql',
    plsql: 'sql',
    patch: 'diff',
  };

  return map[l] || l;
}

export interface LanguageMetadata {
  id: string;
  label: string;
  dotColor: string;
  badgeClasses: string;
}

/**
 * Fallback clipboard copy using a temporary textarea for contexts where navigator.clipboard might be restricted.
 */
export function fallbackCopyText(text: string): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch {
    return false;
  }
}

/**
 * Copies code text to clipboard with modern navigator.clipboard and reliable textarea fallback.
 */
export async function copyCodeToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return fallbackCopyText(text);
    }
  }
  return fallbackCopyText(text);
}

const LINE_NUMBERS_STORAGE_KEY = 'wiki_code_block_line_numbers_enabled';

/**
 * Checks if line numbers should be visible based on localStorage preference.
 * Defaults to true if no preference is explicitly set.
 */
export function getLineNumbersPreference(): boolean {
  try {
    if (typeof localStorage === 'undefined') return true;
    const val = localStorage.getItem(LINE_NUMBERS_STORAGE_KEY);
    if (val === null) return true;
    return val === 'true';
  } catch {
    return true;
  }
}

/**
 * Sets user preference for code block line numbers in localStorage.
 */
export function setLineNumbersPreference(enabled: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LINE_NUMBERS_STORAGE_KEY, String(enabled));
  } catch {
    // Ignore localStorage access failures
  }
}

/**
 * Returns a human-friendly display label, dot color, and badge classes for a given language.
 */
export function getLanguageMetadata(rawLang: string): LanguageMetadata {
  const norm = normalizeLanguage(rawLang);
  const colorMap: Record<string, LanguageMetadata> = {
    typescript: {
      id: 'typescript',
      label: 'TypeScript',
      dotColor: 'bg-blue-400',
      badgeClasses: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
    },
    javascript: {
      id: 'javascript',
      label: 'JavaScript',
      dotColor: 'bg-yellow-400',
      badgeClasses: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30',
    },
    tsx: {
      id: 'tsx',
      label: 'TSX / React',
      dotColor: 'bg-sky-400',
      badgeClasses: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
    },
    jsx: {
      id: 'jsx',
      label: 'JSX / React',
      dotColor: 'bg-sky-400',
      badgeClasses: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
    },
    json: {
      id: 'json',
      label: 'JSON',
      dotColor: 'bg-amber-400',
      badgeClasses: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    },
    bash: {
      id: 'bash',
      label: 'Bash / Shell',
      dotColor: 'bg-emerald-400',
      badgeClasses: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    },
    sql: {
      id: 'sql',
      label: 'SQL',
      dotColor: 'bg-violet-400',
      badgeClasses: 'bg-violet-500/15 text-violet-300 border border-violet-500/30',
    },
    python: {
      id: 'python',
      label: 'Python',
      dotColor: 'bg-blue-500',
      badgeClasses: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
    },
    yaml: {
      id: 'yaml',
      label: 'YAML',
      dotColor: 'bg-rose-400',
      badgeClasses: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
    },
    markup: {
      id: 'html',
      label: 'HTML / XML',
      dotColor: 'bg-orange-400',
      badgeClasses: 'bg-orange-500/15 text-orange-300 border border-orange-500/30',
    },
    markdown: {
      id: 'markdown',
      label: 'Markdown',
      dotColor: 'bg-indigo-400',
      badgeClasses: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
    },
    css: {
      id: 'css',
      label: 'CSS',
      dotColor: 'bg-cyan-400',
      badgeClasses: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
    },
    graphql: {
      id: 'graphql',
      label: 'GraphQL',
      dotColor: 'bg-pink-400',
      badgeClasses: 'bg-pink-500/15 text-pink-300 border border-pink-500/30',
    },
    docker: {
      id: 'dockerfile',
      label: 'Dockerfile',
      dotColor: 'bg-teal-400',
      badgeClasses: 'bg-teal-500/15 text-teal-300 border border-teal-500/30',
    },
    rust: {
      id: 'rust',
      label: 'Rust',
      dotColor: 'bg-orange-500',
      badgeClasses: 'bg-orange-500/15 text-orange-300 border border-orange-500/30',
    },
    go: {
      id: 'go',
      label: 'Go',
      dotColor: 'bg-cyan-400',
      badgeClasses: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
    },
    c: {
      id: 'c',
      label: 'C',
      dotColor: 'bg-sky-400',
      badgeClasses: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
    },
    cpp: {
      id: 'cpp',
      label: 'C++',
      dotColor: 'bg-blue-400',
      badgeClasses: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
    },
    csharp: {
      id: 'csharp',
      label: 'C#',
      dotColor: 'bg-purple-400',
      badgeClasses: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
    },
    java: {
      id: 'java',
      label: 'Java',
      dotColor: 'bg-red-400',
      badgeClasses: 'bg-red-500/15 text-red-300 border border-red-500/30',
    },
    kotlin: {
      id: 'kotlin',
      label: 'Kotlin',
      dotColor: 'bg-fuchsia-400',
      badgeClasses: 'bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30',
    },
    swift: {
      id: 'swift',
      label: 'Swift',
      dotColor: 'bg-orange-400',
      badgeClasses: 'bg-orange-500/15 text-orange-300 border border-orange-500/30',
    },
    php: {
      id: 'php',
      label: 'PHP',
      dotColor: 'bg-indigo-400',
      badgeClasses: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
    },
    ruby: {
      id: 'ruby',
      label: 'Ruby',
      dotColor: 'bg-rose-500',
      badgeClasses: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
    },
    toml: {
      id: 'toml',
      label: 'TOML',
      dotColor: 'bg-stone-400',
      badgeClasses: 'bg-stone-500/15 text-stone-300 border border-stone-500/30',
    },
    diff: {
      id: 'diff',
      label: 'Diff / Patch',
      dotColor: 'bg-lime-400',
      badgeClasses: 'bg-lime-500/15 text-lime-300 border border-lime-500/30',
    },
    lua: {
      id: 'lua',
      label: 'Lua',
      dotColor: 'bg-blue-500',
      badgeClasses: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
    },
    powershell: {
      id: 'powershell',
      label: 'PowerShell',
      dotColor: 'bg-sky-500',
      badgeClasses: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
    },
    code: {
      id: 'code',
      label: 'Code',
      dotColor: 'bg-slate-400',
      badgeClasses: 'bg-slate-700/80 text-slate-300 border border-slate-600/60',
    },
  };

  return (
    colorMap[norm] || {
      id: norm,
      label: norm.toUpperCase(),
      dotColor: 'bg-blue-400',
      badgeClasses: 'bg-slate-700/80 text-slate-300 border border-slate-600/60',
    }
  );
}

/**
 * Highlights a raw string of code and returns tokenized HTML string safely.
 */
export function highlightSnippet(code: string, language: string): string {
  const norm = normalizeLanguage(language);
  const grammar = Prism.languages[norm] || Prism.languages.javascript || Prism.languages.markup;
  try {
    return Prism.highlight(code, grammar, norm);
  } catch {
    return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

/**
 * Extracts CSS class names from an element safely across browser DOM and lightweight test mocks.
 */
function getElementClasses(el: Element): string[] {
  if (typeof el.className === 'string' && el.className.trim()) {
    return el.className.trim().split(/\s+/);
  }
  return Array.from(el.classList || []);
}

/**
 * Normalizes any `language-<alias>` class on a `<pre>` or `<code>` element
 * to its canonical Prism.js grammar class (e.g. `language-rs` -> `language-rust`,
 * `language-golang` -> `language-go`, `language-pgsql` -> `language-sql`)
 * so Prism.highlightAllUnder tokenizes aliases accurately.
 */
function normalizeElementLanguageClass(el: Element): void {
  const classes = getElementClasses(el);
  const langClass = classes.find(c => c.startsWith('language-'));
  if (!langClass) return;

  const raw = langClass.replace('language-', '').toLowerCase().trim();
  if (!raw || raw === 'none') return;

  const canonical = normalizeLanguage(raw);
  if (canonical && canonical !== 'code' && canonical !== raw) {
    el.classList.remove(langClass);
    el.classList.add(`language-${canonical}`);
  }
}

/**
 * Enhances all code blocks inside a root DOM container:
 * 1. Normalizes language aliases on pre/code elements for Prism.js.
 * 2. Executes Prism.js tokenization on pre and code elements.
 * 3. Adds line numbers when appropriate for multi-line snippets.
 * 4. Wraps the <pre> block with a sleek, responsive container header with:
 *    - Language badge with color indicator
 *    - Total line counter
 *    - One-click copy-to-clipboard button with visual feedback ('Copiar' -> 'Copiado!')
 */
export function enhanceCodeBlocks(container: HTMLElement | null): void {
  if (!container || typeof document === 'undefined') return;

  const preElements = container.querySelectorAll('pre');

  // 1. Normalize language-* alias classes before Prism runs so aliases like language-rs / language-golang tokenize
  preElements.forEach(pre => {
    normalizeElementLanguageClass(pre);
    const codeChild = pre.querySelector('code');
    if (codeChild) {
      normalizeElementLanguageClass(codeChild);
    }
  });

  // 2. Run Prism syntax highlighting on all code elements
  try {
    Prism.highlightAllUnder(container);
  } catch (err) {
    console.warn('Prism syntax highlighting warning:', err);
  }

  // 3. Enhance each pre block
  preElements.forEach(pre => {
    // Avoid double decoration if already enhanced
    if (pre.closest('.code-block-wrapper')) {
      return;
    }

    const codeEl = pre.querySelector('code') || pre;

    // Detect language from classes (e.g. language-rust, language-go, language-sql, etc.)
    const combinedClasses = getElementClasses(pre).concat(getElementClasses(codeEl));
    const langClass = combinedClasses.find(c => c.startsWith('language-'));
    const detectedLang = langClass ? langClass.replace('language-', '').toLowerCase().trim() : '';
    const rawLang = detectedLang || 'code';
    const meta = getLanguageMetadata(rawLang);
    const badgeText = detectedLang && detectedLang !== 'none' ? detectedLang : meta.id || 'code';

    // Count lines of code
    const rawText = codeEl.textContent || '';
    const lines = rawText.split('\n');
    const lineCount = lines.length;

    // Build outer wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper my-5 rounded-lg border border-slate-700/80 bg-slate-900 shadow-md overflow-hidden text-left not-prose';

    // Read initial line numbers visibility preference from localStorage
    const lineNumbersVisible = getLineNumbersPreference();

    // Build header bar with label, language badge, line numbers toggle, and copy button
    const header = document.createElement('div');
    header.className = 'code-block-header flex items-center justify-between px-3.5 py-1.5 bg-slate-800/90 text-slate-300 border-b border-slate-700/80 font-mono text-[11px] select-none';
    
    header.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full ${meta.dotColor} inline-block shadow-sm"></span>
        <span class="font-semibold text-slate-200 tracking-wide">${meta.label}</span>
        <span class="code-lang-badge inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${meta.badgeClasses || 'bg-slate-700/80 text-slate-300 border border-slate-600/60'} tracking-wider" data-language="${badgeText}">
          ${badgeText}
        </span>
        ${lineCount > 1 ? `<span class="text-[10px] text-slate-400 font-normal">(${lineCount} linhas)</span>` : ''}
      </div>
      <div class="flex items-center gap-1.5">
        <button type="button" class="toggle-lines-btn px-2 py-1 rounded text-[11px] font-mono transition-all flex items-center gap-1 cursor-pointer border ${lineNumbersVisible ? 'text-indigo-300 bg-indigo-950/40 border-indigo-500/40 hover:bg-indigo-900/50' : 'text-slate-400 bg-slate-800/60 border-slate-700/50 hover:text-slate-200 hover:bg-slate-700/70'}" title="${lineNumbersVisible ? 'Ocultar números de linha' : 'Mostrar números de linha'}" aria-pressed="${lineNumbersVisible ? 'true' : 'false'}">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"></path>
          </svg>
          <span class="toggle-lines-label">${lineNumbersVisible ? 'Linhas: On' : 'Linhas: Off'}</span>
        </button>
        <button type="button" class="copy-code-btn px-2.5 py-1 rounded text-[11px] font-mono text-slate-300 hover:text-white hover:bg-slate-700/80 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer bg-slate-800/60 border border-slate-700/50" title="Copiar código para a área de transferência" aria-label="Copy to Clipboard" data-testid="copy-code-btn">
          <svg class="w-3.5 h-3.5 text-slate-400 copy-icon transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path class="copy-icon-path" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
          <span class="copy-label">Copiar</span>
        </button>
      </div>
    `;

    // SVG icon paths for copy clipboard and success checkmark
    const clipboardPathD = 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z';
    const checkmarkPathD = 'M5 13l4 4L19 7';

    // Wire copy button functionality
    const copyBtn = header.querySelector<HTMLButtonElement>('.copy-code-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', e => {
        e.stopPropagation();
        const codeText = codeEl.textContent || '';
        
        const handleSuccess = () => {
          const label = copyBtn.querySelector('.copy-label');
          const icon = copyBtn.querySelector('.copy-icon');
          const path = copyBtn.querySelector('.copy-icon-path');

          if (label) label.textContent = 'Copiado!';
          copyBtn.classList.add('text-emerald-400', 'border-emerald-600/60', 'bg-emerald-950/40');
          if (icon) {
            icon.classList.remove('text-slate-400');
            icon.classList.add('text-emerald-400', 'scale-110');
          }
          if (path) {
            path.setAttribute('d', checkmarkPathD);
          }

          setTimeout(() => {
            if (label) label.textContent = 'Copiar';
            copyBtn.classList.remove('text-emerald-400', 'border-emerald-600/60', 'bg-emerald-950/40');
            if (icon) {
              icon.classList.add('text-slate-400');
              icon.classList.remove('text-emerald-400', 'scale-110');
            }
            if (path) {
              path.setAttribute('d', clipboardPathD);
            }
          }, 2000);
        };

        copyCodeToClipboard(codeText).then(() => {
          handleSuccess();
        }).catch(() => {
          handleSuccess();
        });
      });
    }

    // Build code body area with line numbers column and pre block
    const bodyContainer = document.createElement('div');
    bodyContainer.className = 'code-block-body relative flex overflow-x-auto';

    // Generate line numbers gutter
    const lineNumbersGutter = document.createElement('div');
    lineNumbersGutter.className = `code-line-numbers select-none flex flex-col py-4 pl-3 pr-2.5 text-right font-mono text-[0.85rem] leading-[1.65] text-slate-500/80 bg-slate-900/60 border-r border-slate-700/60 shrink-0 ${lineNumbersVisible ? '' : 'hidden'}`;
    lineNumbersGutter.setAttribute('aria-hidden', 'true');

    // Build line number elements
    const lineElementsHtml = Array.from({ length: Math.max(1, lineCount) }, (_, idx) => 
      `<span class="code-line-num select-none block leading-[1.65] text-right font-mono" data-line="${idx + 1}">${idx + 1}</span>`
    ).join('');
    lineNumbersGutter.innerHTML = lineElementsHtml;

    // Wire line numbers toggle button functionality and sync across all code blocks
    const toggleLinesBtn = header.querySelector<HTMLButtonElement>('.toggle-lines-btn');
    if (toggleLinesBtn) {
      toggleLinesBtn.addEventListener('click', e => {
        e.stopPropagation();
        const currentActive = getLineNumbersPreference();
        const nextState = !currentActive;
        setLineNumbersPreference(nextState);

        // Update all code blocks in the document to reflect the new global user preference
        const allWrappers = document.querySelectorAll('.code-block-wrapper');
        allWrappers.forEach(wrap => {
          const gutter = wrap.querySelector('.code-line-numbers');
          const btn = wrap.querySelector<HTMLButtonElement>('.toggle-lines-btn');
          const label = wrap.querySelector('.toggle-lines-label');

          if (gutter) {
            if (nextState) {
              gutter.classList.remove('hidden');
            } else {
              gutter.classList.add('hidden');
            }
          }

          if (btn) {
            btn.setAttribute('aria-pressed', nextState ? 'true' : 'false');
            btn.title = nextState ? 'Ocultar números de linha' : 'Mostrar números de linha';
            if (nextState) {
              btn.className = 'toggle-lines-btn px-2 py-1 rounded text-[11px] font-mono transition-all flex items-center gap-1 cursor-pointer border text-indigo-300 bg-indigo-950/40 border-indigo-500/40 hover:bg-indigo-900/50';
            } else {
              btn.className = 'toggle-lines-btn px-2 py-1 rounded text-[11px] font-mono transition-all flex items-center gap-1 cursor-pointer border text-slate-400 bg-slate-800/60 border-slate-700/50 hover:text-slate-200 hover:bg-slate-700/70';
            }
          }

          if (label) {
            label.textContent = nextState ? 'Linhas: On' : 'Linhas: Off';
          }
        });
      });
    }

    // Ensure pre styling integrates cleanly with line numbers gutter
    pre.classList.add('code-content-pre', 'flex-1', '!m-0', '!border-0', '!rounded-none');

    // Replace the raw <pre> in the DOM with our enhanced wrapper
    if (pre.parentNode) {
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      bodyContainer.appendChild(lineNumbersGutter);
      bodyContainer.appendChild(pre);
      wrapper.appendChild(bodyContainer);
    }
  });
}

export default {
  enhanceCodeBlocks,
  highlightSnippet,
  getLanguageMetadata,
  normalizeLanguage,
  getLineNumbersPreference,
  setLineNumbersPreference,
  SUPPORTED_PRISM_LANGUAGES,
};
