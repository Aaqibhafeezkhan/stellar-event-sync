import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { URL } from 'node:url';

const out = new URL('../web-dist/', import.meta.url).pathname;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(new URL('../site/styles.css', import.meta.url), join(out, 'styles.css'));
cpSync(new URL('../site/app.js', import.meta.url), join(out, 'app.js'));
cpSync(new URL('../site/assets', import.meta.url), join(out, 'assets'), { recursive: true });

const code = (value) =>
  `<div class="code-shell"><button class="copy" data-copy>Copy</button><pre><code>${value}</code></pre></div>`;
const docs = [
  [
    'Start here',
    'introduction',
    'Introduction',
    `<p>Stellar Event Sync is a small TypeScript library for applications that poll Stellar RPC <code>getEvents</code>. It validates RPC data, deduplicates by event ID, and commits each page with its checkpoint in one SQLite transaction.</p><div class="callout"><strong>Project status:</strong> experimental MVP. It is not an indexer service, an npm package, or a production-readiness guarantee.</div><h2>Choose this project when</h2><ul><li>You want to keep application-specific event records.</li><li>You need a restartable cursor and explicit retention-gap failures.</li><li>You prefer a reusable ingestion primitive over a hosted query platform.</li></ul>`,
  ],
  [
    'Start here',
    'getting-started',
    'Getting started',
    `<p>Clone the repository, install the locked dependencies, and run the full verification suite.</p>${code(`<span class="tok-key">git</span> clone https://github.com/Webghost01-NG/stellar-event-sync.git\ncd stellar-event-sync\nnpm ci\nnpm run check\nnpm test`)}<p>Node.js 22.5 or newer is required because the store uses <code>node:sqlite</code>.</p>`,
  ],
  [
    'Start here',
    'installation',
    'Installation',
    `<p>The library is not published to npm. Install from source while the public API is still evolving.</p>${code(`git clone https://github.com/Webghost01-NG/stellar-event-sync.git\ncd stellar-event-sync\nnpm ci\nnpm run build`)}<h2>Runtime requirements</h2><table><tr><th>Requirement</th><th>Reason</th></tr><tr><td>Node ≥22.5</td><td>Built-in SQLite module</td></tr><tr><td>Writable local filesystem</td><td>SQLite database and WAL files</td></tr><tr><td>Stellar RPC URL</td><td>Health and event requests</td></tr></table>`,
  ],
  [
    'Start here',
    'quickstart',
    'Quickstart',
    `<p>This example matches <code>examples/sync.ts</code>. It starts at the current Testnet ledger, so it does not claim older history.</p>${code(`<span class="tok-key">import</span> { SqliteEventStore, StellarRpcEventSource, synchronize }\n  <span class="tok-key">from</span> <span class="tok-str">'./dist/src/index.js'</span>;\n\nconst rpc = new StellarRpcEventSource(\n  <span class="tok-str">'https://soroban-testnet.stellar.org'</span>,\n);\nconst health = await rpc.health();\nconst store = new SqliteEventStore(<span class="tok-str">'events.sqlite'</span>);\n\ntry {\n  console.log(await synchronize(rpc, store, {\n    source: <span class="tok-str">'stellar-testnet'</span>,\n    startLedger: health.latestLedger,\n  }));\n} finally {\n  store.close();\n}`)}<p>Run the checked-in example with <code>npm run example</code>.</p>`,
  ],
  [
    'Core concepts',
    'architecture',
    'Architecture',
    `<p>The system has three explicit boundaries: a validated RPC source, an orchestration loop, and a transactional store.</p><h2>Data path</h2><ol><li><code>StellarRpcEventSource</code> checks health and validates every event page.</li><li><code>synchronize</code> enforces retention and cursor rules.</li><li><code>SqliteEventStore.commitPage</code> inserts unique events and advances the checkpoint atomically.</li></ol><p>Transport and storage are intentionally small. Query APIs, dashboards, historical archives, and webhook delivery remain outside the MVP.</p>`,
  ],
  [
    'Core concepts',
    'stellar-rpc',
    'Stellar RPC integration',
    `<p>The client uses supported JSON-RPC methods <code>getHealth</code> and <code>getEvents</code>. A request begins with <code>startLedger</code>; subsequent pages use only the opaque cursor.</p><h2>Contract filtering</h2><p>Set <code>contractId</code> on synchronization options. The filter is sent only on the initial range request because the continuation cursor represents the active query.</p><h2>Validation</h2><p>Unsafe ledger numbers, malformed topics, invalid event types, and missing result fields fail with <code>MalformedRpcResponseError</code>.</p>`,
  ],
  [
    'Core concepts',
    'event-synchronization',
    'Event synchronization',
    `<p><code>synchronize</code> reads health, restores a checkpoint, walks pages, and records page-level counters. It stops when the cursor no longer advances or the configured page limit is reached.</p><h2>Result</h2>${code(`{\n  source: <span class="tok-str">'stellar-testnet'</span>,\n  state: <span class="tok-str">'complete'</span>,\n  pages: 3, received: 150,\n  inserted: 150, duplicates: 0,\n  nextLedger: 5301985\n}`)}<p>A <code>complete</code> result means the requested retained range completed—not that all historical chain data exists locally.</p>`,
  ],
  [
    'Core concepts',
    'deduplication',
    'Event deduplication',
    `<p>Stellar RPC documentation instructs clients to deduplicate events by unique <code>id</code>. The SQLite <code>events.id</code> primary key and <code>INSERT OR IGNORE</code> make replay deterministic.</p><h2>Guarantee boundary</h2><p>The store prevents duplicate local records. It does not make arbitrary webhooks, emails, or payments exactly once. Use an idempotency key or transactional outbox for downstream effects.</p>`,
  ],
  [
    'Core concepts',
    'checkpoints',
    'Checkpoint persistence',
    `<p>Each source has one checkpoint containing an optional opaque cursor and a next-ledger value. Event inserts and checkpoint updates happen within one <code>BEGIN IMMEDIATE</code> transaction.</p><h2>Why both fields?</h2><p>The cursor resumes an active walk. The next ledger supports retention checks and a fresh range after the cursor has completed. Cursors are never parsed or synthesized.</p>`,
  ],
  [
    'Reliability',
    'crash-recovery',
    'Crash recovery',
    `<p>If a process fails before checkpoint commit, SQLite rolls back both the event rows and checkpoint. Restart replays the same page; event IDs absorb duplicates safely.</p><h2>What is tested</h2><ul><li>Injected failure between inserts and checkpoint save.</li><li>No event or checkpoint remains after rollback.</li><li>Restart begins from the last committed position.</li></ul>`,
  ],
  [
    'Reliability',
    'retention-boundaries',
    'Retention boundaries',
    `<p>RPC servers retain a bounded ledger window. Before fetching, the synchronizer compares its requested next ledger with <code>getHealth.oldestLedger</code>.</p><p>If the request is older, it throws <code>IncompleteHistoryError</code> before fetching. It never silently clamps to the oldest available ledger.</p><div class="callout">Recovery strategies and durable gap records are planned work. The current default is deliberately fail-closed.</div>`,
  ],
  [
    'Reliability',
    'error-handling',
    'Error handling',
    `<p>Errors are structured for programmatic handling and bounded for safe diagnostics.</p><table><tr><th>Error</th><th>Meaning</th></tr><tr><td><code>IncompleteHistoryError</code></td><td>Requested history predates retention</td></tr><tr><td><code>MalformedRpcResponseError</code></td><td>Remote data failed validation</td></tr><tr><td><code>RpcRequestError</code></td><td>HTTP or JSON-RPC failure</td></tr><tr><td><code>RpcTimeoutError</code></td><td>Configured deadline elapsed</td></tr><tr><td><code>RpcAbortError</code></td><td>Request was aborted</td></tr></table><p>RPC codes are retained when present; messages are length-bounded and common credential patterns are redacted.</p>`,
  ],
  [
    'Reliability',
    'guarantees',
    'Reliability guarantees',
    `<h2>Guaranteed by tests</h2><ul><li>At-most-once local persistence per event ID.</li><li>Atomic event-page and checkpoint commit.</li><li>Safe replay after a rolled-back page.</li><li>Explicit failure when the known checkpoint is outside retention.</li><li>Bounded retry and diagnostic behavior.</li></ul><h2>Not guaranteed</h2><p>Global exactly-once delivery, canonical historical completeness, provider agreement, chain-reorganization handling, or durability beyond SQLite and filesystem guarantees.</p>`,
  ],
  [
    'Operate',
    'configuration',
    'Configuration',
    `<table><tr><th>Option</th><th>Default</th><th>Purpose</th></tr><tr><td><code>source</code></td><td>required</td><td>Checkpoint namespace</td></tr><tr><td><code>startLedger</code></td><td>required</td><td>First requested ledger without a checkpoint</td></tr><tr><td><code>pageSize</code></td><td>100</td><td>RPC page limit</td></tr><tr><td><code>maxPages</code></td><td>1,000</td><td>Bound one synchronization call</td></tr><tr><td><code>contractId</code></td><td>none</td><td>Initial request contract filter</td></tr></table><p>Retry policy additionally supports attempts, delays, caps, jitter, timeout, <code>Retry-After</code>, and injectable clock/sleep functions.</p>`,
  ],
  [
    'Operate',
    'diagnostics',
    'Diagnostics CLI',
    `<p>The read-only CLI checks RPC health against an existing local checkpoint without mutating storage.</p>${code(`npm run diagnostics -- --rpc-url https://soroban-testnet.stellar.org \\\n  --store events.sqlite --json`)}<p>Exit codes distinguish healthy, incomplete history, malformed responses, network failure, and invalid arguments. URL credentials, queries, and fragments are rejected or redacted.</p>`,
  ],
  [
    'Operate',
    'troubleshooting',
    'Troubleshooting',
    `<h2>INCOMPLETE_HISTORY</h2><p>Your checkpoint is older than the provider's retained floor. Do not delete the error or claim completeness. Select a documented backfill source or begin a clearly marked partial dataset.</p><h2>ExperimentalWarning: SQLite</h2><p>Node 22 may print this warning for <code>node:sqlite</code>. It is a known runtime limitation, not a failed test.</p><h2>Repeated events</h2><p>Repeated delivery is expected. Check the <code>duplicates</code> counter; unique event IDs should still produce one stored row.</p>`,
  ],
  [
    'Develop',
    'testing',
    'Testing',
    `<p>The suite is offline and deterministic. Run all gates before a pull request.</p>${code(`npm ci\nnpm run check\nnpm test`)}<p>KT-01 through KT-04 cover duplicates, crash/restart, retention expiry, and cursor consistency. RPC tests cover malformed data, retry classification, timeouts, redaction, and filters.</p>`,
  ],
  [
    'Develop',
    'examples',
    'Examples',
    `<h2>Testnet synchronization</h2><p><code>examples/sync.ts</code> fetches current Testnet events and writes SQLite locally. Set <code>STELLAR_RPC_URL</code> and optionally <code>STELLAR_CONTRACT_ID</code>.</p><h2>Diagnostics</h2><p><code>src/cli/index.ts</code> demonstrates read-only checkpoint inspection and versioned JSON output.</p><p>No example submits transactions or requires a private key.</p>`,
  ],
  [
    'Develop',
    'security',
    'Security',
    `<p>Never pass private keys to this project. RPC endpoints may include sensitive query tokens, so diagnostics remove credentials, query strings, and fragments.</p><h2>Reporting</h2><p>Use the repository's private <a href="https://github.com/Webghost01-NG/stellar-event-sync/security/advisories/new">security advisory form</a>. Do not publish an exploitable report in an issue.</p>`,
  ],
  [
    'Develop',
    'limitations',
    'Known limitations',
    `<ul><li>Not published to npm.</li><li>No schema migration mechanism.</li><li>No PostgreSQL or filesystem adapter.</li><li>No historical provider integration.</li><li>No transactional outbox.</li><li>No multi-provider comparison.</li><li>No reorganization model.</li><li>Node 22 built-in SQLite is experimental.</li></ul><p>These are roadmap boundaries, not evidence that competing products are deficient.</p>`,
  ],
  [
    'Community',
    'contributing',
    'Contributor onboarding',
    `<p>Choose an unassigned issue whose acceptance criteria match your experience. Comment before substantial work, create a focused branch, and include deterministic tests.</p><h2>Start here</h2><ul><li><a href="https://github.com/Webghost01-NG/stellar-event-sync/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22">Beginner-friendly issues</a></li><li><a href="https://github.com/Webghost01-NG/stellar-event-sync/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22">Help wanted</a></li><li><a href="https://github.com/Webghost01-NG/stellar-event-sync/blob/main/CONTRIBUTING.md">Contribution guide</a></li></ul><p>No private credentials are required for normal contributions.</p>`,
  ],
  [
    'Community',
    'roadmap',
    'Development roadmap',
    `<h2>Near term</h2><ul><li>Schema migrations and storage interfaces.</li><li>Fault-injection and property-based verification.</li><li>Validated event filter structures.</li><li>Retention recovery state design.</li></ul><h2>Later</h2><ul><li>Transactional outbox.</li><li>PostgreSQL adapter.</li><li>Cross-provider consistency audits.</li><li>Release and provenance automation.</li></ul><p>Roadmap entries are proposals until merged.</p>`,
  ],
  [
    'Community',
    'faq',
    'Frequently asked questions',
    `<h2>Is this a Stellar indexer?</h2><p>No. It is a small ingestion reliability library for applications keeping their own event records.</p><h2>Is it production-ready?</h2><p>No. The project is an experimental MVP with explicit limitations.</p><h2>Can I install it from npm?</h2><p>Not yet. Clone the repository and build from source.</p><h2>Does it recover missing history?</h2><p>It detects and reports a retention gap. Automatic backfill is not implemented.</p><h2>Is it affiliated with Stellar or a funding program?</h2><p>No. It is an independent open-source project.</p>`,
  ],
];

