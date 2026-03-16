import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/index.js';
import { IncidentRepository } from '../src/incidents/repository.js';
import { buildFingerprint } from '../src/incidents/fingerprint.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('incident repository', () => {
  let db;
  let repo;
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'claw-ops-test-'));
    db = openDatabase(join(tmpDir, 'test.sqlite'));
    repo = new IncidentRepository(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a new incident', () => {
    const fp = buildFingerprint({ alertname: 'DiskHigh', component: 'host', entity_id: 'node1' });
    const { incident, created } = repo.upsert({
      fingerprint: fp,
      title: 'Disk pressure on node1',
      severity: 'warning',
      components: ['host'],
      evidence: [{ type: 'signal', summary: 'disk > 85%' }],
    });

    assert.ok(created);
    assert.equal(incident.fingerprint, fp);
    assert.equal(incident.status, 'open');
    assert.equal(incident.severity, 'warning');
    assert.equal(incident.recurrence_count, 1);
  });

  it('deduplicates on same fingerprint', () => {
    const fp = buildFingerprint({ alertname: 'DiskHigh', component: 'host', entity_id: 'node1' });

    const first = repo.upsert({
      fingerprint: fp,
      title: 'Disk pressure on node1',
      severity: 'warning',
      components: ['host'],
      evidence: [{ type: 'signal', summary: 'first' }],
    });
    assert.ok(first.created);

    const second = repo.upsert({
      fingerprint: fp,
      title: 'Disk pressure on node1',
      severity: 'high',
      components: ['host'],
      evidence: [{ type: 'signal', summary: 'second' }],
    });
    assert.ok(!second.created);
    assert.equal(second.incident.recurrence_count, 2);
    assert.equal(second.incident.severity, 'high'); // escalated
    assert.equal(second.incident.incident_id, first.incident.incident_id);

    // Evidence should contain both entries
    const evidence = JSON.parse(second.incident.evidence);
    assert.equal(evidence.length, 2);
  });

  it('creates new incident if previous was resolved', () => {
    const fp = buildFingerprint({ alertname: 'DiskHigh', component: 'host', entity_id: 'node1' });

    const first = repo.upsert({
      fingerprint: fp,
      title: 'Disk pressure',
      severity: 'warning',
      components: ['host'],
      evidence: [],
    });
    repo.updateStatus(first.incident.incident_id, 'resolved');

    const second = repo.upsert({
      fingerprint: fp,
      title: 'Disk pressure again',
      severity: 'warning',
      components: ['host'],
      evidence: [],
    });
    assert.ok(second.created);
    assert.notEqual(second.incident.incident_id, first.incident.incident_id);
  });

  it('re-opens suppressed incident on recurrence', () => {
    const fp = buildFingerprint({ alertname: 'X', component: 'host', entity_id: '' });

    const first = repo.upsert({
      fingerprint: fp,
      title: 'Test',
      severity: 'info',
      components: ['host'],
      evidence: [],
    });
    // suppressed status is not 'resolved', so upsert should bump recurrence
    repo.updateStatus(first.incident.incident_id, 'acknowledged');

    const second = repo.upsert({
      fingerprint: fp,
      title: 'Test',
      severity: 'info',
      components: ['host'],
      evidence: [],
    });
    assert.ok(!second.created);
    assert.equal(second.incident.recurrence_count, 2);
  });

  it('lists open incidents', () => {
    repo.upsert({ fingerprint: 'fp1', title: 'A', severity: 'warning', components: ['host'], evidence: [] });
    repo.upsert({ fingerprint: 'fp2', title: 'B', severity: 'high', components: ['container'], evidence: [] });

    const open = repo.listOpen();
    assert.equal(open.length, 2);
  });

  it('findById returns null for missing', () => {
    assert.equal(repo.findById('nonexistent'), null);
  });
});

describe('fingerprint', () => {
  it('produces consistent fingerprints', () => {
    const a = buildFingerprint({ alertname: 'DiskHigh', component: 'host', entity_id: 'n1' });
    const b = buildFingerprint({ alertname: 'DiskHigh', component: 'host', entity_id: 'n1' });
    assert.equal(a, b);
  });

  it('produces different fingerprints for different inputs', () => {
    const a = buildFingerprint({ alertname: 'DiskHigh', component: 'host', entity_id: 'n1' });
    const b = buildFingerprint({ alertname: 'DiskHigh', component: 'host', entity_id: 'n2' });
    assert.notEqual(a, b);
  });
});
