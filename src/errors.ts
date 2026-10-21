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

export class RpcConfigurationError extends EventSyncError {
  constructor(message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message, 'RPC_CONFIGURATION_INVALID', details);
  }
}

export class MalformedRpcResponseError extends EventSyncError {
  constructor(message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message, 'MALFORMED_RPC_RESPONSE', details);
  }
}

export class RpcRequestError extends EventSyncError {
  readonly status?: number | undefined;
  readonly rpcCode?: number | undefined;

  constructor(
    message: string,
    readonly retryable: boolean,
    detailsOrOptions?: Readonly<Record<string, unknown>> | ErrorOptions,
    options?: ErrorOptions,
  ) {
    const isErrorOptions =
      detailsOrOptions !== undefined &&
      typeof detailsOrOptions === 'object' &&
      'cause' in detailsOrOptions &&
      Object.keys(detailsOrOptions).length === 1;

    const details = isErrorOptions
      ? {}
      : ((detailsOrOptions as Readonly<Record<string, unknown>> | undefined) ?? {});
    const errorOptions = isErrorOptions ? (detailsOrOptions as ErrorOptions) : options;

    super(message, 'RPC_REQUEST_FAILED', { retryable, ...details }, errorOptions);
    if (typeof details.status === 'number') {
      this.status = details.status;
    }
    if (typeof details.rpcCode === 'number') {
      this.rpcCode = details.rpcCode;
    }
  }
}

export class RpcTimeoutError extends EventSyncError {
  constructor(
    message = 'RPC request timed out',
    details: Readonly<Record<string, unknown>> = {},
    options?: ErrorOptions,
  ) {
    super(message, 'RPC_TIMEOUT', details, options);
  }
}

export class RpcAbortError extends EventSyncError {
  constructor(
    message = 'RPC request aborted',
    details: Readonly<Record<string, unknown>> = {},
    options?: ErrorOptions,
  ) {
    super(message, 'RPC_ABORTED', details, options);
  }
}
