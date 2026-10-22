import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIAGNOSTICS_EXIT_CODES,
  runDiagnostics,
  type CheckpointReader,
} from '../src/cli/diagnostics.js';
import { MalformedRpcResponseError, RpcRequestError } from '../src/errors.js';
import type { EventSource, RpcHealth } from '../src/types.js';
import { SECRET_REDACTION_CASES } from './fixtures/secret-redaction.js';

const health: RpcHealth = { oldestLedger: 100, latestLedger: 120, ledgerRetentionWindow: 21 };

class FakeSource implements EventSource {
  constructor(private readonly result: RpcHealth | Error) {}
  async health(): Promise<RpcHealth> {
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
  async fetch(): Promise<never> {
    throw new Error('not used');
  }
}

class FakeCheckpoints implements CheckpointReader {
  closed = false;
  constructor(private readonly value?: { nextLedger: number; cursor?: string }) {}
  checkpoint(): { nextLedger: number; cursor?: string } | undefined {
    return this.value;
  }
  close(): void {
    this.closed = true;
  }
}

function output() {
  return {
    stdout: '',
    stderr: '',
    writeStdout(value: string) {
      this.stdout += value;
    },
    writeStderr(value: string) {
      this.stderr += value;
    },
  };
}

test('diagnostics emits human output separately and redacts endpoint secrets', async () => {
  const streams = output();
  const checkpoints = new FakeCheckpoints({ nextLedger: 100, cursor: 'cursor-1' });
  const code = await runDiagnostics({
    rpcUrl: 'https://user:password@example.test/rpc?token=secret#fragment',
    source: 'fixture',
    eventSource: new FakeSource(health),
    checkpoints,
    json: false,
    stdout: { write: streams.writeStdout.bind(streams) },
    stderr: { write: streams.writeStderr.bind(streams) },
  });
  assert.equal(code, DIAGNOSTICS_EXIT_CODES.healthy);
  assert.match(streams.stdout, /https:\/\/example\.test\/rpc/);
  assert.doesNotMatch(streams.stdout, /password|secret|fragment/);
  assert.equal(streams.stderr, '');
  assert.equal(checkpoints.closed, true);
});

test('diagnostics reports incomplete history as versioned JSON', async () => {
  const streams = output();
  const code = await runDiagnostics({
    rpcUrl: 'https://example.test',
    source: 'fixture',
    eventSource: new FakeSource(health),
    checkpoints: new FakeCheckpoints({ nextLedger: 99 }),
    json: true,
    stdout: { write: streams.writeStdout.bind(streams) },
    stderr: { write: streams.writeStderr.bind(streams) },
  });
  assert.equal(code, DIAGNOSTICS_EXIT_CODES.incompleteHistory);
  assert.deepEqual(JSON.parse(streams.stdout), {
    version: 1,
    command: 'diagnostics',
    status: 'incomplete-history',
    endpoint: 'https://example.test/',
    source: 'fixture',
    health,
    checkpoint: { nextLedger: 99 },
  });
  assert.equal(streams.stderr, '');
});

test('diagnostics distinguishes malformed responses and network failures', async () => {
  for (const [error, code, status] of [
    [
      new MalformedRpcResponseError('bad response'),
      DIAGNOSTICS_EXIT_CODES.malformedResponse,
      'malformed-response',
    ],
    [
      new RpcRequestError('offline', false),
      DIAGNOSTICS_EXIT_CODES.networkFailure,
      'network-failure',
    ],
  ] as const) {
    const streams = output();
    const actual = await runDiagnostics({
      rpcUrl: 'https://example.test',
      source: 'fixture',
      eventSource: new FakeSource(error),
      checkpoints: new FakeCheckpoints(),
      json: true,
      stdout: { write: streams.writeStdout.bind(streams) },
      stderr: { write: streams.writeStderr.bind(streams) },
    });
    assert.equal(actual, code);
    assert.equal(JSON.parse(streams.stdout).status, status);
  }
});

test('redacts the shared synthetic secret corpus from JSON failure diagnostics', async () => {
  for (const fixture of SECRET_REDACTION_CASES) {
    const streams = output();
    const code = await runDiagnostics({
      rpcUrl:
        'https://sentinel-endpoint-user:sentinel-endpoint-password@rpc.example.test/rpc?api_key=sentinel-endpoint-key#sentinel-endpoint-fragment',
      source: 'fixture',
      eventSource: new FakeSource(new RpcRequestError(fixture.input, false)),
      checkpoints: new FakeCheckpoints(),
      json: true,
      stdout: { write: streams.writeStdout.bind(streams) },
      stderr: { write: streams.writeStderr.bind(streams) },
    });
    assert.equal(code, DIAGNOSTICS_EXIT_CODES.networkFailure, fixture.name);
    const serialized = streams.stdout;
    assert.equal(JSON.parse(serialized).endpoint, 'https://rpc.example.test/rpc');
    for (const sentinel of [
      ...fixture.sentinels,
      'sentinel-endpoint-user',
      'sentinel-endpoint-password',
      'sentinel-endpoint-key',
      'sentinel-endpoint-fragment',
    ]) {
      assert.ok(!serialized.includes(sentinel), `${fixture.name} leaked ${sentinel}`);
    }
    assert.equal(streams.stderr, '');
  }
});
