import {
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  Article,
  Revision,
  UserSession,
  WikiEvent,
} from '../types';
import {
  auth,
  db,
  fetchArticleFromFirestore,
  fetchArticlesFromFirestore,
  handleFirestoreError,
  OperationType,
  saveArticleToFirestore,
} from '../firebase';
import {
  BUILTIN_MEDIAWIKI_TEMPLATES,
  WikiTemplateDefinition,
  buildDefaultTemplatePageSkeleton,
  buildTemplateInvocationWikitext,
} from '../data/defaultTemplates';
import {
  TemplateExpansionOptions,
  TemplateExpansionResult,
  ParsedTemplateCall,
  applyIncludeDirectives,
  expandWikitextTemplates,
  extractTemplateDeclaredParams,
  findBuiltinTemplate,
  normalizeTemplateKey,
  parseTemplateCallBody,
  substituteTemplateParameters,
} from '../utils/templateEngine';
import { parseTitle } from '../utils/namespaces';

export interface SaveTemplateInput {
  name: string;
  wikitext: string;
  summary?: string;
  comment?: string;
  authorUser?: UserSession | null;
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalized: {
    baseName: string;
    title: string;
    slug: string;
    key: string;
  };
  declaredParams: string[];
}

export interface ServiceTemplateExpansionOptions extends TemplateExpansionOptions {
  /** Parâmetros dinâmicos opcionais aplicados em placeholders {{{chave|padrão}}} */
  dynamicParams?: Record<string, string>;
}

