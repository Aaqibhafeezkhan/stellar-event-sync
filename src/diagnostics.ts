import { redactSecrets } from './redaction.js';
import type { IncompleteHistoryError } from './errors.js';
import type { SyncResult } from './types.js';

export const SYNC_RESULT_FORMAT_VERSION = 1 as const;
export const INCOMPLETE_HISTORY_FORMAT_VERSION = 1 as const;

export interface IncompleteHistoryDiagnostic {
  formatVersion: typeof INCOMPLETE_HISTORY_FORMAT_VERSION;
  code: 'INCOMPLETE_HISTORY';
  state: 'incomplete-history';
  history: {
    requestedLedger: number | string;
    oldestAvailableLedger: number | string;
  };
  recovery: {
    automatic: false;
    operatorActionRequired: true;
  };
}

export interface SyncResultDiagnostic {
  formatVersion: typeof SYNC_RESULT_FORMAT_VERSION;
  source: string;
  state: SyncResult['state'];
  pageLimit?: number | string;
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
    source: redactSecrets(result.source),
    state: result.state,
    ...(result.state === 'incomplete-page-limit'
      ? { pageLimit: jsonInteger(result.pageLimit) }
      : {}),
    pages: jsonInteger(result.pages),
    events: {
      received: jsonInteger(result.received),
      inserted: jsonInteger(result.inserted),
      duplicates: jsonInteger(result.duplicates),
    },
    checkpoint: {
      cursor: result.checkpointCursor === undefined ? null : redactSecrets(result.checkpointCursor),
      nextLedger: jsonInteger(result.nextLedger),
    },
  };

  return JSON.stringify(diagnostic);
}

/** Serialize a retention gap without exposing generic error details or selecting a recovery strategy. */
export function formatIncompleteHistoryJson(error: IncompleteHistoryError): string {
  const diagnostic: IncompleteHistoryDiagnostic = {
    formatVersion: INCOMPLETE_HISTORY_FORMAT_VERSION,
    code: 'INCOMPLETE_HISTORY',
    state: 'incomplete-history',
    history: {
      requestedLedger: jsonInteger(error.requestedLedger),
      oldestAvailableLedger: jsonInteger(error.oldestAvailableLedger),
    },
    recovery: {
      automatic: false,
      operatorActionRequired: true,
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
