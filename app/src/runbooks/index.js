import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Load and validate all runbook files from a directory.
 * Returns a RunbookStore with lookup methods.
 */
export function loadRunbooks(runbooksDir) {
  const files = readdirSync(runbooksDir).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    throw new Error(`No runbook files found in ${runbooksDir}`);
  }

  const runbooks = [];

  for (const file of files) {
    const filePath = join(runbooksDir, file);
    const raw = readFileSync(filePath, 'utf-8');
    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Invalid JSON in runbook file ${file}: ${err.message}`);
    }

    validateRunbook(parsed, file);
    runbooks.push(parsed);
  }

  return new RunbookStore(runbooks);
}

function validateRunbook(rb, filename) {
  const required = ['schema_name', 'schema_version', 'runbook_id', 'name', 'triggers'];
  for (const field of required) {
    if (!rb[field]) {
      throw new Error(`Runbook file ${filename} missing required field: ${field}`);
    }
  }

  if (rb.schema_name !== 'claw-ops.runbook') {
    throw new Error(`Runbook file ${filename}: unexpected schema_name "${rb.schema_name}"`);
  }

  if (!Array.isArray(rb.triggers) || rb.triggers.length === 0) {
    throw new Error(`Runbook file ${filename}: triggers must be a non-empty array`);
  }
}

export class RunbookStore {
  constructor(runbooks) {
    this.runbooks = runbooks;
    this._byId = new Map(runbooks.map(r => [r.runbook_id, r]));
  }

  /** Get a runbook by its ID. */
  getById(runbookId) {
    return this._byId.get(runbookId) || null;
  }

  /** Find runbooks whose triggers match a given alertname (simple substring match). */
  findByAlert(alertname) {
    if (!alertname) return [];
    const lower = alertname.toLowerCase();
    return this.runbooks.filter(rb =>
      rb.triggers.some(t => t.toLowerCase().includes(lower) || lower.includes(t.toLowerCase()))
    );
  }

  /** Find runbooks matching a component. */
  findByComponent(component) {
    if (!component) return [];
    const lower = component.toLowerCase();
    return this.runbooks.filter(rb => {
      const name = rb.name.toLowerCase();
      return name.includes(lower);
    });
  }

  /** List all runbook IDs. */
  listIds() {
    return this.runbooks.map(r => r.runbook_id);
  }
}
