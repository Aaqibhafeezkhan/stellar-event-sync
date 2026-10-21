import { StellarRpcEventSource } from '../rpc.js';
import {
  ReadOnlySqliteCheckpoints,
  DIAGNOSTICS_EXIT_CODES,
  runDiagnostics,
  redactUrl,
  validateRpcUrl,
} from './diagnostics.js';

const HELP = `Usage: stellar-event-sync-diagnostics --rpc-url URL --store PATH [options]

Read-only RPC health and local checkpoint diagnostics.

Options:
  --rpc-url URL   RPC endpoint (http/https; credentials are rejected)
  --store PATH    SQLite database to inspect without writing
  --source NAME   Checkpoint source key (default: URL without query/credentials)
  --json          Emit versioned JSON on stdout
  --help          Show this help

Exit codes: 0 healthy, 2 incomplete history, 3 malformed response,
4 network failure, 64 invalid arguments.

Privacy: output redacts URL credentials, query strings, and fragments. Do not put
secret headers or tokens on the command line. Examples:
  stellar-event-sync-diagnostics --rpc-url https://soroban-testnet.stellar.org --store events.sqlite
  stellar-event-sync-diagnostics --rpc-url https://rpc.example --store events.sqlite --json
`;

export async function main(args: readonly string[] = process.argv.slice(2)): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(HELP);
    return DIAGNOSTICS_EXIT_CODES.healthy;
  }
  try {
    const rpcUrl = requiredOption(args, '--rpc-url');
    const store = requiredOption(args, '--store');
    validateRpcUrl(rpcUrl);
    const source = option(args, '--source') ?? redactUrl(rpcUrl);
    const checkpoints = new ReadOnlySqliteCheckpoints(store);
    return await runDiagnostics({
      rpcUrl,
      source,
      eventSource: new StellarRpcEventSource(rpcUrl),
      checkpoints,
      json: args.includes('--json'),
    });
  } catch (error) {
    process.stderr.write(
      `diagnostics: ${error instanceof Error ? error.message : 'invalid arguments'}\n`,
    );
    process.stderr.write('Use --help for usage.\n');
    return DIAGNOSTICS_EXIT_CODES.usage;
  }
}

function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function requiredOption(args: readonly string[], name: string): string {
  const value = option(args, name);
  if (!value || value.startsWith('--')) throw new Error(`${name} is required`);
  return value;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => (process.exitCode = code));
}

export * from './diagnostics.js';
