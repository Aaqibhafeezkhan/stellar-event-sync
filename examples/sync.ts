import { SqliteEventStore, StellarRpcEventSource, synchronize } from '../src/index.js';

const rpcUrl = process.env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const source = new StellarRpcEventSource(rpcUrl);
const health = await source.health();
const store = new SqliteEventStore('stellar-events.sqlite');

try {
  const result = await synchronize(source, store, {
    source: rpcUrl,
    startLedger: health.latestLedger,
    maxPages: 10,
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  store.close();
}
