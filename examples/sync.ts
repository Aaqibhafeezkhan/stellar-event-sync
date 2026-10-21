import {
  formatSyncResultJson,
  SqliteEventStore,
  StellarRpcEventSource,
  synchronize,
} from '../src/index.js';

const rpcUrl = process.env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const contractId = process.env.STELLAR_CONTRACT_ID;
const source = new StellarRpcEventSource(rpcUrl);
const health = await source.health();
const store = new SqliteEventStore('stellar-events.sqlite');

try {
  const result = await synchronize(source, store, {
    source: rpcUrl,
    startLedger: health.latestLedger,
    maxPages: 10,
    ...(contractId === undefined ? {} : { contractId }),
  });
  process.stderr.write('sync complete\n');
  process.stdout.write(`${formatSyncResultJson(result)}\n`);
} finally {
  store.close();
}
