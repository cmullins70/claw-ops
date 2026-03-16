# Claw Ops Implementation Tickets

This document turns the Claw Ops PRD and architecture into an initial implementation backlog.

## Prioritization Model
- **P0**: required for Phase 1 MVP viability
- **P1**: strongly recommended for safe/useful MVP behavior
- **P2**: follow-on leverage and refinement

---

## Epic A: Foundation and Repository Shape

### CLAW_OPS-001 — Create Claw Ops project structure
**Priority:** P0
**Goal:** Establish a clean home for code, config, runbooks, and policies.

**Deliverables**
- directory layout for event processor, schemas, runbooks, and policy definitions
- README with local dev instructions
- config loading convention

**Acceptance Criteria**
- project structure exists and is documented
- schema, runbook, and policy directories are clearly separated
- local start instructions work for a developer

---

### CLAW_OPS-002 — Define environment and config model
**Priority:** P0
**Goal:** Standardize configuration inputs across local and deployed environments.

**Deliverables**
- env var spec
- config file format if needed
- defaults for single-host MVP

**Acceptance Criteria**
- required and optional config values are documented
- secrets are clearly separated from non-secret config
- service can start with sane defaults in dev mode

---

## Epic B: Telemetry Intake and Event Normalization

### CLAW_OPS-003 — Implement alert webhook receiver
**Priority:** P0
**Goal:** Accept incoming webhooks from Alertmanager and other alert sources.

**Deliverables**
- HTTP endpoint for alert intake
- request validation
- basic auth or shared-secret protection
- structured logging for received events

**Acceptance Criteria**
- endpoint accepts test payloads
- invalid payloads are rejected cleanly
- received alerts are logged with stable request ids

---

### CLAW_OPS-004 — Build normalized event schema adapter
**Priority:** P0
**Goal:** Convert heterogeneous source alerts into a single internal event model.

**Deliverables**
- adapters for Alertmanager payloads
- adapter interface for future Loki/Uptime/OpenClaw hooks
- dedup key generation logic

**Acceptance Criteria**
- one input alert maps to one normalized event object
- dedup key generation is deterministic
- schema output matches `docs/claw-ops-schemas.md`

---

### CLAW_OPS-005 — Add source adapters for non-Prometheus events
**Priority:** P1
**Goal:** Support initial Loki, cron, and custom OpenClaw event hooks.

**Deliverables**
- Loki/log anomaly adapter
- cron/job event adapter
- OpenClaw custom event adapter

**Acceptance Criteria**
- at least three source types normalize successfully
- source metadata is preserved in normalized events

---

## Epic C: Incident Store and Lifecycle

### CLAW_OPS-006 — Create sqlite incident store
**Priority:** P0
**Goal:** Persist incident lifecycle state durably across restarts.

**Deliverables**
- sqlite schema
- migrations
- repository layer for incidents, actions, lessons, improvements

**Acceptance Criteria**
- incidents persist across process restart
- schema supports recurrence count, suppression, and action history
- migrations can initialize a fresh database

---

### CLAW_OPS-007 — Implement incident open/update/dedup logic
**Priority:** P0
**Goal:** Open new incidents or update existing ones based on normalized events.

**Deliverables**
- incident fingerprint matching
- recurrence increment logic
- suppression and cooldown handling
- incident status transitions

**Acceptance Criteria**
- repeated equivalent events update the same active incident
- recurrence count increments correctly
- suppressed incidents do not spam summaries during suppression window

---

### CLAW_OPS-008 — Build incident timeline and audit trail
**Priority:** P1
**Goal:** Preserve a complete sequence of event, diagnosis, action, and verification history.

**Deliverables**
- timeline storage model
- append-only incident event records
- actor attribution for actions

**Acceptance Criteria**
- all actions and updates are queryable in sequence
- actor and timestamp are present for each timeline item

---

## Epic D: Policy Engine and Runbook Loader

### CLAW_OPS-009 — Implement policy definition loader
**Priority:** P0
**Goal:** Load machine-readable policy definitions from disk.

**Deliverables**
- policy file format
- policy validation on startup
- runtime lookup by action name

**Acceptance Criteria**
- invalid policy files fail fast with clear errors
- policy lookup is deterministic
- action classes are enforced in code paths

---

### CLAW_OPS-010 — Implement runbook definition loader
**Priority:** P0
**Goal:** Load runbook definitions and bind them to incident classes.

