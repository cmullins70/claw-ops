import { randomUUID } from 'node:crypto';
import { buildFingerprint } from '../incidents/fingerprint.js';

/**
 * Component mapping from Alertmanager labels.
 * Maps known label patterns to Claw Ops component names.
 */
const COMPONENT_MAP = {
  host: 'host',
  node: 'host',
  container: 'container',
  gateway: 'gateway',
  cron: 'cron',
  memory: 'memory',
  prompt: 'prompt',
  tooling: 'tooling',
  security: 'security',
};

const VALID_SEVERITIES = new Set(['info', 'warning', 'high', 'critical']);
const SEVERITY_MAP = { none: 'info', warning: 'warning', critical: 'critical' };

/**
 * Create the Alertmanager webhook handler.
 * Deps: { incidentRepo, db, config, policyStore, runbookStore }
 */
export function createAlertmanagerHandler(deps) {
  const { incidentRepo, db } = deps;

  const insertSignal = db.prepare(`
    INSERT INTO signals (
      signal_id, timestamp, source_type, source_name, signal_name,
      component, entity_id, severity, summary, labels, annotations, evidence, dedup_key
    ) VALUES (
      @signal_id, @timestamp, @source_type, @source_name, @signal_name,
      @component, @entity_id, @severity, @summary, @labels, @annotations, @evidence, @dedup_key
    )
  `);

  return function handleAlertmanager(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const result = processAlertmanagerPayload(payload, { insertSignal, incidentRepo });

        res.writeHead(202, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          accepted: true,
          alerts_processed: result.processed,
          incidents_created: result.created,
          incidents_updated: result.updated,
        }));
      } catch (err) {
        const status = err instanceof SyntaxError ? 400 : 422;
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ accepted: false, error: err.message }));
      }
    });
  };
}

/**
 * Process a full Alertmanager webhook payload.
 * Payload shape: { alerts: [{ status, labels, annotations, startsAt, endsAt, ... }] }
 */
function processAlertmanagerPayload(payload, { insertSignal, incidentRepo }) {
  const alerts = payload?.alerts;
  if (!Array.isArray(alerts)) {
    throw new Error('Payload must contain an alerts array');
  }

  let processed = 0;
  let created = 0;
  let updated = 0;

  for (const alert of alerts) {
    const normalized = normalizeAlert(alert);

    // Persist as signal
    insertSignal.run(normalized.signal);

    // If it's a firing alert, upsert an incident
    if (alert.status === 'firing') {
      const { incident, created: isNew } = incidentRepo.upsert({
        fingerprint: normalized.fingerprint,
        title: normalized.signal.summary,
        severity: normalized.signal.severity,
        components: [normalized.signal.component],
        evidence: [{
          type: 'signal',
          signal_id: normalized.signal.signal_id,
          summary: normalized.signal.summary,
          timestamp: normalized.signal.timestamp,
        }],
        root_cause_class: inferRootCauseClass(normalized.signal),
      });

      if (isNew) created++;
      else updated++;
    }

    // If resolved, try to mark incident as resolved
    if (alert.status === 'resolved') {
      const existing = incidentRepo.findByFingerprint(normalized.fingerprint);
      if (existing && existing.status !== 'resolved') {
        incidentRepo.updateStatus(existing.incident_id, 'resolved');
      }
    }

    processed++;
  }

  return { processed, created, updated };
}

/**
 * Normalize a single Alertmanager alert into a Claw Ops signal + fingerprint.
 */
function normalizeAlert(alert) {
  const labels = alert.labels || {};
  const annotations = alert.annotations || {};

  const alertname = labels.alertname || 'unknown_alert';
  const component = resolveComponent(labels);
  const severity = resolveSeverity(labels.severity || alert.status);
  const entity_id = labels.instance || labels.container_name || labels.job || '';

  const signal = {
    signal_id: randomUUID(),
    timestamp: alert.startsAt || new Date().toISOString(),
    source_type: 'prometheus',
    source_name: 'alertmanager',
    signal_name: alertname,
    component,
    entity_id,
    severity,
    summary: annotations.summary || annotations.description || `Alert: ${alertname}`,
    labels: JSON.stringify(labels),
    annotations: JSON.stringify(annotations),
    evidence: JSON.stringify({
      alertmanager_status: alert.status,
      starts_at: alert.startsAt,
      ends_at: alert.endsAt,
      generator_url: alert.generatorURL,
    }),
    dedup_key: `alertmanager:${alertname}:${component}:${entity_id}`,
  };

  const fingerprint = buildFingerprint({ alertname, component, entity_id });

  return { signal, fingerprint };
}

/** Map Alertmanager labels to a Claw Ops component. */
function resolveComponent(labels) {
  const component = labels.component;
  if (component && COMPONENT_MAP[component]) return COMPONENT_MAP[component];

  // Infer from alertname patterns
  const alertname = (labels.alertname || '').toLowerCase();
  if (alertname.includes('host') || alertname.includes('node')) return 'host';
  if (alertname.includes('container')) return 'container';
  if (alertname.includes('gateway') || alertname.includes('claw-ops') || alertname.includes('clawops')) return 'gateway';
  if (alertname.includes('disk') || alertname.includes('memory')) return 'host';
  if (alertname.includes('cron')) return 'cron';

  return 'host'; // safe default
}

/** Map severity strings to valid Claw Ops severity values. */
function resolveSeverity(raw) {
  if (!raw) return 'warning';
  const lower = raw.toLowerCase();
  if (VALID_SEVERITIES.has(lower)) return lower;
  return SEVERITY_MAP[lower] || 'warning';
}

/** Infer an initial root_cause_class from the signal. */
function inferRootCauseClass(signal) {
  const name = signal.signal_name.toLowerCase();
  if (name.includes('disk')) return 'disk_pressure';
  if (name.includes('memory')) return 'memory_pressure';
  if (name.includes('restart')) return 'container_restart_loop';
  if (name.includes('gateway') || name.includes('down') || name.includes('unavail')) return 'gateway_unavailable';
  if (name.includes('cron')) return 'cron_failure';
  return null;
}

// Exported for testing
export { normalizeAlert, processAlertmanagerPayload, resolveComponent, resolveSeverity, inferRootCauseClass };
