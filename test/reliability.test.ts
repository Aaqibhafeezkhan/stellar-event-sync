import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  IncompleteHistoryError,
  RpcConfigurationError,
  SqliteEventStore,
  synchronize,
  type EventPage,
  type EventSource,
  type FetchRequest,
  type RpcHealth,
  type StellarEvent,
} from '../src/index.js';

const event = (id: string, ledger: number): StellarEvent => ({
  id,
  ledger,
  ledgerClosedAt: '2026-01-01T00:00:00Z',
  topic: ['AAAA'],
  value: 'BBBB',
  txHash: `tx-${id}`,
  type: 'contract',
  raw: { id, ledger },
});

class FixtureSource implements EventSource {
  calls: FetchRequest[] = [];
  healthCalls = 0;
  constructor(
    private readonly pages: EventPage[],
    private readonly healthResult: RpcHealth = {
      oldestLedger: 100,
      latestLedger: 110,
      ledgerRetentionWindow: 11,
    },
  ) {}
  async health(): Promise<RpcHealth> {
    this.healthCalls += 1;
    return this.healthResult;
  }
  async fetch(request: FetchRequest): Promise<EventPage> {
    this.calls.push(request);
    const page = this.pages.shift();
    if (!page) throw new Error('fixture exhausted');
    return page;
  }
}

function store(): SqliteEventStore {
  return new SqliteEventStore(join(mkdtempSync(join(tmpdir(), 'event-sync-')), 'events.sqlite'));
}

test('KT-01: duplicate delivery persists each event once', async () => {
  const database = store();
  const source = new FixtureSource([
    { events: [event('a', 100), event('a', 100)], cursor: 'page-1', latestLedger: 101 },
    { events: [event('a', 100), event('b', 101)], latestLedger: 101 },
  ]);
  const result = await synchronize(source, database, { source: 'fixture', startLedger: 100 });
  assert.equal(database.countEvents(), 2);
  assert.deepEqual(
    { inserted: result.inserted, duplicates: result.duplicates },
    { inserted: 2, duplicates: 2 },
  );
  database.close();
});

test('KT-02: interrupted page transaction rolls back events and checkpoint, then restarts', async () => {
  const database = store();
  const first = new FixtureSource([
    { events: [event('a', 100)], cursor: 'page-1', latestLedger: 101 },
  ]);
  await assert.rejects(
    synchronize(first, database, {
      source: 'fixture',
      startLedger: 100,
      beforeCheckpoint: () => {
        throw new Error('simulated crash');
      },
    }),
    /simulated crash/,
  );
  assert.equal(database.countEvents(), 0);
  assert.equal(database.checkpoint('fixture'), undefined);

  const restarted = new FixtureSource([{ events: [event('a', 100)], latestLedger: 100 }]);
  const result = await synchronize(restarted, database, { source: 'fixture', startLedger: 100 });
  assert.equal(result.inserted, 1);
  assert.equal(database.countEvents(), 1);
  database.close();
});

test('KT-03: expired retention window is explicit and no request is made', async () => {
  const database = store();
  const source = new FixtureSource([], {
    oldestLedger: 200,
    latestLedger: 300,
    ledgerRetentionWindow: 101,
  });
  await assert.rejects(
    synchronize(source, database, { source: 'fixture', startLedger: 199 }),
    (error) => error instanceof IncompleteHistoryError && error.code === 'INCOMPLETE_HISTORY',
  );
  assert.equal(source.calls.length, 0);
  database.close();
});

test('KT-04: cursor is committed page-by-page and used after restart', async () => {
  const database = store();
  const first = new FixtureSource([
    { events: [event('a', 100)], cursor: 'page-1', latestLedger: 102 },
  ]);
  await synchronize(first, database, { source: 'fixture', startLedger: 100, maxPages: 1 });
  assert.deepEqual(database.checkpoint('fixture'), { cursor: 'page-1', nextLedger: 101 });

  const restarted = new FixtureSource([{ events: [event('b', 101)], latestLedger: 102 }]);
  await synchronize(restarted, database, { source: 'fixture', startLedger: 100 });
  assert.deepEqual(restarted.calls[0], { cursor: 'page-1', limit: 100 });
  assert.equal(database.countEvents(), 2);
  database.close();
});

