import { Request, Response } from 'express';
import { contentService } from './content';
import { revisionService } from './revisions';
import { searchService } from './search';
import { eventStreamService } from './events';
import { parsoidService } from './parsoid';

/**
 * Official MediaWiki Action API Handler (/api.php)
 * Conforms to MediaWiki API specification used by Pywikibot, Wikipedia apps, bots and external tools.
 */
export async function handleActionApi(req: Request, res: Response) {
  const query = { ...req.query, ...req.body };
  const action = (query.action || 'help').toLowerCase();
  const format = (query.format || 'json').toLowerCase();

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // 1. Action: opensearch (Quick title autocomplete)
  if (action === 'opensearch') {
    const search = String(query.search || '');
    const limit = Math.min(50, parseInt(String(query.limit || '10'), 10));
    const results = searchService.query(search).slice(0, limit);
    const titles = results.map((r: { title: string }) => r.title);
    const descriptions = results.map((r: { snippet?: string }) => r.snippet || '');
    const urls = results.map((r: { slug: string }) => `https://wazzimagiygg.com/#/wiki/${encodeURIComponent(r.slug)}`);

    return res.json([search, titles, descriptions, urls]);
  }

  // 2. Action: parse (Parse page or wikitext to HTML)
  if (action === 'parse') {
    const page = query.page ? String(query.page) : undefined;
    const text = query.text ? String(query.text) : undefined;

    let wikitext = text || '';
    let title = page || 'API';
    let revId = 1;

    if (page) {
      const art = contentService.getArticle(page);
      if (art) {
        wikitext = art.wikitext;
        title = art.title;
      }
    }

    const rendered = parsoidService.parse(wikitext, title);
    return res.json({
      parse: {
        title,
        pageid: 1,
        revid: revId,
        text: {
          '*': rendered.html,
        },
        sections: rendered.toc.map((t: { level: number; text: string; number: string; id: string }, idx: number) => ({
          toclevel: t.level,
          level: String(t.level + 1),
          line: t.text,
          number: t.number,
          index: String(idx + 1),
          anchor: t.id,
        })),
        categories: rendered.categories.map((c: string) => ({
          sortkey: '',
          '*': c,
        })),
        links: rendered.internalLinks.map((l: string) => ({
          ns: 0,
          exists: true,
          '*': l,
        })),
      },
    });
  }

  // 3. Action: query (The core MediaWiki query action)
  if (action === 'query') {
    const meta = query.meta ? String(query.meta).split('|') : [];
    const prop = query.prop ? String(query.prop).split('|') : [];
    const list = query.list ? String(query.list).split('|') : [];
    const titlesParam = query.titles ? String(query.titles).split('|') : [];

    const responsePayload: any = {
      batchcomplete: '',
      query: {},
    };

    // 3.1. meta=siteinfo
    if (meta.includes('siteinfo')) {
      responsePayload.query.general = {
        sitename: 'NotMediaWiki',
        dbname: 'notmediawiki_db',
        base: 'https://wazzimagiygg.com/#/home',
        generator: 'NotMediaWiki 1.42.0-wazzimagiygg',
        phpversion: '8.3.6-emulated-nodejs',
        case: 'first-letter',
        lang: 'pt-BR',
        time: new Date().toISOString(),
      };
      responsePayload.query.namespaces = {
        '-2': { id: -2, case: 'first-letter', canonical: 'Media', '*': 'Multimídia' },
        '-1': { id: -1, case: 'first-letter', canonical: 'Special', '*': 'Especial' },
        '0': { id: 0, case: 'first-letter', content: '', '*': '' },
        '1': { id: 1, case: 'first-letter', subpages: '', canonical: 'Talk', '*': 'Discussão' },
        '2': { id: 2, case: 'first-letter', subpages: '', canonical: 'User', '*': 'Usuário' },
        '3': { id: 3, case: 'first-letter', subpages: '', canonical: 'User talk', '*': 'Discussão Usuário' },
        '4': { id: 4, case: 'first-letter', subpages: '', canonical: 'Project', '*': 'NotMediaWiki' },
        '5': { id: 5, case: 'first-letter', subpages: '', canonical: 'Project talk', '*': 'Discussão NotMediaWiki' },
        '6': { id: 6, case: 'first-letter', canonical: 'File', '*': 'Ficheiro' },
        '7': { id: 7, case: 'first-letter', subpages: '', canonical: 'File talk', '*': 'Discussão Ficheiro' },
        '8': { id: 8, case: 'first-letter', subpages: '', canonical: 'MediaWiki', '*': 'MediaWiki' },
        '9': { id: 9, case: 'first-letter', subpages: '', canonical: 'MediaWiki talk', '*': 'Discussão MediaWiki' },
        '10': { id: 10, case: 'first-letter', subpages: '', canonical: 'Template', '*': 'Predefinição' },
        '11': { id: 11, case: 'first-letter', subpages: '', canonical: 'Template talk', '*': 'Discussão Predefinição' },
        '12': { id: 12, case: 'first-letter', subpages: '', canonical: 'Help', '*': 'Ajuda' },
        '13': { id: 13, case: 'first-letter', subpages: '', canonical: 'Help talk', '*': 'Discussão Ajuda' },
        '14': { id: 14, case: 'first-letter', canonical: 'Category', '*': 'Categoria' },
        '15': { id: 15, case: 'first-letter', subpages: '', canonical: 'Category talk', '*': 'Discussão Categoria' },
      };
    }

    // 3.2. list=recentchanges
    if (list.includes('recentchanges')) {
      const limit = Math.min(100, parseInt(String(query.rclimit || '20'), 10));
      const evts = eventStreamService.getHistory(limit);
      responsePayload.query.recentchanges = evts.map((evt: any) => ({
        type: evt.type,
        ns: evt.page_namespace,
        title: evt.page_title,
        pageid: 1,
        revid: 100,
        old_revid: 99,
        rcid: 1,
        user: evt.user_text,
        minor: evt.rev_minor_edit ? '' : undefined,
        comment: evt.comment,
        timestamp: evt.rev_timestamp,
      }));
    }

    // 3.3. prop=info|revisions|categories
    if (titlesParam.length > 0) {
      const pages: Record<string, any> = {};

      titlesParam.forEach((t, idx) => {
        const art = contentService.getArticle(t);
        const pageId = idx + 1;

        if (!art) {
          pages[String(-1 - idx)] = {
            title: t,
            missing: '',
            ns: 0,
          };
        } else {
          const pageObj: any = {
            pageid: pageId,
            ns: art.namespace || 0,
            title: art.title,
            length: art.wikitext.length,
            touched: art.updatedAt || art.createdAt,
          };

          if (prop.includes('revisions')) {
            const revs = revisionService.getRevisionsForArticle(art.slug);
            pageObj.revisions = revs.slice(0, 5).map(r => ({
              revid: 1,
              parentid: 0,
              user: r.author?.name || 'Editor',
              timestamp: r.timestamp,
              comment: r.comment,
              contentformat: 'text/x-wiki',
              contentmodel: 'wikitext',
              '*': r.wikitext,
            }));
          }

          if (prop.includes('categories')) {
            pageObj.categories = (art.categories || []).map(c => ({
              ns: 14,
              title: `Categoria:${c}`,
            }));
          }

          pages[String(pageId)] = pageObj;
        }
      });

      responsePayload.query.pages = pages;
    }

    return res.json(responsePayload);
  }

  // Fallback API help
  return res.json({
    error: {
      code: 'unsupported_action',
      info: `Ação "${action}" recebida. Suporte completo para action=query, action=parse e action=opensearch compatíveis com MediaWiki.`,
    },
  });
}
