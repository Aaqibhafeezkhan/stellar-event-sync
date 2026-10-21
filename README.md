# Stellar Event Sync

Crash-consistent ingestion primitives for applications that poll Stellar RPC `getEvents`.

Stellar Event Sync is a small TypeScript library for teams that want to keep their own event
records without operating a general-purpose indexer. It deduplicates by Stellar event ID, stores
events and their cursor checkpoint in one SQLite transaction, resumes after restart, and refuses to
claim complete history when a checkpoint has fallen behind an RPC server's retention window.

> Status: experimental MVP. The API may change before 1.0. This project is independent and is not
> affiliated with the Stellar Development Foundation or Drips.

## Why this exists

Stellar RPC intentionally keeps a bounded event history. The official ingestion guide demonstrates
a useful SQLite cron job, but explicitly assumes polling is frequent enough to avoid oldest-ledger
recovery. The RPC documentation also tells clients to deduplicate repeated events by unique `id`.
This library isolates those reliability concerns. It does **not** replace Mercury, SoroScan,
Goldsky, or a full indexing pipeline.

## Guarantees

- An event ID is persisted at most once in one SQLite store.
- A page's events and checkpoint commit atomically.
- A crash before checkpoint commit rolls back that page, allowing safe replay.
- A requested ledger below `getHealth.oldestLedger` raises `IncompleteHistoryError`.
- Retryable transport and HTTP 5xx failures use bounded exponential retries.
- Malformed RPC responses fail closed with typed errors.

These guarantees cover the local event store. They do not make arbitrary external side effects
(webhooks, emails, payments) exactly-once. Consumers should use an outbox or their own idempotency
keys. Chain reorganizations, multi-provider reconciliation, historical backfill outside RPC
retention, schema migrations, and production observability are not yet supported.

## Requirements and quick start

Node.js 22.5 or newer is required because the MVP uses Node's built-in `node:sqlite` module.

```bash
git clone https://github.com/Webghost01-NG/stellar-event-sync.git
cd stellar-event-sync
npm ci
npm test
npm run example
```

The example starts at the current Testnet ledger and writes `stellar-events.sqlite`. Override the
endpoint with `STELLAR_RPC_URL`. It does not submit transactions or require a secret key.

```ts
import {
  formatSyncResultJson,
  SqliteEventStore,
  StellarRpcEventSource,
  synchronize,
} from 'stellar-event-sync';

const rpc = new StellarRpcEventSource('https://soroban-testnet.stellar.org');
const health = await rpc.health();
const store = new SqliteEventStore('events.sqlite');

const result = await synchronize(rpc, store, {
  source: 'stellar-testnet',
  startLedger: health.latestLedger,
});

process.stderr.write('sync complete\n');
process.stdout.write(`${formatSyncResultJson(result)}\n`);
store.close();
```

`formatSyncResultJson` emits one versioned JSON document containing the source label, state, page
and event counters, and checkpoint position. It intentionally excludes event payloads and secrets.
The current envelope has `formatVersion: 1`; integer `bigint` values are encoded as decimal JSON
strings. Keep logs on stderr so stdout remains safe for automation.

## Architecture

`StellarRpcEventSource` validates and pages RPC responses. `synchronize` enforces retention and
cursor rules. `SqliteEventStore` owns the atomic boundary: event inserts and checkpoint updates are
one transaction. The event ID primary key makes replay deterministic.

```text
Stellar RPC -> validated page -> SQLite transaction -> events + checkpoint
                    |                    |
              typed failure        rollback on crash
```

See [the research gate](docs/research.md), [architecture decisions](docs/architecture.md), and the
[roadmap](docs/roadmap.md).

## Development

```bash
npm ci
npm run check
npm test
```

The tests map directly to KT-01 through KT-04 and include malformed-response and retry cases. Read
[CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Use the issue forms to report a
bug or propose a feature; security reports follow [SECURITY.md](SECURITY.md).

## Relevant Stellar documentation

- [RPC `getEvents`](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getEvents)
- [RPC `getHealth`](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getHealth)
- [Official event ingestion guide](https://developers.stellar.org/docs/build/guides/events/ingest)
- [Stellar indexer overview](https://developers.stellar.org/docs/data/indexers)

## License

[MIT](LICENSE) © 2026 Webghost01-NG.
