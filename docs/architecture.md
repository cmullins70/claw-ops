# Claw Ops Technical Architecture

## Title
Technical Architecture: Claw Ops MVP

## Overview
Claw Ops consists of six logical layers:
1. telemetry collection
2. event normalization
3. incident state
4. policy and runbooks
5. agent responder
6. learning and continuous improvement

The architecture should support a single-host OpenClaw deployment first, while remaining extensible.

## Layer 1: Telemetry Collection

### OSS Components
- **Prometheus** for metrics
- **Alertmanager** for alert routing
- **Grafana** for dashboards
- **node_exporter** for host metrics
- **cAdvisor** for container metrics
- **Loki + Promtail** for logs
- **Blackbox Exporter** for HTTP, TCP, and DNS checks
- **Uptime Kuma** optionally for simple reachability checks
- **Restic** for backup hygiene
- **Trivy** optionally for image vulnerability scanning

### Telemetry Domains

#### Host telemetry
- CPU
- memory
- disk usage
- inode usage
- load
- network reachability
- reboot and uptime
- OOM signals where available

#### Container telemetry
- container status
- restart count
- memory and CPU usage
- filesystem growth
- healthcheck status

#### OpenClaw telemetry
- gateway status
- cron success and failure
- security audit status
- update status
- tool error counts if instrumented

#### Cognitive telemetry
- prompt bytes or tokens
- completion tokens
- estimated model cost
- memory retrieval count
- retrieval latency
- tool latency and failure
- session compaction or context saturation events
- repeated large file read patterns if instrumented

## Layer 2: Event Normalization

### Purpose
Convert heterogeneous alerts, log anomalies, and check failures into a common incident-ready schema.

### Inputs
- Alertmanager webhooks
- log anomaly hooks
- scheduled healthcheck outputs
- OpenClaw cron and job run hooks
- custom app metric threshold crossings

### Event Processor
A lightweight event processor service should:
- receive alerts and events
- enrich them with stable labels
- generate a dedup key
- emit normalized events
- open or update incident state

A small Node service is sufficient for MVP.

## Layer 3: Incident State

### Purpose
Give the agent memory of the current incident lifecycle.

### Required Stored State
- incident id
- fingerprint
- title
- status
- severity
- likely root cause class
- confidence
- affected components
- first seen and last seen
- recurrence count
- evidence snapshots
- actions attempted
- approval requests issued
- cooldown or suppression state
- linked lessons and improvements

### Suggested Initial Storage
- **sqlite** for MVP
  - simple
  - local
  - durable enough for one-host deployment

Postgres can be considered later if operational scale justifies it.

## Layer 4: Policy and Runbooks

### Policy Model
Each action belongs to one of three classes:

#### Autonomous
Examples:
- fetch logs
- query metrics
- rerun read-only health checks
- annotate incident
- suppress duplicates briefly

#### Approval-gated
Examples:
- restart container
- restart gateway
- pause a noisy cron
- prune temp artifacts
- reduce a retention window

#### Human-only
Examples:
- firewall changes
- secret rotation
- auth changes
- deleting durable data
- package upgrades
- global provider or model changes

### Runbook Model
Runbooks should be executable or semi-executable decision trees with:
1. trigger conditions
2. facts to gather
3. classification rules
4. allowed autonomous actions
5. approval-required actions
6. verification checks
7. escalation templates
8. improvement prompts

### Initial Runbooks
- gateway unavailable
- container restart loop
- disk usage high
- memory pressure or OOM suspicion
- cron failure streak
- provider latency degradation
- token usage anomaly
- prompt size anomaly
- memory retrieval anomaly

## Layer 5: Agent Responder

### Purpose
Use normalized incident data plus policy and runbooks to act as first responder.

### Response Flow
1. Incident opens or updates.
2. Agent receives incident payload.
3. Agent retrieves the runbook and policy.
4. Agent gathers diagnostics.
5. Agent classifies likely cause with confidence.
6. Agent decides one of:
   - autonomous action
   - approval request
   - summary only
7. Agent verifies results.
8. Agent sends a human summary if needed.
9. Agent generates lesson and improvement output if warranted.

### Human Messaging Requirements
Human-facing summaries should include:
- incident summary
- likely cause and confidence
- evidence highlights
- actions already taken
- verification result
- recommended next action
- approval request if necessary

## Layer 6: Learning and Continuous Improvement

### Purpose
Convert repeated pain into durable operational changes.

### Inputs
- incidents
- recurring incidents
- repeated manual approvals
- repeated low-value alerts
- repeated expensive investigations
- repeated cognitive inefficiencies
- human corrections

### Outputs
- lessons
- improvement candidates
- runbook updates
- threshold tuning suggestions
- prompt optimization suggestions
- memory hygiene suggestions
- cron rescheduling proposals
- requests for new instrumentation

## Deployment Model

### Initial Deployment
A single-host Docker Compose stack containing:
- Grafana
- Prometheus
- Alertmanager
- Loki
- Promtail
- node_exporter
- cAdvisor
- Blackbox Exporter
- optional Uptime Kuma
- Claw Ops event processor
- incident sqlite volume

### Future Optional Additions
- Postgres
- task queue
- dedicated specialist responder agents
- policy admin UI
- richer incident timeline UI

## End-to-End Data Flow
1. Exporters emit metrics and logs.
2. Prometheus, Loki, Uptime, or custom hooks generate alerts or events.
3. The event processor normalizes them.
4. The incident store opens or updates an incident.
5. The agent responder investigates.
6. Policy determines allowed actions.
7. Verification updates incident state.
8. Human summary is sent if needed.
9. Lesson and improvement artifacts are generated on closure or recurrence.

## Reliability Considerations
- event processor should fail safely
- incidents should be durable across restarts
- retries must be bounded
- verification should be explicit, not assumed
- observability impairment should itself become an incident class

## Security Considerations
- agent action permissions must be bounded explicitly
- secrets must not be written into incident summaries or lessons
- all actions must be auditable
- approval-gated actions should preserve exact command intent where relevant
- logs and lessons should be redacted where necessary

## Observability of Claw Ops Itself
Monitor:
- event processor uptime
- incident store health
- webhook delivery success
- responder agent success or failure
- time from alert to incident creation
- time from incident creation to first summary
- number of stuck incidents

## Architecture Decisions to Revisit Later
- sqlite vs Postgres
- markdown vs structured storage for lessons and improvements
- direct app instrumentation vs sidecar for cognitive metrics
- approval UX and audit UX
- specialist-agent routing patterns