const groups = [...new Set(docs.map(([group]) => group))];
const nav = (active = '') =>
  groups
    .map(
      (group) =>
        `<div class="docs-group"><h2>${group}</h2>${docs
          .filter(([g]) => g === group)
          .map(
            ([, slug, title]) =>
              `<a data-doc-link href="/docs/${slug}" ${active === slug ? 'aria-current="page"' : ''}>${title}</a>`,
          )
          .join('')}</div>`,
    )
    .join('');
const header = `<a class="skip" href="#content">Skip to content</a><header class="site-header"><a class="brand" href="/">Stellar Event Sync</a><button class="menu" data-menu aria-expanded="false" aria-label="Toggle navigation">Menu</button><nav class="site-nav" data-nav aria-label="Primary"><a href="/docs">Docs</a><a href="https://github.com/Webghost01-NG/stellar-event-sync/issues">Issues</a><a href="https://github.com/Webghost01-NG/stellar-event-sync">GitHub</a><a class="button primary" href="https://github.com/Webghost01-NG/stellar-event-sync/blob/main/CONTRIBUTING.md">Contribute</a></nav></header>`;
const footer = `<footer class="site-footer"><strong>Stellar Event Sync</strong><nav class="footer-links" aria-label="Footer"><a href="https://github.com/Webghost01-NG/stellar-event-sync">GitHub</a><a href="/docs">Documentation</a><a href="https://github.com/Webghost01-NG/stellar-event-sync/blob/main/CONTRIBUTING.md">Contributing</a><a href="https://github.com/Webghost01-NG/stellar-event-sync/blob/main/LICENSE">MIT License</a><a href="https://github.com/Webghost01-NG/stellar-event-sync/blob/main/SECURITY.md">Security</a></nav></footer>`;
const shell = (title, description, body) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${description}"><meta name="theme-color" content="#f5f4ef"><link rel="canonical" href="https://stellar-event-sync.vercel.app${title === 'Stellar Event Sync' ? '/' : `/docs/${title.toLowerCase().replaceAll(' ', '-')}`}"><link rel="stylesheet" href="/styles.css"><script src="/app.js" defer></script></head><body>${header}${body}${footer}</body></html>`;

