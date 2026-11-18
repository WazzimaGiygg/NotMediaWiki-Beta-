export interface DynamicHeading {
  id: string;
  level: 2 | 3;
  text: string;
  number: string;
}

export interface TocGroup {
  parent: DynamicHeading;
  subSections: DynamicHeading[];
}

/**
 * Converts heading text into a stable, URL-safe DOM anchor ID.
 */
export function slugifyHeading(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'secao'
  );
}

/**
 * Strips trailing permalink markers (e.g. '#') and inner HTML tags from heading content.
 */
export function cleanHeadingText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/#\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses H2 and H3 headings from an HTML string into a numbered hierarchical list
 * with guaranteed unique anchor IDs. Works in both browser and Node/SSR test environments.
 */
export function extractHeadingsFromHtml(html?: string): DynamicHeading[] {
  if (!html || !html.trim()) return [];

  const regex = /<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
  const result: DynamicHeading[] = [];
  const seenIds = new Set<string>();
  let h2Count = 0;
  let h3Count = 0;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1], 10) as 2 | 3;
    const attrs = match[2] || '';
    const text = cleanHeadingText(match[3] || '');
    if (!text) continue;

    const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
    const baseId = (idMatch && idMatch[1].trim()) || slugifyHeading(text);

    let uniqueId = baseId;
    let suffix = 1;
    while (seenIds.has(uniqueId)) {
      uniqueId = `${baseId}-${suffix++}`;
    }
    seenIds.add(uniqueId);

    let number = '';
    if (level === 2) {
      h2Count++;
      h3Count = 0;
      number = `${h2Count}`;
    } else {
      h3Count++;
      number = h2Count > 0 ? `${h2Count}.${h3Count}` : `${h3Count}`;
    }

    result.push({
      id: uniqueId,
      level,
      text,
      number,
    });
  }

  return result;
}

/**
 * Groups flat H2/H3 headings into parent H2 sections with nested H3 subsections.
 */
export function groupHeadings(headings: DynamicHeading[]): TocGroup[] {
  const groups: TocGroup[] = [];
  let currentGroup: TocGroup | null = null;

  for (const heading of headings) {
    if (heading.level === 2) {
      currentGroup = {
        parent: heading,
        subSections: [],
      };
      groups.push(currentGroup);
    } else if (currentGroup) {
      currentGroup.subSections.push(heading);
    } else {
      currentGroup = {
        parent: heading,
        subSections: [],
      };
      groups.push(currentGroup);
    }
  }

  return groups;
}
