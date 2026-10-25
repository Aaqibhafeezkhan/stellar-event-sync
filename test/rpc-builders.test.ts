import assert from 'node:assert/strict';
import test from 'node:test';
import {
  eventFixture,
  healthFixture,
  pageFixture,
  positionFixture,
  rpcErrorFixture,
} from './fixtures/rpc-builders.js';

test('RPC fixture builders provide valid defaults', () => {
  assert.deepEqual(eventFixture(), {
    id: 'event-1',
    ledger: 2,
    ledgerClosedAt: '2026-01-01T00:00:00Z',
    topic: ['topic'],
    value: 'value',
    txHash: 'tx-hash',
    type: 'contract',
    raw: {},
  });
  assert.deepEqual(pageFixture(), { events: [], latestLedger: 2 });
  assert.deepEqual(healthFixture(), {
    oldestLedger: 1,
    latestLedger: 2,
    ledgerRetentionWindow: 2,
  });
  assert.deepEqual(rpcErrorFixture(), { code: -32603, message: 'Internal error' });
});

test('RPC fixture builders accept typed overrides without hiding asserted fields', () => {
  const event = eventFixture({ id: 'custom-event', ledger: 42, topic: ['custom-topic'] });
  assert.equal(event.id, 'custom-event');
  assert.equal(event.ledger, 42);
  assert.deepEqual(event.topic, ['custom-topic']);

  assert.deepEqual(pageFixture({ events: [event], latestLedger: 50, cursor: 'next' }), {
    events: [event],
    latestLedger: 50,
    cursor: 'next',
  });
  assert.deepEqual(
    healthFixture({ oldestLedger: 10, latestLedger: 50, ledgerRetentionWindow: 40 }),
    {
      oldestLedger: 10,
      latestLedger: 50,
      ledgerRetentionWindow: 40,
    },
  );
  assert.deepEqual(
    rpcErrorFixture({ code: -32000, message: 'Unavailable', data: { retry: true } }),
    {
      code: -32000,
      message: 'Unavailable',
      data: { retry: true },
    },
  );
});

test('position fixtures preserve bigint and string representations', () => {
  assert.equal(positionFixture(9007199254740993n), 9007199254740993n);
  assert.equal(positionFixture('9007199254740993'), '9007199254740993');
});
