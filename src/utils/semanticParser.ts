/**
 * Lightweight Semantic MediaWiki (SMW) & Cargo Structured Data Engine
 * Supports property annotations [[Property::Value]], {{#set: ...}}, datatypes,
 * query resolution and factbox extraction.
 */

export type SemanticPropertyType = 'Page' | 'Text' | 'Number' | 'Date' | 'URL' | 'Boolean';

export interface SemanticFact {
  property: string;
  propertyKey: string;
  rawValue: string;
  type: SemanticPropertyType;
  parsedValue: string | number | boolean | Date;
  isLink: boolean;
}

export interface SemanticPageData {
  slug: string;
  title: string;
  facts: SemanticFact[];
  categories: string[];
}

/**
 * Infer the datatype of a property value based on heuristics.
 */
export function inferPropertyType(property: string, value: string): SemanticPropertyType {
  const pLower = property.toLowerCase();
  const vLower = value.toLowerCase().trim();

  if (vLower === 'true' || vLower === 'false' || vLower === 'sim' || vLower === 'não') {
    return 'Boolean';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(vLower) || pLower.includes('data') || pLower.includes('date') || pLower.includes('nascimento') || pLower.includes('fundação')) {
    return 'Date';
  }
  if (!Number.isNaN(Number(vLower.replace(/,/g, '.'))) && (pLower.includes('população') || pLower.includes('área') || pLower.includes('ano') || pLower.includes('número') || pLower.includes('total') || pLower.includes('id'))) {
    return 'Number';
  }
  if (vLower.startsWith('http://') || vLower.startsWith('https://')) {
    return 'URL';
  }
  if (value.startsWith('[[') && value.endsWith(']]')) {
    return 'Page';
  }
  return 'Text';
}

/**
 * Extracts all semantic properties [[Property::Value]] and {{#set: prop=val}} from Wikitext.
 */
export function parseSemanticFacts(slug: string, title: string, wikitext: string): SemanticPageData {
  const facts: SemanticFact[] = [];
  const propertyMap = new Map<string, SemanticFact>();

  // 1. Match [[Property::Value]] or [[Property::Value|Display]]
  // Regex handles nested whitespace and unicode
  const annotationRegex = /\[\[([A-Za-zÀ-ÿ0-9 _\-]+)::([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = annotationRegex.exec(wikitext)) !== null) {
    const propName = match[1].trim();
    const rawVal = match[2].trim();
    const displayVal = match[3] ? match[3].trim() : rawVal;
    const propKey = propName.toLowerCase().replace(/ /g, '_');
    const type = inferPropertyType(propName, rawVal);

    let parsedVal: any = displayVal;
    if (type === 'Number') {
      const num = Number(rawVal.replace(/,/g, '.'));
      if (!Number.isNaN(num)) parsedVal = num;
    } else if (type === 'Boolean') {
      parsedVal = ['true', 'sim', '1'].includes(rawVal.toLowerCase());
    }

    const fact: SemanticFact = {
      property: propName,
      propertyKey: propKey,
      rawValue: rawVal,
      type,
      parsedValue: parsedVal,
      isLink: type === 'Page' || type === 'URL' || !!match[3],
    };

    propertyMap.set(`${propKey}::${rawVal}`, fact);
  }

  // 2. Match {{#set: prop1=val1 | prop2=val2 }}
  const setParserFuncRegex = /\{\{#set:\s*([^}]+)\}\}/gi;
  while ((match = setParserFuncRegex.exec(wikitext)) !== null) {
    const pairs = match[1].split('|');
    for (const pair of pairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx > 0) {
        const propName = pair.substring(0, eqIdx).trim();
        const rawVal = pair.substring(eqIdx + 1).trim();
        if (propName && rawVal) {
          const propKey = propName.toLowerCase().replace(/ /g, '_');
          const type = inferPropertyType(propName, rawVal);
          const fact: SemanticFact = {
            property: propName,
            propertyKey: propKey,
            rawValue: rawVal,
            type,
            parsedValue: rawVal,
            isLink: type === 'Page' || type === 'URL',
          };
          propertyMap.set(`${propKey}::${rawVal}`, fact);
        }
      }
    }
  }

  // Extract Categories
  const categoryRegex = /\[\[(?:Categoria|Category):([^\]]+)\]\]/gi;
  const categories: string[] = [];
  while ((match = categoryRegex.exec(wikitext)) !== null) {
    categories.push(match[1].trim());
  }

  return {
    slug,
    title,
    facts: Array.from(propertyMap.values()),
    categories,
  };
}

/**
 * Pre-processes wikitext before Parsoid compilation so that [[Property::Value]]
 * renders cleanly as a hyperlink or text in the browser.
 */
export function sanitizeSemanticWikitext(wikitext: string): string {
  // Replace [[Property::Value|Display]] -> [[Value|Display]] or Display
  return wikitext
    .replace(/\[\[([A-Za-zÀ-ÿ0-9 _\-]+)::([^\]|]+)\|([^\]]+)\]\]/g, '$3')
    .replace(/\[\[([A-Za-zÀ-ÿ0-9 _\-]+)::([^\]]+)\]\]/g, '$2')
    .replace(/\{\{#set:[^}]+\}\}/gi, '');
}

/**
 * Evaluates SMW-style query: {{#ask: [[Category:Software]] [[Language::TypeScript]] }}
 */
export function executeSemanticQuery(
  pages: SemanticPageData[],
  conditions: Array<{ property?: string; value?: string; category?: string }>
): SemanticPageData[] {
  return pages.filter(page => {
    return conditions.every(cond => {
      if (cond.category) {
        const catMatch = page.categories.some(
          c => c.toLowerCase() === cond.category!.toLowerCase()
        );
        if (!catMatch) return false;
      }
      if (cond.property && cond.value) {
        const pKey = cond.property.toLowerCase().replace(/ /g, '_');
        const vKey = cond.value.toLowerCase().trim();
        const hasFact = page.facts.some(
          f => f.propertyKey === pKey && f.rawValue.toLowerCase().includes(vKey)
        );
        if (!hasFact) return false;
      }
      return true;
    });
  });
}
