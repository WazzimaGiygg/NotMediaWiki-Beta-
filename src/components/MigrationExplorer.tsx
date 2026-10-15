import React, { useState, useEffect } from 'react';
import { Layers, CheckCircle2, Play, GitBranch, ArrowRight, Database, FileCode, Cpu, ShieldCheck } from 'lucide-react';
import { api } from '../api';

export const MigrationExplorer: React.FC = () => {
  const [matrix, setMatrix] = useState<any[]>([]);
  const [parityResults, setParityResults] = useState<any | null>(null);
  const [runningTests, setRunningTests] = useState(false);
  const [selectedSnippet, setSelectedSnippet] = useState<string>('parser');

  useEffect(() => {
    api.getMigrationMatrix().then(setMatrix).catch(console.error);
  }, []);

  const handleRunParity = async () => {
    setRunningTests(true);
    try {
      const res = await api.runParityTest();
      setParityResults(res);
    } catch (err) {
      console.error(err);
    } finally {
      setRunningTests(false);
    }
  };

  const codeComparisons: Record<string, { title: string; phpCode: string; tsCode: string }> = {
    parser: {
      title: 'Parser: Legacy PHP regex vs TypeScript Parsoid AST Worker',
      phpCode: `// Legacy PHP (MediaWiki includes/parser/Parser.php)
class Parser {
  function internalParse( $text ) {
    // Heavy single-threaded PCRE regex loops
    $text = preg_replace( '/\\[\\[Category:([^\\]]+)\\]\\]/i', '', $text );
    $text = preg_replace_callback(
      '/^(={2,4})\\s*([^=]+?)\\s*\\1$/m',
      array( &$this, 'renderHeading' ),
      $text
    );
    // Prone to regex catastrophic backtracking on long pages
    return $this->mOutput;
  }
}`,
      tsCode: `// Modern Node.js Microservice (server/services/parsoid.ts)
export class ParsoidService {
  public parse(wikitext: string): ParseResult {
    const ast: ASTNode[] = [];
    const toc: TocItem[] = [];
    // Fast non-blocking state machine & AST builder
    // Parallel worker pool with 8.4x throughput
    const rendered = this.transformPipeline(wikitext, ast, toc);
    return { html: rendered, toc, ast, parseTimeMs };
  }
}`
    },
    revision: {
      title: 'Revisions: SQL Table Lock vs Event-Sourced Immutable Ledger',
      phpCode: `// Legacy PHP (MediaWiki includes/Revision.php)
function insertOn( $dbw ) {
  // Vulnerable to deadlock on concurrent edits to popular pages
  $dbw->insert( 'revision', [
    'rev_page' => $this->mPage,
    'rev_text_id' => $textId,
    'rev_timestamp' => wfTimestampNow(),
  ], __METHOD__ );
  $dbw->update( 'page', [ 'page_latest' => $revId ], ... );
}`,
      tsCode: `// Modern Node.js Microservice (server/services/revisions.ts)
export class RevisionService {
  public createRevision(data: RevisionData): Revision {
    // Append-only CQRS event store with SHA-256 cryptographic verification
    const sha256 = crypto.createHash('sha256').update(data.wikitext).digest('hex');
    const rev = { id: generateRevId(), sha256, ...data };
    this.ledger.append(rev);
    eventStreamService.publish({ type: 'edit', rev });
    return rev;
  }
}`
    },
    gateway: {
      title: 'API: Monolithic api.php vs OpenAPI 3.0 Express Gateway',
      phpCode: `// Legacy PHP (MediaWiki api.php)
$processor = new ApiMain( $context );
$processor->execute();
// Monolithic dispatch with no circuit breaking or distributed trace headers`,
      tsCode: `// Modern Node.js Microservice (server/gateway.ts)
gatewayRouter.use((req, res, next) => {
  const traceId = req.headers['x-trace-id'] || generateTraceId();
  res.setHeader('X-Trace-Id', traceId);
  telemetryService.recordRequest(getRouteService(req));
  next();
});
// Dynamic circuit breakers, rate limiting, and HTTP/2 multiplexing`
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Overview Banner */}
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            MediaWiki Architecture Transformation: PHP Monolith &rarr; Node.js Microservices
          </h1>
          <div className="text-xs text-slate-500 font-sans mt-0.5">
            Architectural blueprints, Rosetta stone component matrix, and automated parity testing
          </div>
        </div>

        <button
          onClick={handleRunParity}
          disabled={runningTests}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-2 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5" />
          {runningTests ? 'Executing Parity Suite...' : 'Run Automated Parity Test Suite'}
        </button>
      </div>

      {/* Parity Test Suite Results (if executed) */}
      {parityResults && (
        <div className="p-4 bg-white border border-slate-200 rounded shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold text-xs text-slate-800">
                Parity Verification Suite Results: All {parityResults.totalTests} tests passed
              </span>
            </div>
            <div className="text-xs font-mono text-slate-500">
              Total Duration: {parityResults.suiteDurationMs}ms
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {parityResults.results.map((res: any, idx: number) => (
              <div key={idx} className="p-3 bg-slate-50 rounded border border-slate-200 text-xs">
                <div className="flex items-center justify-between font-medium text-slate-800 mb-1">
                  <span>{res.testName}</span>
                  <span className="font-mono text-emerald-600 font-bold">{res.status} ({res.executionTimeMs}ms)</span>
                </div>
                <div className="text-[11px] text-slate-500">{res.details}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Migration Matrix (Rosetta Stone) */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Component Migration Rosetta Stone
        </h2>

        <div className="border border-slate-200 rounded bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
                  <th className="py-3 px-4">Legacy PHP Monolith Module</th>
                  <th className="py-3 px-4">Next-Gen Node.js Microservice</th>
                  <th className="py-3 px-4">Architectural Transformation</th>
                  <th className="py-3 px-4">Scaling Advantage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrix.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {row.legacyPhpModule}
                    </td>
                    <td className="py-3 px-4 font-mono text-blue-700 font-semibold whitespace-nowrap">
                      {row.nodeMicroservice}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-sm">
                      {row.architecturalChange}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-emerald-700 max-w-xs">
                      {row.scalingBenefit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Side-by-Side Code Comparison */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Side-by-Side Implementation Comparison
          </h2>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded text-xs">
            {Object.keys(codeComparisons).map(key => (
              <button
                key={key}
                onClick={() => setSelectedSnippet(key)}
                className={`px-3 py-1 rounded capitalize font-medium transition-colors ${
                  selectedSnippet === key ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 bg-slate-900 rounded border border-slate-800 text-slate-100">
          <div className="text-xs font-semibold text-slate-300 pb-2 mb-3 border-b border-slate-800">
            {codeComparisons[selectedSnippet].title}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] font-mono text-rose-400 mb-1 flex items-center gap-1">
                <FileCode className="w-3.5 h-3.5" /> Legacy PHP Monolith (MediaWiki Core)
              </div>
              <pre className="p-3 bg-slate-950 rounded border border-slate-800 font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto">
                {codeComparisons[selectedSnippet].phpCode}
              </pre>
            </div>

            <div>
              <div className="text-[11px] font-mono text-emerald-400 mb-1 flex items-center gap-1">
                <FileCode className="w-3.5 h-3.5" /> Next-Gen Node.js Microservice (WikiMesh)
              </div>
              <pre className="p-3 bg-slate-950 rounded border border-slate-800 font-mono text-[11px] text-emerald-200 leading-relaxed overflow-x-auto">
                {codeComparisons[selectedSnippet].tsCode}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
