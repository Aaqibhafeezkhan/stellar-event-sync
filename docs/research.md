# Technical validation report

Research checked on 2026-10-20. Verdict: **CONDITIONAL PASS**.

## Evidence

Stellar RPC's `getEvents` documentation says that history is bounded, exposes `oldestLedger` and
`latestLedger` through `getHealth`, and requires clients to deduplicate by unique event ID. The
default retention configuration is 120,960 ledgers (roughly seven days). Requests older than the
retained floor fail rather than proving that no event existed.

The official event-to-SQLite guide is intentionally simpler. It states that it assumes frequent
polling and does not implement oldest-ledger discovery or retention recovery. This is the concrete
reliability gap addressed by the MVP.

The JavaScript SDK exposes Stellar RPC networking and event types. This MVP uses the supported JSON
RPC API directly so deterministic fixtures can replace the transport and the runtime dependency
surface stays small.

## Comparison

| Project | Primary purpose | Overlap | Difference from this project |
| --- | --- | --- | --- |
| Stellar event ingestion guide | Educational SQLite poller | Local event persistence | Explicitly assumes away retention recovery |
| Mercury / Retroshades | Managed/custom indexing service | Historical event access | Hosted broader product; this is a self-hosted reliability primitive |
| SoroScan | GraphQL/REST/webhook indexer | Event ingestion and storage | Much broader service architecture; not a focused TS checkpoint library |
| Stellar Ingest SDK | Full ledger ingestion framework | Durable ingestion concerns | Ledger-scale Go toolkit; this MVP targets application-level `getEvents` consumers |
| Mimir event poller | Application-specific bot ingestion | Cursor safety and retention handling | Strong prior art, but reliability logic is embedded in a Telegram bot rather than a reusable package |

The Grid's public corpus search found a live Soroban Indexer record but did not establish market
demand or adoption. The comparison therefore supports technical differentiation, not a commercial
claim.

## Kill-test results

- KT-01: duplicate fixture delivery inserts two unique IDs from four deliveries.
- KT-02: a fault between insert and checkpoint rolls back both; restart safely replays the page.
- KT-03: a start ledger below the health-reported floor throws `INCOMPLETE_HISTORY` before fetch.
- KT-04: checkpoint cursor survives restart and is the next request's cursor; retries and malformed
  responses have negative tests.

A public Testnet compatibility run on 2026-10-20 traversed three pages and persisted 150 events.
This verifies current wire compatibility only; it is not a load, longevity, or production test.

## Gate decision

Proceed only as a narrow, reusable reliability toolkit. Kill or redesign the project if it expands
into a generic event-query service without evidence of a distinct need. The strongest next evidence
would be independent applications integrating the library and reporting real recovery behavior.

## Primary sources

- [Stellar RPC `getEvents`](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getEvents)
- [Stellar event ingestion guide](https://developers.stellar.org/docs/build/guides/events/ingest)
- [Stellar indexer overview](https://developers.stellar.org/docs/data/indexers)
- [Stellar JavaScript SDK](https://github.com/stellar/js-stellar-sdk)
- [Stellar RPC configuration](https://developers.stellar.org/docs/data/apis/rpc/admin-guide/configuring)
- [SoroScan repository](https://github.com/SoroScan/soroscan)
- [Mimir repository](https://github.com/mimir-stellar/telegram-bot)
- [Drips Wave maintainer participation](https://docs.drips.network/wave/maintainers/participating-in-a-wave/)
- [Drips Wave terms](https://docs.drips.network/wave/terms-and-rules/)
