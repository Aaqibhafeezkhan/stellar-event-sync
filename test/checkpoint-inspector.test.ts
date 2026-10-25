import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  CheckpointInspectionError,
  SqliteCheckpointInspector,
  SqliteEventStore,
} from '../src/index.js';

function temporaryPath(name = 'events.sqlite'): string {
  return join(mkdtempSync(join(tmpdir(), 'checkpoint-inspection-')), name);
}

test('inspects an existing checkpoint as immutable metadata', () => {
  const path = temporaryPath();
  const store = new SqliteEventStore(path);
  store.commitPage('fixture', [], { cursor: 'page-1', nextLedger: 101 });
  store.close();

  const inspector = new SqliteCheckpointInspector(path);
  const checkpoint = inspector.inspect('fixture');
  assert.deepEqual(checkpoint, {
    schemaVersion: 1,
    source: 'fixture',
    cursor: 'page-1',
    nextLedger: 101,
    updatedAt: checkpoint?.updatedAt,
  });
  assert.equal(Object.isFrozen(checkpoint), true);
  assert.match(checkpoint?.updatedAt ?? '', /^\d{4}-\d{2}-\d{2} /);
  inspector.close();
});

test('returns undefined for an absent checkpoint without mutating the store', () => {
  const path = temporaryPath();
  const store = new SqliteEventStore(path);
  store.close();

  const inspector = new SqliteCheckpointInspector(path);
  assert.equal(inspector.inspect('missing'), undefined);
  inspector.close();

  const reopened = new SqliteEventStore(path);
  assert.equal(reopened.checkpoint('missing'), undefined);
  assert.equal(reopened.countEvents(), 0);
  reopened.close();
});

test('does not create a missing database during inspection', () => {
  const path = temporaryPath('missing.sqlite');
  assert.equal(existsSync(path), false);
  assert.throws(
    () => new SqliteCheckpointInspector(path),
    (error) =>
      error instanceof CheckpointInspectionError && error.code === 'CHECKPOINT_INSPECTION_FAILED',
  );
  assert.equal(existsSync(path), false);
});

test('rejects malformed checkpoint schemas with a typed error', () => {
  const path = temporaryPath();
  writeFileSync(path, 'not a sqlite database');
  assert.throws(
    () => new SqliteCheckpointInspector(path),
    (error) =>
      error instanceof CheckpointInspectionError && error.code === 'CHECKPOINT_INSPECTION_FAILED',
  );
});

test('rejects a store with no read permission before opening it', () => {
  const path = temporaryPath();
  const store = new SqliteEventStore(path);
  store.close();
  chmodSync(path, 0o000);
  try {
    assert.throws(
      () => new SqliteCheckpointInspector(path),
      (error) =>
        error instanceof CheckpointInspectionError && error.code === 'CHECKPOINT_INSPECTION_FAILED',
    );
  } finally {
    chmodSync(path, 0o600);
  }
});
