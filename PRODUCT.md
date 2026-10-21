# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Inferred from the implementation brief: the core remains a TypeScript library on Node.js 22.5+.
The public website is a static, build-time-generated site in this repository, deployed to Vercel
without changing the library's runtime dependencies.

## Users

Primary users are Stellar application developers who poll RPC `getEvents` and need explicit,
testable behavior around duplicate delivery, durable progress, restart recovery, and bounded RPC
history. A second audience is independent open-source contributors looking for well-scoped work at
beginner, intermediate, and advanced levels.

## Product Purpose

Stellar Event Sync supplies small, reusable TypeScript primitives for safely moving Stellar RPC
events into durable local storage. Success means an application can explain what it has processed,
resume after interruption, refuse false completeness claims, and diagnose failures without exposing
secrets.

## Positioning

The project is not a hosted indexer or query service. Its distinguishing mechanism is an atomic local
boundary: validated event pages and their continuation checkpoint are committed together, with event
IDs enforcing deterministic deduplication and retention gaps represented explicitly.

## Operating Context

Developers evaluate and integrate the project through GitHub, Node.js, TypeScript, Stellar RPC,
SQLite, deterministic fixtures, CI, and the command line. The public site explains the model and
routes readers into reference documentation and contribution work.

## Capabilities and Constraints

- Typed Stellar RPC health, event, pagination, and error handling.
- Event-ID deduplication and atomic SQLite event/checkpoint persistence.
- Restart recovery, retention-floor detection, retry policies, contract filtering, and diagnostics.
- Node.js 22.5+ is required; Node 22 still reports `node:sqlite` as experimental.
- The package is not published to npm and is not claimed production-ready.
- Historical backfill beyond RPC retention, arbitrary exactly-once side effects, reorg handling,
  storage migrations, and multi-provider reconciliation remain planned work.

## Brand Commitments

The product name is Stellar Event Sync. The public presentation must be factual, independent, and
developer-focused, using black, white, and restrained neutrals. It must not imply affiliation with
Stellar, Drips, Tiger Waves, or existing indexer providers.

## Evidence on Hand

Evidence is limited to the repository source, deterministic tests, GitHub Actions history, public
Stellar documentation, and recorded Testnet compatibility runs. There are no verified adoption
statistics, testimonials, partnerships, package downloads, or production case studies; future work
must not fabricate them.

## Product Principles

1. Make incomplete state explicit rather than silently continuing.
2. Keep reliability claims narrow, deterministic, and test-backed.
3. Prefer small composable primitives over a general-purpose indexing platform.
4. Make contribution paths understandable without private credentials.
5. Preserve operator privacy in errors, diagnostics, examples, and documentation.

## Accessibility & Inclusion

The website and documentation must support keyboard operation, readable contrast, reduced motion,
responsive layouts down to 390px, meaningful landmarks, visible focus, and clear language.