const homepage = `<main id="content"><section class="hero"><div class="hero-copy"><h1>Events should resume. Claims should hold.</h1><p class="lede">A focused TypeScript toolkit for crash-consistent Stellar RPC event ingestion—deduplicated records, durable checkpoints, explicit retention gaps, and errors built for operators.</p><div class="actions"><a class="button primary" href="/docs/getting-started">Read documentation</a><a class="button" href="https://github.com/Webghost01-NG/stellar-event-sync">View GitHub</a><a class="button" href="https://github.com/Webghost01-NG/stellar-event-sync/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22">Start contributing</a></div></div><div class="proof" data-flow><div class="proof-head"><span>Page 004 / retained range</span><span>validated</span></div><div class="event-row"><span>5301982</span><span>event_8f2</span><b>INSERT</b></div><div class="event-row"><span>5301983</span><span>event_8f3</span><b>INSERT</b></div><div class="event-row"><span>5301983</span><span>event_8f3</span><span>DUPLICATE</span></div><div class="flow-line"></div><div class="checkpoint"><div class="event-row"><span>cursor</span><span>004…8f3</span><b>SAVED</b></div><div class="event-row"><span>next</span><span>5301984</span><b>COMMIT</b></div></div></div></section><section class="section"><h2>Reliability lives between pages.</h2><p class="section-intro">Stellar RPC already defines the event stream. Stellar Event Sync focuses on the failure-prone boundary between a remote page and your application's durable state.</p><div class="capability-list"><div class="capability"><span>01</span><strong>Validate before trust</strong><p>Health, events, ledgers, topics, and error envelopes fail closed when their shapes are unsafe.</p></div><div class="capability"><span>02</span><strong>Persist once</strong><p>Event IDs are primary keys, so replay cannot create a second local record.</p></div><div class="capability"><span>03</span><strong>Commit progress atomically</strong><p>Page inserts and checkpoint movement succeed or roll back together.</p></div><div class="capability"><span>04</span><strong>Name missing history</strong><p>A checkpoint behind the RPC retention floor becomes an explicit incomplete-history error.</p></div></div></section><section class="section"><h2>One page. One transaction. One honest state.</h2><div class="flow"><article><code>RPC / 01</code><h3>Inspect health</h3><p>Read the retained ledger floor before requesting history.</p></article><article><code>FETCH / 02</code><h3>Validate page</h3><p>Walk the opaque cursor and reject malformed responses.</p></article><article><code>SQLITE / 03</code><h3>Commit together</h3><p>Insert unique events and advance the checkpoint atomically.</p></article><article><code>RESTART / 04</code><h3>Replay safely</h3><p>Resume from the last committed cursor after interruption.</p></article></div></section><section class="section"><h2>Start from source.</h2><p class="section-intro">The package is deliberately not published yet. Clone the repository, run the verified suite, and execute the checked-in Testnet example.</p>${code(`git clone https://github.com/Webghost01-NG/stellar-event-sync.git\ncd stellar-event-sync\nnpm ci\nnpm test\nnpm run example`)}<a class="button" href="/docs/quickstart">Open the quickstart</a></section><section class="section"><h2>Built in public, with bounded work.</h2><p class="section-intro">Issues describe current behavior, desired behavior, scope, acceptance criteria, tests, dependencies, and expected difficulty. You can contribute without credentials or a running contract.</p><div class="actions"><a class="button primary" href="https://github.com/Webghost01-NG/stellar-event-sync/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22">Find a first issue</a><a class="button" href="/docs/contributing">Contributor guide</a></div></section><section class="section"><h2>Roadmap, without pretending.</h2><div class="roadmap"><div><p class="status">Working now</p><ul><li>Typed RPC ingestion</li><li>Event-ID deduplication</li><li>Atomic SQLite checkpoints</li><li>Restart recovery</li><li>Retention-gap detection</li><li>Retry and diagnostics policies</li></ul></div><div><p class="status">Planned, not promised</p><ul><li>Schema migrations</li><li>Transactional outbox</li><li>Additional storage adapters</li><li>Fault-injection harness</li><li>Cross-provider audits</li><li>Release automation</li></ul></div></div></section></main>`;
writeFileSync(
  join(out, 'index.html'),
  shell(
    'Stellar Event Sync',
    'Crash-consistent event ingestion primitives for Stellar RPC.',
    homepage,
  ),
);

