export interface DiffWordChunk {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

export interface DiffCell {
  lineNumber?: number;
  content?: string;
  type: 'added' | 'removed' | 'unchanged' | 'empty';
  wordChunks?: DiffWordChunk[];
}

export interface SideBySideRow {
  id: number;
  type: 'modified' | 'added' | 'removed' | 'unchanged';
  left: DiffCell;
  right: DiffCell;
}

export interface UnifiedRow {
  id: number;
  type: 'added' | 'removed' | 'unchanged';
  lineNumberOld?: number;
  lineNumberNew?: number;
  content: string;
  wordChunks?: DiffWordChunk[];
}

export interface SideBySideDiffResult {
  rows: SideBySideRow[];
  unifiedRows: UnifiedRow[];
  stats: {
    added: number;
    removed: number;
    unchanged: number;
    byteDelta: number;
    totalRows: number;
    modifiedBlocks: number;
  };
}

/**
 * Tokenize a line into words, spaces, and punctuation for intra-line highlighting
 */
function tokenizeLine(line: string): string[] {
  if (!line) return [];
  // Split on word boundaries, keeping spaces and punctuation as individual tokens
  const tokens = line.match(/\w+|\s+|[^\w\s]/g);
  return tokens || [line];
}

/**
 * Longest Common Subsequence (LCS) matrix computation
 */
function computeLCS<T>(a: T[], b: T[], equals: (x: T, y: T) => boolean): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (equals(a[i], b[j])) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  return dp;
}

/**
 * Word-level difference computation between two strings
 */
