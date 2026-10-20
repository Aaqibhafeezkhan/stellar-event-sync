# Roadmap and contributor workstreams

The MVP intentionally leaves four independent areas for contributors:

1. **Storage:** migrations, a filesystem adapter, and a transactional outbox.
2. **Transport:** configurable retry policy, timeouts, filters, and multi-provider checks.
3. **Reliability testing:** fault injection, randomized traces, and long-running Testnet checks.
4. **Operator experience:** CLI diagnostics, machine-readable reports, examples, and documentation.

Near-term work should preserve the narrow library scope. A hosted API, dashboard, general query
engine, or npm publication requires a separate design decision and maintainer approval.
