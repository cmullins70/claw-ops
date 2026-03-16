import { createHash } from 'node:crypto';

/**
 * Build a stable fingerprint for incident deduplication.
 *
 * Fingerprint is derived from: alertname + component + entity_id.
 * This groups recurring instances of the same issue into one incident.
 */
export function buildFingerprint({ alertname, component, entity_id }) {
  const parts = [
    alertname || 'unknown',
    component || 'unknown',
    entity_id || '',
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}
