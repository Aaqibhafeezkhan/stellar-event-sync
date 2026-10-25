export interface StellarEvent {
  id: string;
  ledger: number;
  ledgerClosedAt: string;
  contractId?: string;
  topic: readonly string[];
  value: string;
  txHash: string;
  type: 'contract' | 'system';
  raw: Readonly<Record<string, unknown>>;
}

export interface RpcHealth {
  oldestLedger: number;
  latestLedger: number;
  ledgerRetentionWindow: number;
}

export interface FetchRequest {
  startLedger?: number;
  cursor?: string;
  limit?: number;
  contractId?: string;
}

export interface EventPage {
  events: readonly StellarEvent[];
  cursor?: string;
  latestLedger: number;
}

export interface EventSource {
  health(): Promise<RpcHealth>;
  fetch(request: FetchRequest): Promise<EventPage>;
}

/** Immutable metadata returned by the read-only checkpoint inspector. */
export interface CheckpointInspection {
  readonly schemaVersion: 1;
  readonly source: string;
  readonly cursor?: string;
  readonly nextLedger: number;
  readonly updatedAt: string;
}

export type SyncState = 'complete' | 'incomplete-history' | 'incomplete-page-limit';

interface SyncResultBase {
  source: string;
  pages: number;
  received: number;
  inserted: number;
  duplicates: number;
  checkpointCursor?: string;
  nextLedger: number;
}

export interface CompleteSyncResult extends SyncResultBase {
  state: 'complete';
}

/** Reserved for diagnostics that represent a retention gap rather than a successful run. */
export interface IncompleteHistorySyncResult extends SyncResultBase {
  state: 'incomplete-history';
}

export interface PageLimitSyncResult extends SyncResultBase {
  state: 'incomplete-page-limit';
  pageLimit: number;
  checkpointCursor: string;
}

export type SyncResult = CompleteSyncResult | IncompleteHistorySyncResult | PageLimitSyncResult;
