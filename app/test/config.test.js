import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config/index.js';

describe('config loader', () => {
  it('loads defaults when no env is provided', () => {
    const config = loadConfig({});
    assert.equal(config.port, 8787);
    assert.equal(config.nodeEnv, 'development');
    assert.equal(config.logLevel, 'info');
  });

  it('respects environment overrides', () => {
    const config = loadConfig({
      CLAW_OPS_PORT: '9999',
      LOG_LEVEL: 'debug',
    });
    assert.equal(config.port, 9999);
    assert.equal(config.logLevel, 'debug');
  });

  it('rejects invalid port', () => {
    assert.throws(() => loadConfig({ CLAW_OPS_PORT: 'abc' }), /CLAW_OPS_PORT/);
  });

  it('rejects placeholder secret in production', () => {
    assert.throws(
      () => loadConfig({ NODE_ENV: 'production', CLAW_OPS_SHARED_SECRET: 'replace-me' }),
      /SHARED_SECRET/
    );
  });

  it('returns a frozen object', () => {
    const config = loadConfig({});
    assert.throws(() => { config.port = 1234; }, TypeError);
  });
});
