export interface ServiceNode {
  id: string;
  name: string;
  role: string;
  status: 'healthy' | 'degraded' | 'failing';
  circuitBreaker: 'CLOSED' | 'HALF_OPEN' | 'OPEN';
  rps: number;
  latencyMs: {
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: number; // percentage 0-100
  uptimePercent: number;
  memoryUsageMb: number;
  technology: string;
  legacyPhpEquivalent: string;
}

export class TelemetryService {
  private services: Map<string, ServiceNode> = new Map();
  private totalRequests: number = 24190;
  private startTime: number = Date.now();

  constructor() {
    this.initNodes();
  }

  private initNodes() {
    const nodes: ServiceNode[] = [
      {
        id: 'api-gateway',
        name: 'API Gateway & Mesh Router',
        role: 'Edge ingress, TLS, rate-limiting & distributed trace routing',
        status: 'healthy',
        circuitBreaker: 'CLOSED',
        rps: 342,
        latencyMs: { p50: 3.2, p95: 8.5, p99: 14.1 },
        errorRate: 0.02,
        uptimePercent: 99.99,
        memoryUsageMb: 84,
        technology: 'Node.js Express / HTTP2 / Keep-Alive',
        legacyPhpEquivalent: 'Apache/Nginx mod_php + index.php / api.php entry point',
      },
      {
        id: 'parsoid-service',
        name: 'Parsoid Parser Service',
        role: 'Bidirectional Wikitext <-> HTML5 AST compiler',
        status: 'healthy',
        circuitBreaker: 'CLOSED',
        rps: 185,
        latencyMs: { p50: 12.4, p95: 28.0, p99: 45.2 },
        errorRate: 0.05,
        uptimePercent: 99.98,
        memoryUsageMb: 142,
        technology: 'Node.js V8 Engine / TypeScript Worker Pool',
        legacyPhpEquivalent: 'includes/parser/Parser.php (single-thread PCRE)',
      },
      {
        id: 'content-service',
        name: 'Page Content Service',
        role: 'Article CRUD, multi-slot page management, Tier-1 memory cache',
        status: 'healthy',
        circuitBreaker: 'CLOSED',
        rps: 420,
        latencyMs: { p50: 5.1, p95: 11.8, p99: 19.4 },
        errorRate: 0.01,
        uptimePercent: 99.99,
        memoryUsageMb: 96,
        technology: 'Node.js async service + Redis / Memory cache',
        legacyPhpEquivalent: 'includes/page/WikiPage.php + cur / page MySQL tables',
      },
      {
        id: 'revision-service',
        name: 'Revision & Diff Service',
        role: 'Immutable append-only ledger, Myers diffs, SHA-256 integrity',
        status: 'healthy',
        circuitBreaker: 'CLOSED',
        rps: 94,
        latencyMs: { p50: 8.6, p95: 21.3, p99: 38.0 },
        errorRate: 0.01,
        uptimePercent: 99.99,
        memoryUsageMb: 110,
        technology: 'Node.js crypto stream / Myers diff worker',
        legacyPhpEquivalent: 'includes/Revision.php + text / old SQL tables',
      },
      {
        id: 'search-service',
        name: 'CirrusSearch Microservice',
        role: 'Inverted-index full-text search & title prefix autocomplete',
        status: 'healthy',
        circuitBreaker: 'CLOSED',
        rps: 128,
        latencyMs: { p50: 7.4, p95: 16.2, p99: 25.8 },
        errorRate: 0.03,
        uptimePercent: 99.97,
        memoryUsageMb: 120,
        technology: 'Node.js BM25 Indexer / Elasticsearch API proxy',
        legacyPhpEquivalent: 'extensions/CirrusSearch / SpecialSearch.php',
      },
      {
        id: 'eventstream-service',
        name: 'EventGate / EventStreams',
        role: 'Kafka & Server-Sent Events broker for Wikimedia event schemas',
        status: 'healthy',
        circuitBreaker: 'CLOSED',
        rps: 210,
        latencyMs: { p50: 2.1, p95: 4.8, p99: 8.2 },
        errorRate: 0.0,
        uptimePercent: 100.0,
        memoryUsageMb: 68,
        technology: 'Node.js SSE pipeline / Kafka Event Platform',
        legacyPhpEquivalent: 'JobQueueGroup.php / Redis background workers',
      },
      {
        id: 'auth-service',
        name: 'CentralAuth & RBAC Service',
        role: 'User identity, JWT sessions, permissions & anti-abuse checks',
        status: 'healthy',
        circuitBreaker: 'CLOSED',
        rps: 75,
        latencyMs: { p50: 3.8, p95: 9.1, p99: 15.6 },
        errorRate: 0.01,
        uptimePercent: 99.99,
        memoryUsageMb: 54,
        technology: 'Node.js JWT / CentralAuth multi-wiki provider',
        legacyPhpEquivalent: 'extensions/CentralAuth / SessionManager.php',
      },
    ];

    nodes.forEach(n => this.services.set(n.id, n));
  }

