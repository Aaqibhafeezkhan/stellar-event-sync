# Changelog

All notable changes to Stellar Event Sync will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Before 1.0, minor versions may contain documented breaking changes.

The repository currently declares `0.1.0` in `package.json`, but the project has not been published to npm. The entries below describe verified functionality merged before the first public release; they do **not** represent a tagged or published release.

## [Unreleased]

### Added

- Added a versioned, recovery-neutral JSON serializer for incomplete-history errors.
- Crash-consistent Stellar RPC event ingestion with event-ID deduplication, transactional SQLite event/checkpoint writes, and restartable cursors ([initial implementation](https://github.com/Webghost01-NG/stellar-event-sync/commit/0e3f9d45ba5a4da2138ad2a6a9e0742361ee7db3)).
- Versioned synchronization diagnostics and a read-only diagnostics CLI ([diagnostic data](https://github.com/Webghost01-NG/stellar-event-sync/commit/26ff12cc3b7dc3258f8cfe4a23c9cfaec93facd4), [CLI](https://github.com/Webghost01-NG/stellar-event-sync/commit/006d4bbe0ae1c9fec50d62814614baacf77a19aa)).
- Contract-ID filtering for initial event range requests ([implementation](https://github.com/Webghost01-NG/stellar-event-sync/commit/73f1c4ce54f9f25191aac4e5b5eb6cde05df2d82)).
- Configurable RPC retries with timeout, jitter, and `Retry-After` handling ([implementation](https://github.com/Webghost01-NG/stellar-event-sync/commit/bfe3da2dee12350f169f90cc1320a526c4a54915)).
- Project documentation website and local site verification tooling ([implementation](https://github.com/Webghost01-NG/stellar-event-sync/commit/a3abf52688b83c291c80c80c9201a220cab3783a)).

### Changed

- A synchronization run that hits `maxPages` while a continuation cursor remains now reports `incomplete-page-limit` instead of reporting complete progress; the checkpoint remains resumable ([implementation](https://github.com/Webghost01-NG/stellar-event-sync/commit/81a7a3c44afcc715a5c0b2e2a571659f04fac160)).

### Fixed

- Improved the structure and sanitization of RPC error diagnostics ([implementation](https://github.com/Webghost01-NG/stellar-event-sync/commit/042bb8aa8f530f1c757746e7aee5a8aad7dc0c46)).

### Security

- Reject RPC endpoint URLs containing embedded user credentials and validate event page limits before any request ([implementation](https://github.com/Webghost01-NG/stellar-event-sync/commit/57c9799643c6f18496d2525fcdaa3f55b057a31d)).

### Known limitations

- The project is experimental and not published to npm. Its public API may change before 1.0.
- No automatic historical backfill, schema migrations, PostgreSQL adapter, transactional outbox, chain-reorganization handling, or multi-provider reconciliation.
- Atomic local storage and deduplication do not guarantee exactly-once delivery to downstream services.
