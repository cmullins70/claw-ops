import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadRunbooks } from '../src/runbooks/index.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('runbook loader', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'claw-ops-runbooks-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeRunbook(filename, obj) {
    writeFileSync(join(tmpDir, filename), JSON.stringify(obj));
  }

  it('loads valid runbooks', () => {
    writeRunbook('gateway.json', {
      schema_name: 'claw-ops.runbook',
      schema_version: '0.1.0',
      runbook_id: 'gateway_unavailable_v1',
      name: 'Gateway unavailable',
      triggers: ['gateway healthcheck failed'],
      autonomous_actions: ['diagnostics.collect_logs'],
    });

    writeRunbook('disk.json', {
      schema_name: 'claw-ops.runbook',
      schema_version: '0.1.0',
      runbook_id: 'disk_pressure_v1',
      name: 'Disk pressure',
      triggers: ['disk usage exceeds threshold'],
      autonomous_actions: ['diagnostics.collect_metrics_snapshot'],
    });

    const store = loadRunbooks(tmpDir);
    assert.equal(store.listIds().length, 2);
    assert.ok(store.getById('gateway_unavailable_v1'));
    assert.ok(store.getById('disk_pressure_v1'));
    assert.equal(store.getById('nonexistent'), null);
  });

  it('finds runbooks by alert name', () => {
    writeRunbook('gateway.json', {
      schema_name: 'claw-ops.runbook',
      schema_version: '0.1.0',
      runbook_id: 'gw_v1',
      name: 'Gateway unavailable',
      triggers: ['gateway healthcheck failed', 'status endpoint unavailable'],
    });

    const store = loadRunbooks(tmpDir);
    const matches = store.findByAlert('gateway healthcheck failed');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].runbook_id, 'gw_v1');
  });

  it('throws on empty directory', () => {
    assert.throws(() => loadRunbooks(tmpDir), /No runbook files/);
  });

  it('throws on missing required fields', () => {
    writeRunbook('bad.json', {
      schema_name: 'claw-ops.runbook',
      schema_version: '0.1.0',
    });
    assert.throws(() => loadRunbooks(tmpDir), /runbook_id/);
  });

  it('throws on wrong schema_name', () => {
    writeRunbook('bad.json', {
      schema_name: 'wrong',
      schema_version: '0.1.0',
      runbook_id: 'x',
      name: 'x',
      triggers: ['x'],
    });
    assert.throws(() => loadRunbooks(tmpDir), /schema_name/);
  });
});
