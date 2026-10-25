import type { EventPage, RpcHealth, StellarEvent } from '../../src/types.js';

export function eventFixture(overrides: Partial<StellarEvent> = {}): StellarEvent {
  return {
    id: 'event-1',
    ledger: 2,
    ledgerClosedAt: '2026-01-01T00:00:00Z',
    topic: ['topic'],
    value: 'value',
    txHash: 'tx-hash',
    type: 'contract',
    raw: {},
    ...overrides,
  };
}

export function pageFixture(overrides: Partial<EventPage> = {}): EventPage {
  return {
    events: [],
    latestLedger: 2,
    ...overrides,
  };
}

export function healthFixture(overrides: Partial<RpcHealth> = {}): RpcHealth {
  return {
    oldestLedger: 1,
    latestLedger: 2,
    ledgerRetentionWindow: 2,
    ...overrides,
  };
}

export interface RpcErrorFixture {
  code: number;
  message: string;
  data?: unknown;
}

export function rpcErrorFixture(overrides: Partial<RpcErrorFixture> = {}): RpcErrorFixture {
  return {
    code: -32603,
    message: 'Internal error',
    ...overrides,
  };
}

export function positionFixture(position: number | string | bigint): number | string | bigint {
  return position;
}