export function computeWordDiff(
  oldLine: string,
  newLine: string
): { leftChunks: DiffWordChunk[]; rightChunks: DiffWordChunk[] } {
  if (oldLine === newLine) {
    const chunk: DiffWordChunk = { type: 'unchanged', text: oldLine };
    return { leftChunks: [chunk], rightChunks: [chunk] };
  }

  const oldTokens = tokenizeLine(oldLine);
  const newTokens = tokenizeLine(newLine);

  const dp = computeLCS(oldTokens, newTokens, (x, y) => x === y);

  let i = oldTokens.length;
  let j = newTokens.length;

  const leftReversed: DiffWordChunk[] = [];
  const rightReversed: DiffWordChunk[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      const match = oldTokens[i - 1];
      leftReversed.push({ type: 'unchanged', text: match });
      rightReversed.push({ type: 'unchanged', text: match });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rightReversed.push({ type: 'added', text: newTokens[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      leftReversed.push({ type: 'removed', text: oldTokens[i - 1] });
      i--;
    }
  }

  return {
    leftChunks: leftReversed.reverse(),
    rightChunks: rightReversed.reverse(),
  };
}

/**
 * Main side-by-side and unified diff generator between two text bodies
 */
export function computeSideBySideDiff(oldText: string, newText: string): SideBySideDiffResult {
  const oldLines = oldText ? oldText.split('\n') : [];
  const newLines = newText ? newText.split('\n') : [];

  // Line-level LCS matrix
  const dp = computeLCS(oldLines, newLines, (x, y) => x === y);

  // Backtrack to build raw operations
  type RawOp = { type: 'unchanged' | 'removed' | 'added'; oldIdx?: number; newIdx?: number; content: string };
  const rawOpsReversed: RawOp[] = [];

  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      rawOpsReversed.push({
        type: 'unchanged',
        oldIdx: i - 1,
        newIdx: j - 1,
        content: oldLines[i - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawOpsReversed.push({
        type: 'added',
        newIdx: j - 1,
        content: newLines[j - 1],
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawOpsReversed.push({
        type: 'removed',
        oldIdx: i - 1,
        content: oldLines[i - 1],
      });
      i--;
    }
  }

  const ops = rawOpsReversed.reverse();

  // Stats counters
  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;
  let modifiedBlocks = 0;

  // Group adjacent removed/added ops into change blocks for side-by-side alignment
  const rows: SideBySideRow[] = [];
  const unifiedRows: UnifiedRow[] = [];
  let rowIdCounter = 1;

  let opIdx = 0;
  while (opIdx < ops.length) {
    const currentOp = ops[opIdx];

    if (currentOp.type === 'unchanged') {
      unchangedCount++;
      const lineNoOld = (currentOp.oldIdx ?? 0) + 1;
      const lineNoNew = (currentOp.newIdx ?? 0) + 1;

      rows.push({
        id: rowIdCounter,
        type: 'unchanged',
        left: {
          lineNumber: lineNoOld,
          content: currentOp.content,
          type: 'unchanged',
        },
        right: {
          lineNumber: lineNoNew,
          content: currentOp.content,
          type: 'unchanged',
        },
      });

      unifiedRows.push({
        id: rowIdCounter,
        type: 'unchanged',
        lineNumberOld: lineNoOld,
        lineNumberNew: lineNoNew,
        content: currentOp.content,
      });

      rowIdCounter++;
      opIdx++;
    } else {
      // Collect contiguous cluster of modifications (removed and added)
      const removedCluster: RawOp[] = [];
      const addedCluster: RawOp[] = [];

      while (opIdx < ops.length && ops[opIdx].type !== 'unchanged') {
        if (ops[opIdx].type === 'removed') {
          removedCluster.push(ops[opIdx]);
        } else if (ops[opIdx].type === 'added') {
          addedCluster.push(ops[opIdx]);
        }
        opIdx++;
      }

      addedCount += addedCluster.length;
      removedCount += removedCluster.length;
      modifiedBlocks++;

      // Populate unified rows
      for (const r of removedCluster) {
        unifiedRows.push({
          id: rowIdCounter++,
          type: 'removed',
          lineNumberOld: (r.oldIdx ?? 0) + 1,
          content: r.content,
        });
      }
      for (const a of addedCluster) {
        unifiedRows.push({
          id: rowIdCounter++,
          type: 'added',
          lineNumberNew: (a.newIdx ?? 0) + 1,
          content: a.content,
        });
      }

      // Pair them up side-by-side
      const maxLen = Math.max(removedCluster.length, addedCluster.length);
      for (let k = 0; k < maxLen; k++) {
        const rem = removedCluster[k];
        const add = addedCluster[k];

        if (rem && add) {
          // Changed line: calculate word-level diff
          const { leftChunks, rightChunks } = computeWordDiff(rem.content, add.content);

          rows.push({
            id: rowIdCounter++,
            type: 'modified',
            left: {
              lineNumber: (rem.oldIdx ?? 0) + 1,
              content: rem.content,
              type: 'removed',
              wordChunks: leftChunks,
            },
            right: {
              lineNumber: (add.newIdx ?? 0) + 1,
              content: add.content,
              type: 'added',
              wordChunks: rightChunks,
            },
          });
        } else if (rem && !add) {
          // Line removed only
          rows.push({
            id: rowIdCounter++,
            type: 'removed',
            left: {
              lineNumber: (rem.oldIdx ?? 0) + 1,
              content: rem.content,
              type: 'removed',
              wordChunks: [{ type: 'removed', text: rem.content }],
            },
            right: {
              type: 'empty',
            },
          });
        } else if (!rem && add) {
          // Line added only
          rows.push({
            id: rowIdCounter++,
            type: 'added',
            left: {
              type: 'empty',
            },
            right: {
              lineNumber: (add.newIdx ?? 0) + 1,
              content: add.content,
              type: 'added',
              wordChunks: [{ type: 'added', text: add.content }],
            },
          });
        }
      }
    }
  }

  const byteDelta = new TextEncoder().encode(newText).length - new TextEncoder().encode(oldText).length;

  return {
    rows,
    unifiedRows,
    stats: {
      added: addedCount,
      removed: removedCount,
      unchanged: unchangedCount,
      byteDelta,
      totalRows: rows.length,
      modifiedBlocks,
    },
  };
}
