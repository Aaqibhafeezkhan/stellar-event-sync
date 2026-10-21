import assert from 'node:assert/strict';
import test from 'node:test';
import { MalformedRpcResponseError, StellarRpcEventSource } from '../src/index.js';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const validEvent = {
  id: 'event-1',
  ledger: 2,
  ledgerClosedAt: '2026-01-01T00:00:00Z',
  topic: ['topic'],
  value: 'value',
  txHash: 'tx-hash',
  type: 'contract',
};

test('retries a transient HTTP failure without changing the request', async () => {
  const bodies: string[] = [];
  let attempts = 0;
  const source = new StellarRpcEventSource('https://rpc.invalid', {
    retries: 1,
    retryDelayMs: 0,
    fetch: async (_url, init) => {
      bodies.push(String(init?.body));
      attempts += 1;
      return attempts === 1
        ? response({ error: 'temporary' }, 503)
        : response({ result: { oldestLedger: 1, latestLedger: 2, ledgerRetentionWindow: 2 } });
    },
  });
  assert.equal((await source.health()).latestLedger, 2);
  assert.equal(attempts, 2);
  const first = JSON.parse(bodies[0] ?? '{}') as { method?: string };
  const second = JSON.parse(bodies[1] ?? '{}') as { method?: string };
  assert.equal(first.method, second.method);
});

test('rejects malformed RPC response shapes without echoing payloads', async () => {
  const payloadMarker = 'fixture-payload-must-not-be-echoed';
  const fixtures: Array<{ name: string; body: unknown; message: string }> = [
    { name: 'null body', body: null, message: 'RPC body is not an object' },
    { name: 'array body', body: [], message: 'RPC body is not an object' },
    { name: 'missing result', body: { jsonrpc: '2.0' }, message: 'RPC body has no result' },
    {
      name: 'non-object result',
      body: { result: payloadMarker },
      message: 'getEvents result has no events array',
    },
    {
      name: 'missing events array',
      body: { result: { latestLedger: 2, cursor: payloadMarker } },
      message: 'getEvents result has no events array',
    },
    {
      name: 'missing page ledger metadata',
      body: { result: { events: [validEvent], cursor: payloadMarker } },
      message: 'latestLedger must be an integer',
    },
    {
      name: 'unsafe page ledger',
      body: { result: { latestLedger: Number.MAX_SAFE_INTEGER + 1, events: [] } },
      message: 'latestLedger must be an integer',
    },
    {
      name: 'wrong topic type',
      body: {
        result: {
          latestLedger: 2,
          events: [{ ...validEvent, topic: { payloadMarker } }],
        },
      },
      message: 'Event topic is invalid',
    },
    {
      name: 'wrong value type',
      body: {
        result: {
          latestLedger: 2,
          events: [{ ...validEvent, value: { payloadMarker } }],
        },
      },
      message: 'value must be a string',
    },
    {
      name: 'invalid event type',
      body: {
        result: {
          latestLedger: 2,
          events: [{ ...validEvent, type: 'unsupported' }],
        },
      },
      message: 'Event type is invalid',
    },
  ];

  for (const fixture of fixtures) {
    const source = new StellarRpcEventSource('https://rpc.invalid', {
      retries: 0,
      fetch: async () => response(fixture.body),
    });

    await assert.rejects(source.fetch({ startLedger: 1 }), (error) => {
      assert.ok(error instanceof MalformedRpcResponseError, fixture.name);
      assert.equal(error.code, 'MALFORMED_RPC_RESPONSE', fixture.name);
      assert.match(error.message, new RegExp(fixture.message), fixture.name);
      assert.doesNotMatch(error.message, new RegExp(payloadMarker), fixture.name);
      return true;
    });
  }
});
