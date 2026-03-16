# Claw Ops Execution Plan

## Purpose
This document is the working execution plan for taking Claw Ops from concept and scaffolding to a deployed, usable Phase 1 system on `kyra-nest`, then iterating toward fuller agent-first monitoring, response, and continuous improvement.

It is intended to be actionable by Kyra and humans as a shared implementation plan.

---

## 0. Outcome Definition

### Target outcome
Deploy a safe Phase 1 Claw Ops side stack on `kyra-nest` that:
- observes host, container, and OpenClaw runtime health
- normalizes incidents into machine-readable records
- supports policy/runbook-driven agent response
- stays private-by-default
- operates within explicit resource bounds
- produces useful human summaries
- creates a path to continuous improvement

### Explicit non-goal for Phase 1
Do not try to ship full autonomous remediation, broad public admin surfaces, or a heavyweight enterprise observability platform in the first pass.

---

## 1. Current State Summary

### Already completed
- Vision doc created
- MVP PRD created
- Technical architecture spec created
- Schema doc created
- Implementation tickets created
- Starter runbooks and policies doc created
- Machine-readable policy files created
- Machine-readable runbook files created
- Broad starter Docker Compose scaffold created
- Safer `kyra-nest` Phase 1 Compose profile created
- Host preflight assessment completed
- `kyra-nest` recommendation established: separate same-host side stack, private-by-default, conservative first deployment

### Key artifacts already present
- `docs/claw-ops-vision.md`
- `docs/claw-ops-prd.md`
- `docs/claw-ops-architecture.md`
- `docs/claw-ops-schemas.md`
- `docs/claw-ops-implementation-tickets.md`
- `docs/claw-ops-runbooks-and-policies.md`
- `docs/claw-ops-preflight-assessment-kyra-nest.md`
- `claw-ops/policies/*`
- `claw-ops/runbooks/*`
- `claw-ops/docker-compose.phase1.yml`

### Important known issues to factor into the plan
- OpenClaw host CLI/runtime version drift exists
- `kyra-nest` already has several exposed services
- OpenClaw ports are currently broadly bound
- Event processor is still a placeholder
- No validation layer exists yet for runbooks/policies
- No incident store exists yet
- No actual approval workflow exists yet

---

## 2. Strategy

### Delivery strategy
Build this in four tracks that can progress mostly in parallel but converge in order:

1. **Platform track**
   - safe deployment shell
   - config refinement
   - resource and security posture

2. **Core app track**
   - event processor
   - incident store
   - policy/runbook loading
   - responder skeleton

3. **Observability track**
   - alert rules
   - baseline dashboards
   - selective logging
   - observability-of-observability

4. **Operationalization track**
   - runbooks
   - approval patterns
   - backlog/lesson generation
   - rollout and verification

### Guiding principle
Bias toward a **thin working spine** over broad incomplete capability.

That means the first goal is not “everything.” The first goal is:
- ingest an alert
- normalize it
- store/update an incident
- attach a runbook/policy
- produce a useful human summary

Once that spine works, expand.

---

## 3. Phase Plan

## Phase A — Stabilize the deployment shell
**Goal:** Make the Claw Ops deployment profile safe enough to stand up on `kyra-nest` without surprising the host.

### Tasks
1. Replace placeholder secrets in Phase 1 config model.
2. Add `.env.example` / env contract for Phase 1.
3. Add healthchecks to core services.
4. Refine Promtail scope so log ingestion is intentionally narrow.
5. Decide whether Loki is enabled on day one or held back until Phase C.
6. Add resource budget notes directly into deployment docs.
7. Add a host-side bring-up script for the Phase 1 stack.

### Deliverables
- hardened-ish Phase 1 compose profile
- env template
- bring-up instructions or deploy script
- explicit day-one service list

### Exit criteria
- Claw Ops Phase 1 stack can be deployed privately on `kyra-nest`
- no accidental all-interface admin exposure
- all placeholder secrets are gone from deployable config

---

## Phase B — Build the working spine
**Goal:** Create the smallest working Claw Ops core.

### Scope
- webhook intake
- event normalization
- sqlite incident store
- policy/runbook loader
- incident open/update/dedup logic
- human summary output contract

