import assert from 'node:assert/strict';
import test from 'node:test';
import { MalformedRpcResponseError, RpcRequestError, StellarRpcEventSource } from '../src/index.js';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

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

test('rejects malformed event responses', async () => {
  const source = new StellarRpcEventSource('https://rpc.invalid', {
    retries: 0,
    fetch: async () => response({ result: { latestLedger: 2, events: [{ id: 'bad' }] } }),
  });
  await assert.rejects(
    source.fetch({ startLedger: 1 }),
    (error) => error instanceof MalformedRpcResponseError,
  );
});

test('retains numeric RPC code and sanitizes error message', async () => {
  const source = new StellarRpcEventSource('https://rpc.invalid', {
    retries: 0,
    fetch: async () => response({ error: { code: -32603, message: 'Internal error with token=secret123' } }),
  });
  await assert.rejects(
    source.health(),
    (error) => {
      if (!(error instanceof RpcRequestError)) return false;
      assert.equal(error.rpcCode, -32603);
      assert.equal(error.message, 'Internal error with token=[REDACTED]');
      return true;
    },
  );
});

test('bounds oversized error messages', async () => {
  const longMsg = 'a'.repeat(300);
  const source = new StellarRpcEventSource('https://rpc.invalid', {
    retries: 0,
    fetch: async () => response({ error: { code: -32000, message: longMsg } }),
  });
  await assert.rejects(
    source.health(),
    (error) => {
      if (!(error instanceof RpcRequestError)) return false;
      assert.equal(error.rpcCode, -32000);
      assert.equal(error.message.length <= 200, true);
      assert.equal(error.message.endsWith('...'), true);
      return true;
    },
  );
});

test('handles malformed error objects and non-string error messages', async () => {
  const source = new StellarRpcEventSource('https://rpc.invalid', {
    retries: 0,
    fetch: async () => response({ error: 12345 }),
  });
  await assert.rejects(
    source.health(),
    (error) => {
      if (!(error instanceof RpcRequestError)) return false;
      assert.equal(error.rpcCode, undefined);
      assert.equal(error.message, '12345');
      return true;
    },
  );
});
