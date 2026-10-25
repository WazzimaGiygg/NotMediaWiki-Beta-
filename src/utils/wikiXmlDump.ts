import { Article, Revision } from '../types';
import { MEDIAWIKI_NAMESPACES } from './namespaces';

export interface ImportedPage {
  title: string;
  slug: string;
  namespace: number;
  revisions: Array<{
    id: string;
    timestamp: string;
    username: string;
    userId: string;
    comment: string;
    wikitext: string;
    sha1?: string;
  }>;
}

/**
 * Generates an official MediaWiki XML Export Dump (version 0.11)
 * Compatible with standard MediaWiki Special:Import and tools like mwclient, pywikibot.
 */
export function generateMediaWikiXmlDump(
  articles: Article[],
  revisionsMap: Record<string, Revision[]> = {}
): string {
  const now = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<mediawiki xmlns="http://www.mediawiki.org/xml/export-0.11/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.mediawiki.org/xml/export-0.11/ http://www.mediawiki.org/xml/export-0.11.xsd" version="0.11" xml:lang="pt-BR">
  <siteinfo>
    <sitename>NotMediaWiki</sitename>
    <dbname>notmediawiki_db</dbname>
    <base>https://wazzimagiygg.com</base>
    <generator>NotMediaWiki 1.42.0-wazzimagiygg</generator>
    <case>first-letter</case>
    <namespaces>
`;

  Object.values(MEDIAWIKI_NAMESPACES).forEach(ns => {
    xml += `      <namespace key="${ns.id}" case="first-letter">${escapeXml(ns.localized || ns.canonical)}</namespace>\n`;
  });

  xml += `    </namespaces>
  </siteinfo>
`;

  articles.forEach((art, artIdx) => {
    const revs = revisionsMap[art.slug] || [
      {
        id: art.latestRevisionId || `rev_${artIdx + 1}`,
        articleSlug: art.slug,
        parentRevisionId: null,
        wikitext: art.wikitext,
        comment: art.summary || 'Importação do NotMediaWiki',
        author: {
          id: 'user_import_01',
          name: 'NotMediaWiki Archiver',
          isBot: true,
        },
        timestamp: art.updatedAt || art.createdAt || now,
        sha256: 'sha256-archive',
        byteSize: art.wikitext.length,
        isMinor: false,
      },
    ];

    xml += `  <page>
    <title>${escapeXml(art.title)}</title>
    <ns>${art.namespace ?? 0}</ns>
    <id>${artIdx + 1}</id>
`;

    revs.forEach((r, revIdx) => {
      xml += `    <revision>
      <id>${revIdx + 1}</id>
      <timestamp>${escapeXml(r.timestamp)}</timestamp>
      <contributor>
        <username>${escapeXml(r.author?.name || 'Editor')}</username>
        <id>${escapeXml(r.author?.id || '1')}</id>
      </contributor>
      <comment>${escapeXml(r.comment || '')}</comment>
      <model>wikitext</model>
      <format>text/x-wiki</format>
      <text bytes="${r.wikitext.length}" xml:space="preserve">${escapeXml(r.wikitext)}</text>
      <sha1>${escapeXml(r.sha256 || '')}</sha1>
    </revision>
`;
    });

    xml += `  </page>\n`;
  });

  xml += `</mediawiki>`;
  return xml;
}

/**
 * Parses an official MediaWiki XML dump string and extracts pages and revisions.
 */
export function parseMediaWikiXmlDump(xmlString: string): ImportedPage[] {
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Falha ao processar arquivo XML: sintaxe XML corrompida.');
    }

    const pageNodes = xmlDoc.getElementsByTagName('page');
    const importedPages: ImportedPage[] = [];

    for (let i = 0; i < pageNodes.length; i++) {
      const pageNode = pageNodes[i];
      const titleNode = pageNode.getElementsByTagName('title')[0];
      const nsNode = pageNode.getElementsByTagName('ns')[0];

      const title = titleNode ? titleNode.textContent || '' : '';
      if (!title) continue;

      const ns = nsNode ? parseInt(nsNode.textContent || '0', 10) : 0;
      const slug = title.replace(/ /g, '_');

      const revNodes = pageNode.getElementsByTagName('revision');
      const revisions: ImportedPage['revisions'] = [];

      for (let j = 0; j < revNodes.length; j++) {
        const revNode = revNodes[j];
        const id = revNode.getElementsByTagName('id')[0]?.textContent || `import_${Date.now()}_${j}`;
        const timestamp = revNode.getElementsByTagName('timestamp')[0]?.textContent || new Date().toISOString();
        const contributor = revNode.getElementsByTagName('contributor')[0];
        const username = contributor?.getElementsByTagName('username')[0]?.textContent || 'Editor MediaWiki';
        const userId = contributor?.getElementsByTagName('id')[0]?.textContent || 'user_anon';
        const comment = revNode.getElementsByTagName('comment')[0]?.textContent || '';
        const textNode = revNode.getElementsByTagName('text')[0];
        const wikitext = textNode ? textNode.textContent || '' : '';
        const sha1 = revNode.getElementsByTagName('sha1')[0]?.textContent || undefined;

        revisions.push({
          id,
          timestamp,
          username,
          userId,
          comment,
          wikitext,
          sha1,
        });
      }

      importedPages.push({
        title,
        slug,
        namespace: ns,
        revisions,
      });
    }

    return importedPages;
  }

  // Regex-based robust fallback for Node.js / worker / test environments
  const pageRegex = /<page>([\s\S]*?)<\/page>/g;
  const importedPages: ImportedPage[] = [];
  let pageMatch: RegExpExecArray | null;

  while ((pageMatch = pageRegex.exec(xmlString)) !== null) {
    const pageBlock = pageMatch[1];
    const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(pageBlock);
    if (!titleMatch) continue;

    const title = titleMatch[1].trim();
    const nsMatch = /<ns>(\d+)<\/ns>/.exec(pageBlock);
    const ns = nsMatch ? parseInt(nsMatch[1], 10) : 0;
    const slug = title.replace(/ /g, '_');

    const revRegex = /<revision>([\s\S]*?)<\/revision>/g;
    const revisions: ImportedPage['revisions'] = [];
    let revMatch: RegExpExecArray | null;

    while ((revMatch = revRegex.exec(pageBlock)) !== null) {
      const revBlock = revMatch[1];
      const idMatch = /<id>([\s\S]*?)<\/id>/.exec(revBlock);
      const tsMatch = /<timestamp>([\s\S]*?)<\/timestamp>/.exec(revBlock);
      const userMatch = /<username>([\s\S]*?)<\/username>/.exec(revBlock);
      const commentMatch = /<comment>([\s\S]*?)<\/comment>/.exec(revBlock);
      const textMatch = /<text[^>]*>([\s\S]*?)<\/text>/.exec(revBlock);
      const sha1Match = /<sha1>([\s\S]*?)<\/sha1>/.exec(revBlock);

      revisions.push({
        id: idMatch ? idMatch[1].trim() : `import_${Date.now()}`,
        timestamp: tsMatch ? tsMatch[1].trim() : new Date().toISOString(),
        username: userMatch ? userMatch[1].trim() : 'Editor MediaWiki',
        userId: 'import_uid',
        comment: commentMatch ? commentMatch[1].trim() : '',
        wikitext: textMatch ? textMatch[1] : '',
        sha1: sha1Match ? sha1Match[1].trim() : undefined,
      });
    }

    importedPages.push({
      title,
      slug,
      namespace: ns,
      revisions,
    });
  }

  return importedPages;
}

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