### Tasks
1. Create `claw-ops/app/` service skeleton.
2. Add config loader.
3. Add schema validation for normalized events.
4. Implement Alertmanager webhook receiver.
5. Implement source adapter for Alertmanager payloads.
6. Create sqlite schema and migrations.
7. Implement incident repository.
8. Implement incident dedup/fingerprint logic.
9. Load policies from `claw-ops/policies/`.
10. Load runbooks from `claw-ops/runbooks/`.
11. Implement human summary generator.
12. Add `/health` endpoint for the event processor.
13. Add fixture tests for alert ingestion and normalization.

### Deliverables
- runnable event processor service
- normalized event ingestion path
- persisted incidents
- summaries generated from incident context

### Exit criteria
- a test alert can produce a stored incident and a human summary
- the event processor passes healthchecks
- policies and runbooks fail fast if invalid

---

## Phase C — Connect the observability plane
**Goal:** Wire baseline signals into the working spine.

### Scope
- Prometheus alerts
- Blackbox checks
- host/container metrics
- selective logs if Loki/Promtail are enabled

### Tasks
1. Validate Prometheus scrape targets.
2. Validate baseline alert rules against real host/container state.
3. Point Alertmanager at the event processor.
4. Test end-to-end alert flow using synthetic alerts.
5. If Loki enabled, validate log ingestion and retention behavior.
6. Add initial Grafana datasources and one baseline dashboard.
7. Add basic “Claw Ops health” metrics/dashboard.

### Deliverables
- end-to-end alert pipeline
- baseline host/container visibility
- basic dashboard(s)

### Exit criteria
- a real or synthetic alert appears as an incident in Claw Ops
- no obvious alert storm or excessive log growth
- observability components stay within expected resource bounds

---

## Phase D — Add responder intelligence
**Goal:** Give Claw Ops useful first-response behavior without overreaching.

### Scope
- diagnostics gathering
- diagnosis schema
- verification logic
- approval-gated action framework (initially placeholder/manual)

### Tasks
1. Implement diagnostics fetch layer for core incident classes.
2. Implement diagnosis object schema and validation.
3. Implement verification flow and persistence.
4. Add action authorization layer using policy classes.
5. Add pending approval record model.
6. Support summary generation that includes requested approvals.
7. Add at least three fully wired runbooks:
   - gateway unavailable
   - container restart loop
   - disk pressure

### Deliverables
- first-response workflow for core incidents
- approval-aware summaries
- verification results attached to incident timelines

### Exit criteria
- Claw Ops can gather diagnostics and recommend next action for at least 3 incident classes
- approval-gated actions are blocked from automatic execution
- verification result is stored for executed/test actions

---

## Phase E — Add continuous improvement loop
**Goal:** Make the system compound rather than just react.

### Scope
- lesson generation
- improvement candidate generation
- recurrence/toil heuristics

### Tasks
1. Implement lesson creation heuristics.
2. Implement improvement candidate creation heuristics.
3. Link incidents to lessons and improvements.
4. Add recurrence counters and threshold logic.
5. Add repeated-approval and repeated-incident views.
6. Add a reviewable backlog output format.

### Deliverables
- lessons
- improvement candidates
- recurring pain detection

### Exit criteria
- repeated incidents automatically generate structured learning artifacts
- humans can review proposed improvements clearly

---

## Phase F — Add cognitive observability
**Goal:** Monitor Kyra’s own runtime and cognition as first-class operational signals.

### Scope
- prompt/token metrics
- retrieval metrics
- tool failure metrics
- anomaly detection hooks

### Tasks
1. Finalize cognitive metrics contract.
2. Add storage path for cognitive metrics events.
3. Add lookup by workflow/session/time range.
4. Add prompt/token anomaly incident generation.
5. Add retrieval degradation incident generation.
6. Correlate cognitive metrics with cron and runtime context.

### Deliverables
- cognitive metrics ingestion path
- first anomaly rules for token/prompt/retrieval health

### Exit criteria
- token/prompt anomalies can become incidents
- responder can use cognitive evidence during diagnosis

---

## 4. Recommended Immediate Task Order

### Next 10 tasks to do in order
1. Create `.env.example` for Phase 1 deployment
2. Add healthchecks to `docker-compose.phase1.yml`
3. Create Phase 1 host deploy/start script
4. Create `claw-ops/app/` skeleton
5. Implement config loader
6. Implement `/health` endpoint
7. Implement Alertmanager webhook receiver
8. Implement sqlite schema + migrations
9. Implement incident open/update/dedup logic
10. Implement policy/runbook loader + validation

