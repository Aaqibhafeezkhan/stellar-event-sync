import {
  MalformedRpcResponseError,
  RpcAbortError,
  RpcRequestError,
  RpcTimeoutError,
} from './errors.js';
import type { EventPage, EventSource, FetchRequest, RpcHealth, StellarEvent } from './types.js';

export type JitterStrategy =
  'none' | 'full' | 'equal' | ((delayMs: number, attempt: number) => number);

export interface RetryPolicy {
  maxAttempts?: number | undefined;
  maxRetries?: number | undefined;
  initialDelayMs?: number | undefined;
  maxDelayMs?: number | undefined;
  backoffFactor?: number | undefined;
  jitter?: JitterStrategy | boolean | undefined;
  timeoutMs?: number | undefined;
  maxRetryAfterMs?: number | undefined;
  sleep?: ((ms: number) => Promise<void>) | undefined;
  now?: (() => number) | undefined;
  random?: (() => number) | undefined;
}

export interface RpcClientOptions {
  retries?: number | undefined;
  retryDelayMs?: number | undefined;
  timeoutMs?: number | undefined;
  sleep?: ((ms: number) => Promise<void>) | undefined;
  retry?: RetryPolicy | undefined;
  fetch?: typeof fetch | undefined;
}

export interface RetryDecision {
  retry: boolean;
  delayMs: number;
  reason:
    | 'retry_after'
    | 'exponential_backoff'
    | 'max_retries_exceeded'
    | 'aborted'
    | 'malformed_rpc_response'
    | 'non_retryable_error';
}

export interface ResolvedRetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  jitter: JitterStrategy | boolean;
  timeoutMs?: number | undefined;
  maxRetryAfterMs: number;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  random: () => number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status <= 599);
}

export function parseRetryAfter(
  header: string | null | undefined,
  nowMs: number = Date.now(),
): number | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  if (!trimmed) return undefined;

  if (/^\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    return Number.isSafeInteger(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
  }

  const parsedTime = Date.parse(trimmed);
  if (!Number.isNaN(parsedTime)) {
    return Math.max(0, parsedTime - nowMs);
  }

  return undefined;
}

export function evaluateRetry(
  policy: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffFactor: number;
    jitter?: JitterStrategy | boolean | undefined;
    maxRetryAfterMs?: number | undefined;
    now?: (() => number) | undefined;
    random?: (() => number) | undefined;
  },
  attempt: number,
  error: unknown,
): RetryDecision {
  if (attempt >= policy.maxRetries) {
    return { retry: false, delayMs: 0, reason: 'max_retries_exceeded' };
  }

  if (error instanceof RpcAbortError) {
    return { retry: false, delayMs: 0, reason: 'aborted' };
  }

  if (error instanceof MalformedRpcResponseError) {
    return { retry: false, delayMs: 0, reason: 'malformed_rpc_response' };
  }

  let retryable = false;
  let retryAfterHeader: string | null | undefined;

  if (error instanceof RpcRequestError) {
    retryable = error.retryable;
    if (typeof error.details['retryAfterHeader'] === 'string') {
      retryAfterHeader = error.details['retryAfterHeader'];
    }
  } else if (error instanceof RpcTimeoutError) {
    retryable = true;
  } else if (error instanceof TypeError) {
    retryable = true;
  } else {
    retryable = true;
  }

  if (!retryable) {
    return { retry: false, delayMs: 0, reason: 'non_retryable_error' };
  }

  const nowMs = policy.now ? policy.now() : Date.now();
  const retryAfterMs = parseRetryAfter(retryAfterHeader, nowMs);

  if (retryAfterMs !== undefined) {
    const cap = policy.maxRetryAfterMs ?? policy.maxDelayMs;
    const cappedDelay = Math.min(retryAfterMs, cap);
    return { retry: true, delayMs: cappedDelay, reason: 'retry_after' };
  }

  const rawDelay = policy.initialDelayMs * Math.pow(policy.backoffFactor, attempt);
  const cappedBackoff = Math.min(rawDelay, policy.maxDelayMs);

  const random = policy.random ?? Math.random;
  let finalDelay = cappedBackoff;

  if (typeof policy.jitter === 'function') {
    finalDelay = policy.jitter(cappedBackoff, attempt);
  } else if (policy.jitter === 'full' || policy.jitter === true) {
    finalDelay = random() * cappedBackoff;
  } else if (policy.jitter === 'equal') {
    finalDelay = cappedBackoff / 2 + random() * (cappedBackoff / 2);
  } else {
    finalDelay = cappedBackoff;
  }

  finalDelay = Math.min(Math.max(0, Math.round(finalDelay)), policy.maxDelayMs);
  return { retry: true, delayMs: finalDelay, reason: 'exponential_backoff' };
}

