export interface Article {
  id: string;
  slug: string;
  title: string;
  namespace: number; // 0: Main, 1: Talk, 4: Project, 10: Template, 14: Category
  wikitext: string;
  summary: string;
  latestRevisionId: string;
  createdAt: string;
  updatedAt: string;
  categories: string[];
  views: number;
  isProtected?: boolean;
}

export interface Revision {
  id: string;
  articleSlug: string;
  parentRevisionId: string | null;
  wikitext: string;
  comment: string;
  author: {
    id: string;
    name: string;
    isBot: boolean;
    ip?: string;
  };
  timestamp: string;
  sha256: string;
  byteSize: number;
  isMinor: boolean;
}

export interface UserSession {
  id: string;
  username: string;
  role: 'sysop' | 'bureaucrat' | 'moderator' | 'editor' | 'reader' | 'bot';
  editCount: number;
  avatar: string;
  email?: string;
  userTag?: string;
  discriminator?: string;
  userPageSlug?: string;
  isBanned?: boolean;
  banReason?: string;
  bannedAt?: string;
  isGoogleUser?: boolean;
  photoURL?: string;
  provider?: string;
  lastLoginAt?: string;
  syncedToCloudAt?: string;
}

export interface WikiEvent {
  id: string;
  meta: {
    uri: string;
    request_id: string;
    id: string;
    dt: string;
    domain: string;
    stream: string;
  };
  database: string;
  page_title: string;
  page_namespace: number;
  rev_id: string;
  rev_timestamp: string;
  rev_sha1: string;
  rev_minor_edit: boolean;
  rev_len: number;
  user_text: string;
  comment: string;
  type: 'edit' | 'new' | 'rollback' | 'categorize' | 'protect';
}

export const SEED_USERS: UserSession[] = [
  {
    id: 'mafersao1100',
    username: 'Mafersao',
    role: 'bureaucrat',
    editCount: 5,
    avatar: 'MA',
    email: 'mafersao1100@gmail.com',
    isGoogleUser: true,
    provider: 'google.com',
    isBanned: false,
    syncedToCloudAt: '2026-10-09T16:22:06.188Z',
  },
  {
    id: 'AZolFPgfELhRLcvoj7VhlYQV0G42',
    username: 'WazzimaGiygg',
    role: 'bureaucrat',
    editCount: 2,
    avatar: 'WA',
    email: 'pedrohenriquecardonaperes@gmail.com',
    isGoogleUser: true,
    provider: 'google.com',
    isBanned: false,
    syncedToCloudAt: '2026-10-09T16:22:05.295Z',
  },
];