These ten tasks create the backbone needed to start iterating quickly.

---

## 5. Work Breakdown by Artifact

## A. Deployment artifacts
Need to exist:
- `claw-ops/.env.example`
- `claw-ops/scripts/deploy-phase1.sh`
- `claw-ops/scripts/validate-config.sh`
- updated `docker-compose.phase1.yml`

## B. App artifacts
Need to exist:
- `claw-ops/app/package.json`
- `claw-ops/app/src/index.*`
- `claw-ops/app/src/config.*`
- `claw-ops/app/src/webhooks/alertmanager.*`
- `claw-ops/app/src/incidents/*`
- `claw-ops/app/src/policies/*`
- `claw-ops/app/src/runbooks/*`
- `claw-ops/app/src/db/*`

## C. Test artifacts
Need to exist:
- `claw-ops/app/test/fixtures/alertmanager/*.json`
- `claw-ops/app/test/normalization.*`
- `claw-ops/app/test/incidents.*`
- `claw-ops/app/test/redaction.*`

## D. Operational artifacts
Need to exist:
- one baseline Grafana dashboard
- one synthetic alert test path
- one documented end-to-end validation flow

---

## 6. Dependencies and Gates

### Gate 1 — deployability gate
Before any real deployment:
- secrets must not be placeholders
- loopback-only bindings must be preserved
- service limits must exist

### Gate 2 — ingestion gate
Before claiming MVP progress:
- Alertmanager webhook must work
- incidents must persist
- dedup must work

### Gate 3 — responder gate
Before any action logic:
- policies must load cleanly
- runbooks must load cleanly
- autonomous vs approval-gated behavior must be enforced

### Gate 4 — improvement gate
Before claiming continuous improvement:
- recurrence thresholds must produce structured outputs
- lessons/improvements must be queryable and reviewable

---

## 7. Risks and Mitigations

### Risk: accidental exposure of new admin surfaces
**Mitigation:** bind to `127.0.0.1`, keep private-by-default, review ports before deploy.

### Risk: Loki/logging growth creates noise or disk churn
**Mitigation:** low retention, narrow log scope, make Loki optional in early deployment.

### Risk: event processor remains too vague and never becomes real
**Mitigation:** prioritize the working spine over more docs.

### Risk: action/remediation scope gets ahead of safety model
**Mitigation:** no autonomous remediation in Phase 1 beyond diagnostics/annotation.

### Risk: version/config drift in existing OpenClaw environment complicates diagnosis
**Mitigation:** explicitly track host CLI/runtime drift as a parallel cleanup item.

---

## 8. Parallel Cleanup / Hygiene Items
These are not blockers for Claw Ops, but should be tracked.

1. Normalize OpenClaw host CLI/runtime version drift.
2. Review whether OpenClaw ports `18789/18790` should remain broadly exposed.
3. Review whether the existing `9090` listener conflicts with Claw Ops plans.
4. Review Portainer/Speaches exposure posture.

---

## 9. Definition of Phase 1 Success
Phase 1 is successful when all of the following are true:
- Claw Ops runs as a separate same-host side stack on `kyra-nest`
- the stack is private-by-default
- core services respect resource limits
- Alertmanager can deliver an alert to the event processor
- the event processor normalizes and stores an incident
- policies and runbooks load and validate
- Claw Ops can produce a useful human summary for at least one real/synthetic alert
- deployment and validation are documented well enough to repeat

---

## 10. Working Mode Recommendation
Use this document as the execution source of truth.

Recommended working loop:
1. pick the next small batch of tasks
2. implement them
3. validate them end-to-end
4. update docs/config/tests immediately
5. keep the spine working at every step

Do not expand into later phases until the earlier phase has a working, testable path.

---

## 11. Suggested First Execution Batch
If starting immediately, do this batch first:
- create `.env.example`
- add compose healthchecks
- add Phase 1 deploy script
- scaffold event processor app
- implement `/health`
- implement Alertmanager webhook route
- implement sqlite bootstrap
- implement incident create/update path

This is the highest-leverage first slice.
