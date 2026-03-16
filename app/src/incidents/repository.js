import { randomUUID } from 'node:crypto';

/**
 * Incident data-access layer.
 * Handles create, update, upsert-by-fingerprint (dedup), and queries.
 */
export class IncidentRepository {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._findByFingerprint = this.db.prepare(
      'SELECT * FROM incidents WHERE fingerprint = ?'
    );

    this._findById = this.db.prepare(
      'SELECT * FROM incidents WHERE incident_id = ?'
    );

    this._insert = this.db.prepare(`
      INSERT INTO incidents (
        incident_id, fingerprint, title, status, severity,
        root_cause_class, confidence, components,
        first_seen_at, last_seen_at, recurrence_count, evidence
      ) VALUES (
        @incident_id, @fingerprint, @title, @status, @severity,
        @root_cause_class, @confidence, @components,
        @first_seen_at, @last_seen_at, @recurrence_count, @evidence
      )
    `);

    this._updateOnRecurrence = this.db.prepare(`
      UPDATE incidents SET
        last_seen_at = @last_seen_at,
        recurrence_count = recurrence_count + 1,
        severity = @severity,
        evidence = @evidence,
        status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE fingerprint = @fingerprint
    `);

    this._reopenResolved = this.db.prepare(`
      UPDATE incidents SET
        incident_id = @new_incident_id,
        title = @title,
        status = 'open',
        severity = @severity,
        root_cause_class = @root_cause_class,
        confidence = @confidence,
        components = @components,
        first_seen_at = @first_seen_at,
        last_seen_at = @last_seen_at,
        recurrence_count = 1,
        evidence = @evidence,
        actions_attempted = '[]',
        approval_state = NULL,
        suppression_until = NULL,
        linked_lessons = '[]',
        linked_improvements = '[]',
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE fingerprint = @fingerprint AND status = 'resolved'
    `);

    this._updateStatus = this.db.prepare(`
      UPDATE incidents SET
        status = @status,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE incident_id = @incident_id
    `);

    this._listOpen = this.db.prepare(
      "SELECT * FROM incidents WHERE status NOT IN ('resolved','suppressed') ORDER BY last_seen_at DESC"
    );

    this._listAll = this.db.prepare(
      'SELECT * FROM incidents ORDER BY last_seen_at DESC LIMIT ?'
    );
  }

  /**
   * Upsert an incident by fingerprint.
   * If an open/active incident with the same fingerprint exists, bump recurrence.
   * Otherwise create a new incident.
   * Returns { incident, created: boolean }.
   */
  upsert({ fingerprint, title, severity, components, evidence, root_cause_class = null, confidence = null }) {
    const now = new Date().toISOString();
    const existing = this._findByFingerprint.get(fingerprint);

    if (existing && existing.status !== 'resolved') {
      // Merge new evidence into existing
      const existingEvidence = JSON.parse(existing.evidence || '[]');
      const newEvidence = Array.isArray(evidence) ? evidence : [];
      const merged = [...existingEvidence, ...newEvidence];

      this._updateOnRecurrence.run({
        fingerprint,
        last_seen_at: now,
        severity: higherSeverity(existing.severity, severity),
        evidence: JSON.stringify(merged),
      });

      return { incident: this._findByFingerprint.get(fingerprint), created: false };
    }

    if (existing && existing.status === 'resolved') {
      // Re-open as a new occurrence: reset the row with a new incident_id
      this._reopenResolved.run({
        new_incident_id: randomUUID(),
        fingerprint,
        title,
        severity,
        root_cause_class: root_cause_class ?? null,
        confidence: confidence ?? null,
        components: JSON.stringify(Array.isArray(components) ? components : []),
        first_seen_at: now,
        last_seen_at: now,
        evidence: JSON.stringify(Array.isArray(evidence) ? evidence : []),
      });

      return { incident: this._findByFingerprint.get(fingerprint), created: true };
    }

    const incident_id = randomUUID();
    this._insert.run({
      incident_id,
      fingerprint,
      title,
      status: 'open',
      severity,
      root_cause_class,
      confidence,
      components: JSON.stringify(Array.isArray(components) ? components : []),
      first_seen_at: now,
      last_seen_at: now,
      recurrence_count: 1,
      evidence: JSON.stringify(Array.isArray(evidence) ? evidence : []),
    });

    return { incident: this._findById.get(incident_id), created: true };
  }

  findById(incident_id) {
    return this._findById.get(incident_id) || null;
  }

  findByFingerprint(fingerprint) {
    return this._findByFingerprint.get(fingerprint) || null;
  }

  updateStatus(incident_id, status) {
    return this._updateStatus.run({ incident_id, status });
  }

  listOpen() {
    return this._listOpen.all();
  }

  listAll(limit = 100) {
    return this._listAll.all(limit);
  }
}

/** Return the higher of two severity levels. */
function higherSeverity(a, b) {
  const rank = { info: 0, warning: 1, high: 2, critical: 3 };
  return (rank[b] ?? 0) > (rank[a] ?? 0) ? b : a;
}
