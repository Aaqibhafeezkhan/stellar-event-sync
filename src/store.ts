import { DatabaseSync } from 'node:sqlite';
import type { StellarEvent } from './types.js';

export interface Checkpoint {
  cursor?: string;
  nextLedger: number;
}

export class SqliteEventStore {
  readonly database: DatabaseSync;

  constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        ledger INTEGER NOT NULL,
        payload TEXT NOT NULL,
        received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS checkpoints (
        source TEXT PRIMARY KEY,
        cursor TEXT,
        next_ledger INTEGER NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  checkpoint(source: string): Checkpoint | undefined {
    const row = this.database
      .prepare('SELECT cursor, next_ledger FROM checkpoints WHERE source = ?')
      .get(source) as { cursor: string | null; next_ledger: number } | undefined;
    if (!row) return undefined;
    return row.cursor === null
      ? { nextLedger: row.next_ledger }
      : { cursor: row.cursor, nextLedger: row.next_ledger };
  }

  commitPage(
    source: string,
    events: readonly StellarEvent[],
    checkpoint: Checkpoint,
    beforeCheckpoint?: () => void,
  ): { inserted: number; duplicates: number } {
    const insert = this.database.prepare(
      'INSERT OR IGNORE INTO events (id, ledger, payload) VALUES (?, ?, ?)',
    );
    const save = this.database.prepare(`
      INSERT INTO checkpoints (source, cursor, next_ledger, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(source) DO UPDATE SET
        cursor = excluded.cursor,
        next_ledger = excluded.next_ledger,
        updated_at = CURRENT_TIMESTAMP
    `);
    let inserted = 0;
    this.database.exec('BEGIN IMMEDIATE');
    try {
      for (const event of events) {
        const result = insert.run(event.id, event.ledger, JSON.stringify(event));
        inserted += Number(result.changes);
      }
      beforeCheckpoint?.();
      save.run(source, checkpoint.cursor ?? null, checkpoint.nextLedger);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
    return { inserted, duplicates: events.length - inserted };
  }

  countEvents(): number {
    const row = this.database.prepare('SELECT COUNT(*) AS count FROM events').get() as {
      count: number;
    };
    return row.count;
  }

  close(): void {
    this.database.close();
  }
}
