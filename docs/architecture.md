# Architecture decisions

## SQLite transaction boundary

SQLite materially improves the model because a page's unique event inserts and its new checkpoint
can commit atomically. A JSON checkpoint plus separate event files cannot provide the same guarantee
after process or machine interruption. The MVP uses Node's built-in SQLite module, avoiding a native
package dependency, at the cost of requiring modern Node and accepting its experimental warning in
Node 22.

## Cursor plus next ledger

The opaque cursor is the normal continuation token. `nextLedger` is also stored for retention checks
and for starting a new range after a completed walk. A cursor is never synthesized or parsed.

## Failure model

Unknown/malformed responses fail closed. A retry never mutates the checkpoint. Retention expiry is a
distinct structured error because silently clamping to the oldest available ledger would make an
incorrect completeness claim.

Local configuration is validated before network access. Endpoints containing URL userinfo and page
limits outside the documented 1–10,000 range fail with `RpcConfigurationError`, so an unsafe or
rejected request is never sent.
