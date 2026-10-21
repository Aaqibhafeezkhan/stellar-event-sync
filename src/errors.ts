export class EventSyncError extends Error {
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

export class IncompleteHistoryError extends EventSyncError {
  constructor(requestedLedger: number, oldestAvailableLedger: number) {
    super(
      `History is incomplete: ledger ${requestedLedger} is older than the RPC retention floor ${oldestAvailableLedger}`,
      'INCOMPLETE_HISTORY',
      { requestedLedger, oldestAvailableLedger },
    );
  }
}

export class MalformedRpcResponseError extends EventSyncError {
  constructor(message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message, 'MALFORMED_RPC_RESPONSE', details);
  }
}

export class RpcRequestError extends EventSyncError {
  constructor(
    message: string,
    readonly retryable: boolean,
    options?: ErrorOptions,
    readonly rpcCode?: number,
    readonly rpcMessage?: string,
  ) {
    super(
      message,
      'RPC_REQUEST_FAILED',
      {
        retryable,
        ...(rpcCode === undefined ? {} : { rpcCode }),
        ...(rpcMessage === undefined ? {} : { rpcMessage }),
      },
      options,
    );
  }
}
