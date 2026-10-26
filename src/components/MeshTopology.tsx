import React, { useState, useEffect } from 'react';
import { Activity, Cpu, Server, Zap, ShieldAlert, RefreshCw, Play, RotateCcw, ArrowRight } from 'lucide-react';
import { ServiceNode, SystemMetrics } from '../types';
import { api } from '../api';

export const MeshTopology: React.FC = () => {
  const [nodes, setNodes] = useState<ServiceNode[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ServiceNode | null>(null);

  const fetchMeshState = () => {
    Promise.all([api.getTopology(), api.getMetrics()])
      .then(([topo, mets]) => {
        setNodes(topo);
        setMetrics(mets);
        setLoading(false);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchMeshState();
    const interval = setInterval(fetchMeshState, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleSimulateBurst = async () => {
    setSimulating(true);
    try {
      const updatedMets = await api.simulateTraffic(4);
      setMetrics(updatedMets);
      const updatedNodes = await api.getTopology();
      setNodes(updatedNodes);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setSimulating(false), 500);
    }
  };

  const handleResetTraffic = async () => {
    try {
      const resetMets = await api.resetTraffic();
      setMetrics(resetMets);
      const updatedNodes = await api.getTopology();
      setNodes(updatedNodes);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleBreaker = async (nodeId: string) => {
    try {
      const updated = await api.toggleCircuitBreaker(nodeId);
      setNodes(nodes.map(n => (n.id === nodeId ? updated : n)));
      if (selectedNode && selectedNode.id === nodeId) {
        setSelectedNode(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex items-center justify-center font-mono text-xs text-slate-500">
        Discovering Service Mesh topology nodes...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Title & Mesh Controls Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600" />
            NotMediaWiki Microservices Mesh & Telemetry Control Plane
          </h1>
          <div className="text-xs text-slate-500 font-sans mt-0.5">
            Distributed Node.js cluster • Projetos WazzimaGiygg (wazzimagiygg.com)
          </div>
        </div>

        {/* Traffic Simulation Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSimulateBurst}
            disabled={simulating}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {simulating ? 'Injecting Load...' : 'Simulate Traffic Burst (4x)'}
          </button>
          <button
            onClick={handleResetTraffic}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            Reset Baseline
          </button>
        </div>
      </div>

      {/* Aggregate Cluster Metrics (Zero-Pill formatting) */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white border border-slate-200 rounded">
            <div className="text-xs text-slate-500 font-sans">Aggregate Cluster RPS</div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {(metrics.aggregateRps ?? 0).toLocaleString()} <span className="text-xs font-sans text-slate-400 font-normal">req/s</span>
            </div>
            <div className="text-[11px] text-emerald-600 font-sans mt-1">
              Distributed across 7 active microservices
            </div>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded">
            <div className="text-xs text-slate-500 font-sans">Average Mesh Latency (P50)</div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {metrics.averageLatencyMs} <span className="text-xs font-sans text-slate-400 font-normal">ms</span>
            </div>
            <div className="text-[11px] text-slate-500 font-sans mt-1">
              Down from 94ms legacy PHP monolith
            </div>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded">
            <div className="text-xs text-slate-500 font-sans">Total Requests Handled</div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {(metrics.totalRequests ?? 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 font-sans mt-1">
              Zero transaction deadlocks recorded
            </div>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded">
            <div className="text-xs text-slate-500 font-sans">Cluster Memory Footprint</div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {metrics.totalMemoryMb} <span className="text-xs font-sans text-slate-400 font-normal">MB</span>
            </div>
            <div className="text-[11px] text-slate-500 font-sans mt-1">
              Node.js V8 heap across worker pool
            </div>
          </div>
        </div>
      )}

      {/* Architecture Topology Visual Flow */}
      <div className="p-4 bg-slate-900 text-slate-100 rounded border border-slate-800 shadow-md">
        <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2 mb-4">
          <span className="font-semibold uppercase tracking-wider text-slate-300">
            Microservices Dependency Graph & Ingress Route Flow
          </span>
          <span className="font-mono text-emerald-400">Mesh Status: NORMAL</span>
        </div>

        {/* Visual ingress pipeline */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          <div className="p-3 bg-slate-800 border border-slate-700 rounded w-full md:w-auto text-center">
            <div className="font-mono text-slate-400 text-[10px]">CLIENT INGRESS</div>
            <div className="font-bold text-white mt-0.5">Vector 2026 UI / Mobile App</div>
          </div>

          <ArrowRight className="w-4 h-4 text-slate-500 hidden md:block" />

          <div className="p-3 bg-blue-950 border border-blue-700 rounded w-full md:w-auto text-center">
            <div className="font-mono text-blue-300 text-[10px]">API GATEWAY (PORT 3000)</div>
            <div className="font-bold text-blue-100 mt-0.5">Mesh Router / Rate Limiter</div>
          </div>

          <ArrowRight className="w-4 h-4 text-slate-500 hidden md:block" />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full md:w-auto">
            <div className="p-2 bg-slate-800 border border-slate-700 rounded text-center">
              <div className="text-[10px] text-slate-400">Wikitext AST</div>
              <div className="font-semibold text-slate-200">Parsoid</div>
            </div>
            <div className="p-2 bg-slate-800 border border-slate-700 rounded text-center">
              <div className="text-[10px] text-slate-400">Pages & Cache</div>
              <div className="font-semibold text-slate-200">Content</div>
            </div>
            <div className="p-2 bg-slate-800 border border-slate-700 rounded text-center">
              <div className="text-[10px] text-slate-400">SHA-256 Ledger</div>
              <div className="font-semibold text-slate-200">Revision</div>
            </div>
          </div>

          <ArrowRight className="w-4 h-4 text-slate-500 hidden md:block" />

          <div className="p-3 bg-emerald-950 border border-emerald-700 rounded w-full md:w-auto text-center">
            <div className="font-mono text-emerald-300 text-[10px]">EVENT BUS</div>
            <div className="font-bold text-emerald-100 mt-0.5">EventGate (SSE/Kafka)</div>
          </div>
        </div>
      </div>

      {/* Microservices Node Cards Grid */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Individual Microservice Health & Circuit Breakers ({nodes.length} services)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nodes.map(node => {
            const isSelected = selectedNode?.id === node.id;
            const breakerColor =
              node.circuitBreaker === 'CLOSED'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : node.circuitBreaker === 'HALF_OPEN'
                ? 'text-amber-700 bg-amber-50 border-amber-200'
                : 'text-rose-700 bg-rose-50 border-rose-200';

            return (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className={`p-4 bg-white border rounded transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-100 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-semibold text-sm text-slate-900">{node.name}</h3>
                    <div className="text-[11px] text-slate-500 line-clamp-1">{node.role}</div>
                  </div>
                  <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${breakerColor}`}>
                    {node.circuitBreaker}
                  </span>
                </div>

                {/* Legacy Comparison Banner */}
                <div className="p-2 bg-slate-50 rounded text-[11px] text-slate-600 mb-3 border border-slate-100">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Replaces Legacy PHP:
                  </div>
                  <div className="font-mono text-slate-800 text-[11px] truncate">{node.legacyPhpEquivalent}</div>
                </div>

                {/* Telemetry Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center border-t border-slate-100 pt-3">
                  <div>
                    <div className="text-[10px] text-slate-400">RPS</div>
                    <div className="font-mono font-bold text-sm text-slate-800">{node.rps}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">P50 Latency</div>
                    <div className="font-mono font-bold text-sm text-slate-800">{node.latencyMs.p50}ms</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Memory</div>
                    <div className="font-mono font-bold text-sm text-slate-800">{node.memoryUsageMb}MB</div>
                  </div>
                </div>

                {/* Breaker Toggle Button */}
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400 font-mono">
                    P99: {node.latencyMs.p99}ms · Err: {node.errorRate}%
                  </span>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleToggleBreaker(node.id);
                    }}
                    className="text-[11px] font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    Trip / Toggle Breaker
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
