import { IncompleteHistoryError } from './errors.js';
import { SqliteEventStore } from './store.js';
import type { EventSource, SyncResult } from './types.js';

export interface SyncOptions {
  source: string;
  startLedger: number;
  pageSize?: number;
  maxPages?: number;
  contractId?: string;
  beforeCheckpoint?: (page: number) => void;
}

export async function synchronize(
  rpc: EventSource,
  store: SqliteEventStore,
  options: SyncOptions,
): Promise<SyncResult> {
  const health = await rpc.health();
  const saved = store.checkpoint(options.source);
  const nextLedger = saved?.nextLedger ?? options.startLedger;
  if (nextLedger < health.oldestLedger) {
    throw new IncompleteHistoryError(nextLedger, health.oldestLedger);
  }
  let cursor = saved?.cursor;
  let pages = 0;
  let received = 0;
  let inserted = 0;
  let duplicates = 0;
  let next = nextLedger;

  while (pages < (options.maxPages ?? 1_000)) {
    const page = await rpc.fetch(
      cursor === undefined
        ? {
            startLedger: next,
            limit: options.pageSize ?? 100,
            ...(options.contractId === undefined ? {} : { contractId: options.contractId }),
          }
        : { cursor, limit: options.pageSize ?? 100 },
    );
    pages += 1;
    received += page.events.length;
    const lastLedger = page.events.at(-1)?.ledger;
    if (lastLedger !== undefined) next = lastLedger + 1;
    const advanced = page.cursor !== undefined && page.cursor !== cursor;
    const newCursor = advanced ? page.cursor : undefined;
    if (!advanced) next = Math.max(next, page.latestLedger + 1);
    const committed = store.commitPage(
      options.source,
      page.events,
      newCursor === undefined ? { nextLedger: next } : { cursor: newCursor, nextLedger: next },
      options.beforeCheckpoint ? () => options.beforeCheckpoint?.(pages) : undefined,
    );
    inserted += committed.inserted;
    duplicates += committed.duplicates;
    cursor = newCursor;
    if (!advanced) break;
  }

  const result: SyncResult = {
    source: options.source,
    state: 'complete',
    pages,
    received,
    inserted,
    duplicates,
    nextLedger: next,
  };
  return cursor === undefined ? result : { ...result, checkpointCursor: cursor };
}