test('KT-05: invalid page size fails before health or fetch and boundaries serialize', async () => {
  const database = store();
  for (const pageSize of [0, -1, 1.5, 10_001, Number.NaN]) {
    const source = new FixtureSource([]);
    await assert.rejects(
      synchronize(source, database, { source: 'fixture', startLedger: 100, pageSize }),
      (error) =>
        error instanceof RpcConfigurationError &&
        error.code === 'RPC_CONFIGURATION_INVALID' &&
        error.details['field'] === 'pageSize',
      `pageSize ${pageSize}`,
    );
    assert.equal(source.healthCalls, 0, `health calls for pageSize ${pageSize}`);
    assert.equal(source.calls.length, 0, `fetch calls for pageSize ${pageSize}`);
  }

  for (const [sourceName, pageSize, expected] of [
    ['minimum', 1, 1],
    ['maximum', 10_000, 10_000],
  ] as const) {
    const source = new FixtureSource([
      { events: [event(`event-${expected}`, 100)], latestLedger: 100 },
    ]);
    const result = await synchronize(source, database, {
      source: sourceName,
      startLedger: 100,
      pageSize,
    });
    assert.equal(result.pages, 1, sourceName);
    assert.deepEqual(source.calls[0], { startLedger: 100, limit: expected }, sourceName);
  }
  database.close();
});

test('one terminal page completes at a one-page limit', async () => {
  const database = store();
  const source = new FixtureSource([{ events: [event('a', 100)], latestLedger: 100 }]);

  const result = await synchronize(source, database, {
    source: 'fixture',
    startLedger: 100,
    maxPages: 1,
  });

  assert.equal(result.state, 'complete');
  assert.equal(result.pages, 1);
  assert.equal(source.calls.length, 1);
  database.close();
});

test('completion on the final allowed page is not reported as limited', async () => {
  const database = store();
  const source = new FixtureSource([
    { events: [event('a', 100)], cursor: 'page-1', latestLedger: 101 },
    { events: [event('b', 101)], latestLedger: 101 },
  ]);

  const result = await synchronize(source, database, {
    source: 'fixture',
    startLedger: 100,
    maxPages: 2,
  });

  assert.equal(result.state, 'complete');
  assert.equal(result.pages, 2);
  assert.equal(source.calls.length, 2);
  database.close();
});

test('page limit returns incomplete state without requesting page N+1 and restart resumes', async () => {
  const database = store();
  const source = new FixtureSource([
    { events: [event('a', 100)], cursor: 'page-1', latestLedger: 102 },
    { events: [event('b', 101)], cursor: 'page-2', latestLedger: 102 },
    { events: [event('c', 102)], latestLedger: 102 },
  ]);

  const result = await synchronize(source, database, {
    source: 'fixture',
    startLedger: 100,
    maxPages: 2,
  });

  assert.deepEqual(result, {
    source: 'fixture',
    state: 'incomplete-page-limit',
    pageLimit: 2,
    pages: 2,
    received: 2,
    inserted: 2,
    duplicates: 0,
    nextLedger: 102,
    checkpointCursor: 'page-2',
  });
  assert.equal(source.calls.length, 2);
  assert.deepEqual(database.checkpoint('fixture'), { cursor: 'page-2', nextLedger: 102 });

  const restarted = new FixtureSource([{ events: [event('c', 102)], latestLedger: 102 }]);
  const restartedResult = await synchronize(restarted, database, {
    source: 'fixture',
    startLedger: 100,
  });
  assert.equal(restartedResult.state, 'complete');
  assert.deepEqual(restarted.calls[0], { cursor: 'page-2', limit: 100 });
  assert.equal(database.countEvents(), 3);
  database.close();
});

test('invalid maximum pages fails before health or fetch', async () => {
  const database = store();
  for (const maxPages of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const source = new FixtureSource([]);
    await assert.rejects(
      synchronize(source, database, { source: 'fixture', startLedger: 100, maxPages }),
      (error) =>
        error instanceof RpcConfigurationError &&
        error.code === 'RPC_CONFIGURATION_INVALID' &&
        error.details['field'] === 'maxPages',
      `maxPages ${maxPages}`,
    );
    assert.equal(source.healthCalls, 0, `health calls for maxPages ${maxPages}`);
    assert.equal(source.calls.length, 0, `fetch calls for maxPages ${maxPages}`);
  }
  database.close();
});
