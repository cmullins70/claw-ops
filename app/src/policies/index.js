import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Load and validate all policy files from a directory.
 * Returns a PolicyStore with lookup methods.
 */
export function loadPolicies(policiesDir) {
  const files = readdirSync(policiesDir).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    throw new Error(`No policy files found in ${policiesDir}`);
  }

  const policySet = { actions: [], globalPolicy: null };

  for (const file of files) {
    const filePath = join(policiesDir, file);
    const raw = readFileSync(filePath, 'utf-8');
    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Invalid JSON in policy file ${file}: ${err.message}`);
    }

    validatePolicyFile(parsed, file);

    if (parsed.schema_name === 'claw-ops.policy-set') {
      policySet.globalPolicy = parsed;
    } else if (parsed.schema_name === 'claw-ops.policy-actions') {
      policySet.actions.push(...parsed.actions);
    }
  }

  if (!policySet.globalPolicy) {
    throw new Error('No global policy file (schema_name: claw-ops.policy-set) found');
  }

  return new PolicyStore(policySet);
}

function validatePolicyFile(parsed, filename) {
  if (!parsed.schema_name) {
    throw new Error(`Policy file ${filename} missing required field: schema_name`);
  }
  if (!parsed.schema_version) {
    throw new Error(`Policy file ${filename} missing required field: schema_version`);
  }

  if (parsed.schema_name === 'claw-ops.policy-set') {
    if (!parsed.classes) {
      throw new Error(`Policy file ${filename} missing required field: classes`);
    }
    for (const cls of ['autonomous', 'approval_gated', 'human_only']) {
      if (!Array.isArray(parsed.classes[cls])) {
        throw new Error(`Policy file ${filename}: classes.${cls} must be an array`);
      }
    }
  }

  if (parsed.schema_name === 'claw-ops.policy-actions') {
    if (!Array.isArray(parsed.actions)) {
      throw new Error(`Policy file ${filename}: actions must be an array`);
    }
    for (const action of parsed.actions) {
      if (!action.policy_id || !action.action || !action.class) {
        throw new Error(`Policy file ${filename}: each action must have policy_id, action, and class`);
      }
    }
  }
}

export class PolicyStore {
  constructor({ globalPolicy, actions }) {
    this.globalPolicy = globalPolicy;
    this.actions = actions;
    this._actionMap = new Map(actions.map(a => [a.action, a]));
  }

  /** Get the policy class for an action name. */
  classifyAction(actionName) {
    const { classes } = this.globalPolicy;
    if (classes.autonomous.includes(actionName)) return 'autonomous';
    if (classes.approval_gated.includes(actionName)) return 'approval_gated';
    if (classes.human_only.includes(actionName)) return 'human_only';
    return null;
  }

  /** Get the full action policy definition. */
  getActionPolicy(actionName) {
    return this._actionMap.get(actionName) || null;
  }

  /** Get global guardrails list. */
  get guardrails() {
    return this.globalPolicy.guardrails || [];
  }

  /** Get retry policy. */
  get retryPolicy() {
    return this.globalPolicy.retry_policy || {};
  }
}