export const INITIAL_ARTICLES: Article[] = [
  {
    id: 'art-1',
    slug: 'MediaWiki',
    title: 'MediaWiki',
    namespace: 0,
    summary: 'Free and open-source wiki software originally written for Wikipedia.',
    latestRevisionId: 'rev-101',
    createdAt: '2024-01-10T12:00:00Z',
    updatedAt: '2026-03-15T08:22:10Z',
    categories: ['Free software', 'Wiki software', 'Wikimedia Foundation', 'Node.js software', 'Software architecture'],
    views: 45210,
    isProtected: true,
    wikitext: `{{Infobox software
| name = MediaWiki
| developer = Wikimedia Foundation & Open Source Contributors
| initial_release = 2002-01-25
| programming_language = Node.js / TypeScript (Migrated from PHP)
| operating_system = Cross-platform
| license = GPL-2.0-or-later
| website = https://www.mediawiki.org
}}

'''MediaWiki''' is a free and open-source [[wiki]] engine created by [[Magnus Manske]] and developed for use on [[Wikipedia]] and other projects of the [[Wikimedia Foundation]].<ref name="wm-tech">Wikimedia Foundation (2025). [https://techblog.wikimedia.org Technology Report: Deconstructing the Core Monolith].</ref> Originally written in PHP and backed by relational SQL databases, modern Wikimedia architecture decouples the monolith into high-concurrency '''Node.js microservices'''.<ref name="manske02">Manske, Magnus (2002). "UseModWiki to Phase II: The Architecture of Early Wikipedia".</ref>

== Architecture Evolution ==
MediaWiki began in 2002 as a monolithic PHP application known as "Phase II" and "Phase III".<ref name="manske02" /> Over two decades, exponential traffic demands led to the extraction of independent microservices:<ref name="wm-tech" />

=== Parsoid Service ===
A distributed parsing service written in Node.js that compiles Wikitext into semantic HTML5 with complete round-trip DOM annotations.<ref name="parsoid-docs">Wikimedia Foundation (2024). [https://www.mediawiki.org/wiki/Parsoid Parsoid Architecture Specification].</ref>

=== EventStreams & EventGate ===
High-throughput Kafka and Server-Sent Events (SSE) bus broadcasting article revisions in real-time.

=== Content & Revision Services ===
Immutable, cryptographically hashed revision logs decoupling article storage from transaction locks.

=== CirrusSearch Layer ===
Scalable inverted-index search layer backed by Elasticsearch clusters.

== Wikitext Markup ==
MediaWiki uses an extensible markup language called [[Wikitext]]. It supports templates, transclusion, category classification, and mathematical formatting via MathML.<ref name="wikitext-spec">MediaWiki Core Engineering. [https://www.mediawiki.org/wiki/Wikitext MediaWiki Wikitext Specification Guidelines].</ref>

<syntaxhighlight lang="typescript">
import express, { Request, Response } from 'express';
import { ParsoidEngine } from '@mediawiki/parsoid-node';

const app = express();
const engine = new ParsoidEngine({ strictHtml5: true });

// High-speed Parsoid AST endpoint in modern Node.js mesh
app.post('/api/v1/parsoid/parse', async (req: Request, res: Response) => {
  const { wikitext, title } = req.body;
  const domTree = await engine.parseWikitextToDOM(wikitext, { title });
  res.json({
    status: 'success',
    html: domTree.toHTML(),
    metrics: { parseTimeMs: engine.lastExecutionMs }
  });
});
</syntaxhighlight>

{| class="wikitable"
! Component !! Legacy PHP Monolith !! Next-Gen Node.js Microservices
|-
| Parser || Parser.php (single-threaded regex) || Parsoid AST Worker Pool (TypeScript)
|-
| Event Bus || JobQueueGroup (DB poll / Redis) || EventGate Kafka/SSE Stream
|-
| Storage || Monolithic cur/old MySQL tables || CQRS Event-Sourced Document Mesh
|-
| API || Action API (api.php) || High-speed OpenAPI 3.0 Gateway & GraphQL
|}

== See also ==
* [[Parsoid]]
* [[Distributed Systems]]
* [[Wikipedia]]
* [[Node.js]]

== References ==
<references />
`
  },
  {
    id: 'art-2',
    slug: 'Parsoid',
    title: 'Parsoid',
    namespace: 0,
    summary: 'A bidirectional parser service between wikitext and HTML5 DOM.',
    latestRevisionId: 'rev-201',
    createdAt: '2024-02-14T15:30:00Z',
    updatedAt: '2026-03-12T14:10:00Z',
    categories: ['Parsers', 'Wikimedia technology', 'Node.js software'],
    views: 28400,
    isProtected: false,
    wikitext: `{{Infobox software
| name = Parsoid
| developer = Wikimedia Architecture Team
| programming_language = Node.js / TypeScript
| purpose = Bidirectional Wikitext <-> HTML5 Translation
| license = Apache-2.0
}}

'''Parsoid''' is a bidirectional parser service developed to translate [[MediaWiki]] [[Wikitext]] into semantic HTML5 and back without data loss.<ref name="parsoid-team">Wikimedia Core Platform Team (2024). [https://www.mediawiki.org/wiki/Parsoid Parsoid Service & DOM Spec].</ref> It is a critical component of Wikipedia's [[VisualEditor]].<ref name="visualeditor">VisualEditor Project Documentation (2023). "Wikitext to HTML Round-Trip Stability".</ref>

== Core Design Goals ==
Parsoid was engineered with several fundamental architectural objectives:

=== Semantic Round-Tripping ===
Ensure that converting wikitext to HTML and back produces minimal dirty diffs.<ref name="parsoid-team" />

=== DOM Annotations & Microformats ===
Injecting \`data-mw\` metadata attributes so client visual tools understand templates and transclusions.

=== Scalable Node.js Execution ===
Non-blocking I/O allows Parsoid to handle tens of thousands of concurrent parsing requests per second across cluster nodes.<ref name="node-perf">Wikimedia Foundation Engineering (2025). "High-Throughput Node.js Services in Production".</ref>

== Parsing Pipeline ==
The Parsoid pipeline is structured as an asynchronous state machine:

=== Tokenizer & Lexer ===
Converts raw Wikitext into grammatical token streams.

=== Pre-processor & Macro Expansion ===
Recursively expands templates, parser functions (\`{{#if:}}\`), and magic words.

=== HTML5 Tree Builder ===
Generates standard DOM trees with semantic microformats.

== See also ==
* [[MediaWiki]]
* [[VisualEditor]]
* [[Abstract Syntax Tree]]

== References ==
<references />
`
  },
  {
    id: 'art-3',
    slug: 'Distributed_Systems',
    title: 'Distributed Systems',
    namespace: 0,
    summary: 'Systems whose components are located on different networked computers.',
    latestRevisionId: 'rev-301',
    createdAt: '2024-03-01T09:00:00Z',
    updatedAt: '2026-02-28T18:44:00Z',
    categories: ['Computer systems', 'Distributed computing', 'Software architecture'],
    views: 61890,
    isProtected: false,
    wikitext: `{{Infobox technology
| name = Distributed Systems
| category = Software Architecture
| key_characteristics = Concurrency, No global clock, Independent failures
| common_patterns = Microservices, Event-Driven, CQRS, Raft Consensus
}}

A '''distributed system''' is a computing paradigm in which autonomous hardware and software components communicate and coordinate their actions exclusively via message passing across a network.

== MediaWiki Microservices Context ==
Modern high-scale information platforms such as [[Wikipedia]] rely on distributed systems principles:
* '''Horizontal Scalability''': Partitioning stateless services like [[Parsoid]] across container pods.
* '''Eventual Consistency''': Propagating page edits via Kafka event streams to update edge caches, search indexes, and read replicas.
* '''Fault Isolation''': Circuit breakers ensure that a temporary degradation in the search cluster does not take down article reading.

== Key Theorems ==
* '''CAP Theorem''': In the presence of a network partition, a distributed system must choose between Consistency and Availability.
* '''PACELC Theorem''': Extends CAP to include Latency vs Consistency trade-offs even under normal operation.

== See also ==
* [[MediaWiki]]
* [[Node.js]]
* [[Eventual Consistency]]
`
  },
  {
    id: 'art-4',
    slug: 'Node.js',
    title: 'Node.js',
    namespace: 0,
    summary: 'An open-source, cross-platform JavaScript runtime environment based on V8.',
    latestRevisionId: 'rev-401',
    createdAt: '2024-01-05T11:20:00Z',
    updatedAt: '2026-03-08T22:15:00Z',
    categories: ['JavaScript', 'Server software', 'Runtimes', 'Node.js software', 'Software architecture'],
    views: 89300,
    isProtected: true,
    wikitext: `{{Infobox software
| name = Node.js
| developer = OpenJS Foundation
| initial_release = 2009-05-27
| engine = V8 JavaScript Engine
| license = MIT License
| website = https://nodejs.org
}}

'''Node.js''' is a cross-platform, open-source server environment built on Google Chrome's V8 engine. Designed around an event-driven, non-blocking I/O model, Node.js is widely used for scalable network applications and modern distributed microservices.

== Role in Wikimedia Infrastructure ==
Node.js plays a pivotal role in the modernization of the Wikimedia technical ecosystem:
* Powers the [[Parsoid]] parsing daemon.
* Executes the [[EventStreams]] gateway for real-time wiki telemetry.
* Provides low-latency API gateway mediation and RESTBase endpoints.

== Key Features ==
* '''Asynchronous Event Loop''': Single-threaded execution avoiding thread context-switch overhead.
* '''Rich Module Ecosystem''': Over 2 million packages available via npm.
* '''TypeScript Integration''': Full compile-time type safety for enterprise microservices.

== EventStreams Telemetry Example ==
MediaWiki microservices emit real-time revision events consumed via Server-Sent Events (SSE):

<syntaxhighlight lang="javascript">
const http = require('http');

// Simple Node.js microservice health & event dispatch
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'UP', service: 'EventGate', latencyMs: 4 }));
    return;
  }
  res.writeHead(404);
  res.end('Not Found');
});

server.listen(3000, () => {
  console.log('Telemetry microservice listening on port 3000');
});
</syntaxhighlight>

== See also ==
* [[MediaWiki]]
* [[Distributed Systems]]
* [[JavaScript]]
`
  },
  {
    id: 'art-5',
    slug: 'Talk:MediaWiki',
    title: 'Talk:MediaWiki',
    namespace: 1, // Talk
    summary: 'Discussion page for coordinating improvements to the MediaWiki article and microservices migration.',
    latestRevisionId: 'rev-501',
    createdAt: '2024-04-12T10:00:00Z',
    updatedAt: '2026-03-10T16:20:00Z',
    categories: ['Wiki discussions'],
    views: 1240,
    isProtected: false,
    wikitext: `== Microservices Migration Roadmap ==
Hello team! We have successfully migrated the monolithic PHP parser (\`Parser.php\`) to our TypeScript Parsoid service. All tests for table formatting and template transclusion are passing with 99.8% parity. --[[User:NodeArchitect|NodeArchitect]] 14:20, 10 March 2026 (UTC)

:Great news! What about the revision diff engine? Does it handle word-level diffs correctly during rollback operations? --[[User:CommunityEditor|CommunityEditor]] 15:02, 10 March 2026 (UTC)

::Yes! The Revision Microservice computes Myers diffs asynchronously and emits a \`revision_create\` event to EventGate. Latency is now under 12ms. --[[User:WikipedianAdmin|WikipedianAdmin]] 16:15, 10 March 2026 (UTC)

== Benchmarks on Node.js Gateway ==
We tested 10,000 req/sec against \`/api/v1/content/articles/MediaWiki\`. P99 latency stayed under 18ms thanks to the distributed in-memory cache layer. --[[User:ParsoidBot|ParsoidBot]]
`
  }
];

