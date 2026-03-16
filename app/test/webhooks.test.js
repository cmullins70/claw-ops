import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/index.js';
import { IncidentRepository } from '../src/incidents/repository.js';
import { normalizeAlert, resolveComponent, resolveSeverity, inferRootCauseClass } from '../src/webhooks/alertmanager.js';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('alertmanager normalization', () => {
  it('normalizes a firing alert', () => {
    const alert = {
      status: 'firing',
      labels: {
        alertname: 'HostDiskPressureHigh',
        severity: 'warning',
        component: 'host',
        instance: 'kyra-nest:9100',
      },
      annotations: {
        summary: 'Root disk has less than 15% free space',
      },
      startsAt: '2026-03-16T10:00:00.000Z',
    };

    const { signal, fingerprint } = normalizeAlert(alert);

    assert.equal(signal.source_type, 'prometheus');
    assert.equal(signal.source_name, 'alertmanager');
    assert.equal(signal.signal_name, 'HostDiskPressureHigh');
    assert.equal(signal.component, 'host');
    assert.equal(signal.severity, 'warning');
    assert.equal(signal.entity_id, 'kyra-nest:9100');
    assert.equal(signal.summary, 'Root disk has less than 15% free space');
    assert.ok(fingerprint);
    assert.ok(signal.signal_id);
  });

  it('handles missing annotations gracefully', () => {
    const { signal } = normalizeAlert({
      status: 'firing',
      labels: { alertname: 'TestAlert' },
      annotations: {},
      startsAt: '2026-03-16T10:00:00.000Z',
    });
    assert.ok(signal.summary.includes('TestAlert'));
  });
});

describe('resolveComponent', () => {
  it('maps explicit component labels', () => {
    assert.equal(resolveComponent({ component: 'container' }), 'container');
    assert.equal(resolveComponent({ component: 'gateway' }), 'gateway');
  });

  it('infers from alertname', () => {
    assert.equal(resolveComponent({ alertname: 'ContainerRestartLoop' }), 'container');
    assert.equal(resolveComponent({ alertname: 'HostDiskPressure' }), 'host');
    assert.equal(resolveComponent({ alertname: 'GatewayDown' }), 'gateway');
  });

  it('defaults to host', () => {
    assert.equal(resolveComponent({}), 'host');
  });
});

describe('resolveSeverity', () => {
  it('passes through valid values', () => {
    assert.equal(resolveSeverity('warning'), 'warning');
    assert.equal(resolveSeverity('critical'), 'critical');
    assert.equal(resolveSeverity('high'), 'high');
    assert.equal(resolveSeverity('info'), 'info');
  });

  it('maps Alertmanager values', () => {
    assert.equal(resolveSeverity('none'), 'info');
  });

  it('defaults to warning', () => {
    assert.equal(resolveSeverity(undefined), 'warning');
    assert.equal(resolveSeverity('unknown'), 'warning');
  });
});

describe('inferRootCauseClass', () => {
  it('maps disk alerts', () => {
    assert.equal(inferRootCauseClass({ signal_name: 'HostDiskPressureHigh' }), 'disk_pressure');
  });

  it('maps memory alerts', () => {
    assert.equal(inferRootCauseClass({ signal_name: 'HostMemoryPressureHigh' }), 'memory_pressure');
  });

  it('maps container restart alerts', () => {
    assert.equal(inferRootCauseClass({ signal_name: 'ContainerRestartLoopSuspected' }), 'container_restart_loop');
  });

  it('maps gateway alerts', () => {
    assert.equal(inferRootCauseClass({ signal_name: 'ClawOpsEventProcessorDown' }), 'gateway_unavailable');
  });

  it('returns null for unknown', () => {
    assert.equal(inferRootCauseClass({ signal_name: 'SomethingElse' }), null);
  });
});

describe('alertmanager webhook integration', () => {
  let db;
  let repo;
  let tmpDir;
  let insertSignal;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'claw-ops-test-'));
    db = openDatabase(join(tmpDir, 'test.sqlite'));
    repo = new IncidentRepository(db);
    insertSignal = db.prepare(`
      INSERT INTO signals (
        signal_id, timestamp, source_type, source_name, signal_name,
        component, entity_id, severity, summary, labels, annotations, evidence, dedup_key
      ) VALUES (
        @signal_id, @timestamp, @source_type, @source_name, @signal_name,
        @component, @entity_id, @severity, @summary, @labels, @annotations, @evidence, @dedup_key
      )
    `);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('processes a single firing alert fixture', () => {
    const fixture = JSON.parse(readFileSync(
      join(import.meta.dirname, 'fixtures/alertmanager/firing-single.json'), 'utf-8'
    ));

    for (const alert of fixture.alerts) {
      const { signal, fingerprint } = normalizeAlert(alert);
      insertSignal.run(signal);

      const { incident, created } = repo.upsert({
        fingerprint,
        title: signal.summary,
        severity: signal.severity,
        components: [signal.component],
        evidence: [{ type: 'signal', signal_id: signal.signal_id }],
        root_cause_class: inferRootCauseClass(signal),
      });

      assert.ok(created);
      assert.equal(incident.status, 'open');
      assert.equal(incident.severity, 'warning');
    }

    const signals = db.prepare('SELECT COUNT(*) as c FROM signals').get();
    assert.equal(signals.c, 1);

    const incidents = repo.listOpen();
    assert.equal(incidents.length, 1);
  });

  it('processes multi-alert fixture creating separate incidents', () => {
    const fixture = JSON.parse(readFileSync(
      join(import.meta.dirname, 'fixtures/alertmanager/multi-alert.json'), 'utf-8'
    ));

    for (const alert of fixture.alerts) {
      const { signal, fingerprint } = normalizeAlert(alert);
      insertSignal.run(signal);
      repo.upsert({
        fingerprint,
        title: signal.summary,
        severity: signal.severity,
        components: [signal.component],
        evidence: [{ type: 'signal', signal_id: signal.signal_id }],
      });
    }

    const incidents = repo.listOpen();
    assert.equal(incidents.length, 2);
  });

  it('resolves an incident from resolved fixture', () => {
    // First create the incident by firing
    const firingFixture = JSON.parse(readFileSync(
      join(import.meta.dirname, 'fixtures/alertmanager/firing-single.json'), 'utf-8'
    ));

    let fp;
    for (const alert of firingFixture.alerts) {
      const normalized = normalizeAlert(alert);
      fp = normalized.fingerprint;
      insertSignal.run(normalized.signal);
      repo.upsert({
        fingerprint: fp,
        title: normalized.signal.summary,
        severity: normalized.signal.severity,
        components: [normalized.signal.component],
        evidence: [],
      });
    }

    assert.equal(repo.listOpen().length, 1);

    // Now process the resolved fixture
    const resolvedFixture = JSON.parse(readFileSync(
      join(import.meta.dirname, 'fixtures/alertmanager/resolved-single.json'), 'utf-8'
    ));

    for (const alert of resolvedFixture.alerts) {
      const normalized = normalizeAlert(alert);
      insertSignal.run(normalized.signal);
      const existing = repo.findByFingerprint(normalized.fingerprint);
      if (existing && existing.status !== 'resolved') {
        repo.updateStatus(existing.incident_id, 'resolved');
      }
    }

    assert.equal(repo.listOpen().length, 0);
  });
});