const MAX_TITLE_LEN = 255;
const MAX_WIKITEXT_LEN = 500000;
const MAX_SUMMARY_LEN = 2000;
const INVALID_TITLE_CHARS_RE = /[#<>[\]{}|]/;

/**
 * Normalizes a raw template name or slug into canonical Namespace 10 title and slug.
 */
export function normalizeTemplateIdentity(rawName: string): {
  baseName: string;
  title: string;
  slug: string;
  key: string;
} {
  const stripped = (rawName || '')
    .trim()
    .replace(/^:/, '')
    .replace(/^(?:Predefinição|Predef|Template)\s*:/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const baseName = stripped;
  const title = baseName ? `Predefinição:${baseName}` : 'Predefinição:';
  const slug = title.replace(/\s+/g, '_');
  const key = normalizeTemplateKey(baseName);

  return { baseName, title, slug, key };
}

function stripProtectedMarkupForValidation(wikitext: string): string {
  return (wikitext || '')
    .replace(/<nowiki>[\s\S]*?<\/nowiki>/gi, '')
    .replace(/<syntaxhighlight\b[^>]*>[\s\S]*?<\/syntaxhighlight>/gi, '')
    .replace(/<pre>[\s\S]*?<\/pre>/gi, '')
    .replace(/<code>[\s\S]*?<\/code>/gi, '');
}

/**
 * Extrai nomes de predefinições referenciadas em wikitext via sintaxe {{Nome|...}}.
 */
export function extractTemplateReferences(wikitext: string): string[] {
  const clean = stripProtectedMarkupForValidation(wikitext || '');
  const found = new Set<string>();
  const matches = clean.matchAll(/\{\{\s*([^|{}#\n]+?)(?:\s*\||\s*\}\})/g);
  for (const m of matches) {
    const candidate = (m[1] || '').trim();
    if (
      candidate &&
      !candidate.startsWith('{') &&
      !/^(?:PAGENAME|FULLPAGENAME|NAMESPACE|SITENAME|CURRENTYEAR|CURRENTMONTH|CURRENTDAY)$/i.test(candidate)
    ) {
      found.add(candidate);
    }
  }
  return Array.from(found);
}

/**
 * Serviço centralizado de gerenciamento, armazenamento, validação
 * e expansão sintática de Predefinições MediaWiki ({{NomeDaPredefinição|parâmetro}}).
 */
export class TemplateService {
  private cachedCustomTemplates: Article[] = [];

  public listBuiltinTemplates(): WikiTemplateDefinition[] {
    return BUILTIN_MEDIAWIKI_TEMPLATES;
  }

  public getCachedCustomTemplates(): Article[] {
    return this.cachedCustomTemplates;
  }

  public setCachedCustomTemplates(templates: Article[]): void {
    const dedup = new Map<string, Article>();
    for (const art of templates || []) {
      const parsed = parseTitle(art.title || art.slug);
      if (art.namespace === 10 || parsed.namespaceId === 10) {
        const key = normalizeTemplateKey(parsed.baseTitle || art.title || art.slug);
        if (key) {
          dedup.set(key, { ...art, namespace: 10 });
        }
      }
    }
    this.cachedCustomTemplates = Array.from(dedup.values()).sort((a, b) =>
      a.title.localeCompare(b.title)
    );
  }

  private mergeCustomTemplates(explicit?: Article[]): Article[] {
    if (!explicit || explicit.length === 0) {
      return this.cachedCustomTemplates;
    }
    const merged = new Map<string, Article>();
    for (const art of this.cachedCustomTemplates) {
      const parsed = parseTitle(art.title || art.slug);
      const key = normalizeTemplateKey(parsed.baseTitle || art.title || art.slug);
      if (key) merged.set(key, art);
    }
    for (const art of explicit) {
      const parsed = parseTitle(art.title || art.slug);
      if (art.namespace === 10 || parsed.namespaceId === 10) {
        const key = normalizeTemplateKey(parsed.baseTitle || art.title || art.slug);
        if (key) merged.set(key, { ...art, namespace: 10 });
      }
    }
    return Array.from(merged.values());
  }

  /**
   * Valida nome, limites do blueprint, balanceamento de chaves {{...}} / {{{...}}}
   * e diretivas de inclusão de uma predefinição MediaWiki.
   */
  public validateTemplateDefinition(input: {
    name: string;
    wikitext: string;
    summary?: string;
  }): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalized = normalizeTemplateIdentity(input.name);

    if (!normalized.baseName) {
      errors.push('Informe um nome válido para a predefinição.');
    } else if (INVALID_TITLE_CHARS_RE.test(normalized.baseName)) {
      errors.push(
        'O nome da predefinição contém caracteres inválidos (#, <, >, [, ], {, }, |).'
      );
    }

    if (normalized.title.length > MAX_TITLE_LEN || normalized.slug.length > MAX_TITLE_LEN) {
      errors.push(
        `O título completo da predefinição excede o limite de ${MAX_TITLE_LEN} caracteres.`
      );
    }

    const rawWikitext = input.wikitext || '';
    if (!rawWikitext.trim()) {
      errors.push('O conteúdo Wikitext da predefinição não pode estar vazio.');
    } else if (rawWikitext.length > MAX_WIKITEXT_LEN) {
      errors.push(
        `O Wikitext da predefinição excede o limite máximo de ${MAX_WIKITEXT_LEN} caracteres.`
      );
    }

    if (input.summary && input.summary.trim().length > MAX_SUMMARY_LEN) {
      warnings.push(
        `O resumo será truncado para o limite de ${MAX_SUMMARY_LEN} caracteres.`
      );
    }

    const bodyForBalance = stripProtectedMarkupForValidation(rawWikitext);

    // Verifica balanceamento básico de abertura/fechamento de chaves de predefinição/parâmetro
    // ignorando sintaxe de tabelas {| ... |}
    const cleanBraces = bodyForBalance.replace(/\{\|/g, '').replace(/\|\}/g, '');
    const openBraces = (cleanBraces.match(/\{/g) || []).length;
    const closeBraces = (cleanBraces.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push(
        `Chaves {{...}} ou {{{...}}} desbalanceadas (${openBraces} aberturas para ${closeBraces} fechamentos).`
      );
    }

    // Verifica tags de inclusão balanceadas
    const directiveTags = ['includeonly', 'noinclude', 'onlyinclude'] as const;
    for (const tag of directiveTags) {
      const opens = (bodyForBalance.match(new RegExp(`<${tag}>`, 'gi')) || []).length;
      const closes = (bodyForBalance.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
      if (opens !== closes) {
        errors.push(`Tag <${tag}>...</${tag}> não foi fechada corretamente.`);
      }
    }

    // Avisa sobre auto-recursão direta na transclusão
    if (normalized.key) {
      const transclusionBody = applyIncludeDirectives(rawWikitext, true);
      const refs = extractTemplateReferences(transclusionBody);
      if (refs.some(ref => normalizeTemplateKey(ref) === normalized.key)) {
        warnings.push(
          `A predefinição "${normalized.title}" referencia a si mesma diretamente; a profundidade de recursão será limitada em tempo de execução.`
        );
      }
    }

    const declaredParams = extractTemplateDeclaredParams(rawWikitext);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      normalized,
      declaredParams,
    };
  }

  /**
   * Busca todas as predefinições personalizadas (Namespace 10) no Firestore
   * e atualiza o cache síncrono para expansão imediata em visualizadores.
   */
  public async getAllTemplates(): Promise<Article[]> {
    try {
      const list = (await fetchArticlesFromFirestore(10)) || [];
      this.setCachedCustomTemplates(list);
      return this.cachedCustomTemplates;
    } catch (err) {
      console.warn('Erro ao listar predefinições do Firestore:', err);
      return this.cachedCustomTemplates;
    }
  }

  /**
   * Busca uma predefinição específica pelo nome ou slug (com ou sem prefixo Predefinição:).
   */
  public async getTemplateByName(rawName: string): Promise<Article | null> {
    const identity = normalizeTemplateIdentity(rawName);
    if (!identity.baseName) return null;

    const cachedMatch = this.cachedCustomTemplates.find(art => {
      const parsed = parseTitle(art.title || art.slug);
      return normalizeTemplateKey(parsed.baseTitle || art.title) === identity.key;
    });
    if (cachedMatch) return cachedMatch;

    try {
      const direct = await fetchArticleFromFirestore(identity.slug);
      if (direct) {
        this.setCachedCustomTemplates([...this.cachedCustomTemplates, direct]);
        return direct;
      }
      const all = await this.getAllTemplates();
      return (
        all.find(art => {
          const parsed = parseTitle(art.title || art.slug);
          return normalizeTemplateKey(parsed.baseTitle || art.title) === identity.key;
        }) || null
      );
    } catch {
      return null;
    }
  }

  /**
   * Assina atualizações em tempo real das predefinições (Namespace 10) no Firestore.
   */
  public subscribeTemplates(
    onUpdate: (templates: Article[]) => void,
    onError?: (error: unknown) => void
  ): () => void {
    const path = 'articles';
    try {
      const q = query(collection(db, path), where('namespace', '==', 10));
      return onSnapshot(
        q,
        snapshot => {
          const templates: Article[] = [];
          snapshot.forEach(docSnap => {
            const data = docSnap.data() as Article;
            templates.push({ ...data, namespace: 10 });
          });
          this.setCachedCustomTemplates(templates);
          onUpdate(this.cachedCustomTemplates);
        },
        err => {
          if (onError) onError(err);
          try {
            handleFirestoreError(err, OperationType.LIST, path);
          } catch {
            // Surface safely if caller provided onError or run standalone
          }
        }
      );
    } catch (err) {
      if (onError) onError(err);
      return () => {};
    }
  }

  /**
   * Valida e cria/atualiza uma predefinição reutilizável no Namespace 10 do Firestore,
   * respeitando os limites estruturais do firebase-blueprint.json.
   */
  public async saveTemplate(
    input: SaveTemplateInput
  ): Promise<{ article: Article; revision: Revision; event: WikiEvent }> {
    const validation = this.validateTemplateDefinition({
      name: input.name,
      wikitext: input.wikitext,
      summary: input.summary,
    });

    if (!validation.valid) {
      throw new Error(validation.errors[0]);
    }

    if (!auth.currentUser) {
      throw new Error('Você precisa fazer login com sua conta Google para criar ou editar predefinições.');
    }

    const identity = validation.normalized;
    const cleanWikitext = (input.wikitext || '').slice(0, MAX_WIKITEXT_LEN);
    const safeTitle = identity.title.slice(0, MAX_TITLE_LEN);
    const safeSlug = identity.slug.slice(0, MAX_TITLE_LEN);
    const safeSummary = (input.summary || '').trim().slice(0, MAX_SUMMARY_LEN);

    const result = await saveArticleToFirestore({
      slug: safeSlug,
      title: safeTitle,
      wikitext: cleanWikitext,
      summary: safeSummary || `Predefinição reutilizável ${safeTitle}`,
      comment: (input.comment || `Criada/atualizada predefinição ${safeTitle}`).slice(0, 1000),
      isMinor: false,
      namespace: 10,
      authorUser: input.authorUser || null,
    });

    this.setCachedCustomTemplates([
      ...this.cachedCustomTemplates.filter(
        t => normalizeTemplateKey(parseTitle(t.title || t.slug).baseTitle) !== identity.key
      ),
      result.article,
    ]);

    return result;
  }

  /**
   * Remove uma predefinição personalizada do Firestore (requer privilégio admin/sysop nas regras).
   */
  public async deleteTemplate(nameOrSlug: string): Promise<void> {
    const identity = normalizeTemplateIdentity(nameOrSlug);
    const targetPath = `articles/${identity.slug}`;
    try {
      await deleteDoc(doc(db, 'articles', identity.slug));
      this.setCachedCustomTemplates(
        this.cachedCustomTemplates.filter(
          t => normalizeTemplateKey(parseTitle(t.title || t.slug).baseTitle) !== identity.key
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, targetPath);
    }
  }

  /**
   * Expande sintaxe {{NomeDaPredefinição|parâmetro}} e palavras mágicas no Wikitext,
   * combinando predefinições integradas + predefinições personalizadas do Namespace 10
   * e parâmetros dinâmicos opcionais.
   */
  public expandTemplates(
    wikitext: string,
    options: ServiceTemplateExpansionOptions = {}
  ): TemplateExpansionResult {
    const mergedTemplates = this.mergeCustomTemplates(options.customTemplates);
    let source = wikitext || '';

    if (options.dynamicParams && Object.keys(options.dynamicParams).length > 0) {
      source = substituteTemplateParameters(source, options.dynamicParams);
    }

    return expandWikitextTemplates(source, {
      ...options,
      customTemplates: mergedTemplates,
    });
  }

  /**
   * Versão assíncrona que garante o carregamento prévio das predefinições do Firestore
   * caso existam referências {{Nome|params}} ainda não presentes no cache local.
   */
  public async expandTemplatesAsync(
    wikitext: string,
    options: ServiceTemplateExpansionOptions = {}
  ): Promise<TemplateExpansionResult> {
    const refs = extractTemplateReferences(wikitext);
    if (refs.length > 0) {
      const merged = this.mergeCustomTemplates(options.customTemplates);
      const hasUncachedCustomCandidate = refs.some(ref => {
        if (this.findBuiltin(ref)) return false;
        const key = normalizeTemplateKey(ref);
        return !merged.some(
          art => normalizeTemplateKey(parseTitle(art.title || art.slug).baseTitle) === key
        );
      });

      if (hasUncachedCustomCandidate) {
        await this.getAllTemplates();
      }
    }

    return this.expandTemplates(wikitext, options);
  }

  public parseTemplateCall(rawBody: string): ParsedTemplateCall {
    return parseTemplateCallBody(rawBody);
  }

  public substituteParameters(templateWikitext: string, params: Record<string, string>): string {
    return substituteTemplateParameters(templateWikitext, params);
  }

  public applyDirectives(rawWikitext: string, isTransclusion: boolean): string {
    return applyIncludeDirectives(rawWikitext, isTransclusion);
  }

  public extractDeclaredParams(templateWikitext: string): string[] {
    return extractTemplateDeclaredParams(templateWikitext);
  }

  public buildInvocation(
    name: string,
    params: Record<string, string>,
    definition?: WikiTemplateDefinition
  ): string {
    return buildTemplateInvocationWikitext(name, params, definition);
  }

  public buildSkeleton(name: string): string {
    return buildDefaultTemplatePageSkeleton(name);
  }

  public findBuiltin(name: string): WikiTemplateDefinition | undefined {
    return findBuiltinTemplate(name);
  }
}

export const templateService = new TemplateService();
export type { TemplateExpansionOptions, TemplateExpansionResult, ParsedTemplateCall };
