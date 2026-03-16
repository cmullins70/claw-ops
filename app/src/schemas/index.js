/**
 * Lightweight schema validation helpers for Claw Ops objects.
 * Full JSON Schema validation deferred to Phase 2; these are structural guards.
 */

const VALID_STATUSES = new Set(['open', 'acknowledged', 'investigating', 'mitigated', 'resolved', 'suppressed']);
const VALID_SEVERITIES = new Set(['info', 'warning', 'high', 'critical']);
const VALID_COMPONENTS = new Set(['host', 'container', 'gateway', 'cron', 'memory', 'prompt', 'tooling', 'security']);
const VALID_SOURCE_TYPES = new Set(['prometheus', 'loki', 'uptime', 'cron', 'openclaw', 'custom']);

export function validateIncidentFields({ status, severity, components }) {
  const errors = [];
  if (status && !VALID_STATUSES.has(status)) errors.push(`Invalid status: ${status}`);
  if (severity && !VALID_SEVERITIES.has(severity)) errors.push(`Invalid severity: ${severity}`);
  if (components) {
    for (const c of components) {
      if (!VALID_COMPONENTS.has(c)) errors.push(`Invalid component: ${c}`);
    }
  }
  return errors;
}

export function validateSignalFields({ source_type, component, severity }) {
  const errors = [];
  if (!VALID_SOURCE_TYPES.has(source_type)) errors.push(`Invalid source_type: ${source_type}`);
  if (!VALID_COMPONENTS.has(component)) errors.push(`Invalid component: ${component}`);
  if (!VALID_SEVERITIES.has(severity)) errors.push(`Invalid severity: ${severity}`);
  return errors;
}

export { VALID_STATUSES, VALID_SEVERITIES, VALID_COMPONENTS, VALID_SOURCE_TYPES };
