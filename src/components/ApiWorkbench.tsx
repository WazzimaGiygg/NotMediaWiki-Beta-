import React, { useState } from 'react';
import { Terminal, Send, CheckCircle, Clock, Copy, ArrowRight } from 'lucide-react';

interface PresetEndpoint {
  name: string;
  method: 'GET' | 'POST';
  url: string;
  body?: string;
  description: string;
}

const PRESETS: PresetEndpoint[] = [
  {
    name: 'Parsoid: Parse Wikitext to HTML5',
    method: 'POST',
    url: '/api/v1/parsoid/parse',
    body: JSON.stringify({
      title: 'Quantum_Computing',
      wikitext: "'''Quantum Computing''' is a field of computer science.\n\n== Superposition ==\nQubits can exist in superposition.\n\n{| class=\"wikitable\"\n! Qubits !! States\n|-\n| 2 || 4\n|}\n\n== References ==\n<ref>Nielsen & Chuang, Quantum Computation (2010).</ref>"
    }, null, 2),
    description: 'Invokes Parsoid AST parser worker to generate semantic HTML5 and Table of Contents.'
  },
  {
    name: 'Parsoid: Tokenize Syntax Tree',
    method: 'POST',
    url: '/api/v1/parsoid/tokenize',
    body: JSON.stringify({
      wikitext: "== Architecture ==\n* [[MediaWiki]] microservices\n{{Infobox software | name = Node.js }}"
    }, null, 2),
    description: 'Generates grammar token stream for visual AST inspection.'
  },
  {
    name: 'CirrusSearch: Full-text Query',
    method: 'GET',
    url: '/api/v1/search/query?q=parsoid',
    description: 'BM25 inverted-index query with highlighted snippet extraction.'
  },
  {
    name: 'CirrusSearch: Title Autocomplete',
    method: 'GET',
    url: '/api/v1/search/suggest?prefix=Med',
    description: 'Ultra-low latency (<5ms) typeahead prefix lookup for search bar.'
  },
  {
    name: 'Revisions: Myers Diff Engine',
    method: 'GET',
    url: '/api/v1/revisions/diff/rev-100/rev-101',
    description: 'Asynchronously computes Myers line and word additions/deletions.'
  },
  {
    name: 'Service Mesh: Topology & Circuit Breakers',
    method: 'GET',
    url: '/api/v1/telemetry/topology',
    description: 'Returns real-time health, RPS, and circuit breaker status for all 7 microservices.'
  },
  {
    name: 'Content: Page Statistics',
    method: 'GET',
    url: '/api/v1/content/stats',
    description: 'Queries aggregated page counts, total views, and Parsoid HTML cache ratio.'
  }
];

export const ApiWorkbench: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState<PresetEndpoint>(PRESETS[0]);
  const [method, setMethod] = useState<'GET' | 'POST'>(PRESETS[0].method);
  const [url, setUrl] = useState<string>(PRESETS[0].url);
  const [body, setBody] = useState<string>(PRESETS[0].body || '');
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [responseBody, setResponseBody] = useState<string>('');
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [executing, setExecuting] = useState(false);
  const [copied, setCopied] = useState(false);

  const applyPreset = (preset: PresetEndpoint) => {
    setSelectedPreset(preset);
    setMethod(preset.method);
    setUrl(preset.url);
    setBody(preset.body || '');
  };

  const executeRequest = async () => {
    setExecuting(true);
    setResponseStatus(null);
    setResponseBody('');
    setResponseHeaders({});
    const startTime = performance.now();

    try {
      const opts: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (method === 'POST' && body.trim()) {
        opts.body = body;
      }

      const res = await fetch(url, opts);
      const duration = Math.round((performance.now() - startTime) * 100) / 100;
      setExecutionTimeMs(duration);
      setResponseStatus(res.status);

      const headersObj: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        headersObj[key] = val;
      });
      setResponseHeaders(headersObj);

      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setResponseBody(JSON.stringify(json, null, 2));
      } catch {
        setResponseBody(text);
      }
    } catch (err: any) {
      setResponseStatus(500);
      setResponseBody(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setExecuting(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(responseBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <Terminal className="w-5 h-5 text-blue-600" />
          Microservices API Workbench & Interactive Console
        </h1>
        <div className="text-xs text-slate-500 font-sans mt-0.5">
          Execute direct HTTP calls against Parsoid, Revision, Content, Search, and Mesh Gateway services
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Preset Endpoints */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Pre-configured Microservice Requests
          </div>

          <div className="space-y-1.5">
            {PRESETS.map((p, idx) => {
              const isSelected = p.name === selectedPreset.name;
              return (
                <button
                  key={idx}
                  onClick={() => applyPreset(p)}
                  className={`w-full text-left p-3 rounded border text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-400 text-blue-900 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <span className={`text-[10px] font-mono px-1 py-0.2 rounded font-bold ${
                      p.method === 'POST' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {p.method}
                    </span>
                    <span className="truncate">{p.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-sans mt-1 line-clamp-1">
                    {p.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Interactive Request/Response Console */}
        <div className="lg:col-span-8 space-y-4">
          {/* Request URL bar */}
          <div className="p-3 bg-white border border-slate-200 rounded shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <select
                value={method}
                onChange={e => setMethod(e.target.value as any)}
                className="bg-slate-100 text-xs font-mono font-bold px-3 py-2 rounded border border-slate-200 text-slate-800 outline-none"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>

              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 font-mono text-xs px-3 py-2 rounded text-slate-900 outline-none focus:bg-white focus:border-blue-600"
              />

              <button
                onClick={executeRequest}
                disabled={executing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {executing ? 'Sending...' : 'Send'}
              </button>
            </div>

            {/* Request Body (if POST) */}
            {method === 'POST' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  JSON Request Body:
                </label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={6}
                  className="w-full p-2.5 font-mono text-xs bg-slate-900 text-emerald-300 rounded border border-slate-800 outline-none"
                />
              </div>
            )}
          </div>

          {/* Response Console */}
          <div className="border border-slate-800 rounded bg-slate-950 text-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-300">Live Response</span>
                {responseStatus !== null && (
                  <span className={`font-mono px-2 py-0.5 rounded text-[10px] font-bold ${
                    responseStatus < 300 ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-rose-950 text-rose-300 border border-rose-700'
                  }`}>
                    HTTP {responseStatus}
                  </span>
                )}
                {executionTimeMs !== null && (
                  <span className="font-mono text-slate-400 text-[11px]">
                    Latency: {executionTimeMs}ms
                  </span>
                )}
              </div>

              {responseBody && (
                <button
                  onClick={copyToClipboard}
                  className="text-slate-400 hover:text-white text-[11px] flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>

            {/* Response Headers (Distributed Trace ID) */}
            {responseHeaders['x-trace-id'] && (
              <div className="mb-2 text-[11px] font-mono text-slate-400">
                Trace ID: <span className="text-blue-400">{responseHeaders['x-trace-id']}</span> · Mesh: {responseHeaders['x-powered-by']}
              </div>
            )}

            {/* Body viewer */}
            <pre className="font-mono text-xs text-slate-200 overflow-x-auto max-h-96 leading-relaxed bg-slate-900/50 p-3 rounded border border-slate-800/80">
              {responseBody || '// Press "Send" above to execute microservice request'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
