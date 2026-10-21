import { DatabaseSync } from 'node:sqlite';
import { MalformedRpcResponseError } from '../errors.js';
import type { EventSource, RpcHealth } from '../types.js';

export const DIAGNOSTICS_EXIT_CODES = {
  healthy: 0,
  incompleteHistory: 2,
  malformedResponse: 3,
  networkFailure: 4,
  usage: 64,
} as const;

export interface DiagnosticCheckpoint {
  nextLedger: number;
  cursor?: string;
}

export interface CheckpointReader {
  checkpoint(source: string): DiagnosticCheckpoint | undefined;
  close?(): void;
}

export interface DiagnosticReport {
  version: 1;
  command: 'diagnostics';
  status: 'healthy' | 'incomplete-history' | 'malformed-response' | 'network-failure';
  endpoint: string;
  source: string;
  health?: RpcHealth;
  checkpoint?: DiagnosticCheckpoint;
  error?: { code: string; message: string };
}

export interface DiagnosticOptions {
  rpcUrl: string;
  source: string;
  eventSource: EventSource;
  checkpoints: CheckpointReader;
  json: boolean;
  stdout?: { write(value: string): void };
  stderr?: { write(value: string): void };
}

export async function runDiagnostics(options: DiagnosticOptions): Promise<number> {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const endpoint = redactUrl(options.rpcUrl);
  let report: DiagnosticReport;
  try {
    const health = await options.eventSource.health();
    const checkpoint = options.checkpoints.checkpoint(options.source);
    const incomplete = checkpoint !== undefined && checkpoint.nextLedger < health.oldestLedger;
    report = {
      version: 1,
      command: 'diagnostics',
      status: incomplete ? 'incomplete-history' : 'healthy',
      endpoint,
      source: redactSource(options.source),
      health,
      ...(checkpoint === undefined ? {} : { checkpoint }),
    };
  } catch (error) {
    report = failureReport(endpoint, options.source, error);
  } finally {
    options.checkpoints.close?.();
  }

  if (options.json) {
    stdout.write(`${JSON.stringify(report)}\n`);
  } else if (report.error) {
    stderr.write(`diagnostics: ${report.error.message}\n`);
    stderr.write(`endpoint: ${report.endpoint}\n`);
  } else {
    stdout.write(`endpoint: ${report.endpoint}\n`);
    stdout.write(`status: ${report.status}\n`);
    stdout.write(
      `RPC health: oldest=${report.health?.oldestLedger} latest=${report.health?.latestLedger} retention=${report.health?.ledgerRetentionWindow}\n`,
    );
    stdout.write(
      report.checkpoint === undefined
        ? 'checkpoint: none\n'
        : `checkpoint: next-ledger=${report.checkpoint.nextLedger}${report.checkpoint.cursor === undefined ? '' : ` cursor=${report.checkpoint.cursor}`}\n`,
    );
  }
  return exitCode(report.status);
}

export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return '[invalid-url]';
  }
}

export function validateRpcUrl(value: string): void {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('RPC URL must use http or https');
  }
  if (url.username || url.password) throw new Error('RPC URL must not contain credentials');
}

export class ReadOnlySqliteCheckpoints implements CheckpointReader {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    this.database = new DatabaseSync(path, { readOnly: true });
  }

  checkpoint(source: string): DiagnosticCheckpoint | undefined {
    const row = this.database
      .prepare('SELECT cursor, next_ledger FROM checkpoints WHERE source = ?')
      .get(source) as { cursor: string | null; next_ledger: number } | undefined;
    if (!row) return undefined;
    return row.cursor === null
      ? { nextLedger: row.next_ledger }
      : { nextLedger: row.next_ledger, cursor: row.cursor };
  }

  close(): void {
    this.database.close();
  }
}

function failureReport(endpoint: string, source: string, error: unknown): DiagnosticReport {
  const typed = error instanceof MalformedRpcResponseError;
  const status = typed ? 'malformed-response' : 'network-failure';
  return {
    version: 1,
    command: 'diagnostics',
    status,
    endpoint,
    source: redactSource(source),
    error: {
      code: typed ? 'MALFORMED_RPC_RESPONSE' : 'RPC_REQUEST_FAILED',
      message: error instanceof Error ? error.message : 'RPC request failed',
    },
  };
}

function redactSource(value: string): string {
  return value.includes('://') ? redactUrl(value) : value;
}

function exitCode(status: DiagnosticReport['status']): number {
  if (status === 'healthy') return DIAGNOSTICS_EXIT_CODES.healthy;
  if (status === 'incomplete-history') return DIAGNOSTICS_EXIT_CODES.incompleteHistory;
  if (status === 'malformed-response') return DIAGNOSTICS_EXIT_CODES.malformedResponse;
  return DIAGNOSTICS_EXIT_CODES.networkFailure;
}
