import { MalformedRpcResponseError, RpcRequestError } from './errors.js';
import type { EventPage, EventSource, FetchRequest, RpcHealth, StellarEvent } from './types.js';

interface RpcClientOptions {
  retries?: number;
  retryDelayMs?: number;
  fetch?: typeof fetch;
}

export class StellarRpcEventSource implements EventSource {
  private readonly requestFetch: typeof fetch;
  private readonly retries: number;
  private readonly retryDelayMs: number;
  private requestId = 0;

  constructor(
    private readonly rpcUrl: string,
    options: RpcClientOptions = {},
  ) {
    this.requestFetch = options.fetch ?? globalThis.fetch;
    this.retries = options.retries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 200;
  }

  async health(): Promise<RpcHealth> {
    const result = await this.call('getHealth', {});
    if (!isRecord(result)) throw new MalformedRpcResponseError('getHealth result is not an object');
    return {
      oldestLedger: requiredInteger(result, 'oldestLedger'),
      latestLedger: requiredInteger(result, 'latestLedger'),
      ledgerRetentionWindow: requiredInteger(result, 'ledgerRetentionWindow'),
    };
  }

  async fetch(request: FetchRequest): Promise<EventPage> {
    if ((request.cursor === undefined) === (request.startLedger === undefined)) {
      throw new TypeError('Exactly one of cursor or startLedger is required');
    }
    const pagination: Record<string, unknown> = { limit: request.limit ?? 100 };
    if (request.cursor !== undefined) pagination.cursor = request.cursor;
    const params: Record<string, unknown> = { pagination, xdrFormat: 'base64' };
    if (request.startLedger !== undefined) params.startLedger = request.startLedger;
    const result = await this.call('getEvents', params);
    if (!isRecord(result) || !Array.isArray(result.events)) {
      throw new MalformedRpcResponseError('getEvents result has no events array');
    }
    const latestLedger = requiredInteger(result, 'latestLedger');
    const events = result.events.map(parseEvent);
    const cursor = typeof result.cursor === 'string' ? result.cursor : events.at(-1)?.id;
    return cursor === undefined ? { events, latestLedger } : { events, latestLedger, cursor };
  }

  private async call(method: string, params: Record<string, unknown>): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const response = await this.requestFetch(this.rpcUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: ++this.requestId, method, params }),
        });
        if (!response.ok) {
          throw new RpcRequestError(`RPC returned HTTP ${response.status}`, response.status >= 500);
        }
        const body: unknown = await response.json();
        if (!isRecord(body)) throw new MalformedRpcResponseError('RPC body is not an object');
        if (body.error !== undefined) {
          let rpcCode: number | undefined;
          let errorMessage = `RPC ${method} returned an error`;
          if (isRecord(body.error)) {
            if (typeof body.error.code === 'number') {
              rpcCode = body.error.code;
            }
            if (body.error.message !== undefined) {
              errorMessage = sanitizeRpcErrorMessage(body.error.message);
            }
          } else {
            errorMessage = sanitizeRpcErrorMessage(body.error);
          }
          throw new RpcRequestError(errorMessage, false, rpcCode);
        }
        if (!('result' in body)) throw new MalformedRpcResponseError('RPC body has no result');
        return body.result;
      } catch (error) {
        lastError = error;
        const retryable = !(error instanceof RpcRequestError) || error.retryable;
        if (!retryable || attempt === this.retries) break;
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * 2 ** attempt));
      }
    }
    if (lastError instanceof Error) throw lastError;
    throw new RpcRequestError('RPC request failed', false);
  }
}

function sanitizeRpcErrorMessage(rawMessage: unknown): string {
  const text = typeof rawMessage === 'string' ? rawMessage : String(rawMessage ?? 'Unknown error');
  const cleaned = text.replace(/[\x00-\x1F\x7F]/g, '');
  const bounded = cleaned.length > 200 ? cleaned.slice(0, 197) + '...' : cleaned;
  return bounded
    .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]')
    .replace(/token[=:][\s\"']*[a-zA-Z0-9_\-\.]+/gi, 'token=[REDACTED]')
    .replace(/password[=:][\s\"']*[^\s\"']+/gi, 'password=[REDACTED]');
}

function parseEvent(value: unknown): StellarEvent {
  if (!isRecord(value)) throw new MalformedRpcResponseError('Event is not an object');
  const id = requiredString(value, 'id');
  const ledger = requiredInteger(value, 'ledger');
  const rawType = requiredString(value, 'type');
  if (rawType !== 'contract' && rawType !== 'system') {
    throw new MalformedRpcResponseError('Event type is invalid', { id, type: rawType });
  }
  const type: StellarEvent['type'] = rawType;
  if (!Array.isArray(value.topic) || !value.topic.every((item) => typeof item === 'string')) {
    throw new MalformedRpcResponseError('Event topic is invalid', { id });
  }
  const base = {
    id,
    ledger,
    ledgerClosedAt: requiredString(value, 'ledgerClosedAt'),
    topic: value.topic,
    value: requiredString(value, 'value'),
    txHash: requiredString(value, 'txHash'),
    type,
    raw: value,
  };
  return typeof value.contractId === 'string' ? { ...base, contractId: value.contractId } : base;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') throw new MalformedRpcResponseError(`${key} must be a string`);
  return value;
}

function requiredInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (!Number.isSafeInteger(value))
    throw new MalformedRpcResponseError(`${key} must be an integer`);
  return value as number;
}