docs.forEach(([group, slug, title, content], index) => {
  const prev = docs[index - 1];
  const next = docs[index + 1];
  const body = `<div class="docs-shell"><aside class="docs-sidebar"><button class="docs-menu" data-docs-menu aria-expanded="false" aria-controls="docs-navigation">Browse documentation</button><div id="docs-navigation" data-docs-nav><label for="docs-search">Search documentation</label><input id="docs-search" class="docs-search" data-search type="search" placeholder="Filter topics"><p role="status" data-results class="status"></p>${nav(slug)}</div></aside><main id="content" class="docs-main"><article><p class="status">${group}</p><h1>${title}</h1>${content}<nav class="docs-pager" aria-label="Documentation pages"><span>${prev ? `<a href="/docs/${prev[1]}">← ${prev[2]}</a>` : ''}</span><span>${next ? `<a href="/docs/${next[1]}">${next[2]} →</a>` : ''}</span></nav></article></main></div>`;
  const path = join(out, 'docs', slug);
  mkdirSync(path, { recursive: true });
  writeFileSync(
    join(path, 'index.html'),
    shell(`${title} | Stellar Event Sync`, `${title} documentation for Stellar Event Sync.`, body),
  );
});
const docsIndex = join(out, 'docs');
mkdirSync(docsIndex, { recursive: true });
writeFileSync(
  join(docsIndex, 'index.html'),
  shell(
    'Documentation | Stellar Event Sync',
    'Documentation for Stellar Event Sync.',
    `<div class="docs-shell"><aside class="docs-sidebar"><button class="docs-menu" data-docs-menu aria-expanded="false" aria-controls="docs-navigation">Browse documentation</button><div id="docs-navigation" data-docs-nav><label for="docs-search">Search documentation</label><input id="docs-search" class="docs-search" data-search type="search" placeholder="Filter topics"><p role="status" data-results class="status"></p>${nav()}</div></aside><main id="content" class="docs-main"><article><p class="status">Documentation</p><h1>Build from an honest checkpoint.</h1><p class="lede">Understand the ingestion model, run the source, inspect failure guarantees, and find a contribution path.</p>${groups
      .map(
        (group) =>
          `<h2>${group}</h2><ul>${docs
            .filter(([g]) => g === group)
            .map(([, slug, title]) => `<li><a href="/docs/${slug}">${title}</a></li>`)
            .join('')}</ul>`,
      )
      .join('')}</article></main></div>`,
  ),
);
writeFileSync(
  join(out, 'robots.txt'),
  'User-agent: *\nAllow: /\nSitemap: https://stellar-event-sync.vercel.app/sitemap.xml\n',
);
writeFileSync(
  join(out, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://stellar-event-sync.vercel.app/</loc></url><url><loc>https://stellar-event-sync.vercel.app/docs</loc></url>${docs.map(([, slug]) => `<url><loc>https://stellar-event-sync.vercel.app/docs/${slug}</loc></url>`).join('')}</urlset>`,
);
process.stdout.write(`Built ${docs.length + 2} pages in ${out}\n`);