**Deliverables**
- runbook file format
- runbook validation
- lookup by trigger/root cause/component

**Acceptance Criteria**
- runbooks are discoverable by incident type
- invalid runbooks are rejected clearly
- at least five starter runbooks load successfully

---

### CLAW_OPS-011 — Build action authorization layer
**Priority:** P1
**Goal:** Prevent unapproved execution of approval-gated or human-only actions.

**Deliverables**
- action authorization middleware/service
- approval state checks
- denial logging

**Acceptance Criteria**
- autonomous actions execute without approval
- approval-gated actions require approval token/state
- human-only actions are never auto-executed

---

## Epic E: Agent Responder Workflow

### CLAW_OPS-012 — Create incident responder entrypoint
**Priority:** P0
**Goal:** Trigger the agent responder when incidents open or materially change.

**Deliverables**
- responder invocation hook
- incident payload construction
- idempotency safeguards

**Acceptance Criteria**
- newly opened incidents trigger responder flow
- duplicate responder invocations are bounded
- responder receives incident, policy, and runbook context

---

### CLAW_OPS-013 — Implement diagnostic context gathering
**Priority:** P0
**Goal:** Gather logs, metrics, job history, and other relevant facts for the incident.

**Deliverables**
- diagnostics fetch layer
- component-aware gathering rules
- evidence summary formatting

**Acceptance Criteria**
- gateway incidents fetch gateway/container context
- cron incidents fetch cron/job history
- evidence is attached to incident record

---

### CLAW_OPS-014 — Implement diagnosis output contract
**Priority:** P1
**Goal:** Standardize agent diagnosis results for downstream verification and summaries.

**Deliverables**
- diagnosis schema validation
- confidence field support
- alternative hypothesis support

**Acceptance Criteria**
- diagnosis outputs conform to schema
- missing fields are rejected or defaulted safely

---

### CLAW_OPS-015 — Implement verification flow
**Priority:** P1
**Goal:** Re-check relevant signals after an action or recommendation.

**Deliverables**
- verification check runner
- result persistence
- improved/no-change/worsened classification

**Acceptance Criteria**
- verification runs after any executed action
- verification result is attached to incident history

---

## Epic F: Human Escalation and Approval Flow

### CLAW_OPS-016 — Implement human summary generator
**Priority:** P0
**Goal:** Produce concise, structured summaries for human recipients.

**Deliverables**
- summary template generator
- support for confidence, evidence, and next action
- redaction guardrails

**Acceptance Criteria**
- summaries include what happened, likely cause, evidence, status, and next action
- summaries omit secrets and sensitive payloads

---

### CLAW_OPS-017 — Implement approval request flow
**Priority:** P1
**Goal:** Request human approval for approval-gated actions.

**Deliverables**
- approval request object
- pending approval state
- approval timeout/expiry handling

**Acceptance Criteria**
- approval-gated actions create approval requests instead of executing directly
- approval result is stored against incident/action

---

## Epic G: Continuous Improvement Engine

### CLAW_OPS-018 — Implement lesson generation rules
**Priority:** P1
**Goal:** Create lesson candidates from recurring or high-toil incidents.

**Deliverables**
- heuristic evaluator
- lesson creation workflow
- incident-to-lesson linking

**Acceptance Criteria**
- incidents meeting configured thresholds generate lesson candidates
- lessons link back to originating incident fingerprints

---

### CLAW_OPS-019 — Implement improvement candidate generation
**Priority:** P1
**Goal:** Produce durable improvement proposals from incidents and lessons.

**Deliverables**
- improvement creation rules
- priority and effort fields
- status lifecycle

**Acceptance Criteria**
- repeated incidents can generate improvement candidates automatically
- improvements include evidence and expected benefit

---

### CLAW_OPS-020 — Build recurrence and toil analytics
**Priority:** P2
**Goal:** Surface what keeps happening and what keeps costing time/tokens.

**Deliverables**
- recurring incident views
- repeated approval reports
- repeated diagnostic step reports

**Acceptance Criteria**
- operator can identify top recurring incident families
- repeated approval patterns are queryable

---

## Epic H: Cognitive Observability

### CLAW_OPS-021 — Define cognitive metrics emission contract
**Priority:** P1
**Goal:** Standardize how prompt, token, retrieval, and tool metrics are emitted.

**Deliverables**
- metric field definitions
- emitter integration contract
- sample payloads

