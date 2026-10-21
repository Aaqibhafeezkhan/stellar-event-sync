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

test('retains a numeric RPC code and sanitized message without retrying', async () => {
  const source = new StellarRpcEventSource('https://rpc.invalid', {
    retries: 3,
    retryDelayMs: 0,
    fetch: async () =>
      response({ error: { code: -32602, message: 'invalid params\nfor request' } }),
  });
  await assert.rejects(
    source.health(),
    (error) =>
      error instanceof RpcRequestError &&
      error.code === 'RPC_REQUEST_FAILED' &&
      error.rpcCode === -32602 &&
      error.rpcMessage === 'invalid params for request' &&
      error.message === error.rpcMessage &&
      !error.retryable,
  );
});

test('bounds oversized RPC messages', async () => {
  const source = new StellarRpcEventSource('https://rpc.invalid', {
    retries: 0,
    fetch: async () => response({ error: { code: 1, message: 'x'.repeat(1000) } }),
  });
  await assert.rejects(
    source.health(),
    (error) => error instanceof RpcRequestError && error.rpcMessage?.length === 256,
  );
});

test('does not expose malformed or credential-like error data', async () => {
  const fixtures = [
    { error: 'malformed error' },
    { error: { code: 'not numeric', data: { password: 'super-secret' } } },
    { error: { message: 'authorization=top-secret bearer abc123' } },
  ];
  for (const fixture of fixtures) {
    const source = new StellarRpcEventSource('https://rpc.invalid', {
      retries: 0,
      fetch: async () => response(fixture),
    });
    await assert.rejects(
      source.health(),
      (error) =>
        error instanceof RpcRequestError &&
        error.rpcCode === undefined &&
        !error.message.includes('super-secret') &&
        !error.message.includes('top-secret') &&
        !error.message.includes('abc123'),
    );
  }
});
