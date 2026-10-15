import crypto from 'crypto';
import { INITIAL_REVISIONS, Revision } from '../data/seedData';

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumberOld?: number;
  lineNumberNew?: number;
}

export interface DiffResult {
  fromRevId: string;
  toRevId: string;
  lines: DiffLine[];
  stats: {
    added: number;
    removed: number;
    unchanged: number;
    byteDelta: number;
  };
}

export class RevisionService {
  private revisions: Map<string, Revision> = new Map();

  constructor() {
    INITIAL_REVISIONS.forEach(rev => this.revisions.set(rev.id, rev));
  }

  public getRevisionsForArticle(slug: string): Revision[] {
    return Array.from(this.revisions.values())
      .filter(rev => rev.articleSlug === slug)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public getRevision(revId: string): Revision | undefined {
    return this.revisions.get(revId);
  }

  public createRevision(data: {
    articleSlug: string;
    parentRevisionId: string | null;
    wikitext: string;
    comment: string;
    author: { id: string; name: string; isBot: boolean; ip?: string };
    isMinor?: boolean;
  }): Revision {
    const revId = `rev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const sha256 = crypto.createHash('sha256').update(data.wikitext, 'utf8').digest('hex');
    const byteSize = Buffer.byteLength(data.wikitext, 'utf8');

    const newRev: Revision = {
      id: revId,
      articleSlug: data.articleSlug,
      parentRevisionId: data.parentRevisionId,
      wikitext: data.wikitext,
      comment: data.comment || 'Updated content',
      author: data.author,
      timestamp: new Date().toISOString(),
      sha256,
      byteSize,
      isMinor: !!data.isMinor,
    };

    this.revisions.set(revId, newRev);
    return newRev;
  }

  /**
   * Computes clean Myers-style line diff between two revisions
   */
  public computeDiff(fromRevId: string, toRevId: string): DiffResult {
    const fromRev = this.revisions.get(fromRevId);
    const toRev = this.revisions.get(toRevId);

    if (!fromRev || !toRev) {
      throw new Error(`Revision ${fromRevId} or ${toRevId} not found`);
    }

    const oldLines = fromRev.wikitext.split('\n');
    const newLines = toRev.wikitext.split('\n');
    const diffLines: DiffLine[] = [];

    let oIdx = 0;
    let nIdx = 0;
    let addedCount = 0;
    let removedCount = 0;
    let unchangedCount = 0;

    // LCS / dynamic diff computation
    while (oIdx < oldLines.length && nIdx < newLines.length) {
      if (oldLines[oIdx] === newLines[nIdx]) {
        diffLines.push({
          type: 'unchanged',
          content: oldLines[oIdx],
          lineNumberOld: oIdx + 1,
          lineNumberNew: nIdx + 1,
        });
        unchangedCount++;
        oIdx++;
        nIdx++;
      } else {
        // Lookahead to see if next new matches current old
        const matchInNew = newLines.indexOf(oldLines[oIdx], nIdx);
        const matchInOld = oldLines.indexOf(newLines[nIdx], oIdx);

        if (matchInNew !== -1 && (matchInOld === -1 || matchInNew - nIdx <= matchInOld - oIdx)) {
          // Lines were added in new
          while (nIdx < matchInNew) {
            diffLines.push({
              type: 'added',
              content: newLines[nIdx],
              lineNumberNew: nIdx + 1,
            });
            addedCount++;
            nIdx++;
          }
        } else if (matchInOld !== -1) {
          // Lines were removed in old
          while (oIdx < matchInOld) {
            diffLines.push({
              type: 'removed',
              content: oldLines[oIdx],
              lineNumberOld: oIdx + 1,
            });
            removedCount++;
            oIdx++;
          }
        } else {
          // Changed line
          diffLines.push({
            type: 'removed',
            content: oldLines[oIdx],
            lineNumberOld: oIdx + 1,
          });
          diffLines.push({
            type: 'added',
            content: newLines[nIdx],
            lineNumberNew: nIdx + 1,
          });
          removedCount++;
          addedCount++;
          oIdx++;
          nIdx++;
        }
      }
    }

    while (oIdx < oldLines.length) {
      diffLines.push({
        type: 'removed',
        content: oldLines[oIdx],
        lineNumberOld: oIdx + 1,
      });
      removedCount++;
      oIdx++;
    }

    while (nIdx < newLines.length) {
      diffLines.push({
        type: 'added',
        content: newLines[nIdx],
        lineNumberNew: nIdx + 1,
      });
      addedCount++;
      nIdx++;
    }

    return {
      fromRevId,
      toRevId,
      lines: diffLines,
      stats: {
        added: addedCount,
        removed: removedCount,
        unchanged: unchangedCount,
        byteDelta: toRev.byteSize - fromRev.byteSize,
      },
    };
  }

  public getAllRevisions(): Revision[] {
    return Array.from(this.revisions.values());
  }
}

export const revisionService = new RevisionService();