export const INITIAL_REVISIONS: Revision[] = [
  {
    id: 'rev-100',
    articleSlug: 'MediaWiki',
    parentRevisionId: null,
    wikitext: `'''MediaWiki''' is a free and open-source wiki software originally written in PHP.`,
    comment: 'Initial legacy import from Phase III monolith',
    author: { id: 'usr-1', name: 'WikipedianAdmin', isBot: false },
    timestamp: '2024-01-10T12:00:00Z',
    sha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    byteSize: 84,
    isMinor: false,
  },
  {
    id: 'rev-101',
    articleSlug: 'MediaWiki',
    parentRevisionId: 'rev-100',
    wikitext: INITIAL_ARTICLES[0].wikitext,
    comment: 'Migrated architecture section to Node.js microservices topology & Parsoid pipeline',
    author: { id: 'usr-2', name: 'NodeArchitect', isBot: false },
    timestamp: '2026-03-15T08:22:10Z',
    sha256: '9f8e7d6c5b4a3120123456789abcdef0123456789abcdef0123456789abcdef1',
    byteSize: INITIAL_ARTICLES[0].wikitext.length,
    isMinor: false,
  },
  {
    id: 'rev-201',
    articleSlug: 'Parsoid',
    parentRevisionId: null,
    wikitext: INITIAL_ARTICLES[1].wikitext,
    comment: 'Created Parsoid service documentation with AST specifications',
    author: { id: 'usr-4', name: 'ParsoidBot', isBot: true },
    timestamp: '2026-03-12T14:10:00Z',
    sha256: '7c6b5a4120123456789abcdef0123456789abcdef0123456789abcdef12345678',
    byteSize: INITIAL_ARTICLES[1].wikitext.length,
    isMinor: false,
  },
  {
    id: 'rev-301',
    articleSlug: 'Distributed_Systems',
    parentRevisionId: null,
    wikitext: INITIAL_ARTICLES[2].wikitext,
    comment: 'Comprehensive overview of distributed systems in Wikimedia stack',
    author: { id: 'usr-3', name: 'CommunityEditor', isBot: false },
    timestamp: '2026-02-28T18:44:00Z',
    sha256: '3a4b5c6d7e8f90123456789abcdef0123456789abcdef0123456789abcdef2345',
    byteSize: INITIAL_ARTICLES[2].wikitext.length,
    isMinor: false,
  },
  {
    id: 'rev-401',
    articleSlug: 'Node.js',
    parentRevisionId: null,
    wikitext: INITIAL_ARTICLES[3].wikitext,
    comment: 'Documented V8 event loop and role in microservices architecture',
    author: { id: 'usr-2', name: 'NodeArchitect', isBot: false },
    timestamp: '2026-03-08T22:15:00Z',
    sha256: '2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c',
    byteSize: INITIAL_ARTICLES[3].wikitext.length,
    isMinor: false,
  },
  {
    id: 'rev-501',
    articleSlug: 'Talk:MediaWiki',
    parentRevisionId: null,
    wikitext: INITIAL_ARTICLES[4].wikitext,
    comment: 'Opened discussion thread on parity verification benchmarks',
    author: { id: 'usr-2', name: 'NodeArchitect', isBot: false },
    timestamp: '2026-03-10T16:20:00Z',
    sha256: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2d',
    byteSize: INITIAL_ARTICLES[4].wikitext.length,
    isMinor: false,
  }
];

