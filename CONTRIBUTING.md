# Contributing

Thanks for helping improve Stellar Event Guard. Comment on an open issue before substantial work so
the maintainer can confirm scope and avoid duplicate effort.

## Clean setup

Install Node.js 22.5+ and Git, then run:

```bash
git clone https://github.com/Webghost01-NG/stellar-event-guard.git
cd stellar-event-guard
npm ci
npm run check
npm test
```

Create a focused branch and keep changes within the issue's stated boundaries. Add or update tests
for behavior changes. Never use real private keys, production credentials, or irreversible network
actions in tests.

## Pull-request review criteria

Reviewers check correctness against acceptance criteria, deterministic negative tests, checkpoint
compatibility, typed public APIs, clear diagnostics without sensitive payloads, documentation, and
scope discipline. CI must pass. A maintainer may request a smaller PR when unrelated refactors make
reliability behavior hard to audit.

## Maintainer workflow

The maintainer aims to acknowledge a new issue or PR within three working days, state whether it is
accepted or needs clarification, review small PRs within five working days, and explain requested
changes. These are service targets, not guarantees. Security reports use the private process in
SECURITY.md.

Releases follow Semantic Versioning. Until 1.0, minor releases may contain documented API changes.
Release notes must list behavior changes, migrations, and known limitations.
