import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSyncResultJson } from '../src/diagnostics.js';
import type { SyncResult } from '../src/types.js';
import { redactSecrets } from '../src/redaction.js';
import { SECRET_REDACTION_CASES } from './fixtures/secret-redaction.js';

const result: SyncResult = {
  source: 'stellar-testnet',
  state: 'complete',
  pages: 2,
  received: 7,
  inserted: 5,
  duplicates: 2,
  checkpointCursor: 'cursor-2',
  nextLedger: 12345,
};

test('formats the versioned sync diagnostic envelope', () => {
  assert.equal(
    formatSyncResultJson(result),
    '{"formatVersion":1,"source":"stellar-testnet","state":"complete","pages":2,"events":{"received":7,"inserted":5,"duplicates":2},"checkpoint":{"cursor":"cursor-2","nextLedger":12345}}',
  );
});

test('serializes page-limit incompleteness and its configured limit', () => {
  const limitedResult: SyncResult = {
    ...result,
    state: 'incomplete-page-limit',
    pageLimit: 2,
    checkpointCursor: 'cursor-2',
  };

  assert.deepEqual(JSON.parse(formatSyncResultJson(limitedResult)), {
    formatVersion: 1,
    source: 'stellar-testnet',
    state: 'incomplete-page-limit',
    pageLimit: 2,
    pages: 2,
    events: { received: 7, inserted: 5, duplicates: 2 },
    checkpoint: { cursor: 'cursor-2', nextLedger: 12345 },
  });
});

test('does not serialize raw events or secret-bearing fields', () => {
  const resultWithRawEvent = {
    ...result,
    raw: { event: 'do-not-emit', secret: 'do-not-emit' },
    events: [{ raw: { secret: 'do-not-emit' } }],
    secret: 'do-not-emit',
  } as SyncResult & { events: unknown[]; raw: unknown; secret: string };

  const output = formatSyncResultJson(resultWithRawEvent);
  assert.doesNotMatch(output, /do-not-emit/);
  assert.deepEqual(Object.keys(JSON.parse(output)), [
    'formatVersion',
    'source',
    'state',
    'pages',
    'events',
    'checkpoint',
  ]);
});

test('encodes bigint counters and positions as decimal JSON strings', () => {
  const resultWithBigInt = {
    ...result,
    pages: 2n,
    received: 7n,
    inserted: 5n,
    duplicates: 2n,
    nextLedger: 12345n,
  } as unknown as SyncResult;

  assert.deepEqual(JSON.parse(formatSyncResultJson(resultWithBigInt)), {
    formatVersion: 1,
    source: 'stellar-testnet',
    state: 'complete',
    pages: '2',
    events: { received: '7', inserted: '5', duplicates: '2' },
    checkpoint: { cursor: 'cursor-2', nextLedger: '12345' },
  });
});

test('rejects unsafe numeric counters instead of rounding them', () => {
  assert.throws(
    () => formatSyncResultJson({ ...result, nextLedger: Number.MAX_SAFE_INTEGER + 1 }),
    /safe integers/,
  );
});

test('redacts the shared synthetic secret corpus', () => {
  for (const fixture of SECRET_REDACTION_CASES) {
    const output = redactSecrets(fixture.input);
    assert.equal(output, fixture.expected, fixture.name);
    for (const sentinel of fixture.sentinels) {
      assert.ok(!output.includes(sentinel), `${fixture.name} leaked ${sentinel}`);
    }
  }
});

test('redacts secrets in versioned JSON diagnostic source and cursor fields', () => {
  const output = JSON.parse(
    formatSyncResultJson({
      ...result,
      source: 'source?api_key=sentinel-json-source-key',
      checkpointCursor: 'Bearer sentinel-json-cursor-token',
    }),
  ) as { source: string; checkpoint: { cursor: string | null } };

  assert.equal(output.source, 'source?api_key=[REDACTED]');
  assert.equal(output.checkpoint.cursor, 'Bearer [REDACTED]');
  assert.doesNotMatch(
    JSON.stringify(output),
    /sentinel-json-source-key|sentinel-json-cursor-token/,
  );
});
