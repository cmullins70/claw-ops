import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/index.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('database', () => {
  let db;
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'claw-ops-test-'));
    db = openDatabase(join(tmpDir, 'test.sqlite'));
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates tables on first open', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    const names = tables.map(t => t.name);
    assert.ok(names.includes('signals'), 'signals table exists');
    assert.ok(names.includes('incidents'), 'incidents table exists');
    assert.ok(names.includes('action_attempts'), 'action_attempts table exists');
  });

  it('sets user_version to 1', () => {
    const version = db.pragma('user_version', { simple: true });
    assert.equal(version, 1);
  });

  it('uses WAL journal mode', () => {
    const mode = db.pragma('journal_mode', { simple: true });
    assert.equal(mode, 'wal');
  });

  it('is idempotent on re-open', () => {
    const dbPath = join(tmpDir, 'test.sqlite');
    db.close();
    const db2 = openDatabase(dbPath);
    const version = db2.pragma('user_version', { simple: true });
    assert.equal(version, 1);
    db2.close();
    db = openDatabase(dbPath); // re-assign so afterEach cleanup works
  });
});
