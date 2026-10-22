# Stellar Event Sync

Crash-consistent TypeScript primitives for applications that ingest Stellar RPC events into their
own durable storage.

[Documentation](https://stellar-event-sync.vercel.app/docs) ·
[Good first issues](https://github.com/Webghost01-NG/stellar-event-sync/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) ·
[Contribution guide](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) · [Security](SECURITY.md)

> Experimental MVP: the API may change before 1.0. This project is independent and is not affiliated
> with the Stellar Development Foundation, Drips, or Tiger Waves.

## The problem

Stellar RPC retains a bounded event history and may deliver the same event more than once. An
application that advances its cursor separately from its database writes can silently skip work
after a crash—or claim complete history after the requested ledgers have expired.

Stellar Event Sync makes those failure boundaries explicit. It validates RPC responses, deduplicates
by Stellar event ID, and commits each page's events and checkpoint in one SQLite transaction.

## What works

- Typed `getHealth` and `getEvents` integration
- Event-ID deduplication with deterministic replay
- Atomic SQLite event and checkpoint commits
- Restart from the last committed opaque cursor
- Explicit `INCOMPLETE_HISTORY` detection
- Explicit incomplete results when a per-run page limit is reached
- Contract filtering on initial range requests
- Configurable retry, timeout, jitter, and `Retry-After` handling
- Local validation of RPC endpoint URLs and `getEvents` page limits
- Safe RPC diagnostics and a read-only diagnostics CLI
- Deterministic tests for duplicates, crashes, retention, pagination, and malformed responses

Not yet supported: automatic historical backfill, schema migrations, PostgreSQL, transactional
outbox delivery, reorganization handling, or multi-provider reconciliation. The package is not
published to npm.

## Architecture

```text
Stellar RPC ──► validated event page ──► SQLite transaction
      │                                      ├── unique events
      └── retained ledger window             └── checkpoint
                                                     │
                                    crash/restart ◄──┘
```

`StellarRpcEventSource` validates transport data. `synchronize` enforces retention and cursor rules.
`SqliteEventStore` owns the atomic commit boundary. See the
[architecture guide](https://stellar-event-sync.vercel.app/docs/architecture).

## Quickstart

Node.js 22.5 or newer is required because the MVP uses built-in `node:sqlite`.

```bash
git clone https://github.com/Webghost01-NG/stellar-event-sync.git
cd stellar-event-sync
npm ci
npm run check
npm test
npm run example
```

The example starts at the current Testnet ledger and writes `stellar-events.sqlite`; it does not
claim older history. Override the endpoint with `STELLAR_RPC_URL` and optionally filter with
`STELLAR_CONTRACT_ID`.

```ts
import { SqliteEventStore, StellarRpcEventSource, synchronize } from './dist/src/index.js';

const rpc = new StellarRpcEventSource('https://soroban-testnet.stellar.org');
const health = await rpc.health();
const store = new SqliteEventStore('events.sqlite');

try {
  const result = await synchronize(rpc, store, {
    source: 'stellar-testnet',
    startLedger: health.latestLedger,
  });
  console.log(result);
} finally {
  store.close();
}
```

`maxPages` is a positive integer (default `1,000`) that bounds the work performed by one call.
When the final allowed page still has a continuation cursor, `synchronize` commits that page and
returns `state: 'incomplete-page-limit'` with the configured `pageLimit`; it does not request the
next page or report a complete synchronization. Calling `synchronize` again resumes from the saved
cursor. A terminal page reached exactly at the limit still returns `state: 'complete'`.

## Development

```bash
npm ci
npm run check       # TypeScript, ESLint, Prettier
npm test            # build and deterministic test suite
npm run build:site  # static website and documentation
```

## Roadmap

Near-term work includes schema migrations, storage interfaces, fault injection, property-based
verification, retention recovery states, and stronger filter validation. Later work may include a
transactional outbox, PostgreSQL adapter, provider consistency audits, and release automation.

The [full roadmap](https://stellar-event-sync.vercel.app/docs/roadmap) distinguishes shipped work
from proposals.

## Contributing

Independent contributors are welcome. Issues include current behavior, expected behavior, scope,
acceptance criteria, tests, dependencies, and difficulty. Comment before substantial work so the
maintainer can confirm ownership.

- [Beginner-friendly issues](https://github.com/Webghost01-NG/stellar-event-sync/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
- [All help-wanted issues](https://github.com/Webghost01-NG/stellar-event-sync/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
- [Contributor onboarding](https://stellar-event-sync.vercel.app/docs/contributing)
- [CONTRIBUTING.md](CONTRIBUTING.md)

Real contributors are recognized automatically through GitHub's commit and contribution history.
No rewards, program admission, or funding are guaranteed.

## Security and license

RPC endpoint URLs must not embed credentials. `StellarRpcEventSource` rejects URL userinfo with a
typed `RpcConfigurationError` before any request and exposes only the credential-free `origin` for
diagnostics. Use provider-supported header authentication, for example through a custom `fetch`
wrapper. `getEvents` page limits must be integers from 1 to 10,000; `synchronize` validates
`pageSize` before reading RPC health.

Report vulnerabilities through GitHub's private security advisory flow as described in
[SECURITY.md](SECURITY.md). Licensed under the [MIT License](LICENSE).