**Acceptance Criteria**
- metrics contract covers prompt tokens, completion tokens, retrieval count, tool failures, and estimated cost
- payloads align with `docs/claw-ops-schemas.md`

---

### CLAW_OPS-022 — Ingest and store cognitive metrics events
**Priority:** P1
**Goal:** Make cognitive/runtime metrics available to incident workflows.

**Deliverables**
- storage path for cognitive events
- lookup by session/workflow/time range
- link to incidents where relevant

**Acceptance Criteria**
- responder can query recent cognitive metrics during diagnosis
- token/prompt anomalies can be represented as incident evidence

---

### CLAW_OPS-023 — Create initial token/prompt anomaly rules
**Priority:** P2
**Goal:** Detect prompt amplification and token-cost regressions.

**Deliverables**
- initial alert thresholds
- anomaly event creation rules
- sample dashboards or reports

**Acceptance Criteria**
- anomalous prompt or token spikes generate normalized events
- false-positive behavior is documented and tunable

---

## Epic I: Deployment and Operations

### CLAW_OPS-024 — Draft Docker Compose stack for Claw Ops MVP
**Priority:** P0
**Goal:** Provide a concrete local/deployment stack for the observability plane.

**Deliverables**
- compose file or example compose stack
- volumes, networking, and persistence plan
- startup instructions

**Acceptance Criteria**
- stack can run all required MVP services locally
- persistent volumes are defined for durable state

---

### CLAW_OPS-025 — Add baseline dashboards and alerts
**Priority:** P1
**Goal:** Ship usable visibility from day one.

**Deliverables**
- host health dashboard
- container health dashboard
- incident pipeline dashboard
- starter alert rules

**Acceptance Criteria**
- dashboards render key host/container health metrics
- alert rules cover minimum MVP incidents

---

### CLAW_OPS-026 — Monitor Claw Ops itself
**Priority:** P1
**Goal:** Ensure the monitoring system is observable too.

**Deliverables**
- event processor health metrics
- incident-store health checks
- responder success/failure metrics

**Acceptance Criteria**
- failures in Claw Ops components can themselves raise incidents or alerts

---

## Epic J: Testing and Validation

### CLAW_OPS-027 — Create fixture payload suite
**Priority:** P0
**Goal:** Make normalization and incident logic testable with realistic inputs.

**Deliverables**
- sample Alertmanager payloads
- sample Loki/custom payloads
- expected normalized outputs

**Acceptance Criteria**
- tests cover at least five representative alert/event cases

---

### CLAW_OPS-028 — Create incident simulation harness
**Priority:** P1
**Goal:** Test end-to-end responder flows without real outages.

**Deliverables**
- simulation runner
- fixture-driven incident replay
- expected action/summary assertions

**Acceptance Criteria**
- at least three runbooks can be exercised end-to-end in simulation

---

### CLAW_OPS-029 — Add redaction and secret-leak tests
**Priority:** P1
**Goal:** Prevent sensitive data from leaking into summaries, lessons, or logs.

**Deliverables**
- redaction test fixtures
- summary and lesson validation tests

**Acceptance Criteria**
- known secret-like patterns are blocked or redacted in output surfaces

---

## Recommended Build Order

### Phase 1 build order
1. CLAW_OPS-001
2. CLAW_OPS-002
3. CLAW_OPS-003
4. CLAW_OPS-004
5. CLAW_OPS-006
6. CLAW_OPS-007
7. CLAW_OPS-009
8. CLAW_OPS-010
9. CLAW_OPS-012
10. CLAW_OPS-013
11. CLAW_OPS-016
12. CLAW_OPS-024
13. CLAW_OPS-027

### Phase 2 follow-ons
- CLAW_OPS-011
- CLAW_OPS-014
- CLAW_OPS-015
- CLAW_OPS-017
- CLAW_OPS-018
- CLAW_OPS-019
- CLAW_OPS-021
- CLAW_OPS-022
- CLAW_OPS-025
- CLAW_OPS-026

### Phase 3 leverage
- CLAW_OPS-020
- CLAW_OPS-023
- CLAW_OPS-028
- CLAW_OPS-029

## Definition of MVP Complete
Claw Ops MVP is complete when:
- alerts can be ingested and normalized
- incidents are persisted and deduplicated
- responder workflows can gather diagnostics for core incident classes
- human summaries are generated clearly and safely
- approval-gated actions are blocked pending approval
- recurring incidents can create lesson/improvement artifacts
- host/container/gateway issues are visible end-to-end in a running stack
