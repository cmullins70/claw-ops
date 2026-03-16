import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULTS = {
  NODE_ENV: 'development',
  CLAW_OPS_PORT: 8787,
  CLAW_OPS_DB_PATH: './data/claw-ops.sqlite',
  CLAW_OPS_SHARED_SECRET: '',
  LOG_LEVEL: 'info',
  // In container: env vars set by Dockerfile (/policies, /runbooks)
  // Local dev: resolve relative to app/ working directory
  CLAW_OPS_POLICIES_DIR: resolve(process.cwd(), '../policies'),
  CLAW_OPS_RUNBOOKS_DIR: resolve(process.cwd(), '../runbooks'),
};

/**
 * Load config from environment, with defaults.
 * Validates that critical values are set in production.
 */
export function loadConfig(env = process.env) {
  const config = {
    nodeEnv: env.NODE_ENV || DEFAULTS.NODE_ENV,
    port: Number(env.CLAW_OPS_PORT || DEFAULTS.CLAW_OPS_PORT),
    dbPath: env.CLAW_OPS_DB_PATH || DEFAULTS.CLAW_OPS_DB_PATH,
    sharedSecret: env.CLAW_OPS_SHARED_SECRET || DEFAULTS.CLAW_OPS_SHARED_SECRET,
    logLevel: env.LOG_LEVEL || DEFAULTS.LOG_LEVEL,
    policiesDir: env.CLAW_OPS_POLICIES_DIR || DEFAULTS.CLAW_OPS_POLICIES_DIR,
    runbooksDir: env.CLAW_OPS_RUNBOOKS_DIR || DEFAULTS.CLAW_OPS_RUNBOOKS_DIR,
  };

  const errors = validate(config);
  if (errors.length > 0) {
    throw new Error(`Config validation failed:\n  ${errors.join('\n  ')}`);
  }

  return Object.freeze(config);
}

function validate(config) {
  const errors = [];

  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    errors.push(`CLAW_OPS_PORT must be an integer 1-65535, got "${config.port}"`);
  }

  if (config.nodeEnv === 'production' && (!config.sharedSecret || config.sharedSecret === 'replace-me')) {
    errors.push('CLAW_OPS_SHARED_SECRET must be set in production');
  }

  if (!config.dbPath) {
    errors.push('CLAW_OPS_DB_PATH must be set');
  }

  return errors;
}