  public getTopology(): ServiceNode[] {
    return Array.from(this.services.values());
  }

  public recordRequest(serviceId: string, durationMs: number, isError: boolean = false) {
    this.totalRequests++;
    const s = this.services.get(serviceId);
    if (!s) return;

    // Smooth adjustment
    s.latencyMs.p50 = Math.round((s.latencyMs.p50 * 0.9 + durationMs * 0.1) * 10) / 10;
    if (isError) {
      s.errorRate = Math.min(100, Math.round((s.errorRate + 1.2) * 100) / 100);
      if (s.errorRate > 25 && s.circuitBreaker === 'CLOSED') {
        s.circuitBreaker = 'OPEN';
        s.status = 'failing';
      }
    } else {
      s.errorRate = Math.max(0, Math.round((s.errorRate * 0.95) * 100) / 100);
      if (s.circuitBreaker === 'OPEN' && s.errorRate < 5) {
        s.circuitBreaker = 'CLOSED';
        s.status = 'healthy';
      }
    }
  }

  public simulateTrafficBurst(multiplier: number = 3) {
    for (const node of this.services.values()) {
      node.rps = Math.round(node.rps * (1 + (Math.random() * 0.5 + 0.5) * multiplier));
      node.latencyMs.p50 = Math.round((node.latencyMs.p50 * 1.4) * 10) / 10;
      node.latencyMs.p95 = Math.round((node.latencyMs.p95 * 1.6) * 10) / 10;
      node.latencyMs.p99 = Math.round((node.latencyMs.p99 * 1.8) * 10) / 10;
      node.memoryUsageMb += Math.floor(Math.random() * 15 + 5);
    }
  }

  public resetTraffic() {
    this.initNodes();
  }

  public toggleCircuitBreaker(serviceId: string): ServiceNode | undefined {
    const s = this.services.get(serviceId);
    if (!s) return undefined;

    if (s.circuitBreaker === 'CLOSED') {
      s.circuitBreaker = 'OPEN';
      s.status = 'failing';
      s.errorRate = 48.5;
    } else if (s.circuitBreaker === 'OPEN') {
      s.circuitBreaker = 'HALF_OPEN';
      s.status = 'degraded';
      s.errorRate = 12.0;
    } else {
      s.circuitBreaker = 'CLOSED';
      s.status = 'healthy';
      s.errorRate = 0.05;
    }
    return s;
  }

  public getSystemMetrics() {
    const totalRps = Array.from(this.services.values()).reduce((sum, n) => sum + n.rps, 0);
    const avgLatency = Math.round(
      Array.from(this.services.values()).reduce((sum, n) => sum + n.latencyMs.p50, 0) / this.services.size
    );
    const totalMemory = Array.from(this.services.values()).reduce((sum, n) => sum + n.memoryUsageMb, 0);

    return {
      totalRequests: this.totalRequests,
      aggregateRps: totalRps,
      averageLatencyMs: avgLatency,
      totalMemoryMb: totalMemory,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      healthyServicesCount: Array.from(this.services.values()).filter(s => s.status === 'healthy').length,
      totalServicesCount: this.services.size,
    };
  }
}

export const telemetryService = new TelemetryService();
