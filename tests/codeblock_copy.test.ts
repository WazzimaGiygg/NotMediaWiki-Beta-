import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeLanguage,
  getLanguageMetadata,
  highlightSnippet,
  copyCodeToClipboard,
  enhanceCodeBlocks,
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
  });

  describe('Parsoid Wikitext Code Block Output', () => {
    it('generates proper pre/code structure from <syntaxhighlight lang="typescript">', () => {
      const wikitext = '<syntaxhighlight lang="typescript">\nconst greeting = "Hello World";\n</syntaxhighlight>';
      const parsed = clientParsoid.parse(wikitext, 'TestPage');
      expect(parsed.html).toContain('<pre class="language-typescript">');
      expect(parsed.html).toContain('<code class="language-typescript">');
      expect(parsed.html).toContain('const greeting = "Hello World";');
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
    });
  });
});
