import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateRetry,
  isRetryableStatus,
  MalformedRpcResponseError,
  parseRetryAfter,
  RpcAbortError,
  RpcRequestError,
  RpcTimeoutError,
  StellarRpcEventSource,
} from '../src/index.js';

function response(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
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

test('honors Retry-After in decimal seconds bounded by configured cap', async () => {
  let attempts = 0;
  const sleeps: number[] = [];
  const fakeSleep = async (ms: number): Promise<void> => {
    sleeps.push(ms);
  };

  const source = new StellarRpcEventSource('https://rpc.invalid', {
    retry: {
      maxRetries: 2,
      maxRetryAfterMs: 5000,
      sleep: fakeSleep,
    },
    fetch: async () => {
      attempts += 1;
      if (attempts === 1) {
        return response('Rate limited', 429, { 'retry-after': '2' });
      }
      if (attempts === 2) {
        // Exceeds cap (10s > 5s cap)
        return response('Rate limited', 429, { 'retry-after': '10' });
      }
      return response({ result: { oldestLedger: 1, latestLedger: 3, ledgerRetentionWindow: 2 } });
    },
  });

  const health = await source.health();
  assert.equal(health.latestLedger, 3);
  assert.equal(attempts, 3);
  assert.deepEqual(sleeps, [2000, 5000]);
});

test('honors Retry-After in HTTP-date form with injectable clock bounded by cap', async () => {
  let attempts = 0;
  const sleeps: number[] = [];
  const fakeSleep = async (ms: number): Promise<void> => {
    sleeps.push(ms);
  };
  const fakeNow = Date.parse('2026-10-20T12:00:00Z');

  const source = new StellarRpcEventSource('https://rpc.invalid', {
    retry: {
      maxRetries: 2,
      maxRetryAfterMs: 15_000,
      sleep: fakeSleep,
      now: () => fakeNow,
    },
    fetch: async () => {
      attempts += 1;
      if (attempts === 1) {
        return response('Too Many Requests', 429, {
          'retry-after': 'Tue, 20 Oct 2026 12:00:06 GMT',
        });
      }
      if (attempts === 2) {
        // 20s ahead, capped by 15s cap
        return response('Too Many Requests', 429, {
          'retry-after': 'Tue, 20 Oct 2026 12:00:20 GMT',
        });
      }
      return response({ result: { oldestLedger: 1, latestLedger: 4, ledgerRetentionWindow: 2 } });
    },
  });

  const health = await source.health();
  assert.equal(health.latestLedger, 4);
  assert.equal(attempts, 3);
  assert.deepEqual(sleeps, [6000, 15_000]);
});

test('applies jitter strategies and bounds backoff to maxDelayMs', async () => {
  const sleeps: number[] = [];
  const fakeSleep = async (ms: number): Promise<void> => {
    sleeps.push(ms);
  };

  // Full jitter with injectable random returning 0.5
  let attempts = 0;
  const sourceFull = new StellarRpcEventSource('https://rpc.invalid', {
    retry: {
      maxRetries: 1,
      initialDelayMs: 400,
      jitter: 'full',
      random: () => 0.5,
      sleep: fakeSleep,
    },
    fetch: async () => {
      attempts += 1;
      if (attempts === 1) return response({ error: 'temp' }, 503);
      return response({ result: { oldestLedger: 1, latestLedger: 10, ledgerRetentionWindow: 1 } });
    },
  });
  await sourceFull.health();
  assert.deepEqual(sleeps, [200]); // 400 * 0.5 = 200

  // Equal jitter
  sleeps.length = 0;
  attempts = 0;
  const sourceEqual = new StellarRpcEventSource('https://rpc.invalid', {
    retry: {
      maxRetries: 1,
      initialDelayMs: 400,
      jitter: 'equal',
      random: () => 0.5,
      sleep: fakeSleep,
    },
    fetch: async () => {
      attempts += 1;
      if (attempts === 1) return response({ error: 'temp' }, 503);
      return response({ result: { oldestLedger: 1, latestLedger: 10, ledgerRetentionWindow: 1 } });
    },
  });
  await sourceEqual.health();
  // 400 / 2 + 0.5 * (400 / 2) = 200 + 100 = 300
  assert.deepEqual(sleeps, [300]);

  // Custom jitter function
  sleeps.length = 0;
  attempts = 0;
  const sourceCustom = new StellarRpcEventSource('https://rpc.invalid', {
    retry: {
      maxRetries: 1,
      initialDelayMs: 400,
      jitter: (delay, attempt) => delay + attempt * 10,
      sleep: fakeSleep,
    },
    fetch: async () => {
      attempts += 1;
      if (attempts === 1) return response({ error: 'temp' }, 503);
      return response({ result: { oldestLedger: 1, latestLedger: 10, ledgerRetentionWindow: 1 } });
    },
  });
  await sourceCustom.health();
  assert.deepEqual(sleeps, [400]);
});

test('request timeout has a typed diagnostic and retries up to maxRetries', async () => {
  const sleeps: number[] = [];
  const fakeSleep = async (ms: number): Promise<void> => {
    sleeps.push(ms);
  };
  let attempts = 0;

  const source = new StellarRpcEventSource('https://rpc.invalid', {
    retry: {
      maxRetries: 1,
      initialDelayMs: 150,
      timeoutMs: 50,
      sleep: fakeSleep,
    },
    fetch: async (_url, init) => {
      attempts += 1;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    },
  });

  await assert.rejects(
    source.health(),
    (error) =>
      error instanceof RpcTimeoutError &&
      error.code === 'RPC_TIMEOUT' &&
      error.details['timeoutMs'] === 50,
  );

  assert.equal(attempts, 2);
  // sleeps: attempt 0 timeout (50ms) -> retry backoff (150ms) -> attempt 1 timeout (50ms)
  assert.deepEqual(sleeps, [50, 150, 50]);
});

test('aborted requests have a typed diagnostic', async () => {
  const source = new StellarRpcEventSource('https://rpc.invalid', {
    retries: 2,
    fetch: async () => {
      throw new RpcAbortError('User canceled request');
    },
  });

  await assert.rejects(
    source.health(),
    (error) => error instanceof RpcAbortError && error.code === 'RPC_ABORTED',
  );
});

test('does not retry non-retryable JSON-RPC errors', async () => {
  let attempts = 0;
  const source = new StellarRpcEventSource('https://rpc.invalid', {
    retry: { maxRetries: 3 },
    fetch: async () => {
      attempts += 1;
      return response({ jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' } });
    },
  });

  await assert.rejects(
    source.health(),
    (error) => error instanceof RpcRequestError && !error.retryable,
  );
  assert.equal(attempts, 1);
});

test('does not retry 4xx HTTP client errors (except 408 and 429)', async () => {
  let attempts = 0;
  const source = new StellarRpcEventSource('https://rpc.invalid', {
    retry: { maxRetries: 3 },
    fetch: async () => {
      attempts += 1;
      return response('Bad Request', 400);
    },
  });

  await assert.rejects(
    source.health(),
    (error) =>
      error instanceof RpcRequestError && !error.retryable && error.details['status'] === 400,
  );
  assert.equal(attempts, 1);
});

test('pure policy evaluation distinguishes statuses, transport failures, and JSON-RPC errors', () => {
  assert.equal(isRetryableStatus(200), false);
  assert.equal(isRetryableStatus(400), false);
  assert.equal(isRetryableStatus(404), false);
  assert.equal(isRetryableStatus(408), true);
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(500), true);
  assert.equal(isRetryableStatus(503), true);

  assert.equal(parseRetryAfter('10'), 10_000);
  assert.equal(parseRetryAfter('invalid'), undefined);
  assert.equal(parseRetryAfter(null), undefined);
  assert.equal(
    parseRetryAfter('Tue, 20 Oct 2026 12:00:10 GMT', Date.parse('2026-10-20T12:00:00Z')),
    10_000,
  );

  const policy = {
    maxRetries: 2,
    initialDelayMs: 100,
    maxDelayMs: 1000,
    backoffFactor: 2,
    jitter: 'none' as const,
    maxRetryAfterMs: 5000,
  };

  // Max retries exceeded
  assert.deepEqual(evaluateRetry(policy, 2, new TypeError('Network down')), {
    retry: false,
    delayMs: 0,
    reason: 'max_retries_exceeded',
  });

  // Transport failure is retryable
  assert.deepEqual(evaluateRetry(policy, 0, new TypeError('Network down')), {
    retry: true,
    delayMs: 100,
    reason: 'exponential_backoff',
  });

  // Non-retryable JSON-RPC error
  assert.deepEqual(
    evaluateRetry(policy, 0, new RpcRequestError('RPC error', false, { rpcError: {} })),
    {
      retry: false,
      delayMs: 0,
      reason: 'non_retryable_error',
    },
  );

  // Retry-After header honored and capped
  assert.deepEqual(
    evaluateRetry(
      policy,
      0,
      new RpcRequestError('429', true, { status: 429, retryAfterHeader: '10' }),
    ),
    {
      retry: true,
      delayMs: 5000, // Capped to maxRetryAfterMs
      reason: 'retry_after',
    },
  );
});
