import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SCHEMA_SQL } from './schema.js';

/**
 * Open (or create) the SQLite database and run migrations.
 * Returns the better-sqlite3 Database instance.
 */
export function openDatabase(dbPath) {
  // Ensure the parent directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  migrate(db);

  return db;
}

/**
 * Run schema migrations idempotently.
 * Uses a simple user_version pragma to track schema version.
 */
function migrate(db) {
  const currentVersion = db.pragma('user_version', { simple: true });

  if (currentVersion < 1) {
    db.exec(SCHEMA_SQL);
    db.pragma('user_version = 1');
  }

  // Future migrations go here as:
  // if (currentVersion < 2) { db.exec(MIGRATION_2); db.pragma('user_version = 2'); }
}
