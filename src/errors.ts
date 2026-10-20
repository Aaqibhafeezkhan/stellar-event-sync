export class EventGuardError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details: Readonly<Record<string, unknown>> = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class IncompleteHistoryError extends EventGuardError {
  constructor(requestedLedger: number, oldestAvailableLedger: number) {
    super(
      `History is incomplete: ledger ${requestedLedger} is older than the RPC retention floor ${oldestAvailableLedger}`,
      'INCOMPLETE_HISTORY',
      { requestedLedger, oldestAvailableLedger },
    );
  }
}

export class MalformedRpcResponseError extends EventGuardError {
  constructor(message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message, 'MALFORMED_RPC_RESPONSE', details);
  }
}

export class RpcRequestError extends EventGuardError {
  constructor(
    message: string,
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, 'RPC_REQUEST_FAILED', { retryable }, options);
  }
}