export const INITIAL_EVENTS: WikiEvent[] = [
  {
    id: 'evt-901',
    meta: {
      uri: 'https://wikimedia.mesh/wiki/MediaWiki',
      request_id: 'req-trace-41902',
      id: 'uuid-49120-1',
      dt: '2026-03-15T08:22:10Z',
      domain: 'en.wikipedia.org',
      stream: 'mediawiki.recentchange',
    },
    database: 'enwiki',
    page_title: 'MediaWiki',
    page_namespace: 0,
    rev_id: 'rev-101',
    rev_timestamp: '2026-03-15T08:22:10Z',
    rev_sha1: '9f8e7d6c5b4a3120',
    rev_minor_edit: false,
    rev_len: INITIAL_ARTICLES[0].wikitext.length,
    user_text: 'NodeArchitect',
    comment: 'Migrated architecture section to Node.js microservices topology & Parsoid pipeline',
    type: 'edit',
  },
  {
    id: 'evt-902',
    meta: {
      uri: 'https://wikimedia.mesh/wiki/Parsoid',
      request_id: 'req-trace-41903',
      id: 'uuid-49120-2',
      dt: '2026-03-12T14:10:00Z',
      domain: 'en.wikipedia.org',
      stream: 'mediawiki.recentchange',
    },
    database: 'enwiki',
    page_title: 'Parsoid',
    page_namespace: 0,
    rev_id: 'rev-201',
    rev_timestamp: '2026-03-12T14:10:00Z',
    rev_sha1: '7c6b5a4120123456',
    rev_minor_edit: false,
    rev_len: INITIAL_ARTICLES[1].wikitext.length,
    user_text: 'ParsoidBot',
    comment: 'Created Parsoid service documentation with AST specifications',
    type: 'new',
  }
];
