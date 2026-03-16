import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadPolicies } from '../src/policies/index.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('policy loader', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'claw-ops-policies-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writePolicy(filename, obj) {
    writeFileSync(join(tmpDir, filename), JSON.stringify(obj));
  }

  it('loads valid policies', () => {
    writePolicy('global-policy.json', {
      schema_name: 'claw-ops.policy-set',
      schema_version: '0.1.0',
      classes: {
        autonomous: ['diagnostics.collect_logs'],
        approval_gated: ['gateway.restart'],
        human_only: ['secrets.rotate'],
      },
      guardrails: ['Always verify.'],
      retry_policy: { autonomous_diagnostics_max_retries: 2 },
    });

    writePolicy('actions.json', {
      schema_name: 'claw-ops.policy-actions',
      schema_version: '0.1.0',
      actions: [
        { policy_id: 'gw_restart', action: 'gateway.restart', class: 'approval_gated' },
      ],
    });

    const store = loadPolicies(tmpDir);
    assert.equal(store.classifyAction('diagnostics.collect_logs'), 'autonomous');
    assert.equal(store.classifyAction('gateway.restart'), 'approval_gated');
    assert.equal(store.classifyAction('secrets.rotate'), 'human_only');
    assert.equal(store.classifyAction('unknown.action'), null);
    assert.ok(store.getActionPolicy('gateway.restart'));
    assert.equal(store.guardrails.length, 1);
  });

  it('throws on empty directory', () => {
    assert.throws(() => loadPolicies(tmpDir), /No policy files/);
  });

  it('throws on invalid JSON', () => {
    writeFileSync(join(tmpDir, 'bad.json'), 'not json');
    assert.throws(() => loadPolicies(tmpDir), /Invalid JSON/);
  });

  it('throws on missing schema_name', () => {
    writePolicy('bad.json', { schema_version: '0.1.0' });
    assert.throws(() => loadPolicies(tmpDir), /schema_name/);
  });

  it('throws when global policy is missing', () => {
    writePolicy('actions.json', {
      schema_name: 'claw-ops.policy-actions',
      schema_version: '0.1.0',
      actions: [],
    });
    assert.throws(() => loadPolicies(tmpDir), /global policy/);
  });
});
