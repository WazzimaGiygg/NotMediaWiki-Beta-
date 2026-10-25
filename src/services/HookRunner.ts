/**
 * MediaWiki Hook Runner & Plugin Extension System
 * Implements MediaWiki's standard HookContainer and HookRunner patterns in TypeScript.
 */

export type HookHandler<T = any> = (context: T) => boolean | void | Promise<boolean | void>;

export interface HookRegistration {
  name: string;
  extensionId: string;
  handler: HookHandler;
  priority?: number;
}

export class HookRunner {
  private hooks: Map<string, HookRegistration[]> = new Map();
  private hookCallLog: Array<{ hook: string; extensionId: string; timestamp: string; durationMs: number }> = [];

  constructor() {
    this.registerDefaultHooks();
  }

  /**
   * Registers a hook handler from an extension.
   */
  public register(name: string, extensionId: string, handler: HookHandler, priority = 10): void {
    const list = this.hooks.get(name) || [];
    list.push({ name, extensionId, handler, priority });
    list.sort((a, b) => (b.priority || 10) - (a.priority || 10));
    this.hooks.set(name, list);
  }

  /**
   * Runs all registered handlers for a hook. If any handler returns false,
   * execution stops and the hook is aborted (standard MediaWiki hook abort behavior).
   */
  public async run<T = any>(hookName: string, context: T): Promise<boolean> {
    const list = this.hooks.get(hookName);
    if (!list || list.length === 0) return true;

    for (const reg of list) {
      const start = performance.now();
      try {
        const result = await reg.handler(context);
        const duration = performance.now() - start;
        this.logExecution(hookName, reg.extensionId, duration);

        if (result === false) {
          console.warn(`[MediaWiki Hook] ${hookName} foi abortado pelo handler da extensão "${reg.extensionId}".`);
          return false;
        }
      } catch (err) {
        console.error(`[MediaWiki Hook Error] Erro ao executar ${hookName} na extensão "${reg.extensionId}":`, err);
      }
    }

    return true;
  }

  /**
   * Synchronous hook execution when async is not applicable (e.g. pure string transformation).
   */
  public runSync<T = any>(hookName: string, context: T): boolean {
    const list = this.hooks.get(hookName);
    if (!list || list.length === 0) return true;

    for (const reg of list) {
      const start = performance.now();
      try {
        const result = reg.handler(context);
        const duration = performance.now() - start;
        this.logExecution(hookName, reg.extensionId, duration);

        if (result === false) {
          return false;
        }
      } catch (err) {
        console.error(`[MediaWiki Hook Error] Erro ao executar ${hookName} (sync) na extensão "${reg.extensionId}":`, err);
      }
    }

    return true;
  }

  private logExecution(hook: string, extensionId: string, durationMs: number) {
    this.hookCallLog.unshift({
      hook,
      extensionId,
      timestamp: new Date().toISOString(),
      durationMs: Math.round(durationMs * 100) / 100,
    });
    if (this.hookCallLog.length > 100) {
      this.hookCallLog.pop();
    }
  }

  public getCallLogs() {
    return [...this.hookCallLog];
  }

  public getRegisteredHooks(): Array<{ hook: string; count: number; extensions: string[] }> {
    const summary: Array<{ hook: string; count: number; extensions: string[] }> = [];
    this.hooks.forEach((list, hook) => {
      summary.push({
        hook,
        count: list.length,
        extensions: Array.from(new Set(list.map(l => l.extensionId))),
      });
    });
    return summary;
  }

  /**
   * Registers default core hooks for NotMediaWiki.
   */
  private registerDefaultHooks() {
    // Hook: ParserFirstCallInit
    this.register('ParserFirstCallInit', 'core.parser', ctx => {
      // Registers custom tags (<ref>, <references>, <math>, <code>)
      return true;
    });

    // Hook: EditFilterMergedContent
    this.register('EditFilterMergedContent', 'core.antispam', ctx => {
      // Checks for forbidden strings or bad URLs before save
      if (ctx && ctx.wikitext && typeof ctx.wikitext === 'string') {
        const blacklisted = ['phishing-test-domain.tk', 'trojan-download.exe'];
        if (blacklisted.some(b => ctx.wikitext.includes(b))) {
          ctx.error = 'Edição bloqueada pelo SpamBlacklist: URL maliciosa detectada.';
          return false;
        }
      }
      return true;
    });

    // Hook: ArticlePageDataBefore
    this.register('ArticlePageDataBefore', 'core.semantic', ctx => {
      // Injects semantic metadata and namespaces
      return true;
    });

    // Hook: BeforePageDisplay
    this.register('BeforePageDisplay', 'core.skin', ctx => {
      // Injects CSS styles and responsive modules
      return true;
    });
  }
}

export const hookRunner = new HookRunner();
