import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeLanguage,
  getLanguageMetadata,
  highlightSnippet,
  copyCodeToClipboard,
  enhanceCodeBlocks,
  SUPPORTED_PRISM_LANGUAGES,
} from '../src/utils/syntaxHighlighter';
import { clientParsoid } from '../src/services/parsoid';

describe('Code Block and Copy to Clipboard Integration', () => {
  describe('Language detection and metadata', () => {
    it('normalizes common language aliases', () => {
      expect(normalizeLanguage('js')).toBe('javascript');
      expect(normalizeLanguage('ts')).toBe('typescript');
      expect(normalizeLanguage('py')).toBe('python');
      expect(normalizeLanguage('sh')).toBe('bash');
      expect(normalizeLanguage('yml')).toBe('yaml');
      expect(normalizeLanguage('golang')).toBe('go');
      expect(normalizeLanguage(null)).toBe('code');
    });

    it('returns rich display metadata for supported languages', () => {
      const ts = getLanguageMetadata('typescript');
      expect(ts.label).toBe('TypeScript');
      expect(ts.dotColor).toContain('bg-blue');

      const py = getLanguageMetadata('py');
      expect(py.label).toBe('Python');

      const bash = getLanguageMetadata('bash');
      expect(bash.label).toContain('Bash');
    });

    it('tokenizes code safely with highlightSnippet', () => {
      const code = 'const answer: number = 42;';
      const highlighted = highlightSnippet(code, 'typescript');
      expect(highlighted).toContain('class="token');
      expect(highlighted).toContain('number');
    });
    it('normalizes extended language aliases for Rust, Go, SQL, C++, C#, Kotlin, Ruby, PowerShell, and Diff', () => {
      expect(normalizeLanguage('rs')).toBe('rust');
      expect(normalizeLanguage('golang')).toBe('go');
      expect(normalizeLanguage('pgsql')).toBe('sql');
      expect(normalizeLanguage('postgresql')).toBe('sql');
      expect(normalizeLanguage('mysql')).toBe('sql');
      expect(normalizeLanguage('sqlite')).toBe('sql');
      expect(normalizeLanguage('c++')).toBe('cpp');
      expect(normalizeLanguage('cxx')).toBe('cpp');
      expect(normalizeLanguage('cs')).toBe('csharp');
      expect(normalizeLanguage('c#')).toBe('csharp');
      expect(normalizeLanguage('kt')).toBe('kotlin');
      expect(normalizeLanguage('rb')).toBe('ruby');
      expect(normalizeLanguage('ps1')).toBe('powershell');
      expect(normalizeLanguage('patch')).toBe('diff');
    });

    it('returns rich display metadata for newly added languages', () => {
      expect(getLanguageMetadata('rs').label).toBe('Rust');
      expect(getLanguageMetadata('golang').label).toBe('Go');
      expect(getLanguageMetadata('pgsql').label).toBe('SQL');
      expect(getLanguageMetadata('cpp').label).toBe('C++');
      expect(getLanguageMetadata('csharp').label).toBe('C#');
      expect(getLanguageMetadata('java').label).toBe('Java');
      expect(getLanguageMetadata('kotlin').label).toBe('Kotlin');
      expect(getLanguageMetadata('swift').label).toBe('Swift');
      expect(getLanguageMetadata('php').label).toBe('PHP');
      expect(getLanguageMetadata('ruby').label).toBe('Ruby');
      expect(getLanguageMetadata('toml').label).toBe('TOML');
      expect(getLanguageMetadata('diff').label).toBe('Diff / Patch');
      expect(getLanguageMetadata('lua').label).toBe('Lua');
      expect(getLanguageMetadata('powershell').label).toBe('PowerShell');
    });

    it('tokenizes Rust, Go, SQL, and additional languages with Prism.js grammars', () => {
      expect(SUPPORTED_PRISM_LANGUAGES).toContain('rust');
      expect(SUPPORTED_PRISM_LANGUAGES).toContain('go');
      expect(SUPPORTED_PRISM_LANGUAGES).toContain('sql');

      const rustHtml = highlightSnippet('fn main() {\n  let mut count: u32 = 10;\n  println!("Count: {}", count);\n}', 'rs');
      expect(rustHtml).toContain('token keyword');
      expect(rustHtml).toContain('token macro');

      const goHtml = highlightSnippet('package main\nfunc main() {\n  ch := make(chan int)\n}', 'golang');
      expect(goHtml).toContain('token keyword');
      expect(goHtml).toContain('token builtin');

      const sqlHtml = highlightSnippet('SELECT id, title FROM articles WHERE views > 100 ORDER BY views DESC;', 'postgresql');
      expect(sqlHtml).toContain('token keyword');
      expect(sqlHtml).toContain('token number');

      const cppHtml = highlightSnippet('#include <iostream>\nint main() { return 0; }', 'c++');
      expect(cppHtml).toContain('token macro');
      expect(cppHtml).toContain('token keyword');

      const javaHtml = highlightSnippet('public class Wiki { public static void main(String[] args) {} }', 'java');
      expect(javaHtml).toContain('token keyword');
      expect(javaHtml).toContain('token class-name');

      const phpHtml = highlightSnippet('<?php function greet($name) { return "Hi " . $name; } ?>', 'php');
      expect(phpHtml).toContain('token keyword');
      expect(phpHtml).toContain('token variable');

      const tomlHtml = highlightSnippet('[package]\nname = "notmediawiki"\nversion = "1.0.0"', 'toml');
      expect(tomlHtml).toContain('token table');
      expect(tomlHtml).toContain('token string');

      const diffHtml = highlightSnippet('@@ -1,2 +1,2 @@\n-old line\n+new line', 'patch');
      expect(diffHtml).toContain('token deleted');
      expect(diffHtml).toContain('token inserted');
    });
  });

  describe('Parsoid Wikitext Code Block Output', () => {
    it('generates proper pre/code structure from <syntaxhighlight lang="typescript">', () => {
      const wikitext = '<syntaxhighlight lang="typescript">\nconst greeting = "Hello World";\n</syntaxhighlight>';
      const parsed = clientParsoid.parse(wikitext, 'TestPage');
      expect(parsed.html).toContain('<pre class="language-typescript">');
      expect(parsed.html).toContain('<code class="language-typescript">');
      expect(parsed.html).toContain('const greeting = "Hello World";');
    });

    it('generates proper pre/code structure from <syntaxhighlight lang="rust"> and fenced ```go / ```sql', () => {
      const rustParsed = clientParsoid.parse('<syntaxhighlight lang="rust">\nfn main() {}\n</syntaxhighlight>', 'RustPage');
      expect(rustParsed.html).toContain('<pre class="language-rust">');
      expect(rustParsed.html).toContain('<code class="language-rust">');

      const goParsed = clientParsoid.parse('```go\npackage main\n```', 'GoPage');
      expect(goParsed.html).toContain('<pre class="language-go">');
      expect(goParsed.html).toContain('<code class="language-go">');

      const sqlParsed = clientParsoid.parse('```sql\nSELECT 1;\n```', 'SqlPage');
      expect(sqlParsed.html).toContain('<pre class="language-sql">');
      expect(sqlParsed.html).toContain('<code class="language-sql">');
    });

    it('generates proper pre/code structure from fenced markdown ```python', () => {
      const wikitext = '```python\ndef add(a, b):\n    return a + b\n```';
      const parsed = clientParsoid.parse(wikitext, 'TestPage');
      expect(parsed.html).toContain('<pre class="language-python">');
      expect(parsed.html).toContain('<code class="language-python">');
      expect(parsed.html).toContain('def add(a, b):');
    });

    it('generates pre/code structure from raw <pre>', () => {
      const wikitext = '<pre>\nPlain console log text\n</pre>';
      const parsed = clientParsoid.parse(wikitext, 'TestPage');
      expect(parsed.html).toContain('<pre class="language-none">');
      expect(parsed.html).toContain('<code class="language-none">');
      expect(parsed.html).toContain('Plain console log text');
    });
  });

  describe('enhanceCodeBlocks and Copy to Clipboard Button', () => {
    let originalDocument: any;

    beforeEach(() => {
      originalDocument = (globalThis as any).document;
    });

    afterEach(() => {
      (globalThis as any).document = originalDocument;
      vi.restoreAllMocks();
    });

    it('does not throw when document is undefined (SSR safety)', () => {
      (globalThis as any).document = undefined;
      expect(() => enhanceCodeBlocks(null)).not.toThrow();
    });

    it('decorates pre elements with a header containing the Copy to Clipboard button', async () => {
      // Create minimal simulated DOM node
      class MockElement {
        tagName: string;
        className: string = '';
        innerHTML: string = '';
        textContent: string = '';
        children: MockElement[] = [];
        parentNode: MockElement | null = null;
        attributes: Record<string, string> = {};
        listeners: Record<string, Function[]> = {};
        style: Record<string, string> = {};

        constructor(tag: string) {
          this.tagName = tag.toUpperCase();
        }

        select() {}
        setSelectionRange() {}

        get classList() {
          const classes = new Set(this.className.split(/\s+/).filter(Boolean));
          return {
            contains: (c: string) => classes.has(c),
            add: (...cs: string[]) => {
              cs.forEach(c => classes.add(c));
              this.className = Array.from(classes).join(' ');
            },
            remove: (...cs: string[]) => {
              cs.forEach(c => classes.delete(c));
              this.className = Array.from(classes).join(' ');
            },
          };
        }

        setAttribute(name: string, value: string) {
          this.attributes[name] = value;
        }

        getAttribute(name: string) {
          return this.attributes[name] || null;
        }

        addEventListener(event: string, fn: Function) {
          if (!this.listeners[event]) this.listeners[event] = [];
          this.listeners[event].push(fn);
        }

        appendChild(child: MockElement) {
          child.parentNode = this;
          this.children.push(child);
          return child;
        }

        insertBefore(newNode: MockElement, referenceNode: MockElement) {
          newNode.parentNode = this;
          const idx = this.children.indexOf(referenceNode);
          if (idx >= 0) {
            this.children.splice(idx, 0, newNode);
          } else {
            this.children.push(newNode);
          }
          return newNode;
        }

        removeChild(child: MockElement) {
          const idx = this.children.indexOf(child);
          if (idx >= 0) this.children.splice(idx, 1);
          child.parentNode = null;
          return child;
        }

        closest(selector: string): MockElement | null {
          let curr: MockElement | null = this;
          while (curr) {
            if (selector.startsWith('.') && curr.classList.contains(selector.slice(1))) {
              return curr;
            }
            curr = curr.parentNode;
          }
          return null;
        }

        querySelector(sel: string): MockElement | null {
          const matches = (node: MockElement) => {
            if (sel.startsWith('.')) return node.classList.contains(sel.slice(1));
            return node.tagName.toLowerCase() === sel.toLowerCase();
          };
          for (const child of this.children) {
            if (matches(child)) return child;
            const found = child.querySelector(sel);
            if (found) return found;
          }
          return null;
        }

        querySelectorAll(sel: string): MockElement[] {
          const results: MockElement[] = [];
          const matches = (node: MockElement) => {
            if (sel.startsWith('.')) return node.classList.contains(sel.slice(1));
            return node.tagName.toLowerCase() === sel.toLowerCase();
          };
          for (const child of this.children) {
            if (matches(child)) results.push(child);
            results.push(...child.querySelectorAll(sel));
          }
          return results;
        }
      }

      const mockDoc = {
        createElement: (tag: string) => new MockElement(tag),
        body: new MockElement('body'),
        execCommand: vi.fn().mockReturnValue(true),
      };
      (globalThis as any).document = mockDoc;

      // Create a container with a pre code element
      const container = new MockElement('div');
      const pre = new MockElement('pre');
      pre.className = 'language-typescript';
      const code = new MockElement('code');
      code.className = 'language-typescript';
      code.textContent = 'const a = 1;';
      pre.appendChild(code);
      container.appendChild(pre);

      // Enhance the container
      enhanceCodeBlocks(container as any);

      // Verify wrapper was inserted
      const wrapper = container.children.find(c => c.classList.contains('code-block-wrapper'));
      expect(wrapper).toBeDefined();

      // Verify header was added inside wrapper
      const header = wrapper?.children.find(c => c.classList.contains('code-block-header'));
      expect(header).toBeDefined();
      expect(header?.innerHTML).toContain('copy-code-btn');
      expect(header?.innerHTML).toContain('Copy to Clipboard');
      expect(header?.innerHTML).toContain('Copiar');

      // Verify idempotent: running enhanceCodeBlocks again does NOT double-wrap
      enhanceCodeBlocks(container as any);
      const wrappers = container.querySelectorAll('.code-block-wrapper');
      expect(wrappers.length).toBe(1);

      // Verify copyCodeToClipboard function works via fallback or navigator
      const copyResult = await copyCodeToClipboard('const a = 1;');
      expect(copyResult).toBe(true);

      // Verify alias language classes (e.g. language-rs) are normalized to canonical Prism classes (language-rust)
      const aliasContainer = new MockElement('div');
      const rustPre = new MockElement('pre');
      rustPre.className = 'language-rs';
      const rustCode = new MockElement('code');
      rustCode.className = 'language-rs';
      rustCode.textContent = 'fn main() {}';
      rustPre.appendChild(rustCode);
      aliasContainer.appendChild(rustPre);

      enhanceCodeBlocks(aliasContainer as any);
      expect(rustPre.classList.contains('language-rust')).toBe(true);
      expect(rustCode.classList.contains('language-rust')).toBe(true);
      const rustHeader = aliasContainer.querySelector('.code-block-header');
      expect(rustHeader?.innerHTML).toContain('Rust');
    });
  });
});