function resolvePolicy(options: RpcClientOptions): ResolvedRetryPolicy {
  const retry = options.retry;
  const maxRetries =
    retry?.maxRetries ??
    (retry?.maxAttempts !== undefined ? Math.max(0, retry.maxAttempts - 1) : undefined) ??
    options.retries ??
    3;

  const initialDelayMs = retry?.initialDelayMs ?? options.retryDelayMs ?? 200;
  const maxDelayMs = retry?.maxDelayMs ?? 30_000;
  const backoffFactor = retry?.backoffFactor ?? 2;
  const maxRetryAfterMs = retry?.maxRetryAfterMs ?? 60_000;
  const jitter = retry?.jitter ?? 'none';
  const timeoutMs = retry?.timeoutMs ?? options.timeoutMs;
  const sleep = retry?.sleep ?? options.sleep ?? defaultSleep;
  const now = retry?.now ?? (() => Date.now());
  const random = retry?.random ?? (() => Math.random());

  return {
    maxRetries,
    initialDelayMs,
    maxDelayMs,
    backoffFactor,
    jitter,
    timeoutMs,
    maxRetryAfterMs,
    sleep,
    now,
    random,
  };
}

function isAbortError(error: unknown): boolean {
  if (error instanceof RpcAbortError) return true;
  if (error instanceof Error) {
    return error.name === 'AbortError' || error.name === 'TimeoutError';
  }
  return false;
}

export class StellarRpcEventSource implements EventSource {
  private readonly requestFetch: typeof fetch;
  private readonly policy: ResolvedRetryPolicy;
  private requestId = 0;

  constructor(
    private readonly rpcUrl: string,
    options: RpcClientOptions = {},
  ) {
    this.requestFetch = options.fetch ?? globalThis.fetch;
    this.policy = resolvePolicy(options);
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
    if (request.startLedger !== undefined && request.contractId !== undefined) {
      params.filters = [{ type: 'contract', contractIds: [request.contractId] }];
    }
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
    const policy = this.policy;
    let lastError: unknown;

    for (let attempt = 0; attempt <= policy.maxRetries; attempt += 1) {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let timedOut = false;
      const controller = new AbortController();

      try {
        const fetchPromise = (async () => {
          const response = await this.requestFetch(this.rpcUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: ++this.requestId, method, params }),
            signal: controller.signal,
          });

          if (!response.ok) {
            const retryAfterHeader = response.headers.get('retry-after');
            const retryable = isRetryableStatus(response.status);
            throw new RpcRequestError(`RPC returned HTTP ${response.status}`, retryable, {
              status: response.status,
              retryAfterHeader: retryAfterHeader ?? undefined,
              method,
            });
          }

          const body: unknown = await response.json();
          if (!isRecord(body)) throw new MalformedRpcResponseError('RPC body is not an object');
          if (body.error !== undefined) {
            throw new RpcRequestError(`RPC ${method} returned an error`, false, {
              rpcError: body.error,
              method,
            });
          }
          if (!('result' in body)) throw new MalformedRpcResponseError('RPC body has no result');
          return body.result;
        })();

        let result: unknown;
        if (policy.timeoutMs !== undefined && policy.timeoutMs > 0) {
          const timeoutMs = policy.timeoutMs;
          let completed = false;

          const timeoutPromise = new Promise<never>((_, reject) => {
            const onTimeout = () => {
              if (completed) return;
              timedOut = true;
              controller.abort();
              reject(
                new RpcTimeoutError(`RPC request timed out after ${timeoutMs}ms`, {
                  timeoutMs,
                  attempt,
                  method,
                }),
              );
            };

            if (policy.sleep !== defaultSleep) {
              policy.sleep(timeoutMs).then(onTimeout);
            } else {
              timeoutId = setTimeout(onTimeout, timeoutMs);
            }
          });

          result = await Promise.race([fetchPromise, timeoutPromise]);
          completed = true;
          if (timeoutId !== undefined) clearTimeout(timeoutId);
        } else {
          result = await fetchPromise;
        }

        return result;
      } catch (error) {
        if (timeoutId !== undefined) clearTimeout(timeoutId);

        let effectiveError = error;
        if (timedOut || isAbortError(error)) {
          if (timedOut) {
            effectiveError =
              error instanceof RpcTimeoutError
                ? error
                : new RpcTimeoutError(
                    `RPC request timed out after ${policy.timeoutMs ?? 0}ms`,
                    { timeoutMs: policy.timeoutMs, attempt, method },
                    { cause: error },
                  );
          } else {
            effectiveError = new RpcAbortError(
              'RPC request aborted',
              { attempt, method },
              { cause: error },
            );
          }
        }

        lastError = effectiveError;

        if (attempt >= policy.maxRetries) {
          break;
        }

        const decision = evaluateRetry(policy, attempt, effectiveError);
        if (!decision.retry) {
          break;
        }

        if (decision.delayMs > 0) {
          await policy.sleep(decision.delayMs);
        }
      }
    }

    if (lastError instanceof Error) throw lastError;
    throw new RpcRequestError('RPC request failed', false);
  }
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
