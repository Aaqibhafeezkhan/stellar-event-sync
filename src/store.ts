import { DatabaseSync } from 'node:sqlite';
import { statSync } from 'node:fs';
import { CheckpointInspectionError } from './errors.js';
import type { CheckpointInspection, StellarEvent } from './types.js';

export const SQLITE_SCHEMA_VERSION = 1 as const;

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

/** Read checkpoint metadata without creating or mutating a SQLite database. */
export class SqliteCheckpointInspector {
  readonly #database: DatabaseSync;

  constructor(path: string) {
    try {
      const file = statSync(path);
      if (!file.isFile()) throw new Error('path is not a file');
      if ((file.mode & 0o444) === 0) throw new Error('file is not readable');
      this.#database = new DatabaseSync(path, { readOnly: true });
      this.#validateSchema();
    } catch (error) {
      throw new CheckpointInspectionError('Unable to open checkpoint store for inspection', {
        cause: error,
      });
    }
  }

  inspect(source: string): Readonly<CheckpointInspection> | undefined {
    try {
      const row = this.#database
        .prepare('SELECT source, cursor, next_ledger, updated_at FROM checkpoints WHERE source = ?')
        .get(source) as
        | {
            source: string;
            cursor: string | null;
            next_ledger: number;
            updated_at: string;
          }
        | undefined;
      if (!row) return undefined;
      return Object.freeze({
        schemaVersion: SQLITE_SCHEMA_VERSION,
        source: row.source,
        ...(row.cursor === null ? {} : { cursor: row.cursor }),
        nextLedger: row.next_ledger,
        updatedAt: row.updated_at,
      });
    } catch (error) {
      throw new CheckpointInspectionError('Unable to inspect checkpoint metadata', {
        cause: error,
      });
    }
  }

  close(): void {
    this.#database.close();
  }

  #validateSchema(): void {
    const columns = this.#database.prepare('PRAGMA table_info(checkpoints)').all() as Array<{
      name: string;
    }>;
    const actual = new Set(columns.map(({ name }) => name));
    for (const required of ['source', 'cursor', 'next_ledger', 'updated_at']) {
      if (!actual.has(required)) throw new Error(`missing checkpoint column: ${required}`);
    }
  }
}
