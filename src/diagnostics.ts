import type { SyncResult } from './types.js';

export const SYNC_RESULT_FORMAT_VERSION = 1 as const;

export interface SyncResultDiagnostic {
  formatVersion: typeof SYNC_RESULT_FORMAT_VERSION;
  source: string;
  state: SyncResult['state'];
  pages: number | string;
  events: {
    received: number | string;
    inserted: number | string;
    duplicates: number | string;
  };
  checkpoint: {
    cursor: string | null;
    nextLedger: number | string;
  };
}

/** Serialize the documented, non-event portion of a sync result. */
export function formatSyncResultJson(result: SyncResult): string {
  const diagnostic: SyncResultDiagnostic = {
    formatVersion: SYNC_RESULT_FORMAT_VERSION,
    source: result.source,
    state: result.state,
    pages: jsonInteger(result.pages),
    events: {
      received: jsonInteger(result.received),
      inserted: jsonInteger(result.inserted),
      duplicates: jsonInteger(result.duplicates),
    },
    checkpoint: {
      cursor: result.checkpointCursor ?? null,
      nextLedger: jsonInteger(result.nextLedger),
    },
  };

  return JSON.stringify(diagnostic);
}

function jsonInteger(value: number | bigint): number | string {
  if (typeof value === 'bigint') return value.toString(10);
  if (!Number.isSafeInteger(value)) {
    throw new TypeError('Sync result integers must be safe integers');
  }
  return value;
}
