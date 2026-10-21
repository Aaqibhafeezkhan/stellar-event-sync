import { IncompleteHistoryError, RpcConfigurationError } from './errors.js';
import { validatePageLimit } from './rpc.js';
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

export const DEFAULT_MAX_PAGES = 1_000;

function validateMaxPages(value: number | undefined): number {
  if (value === undefined) return DEFAULT_MAX_PAGES;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RpcConfigurationError('maxPages must be a positive safe integer', {
      field: 'maxPages',
      min: 1,
    });
  }
  return value;
}

export async function synchronize(
  rpc: EventSource,
  store: SqliteEventStore,
  options: SyncOptions,
): Promise<SyncResult> {
  const pageSize = validatePageLimit(options.pageSize, 'pageSize');
  const maxPages = validateMaxPages(options.maxPages);
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

  while (pages < maxPages) {
    const page = await rpc.fetch(
      cursor === undefined
        ? {
            startLedger: next,
            limit: pageSize,
            ...(options.contractId === undefined ? {} : { contractId: options.contractId }),
          }
        : { cursor, limit: pageSize },
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

  const result = {
    source: options.source,
    pages,
    received,
    inserted,
    duplicates,
    nextLedger: next,
  };
  if (cursor !== undefined) {
    return {
      ...result,
      state: 'incomplete-page-limit',
      pageLimit: maxPages,
      checkpointCursor: cursor,
    };
  }
  return { ...result, state: 'complete' };
}
