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

export type SyncState = 'complete' | 'incomplete-history';

export interface SyncResult {
  source: string;
  state: SyncState;
  pages: number;
  received: number;
  inserted: number;
  duplicates: number;
  checkpointCursor?: string;
  nextLedger: number;
}
