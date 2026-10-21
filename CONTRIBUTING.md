# Contributing

Thanks for helping improve Stellar Event Sync. Comment on an open issue before substantial work so
the maintainer can confirm scope and avoid duplicate effort.

## Clean setup

Install Node.js 22.5+ and Git, then run:

```bash
git clone https://github.com/Webghost01-NG/stellar-event-sync.git
cd stellar-event-sync
npm ci
npm run check
npm test
```

Create a focused branch and keep changes within the issue's stated boundaries. Add or update tests
for behavior changes. Never use real private keys, production credentials, or irreversible network
actions in tests.

## Choosing and claiming work

Start with the [good first issue](https://github.com/Webghost01-NG/stellar-event-sync/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
or [help wanted](https://github.com/Webghost01-NG/stellar-event-sync/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
queues. Read the dependencies and acceptance criteria, then leave a short comment describing your
approach. Wait for assignment before investing substantial time. Issues are normally held for seven
days after assignment; post an update if you need longer. No private credentials or prior Stellar
contributions are required unless an issue explicitly says otherwise.

Good parallel starting points are documentation and examples, deterministic test fixtures, website
accessibility, and isolated RPC validation. Avoid combining these workstreams in one pull request.

## Pull-request checklist

- Link the issue and explain the behavior before and after the change.
- Keep the diff within the agreed scope; call out any intentional compatibility change.
- Add deterministic tests for new behavior and negative paths.
- Run `npm run check`, `npm test`, `npm run build:site`, and `npm run check:site`.
- Update public documentation when APIs, errors, configuration, or guarantees change.
- Include screenshots at desktop and 390px for visible website changes.
- Confirm that logs, fixtures, and screenshots contain no secrets or private endpoints.
- Run the diagnostics CLI to confirm it works after your changes: `npm run example` or `npx tsx scripts/diagnostics.ts --help`

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

## Contributor FAQ

**Can I open a pull request without assignment?** Small typo fixes are welcome, but comment first
for behavioral work so two contributors do not solve the same problem.

**Do I need a live Stellar contract?** No. Most work uses deterministic fixtures. Issues requiring
public Testnet verification must document the endpoint and keep network assertions separate from the
deterministic suite.

**Why was my feature request marked `needs-design`?** Storage and recovery changes can alter the
toolkit's reliability contract. Those issues need an agreed design before implementation.

**How is credit recorded?** GitHub preserves commits, pull requests, reviews, and release notes. The
project does not promise payments, program eligibility, or rewards for contributions.
