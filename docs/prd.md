# Claw Ops MVP PRD

## Title
PRD: Claw Ops MVP

## Problem Statement
OpenClaw deployments currently rely on a mix of basic host and container observability plus human interpretation. This is insufficient for Kyra because:
- many important failure modes are agent-specific, not just infrastructure-specific
- recurring operational pain is not systematically converted into durable improvements
- a human-centric monitoring flow creates avoidable toil, delay, and blind spots

We need an MVP that lets an agent:
1. receive operational signals
2. normalize them into incidents
3. gather context automatically
4. take or propose bounded actions
5. summarize clearly to humans
6. generate improvement candidates when patterns recur

## Goals
The MVP must:
- monitor host, container, and OpenClaw runtime health
- monitor basic Kyra cognitive and runtime metrics
- normalize alerts and events into incidents
- let an agent run safe diagnostics automatically
- support policy-based action boundaries
- summarize incidents to humans in a clear form
- create lessons and improvement items from recurring patterns

## Non-Goals
The MVP will not:
- support broad fully autonomous infrastructure changes
- replace all existing dashboards
- include a full visual incident-management product UI
- implement deep ML anomaly detection
- support multi-host or multi-cluster orchestration in the first milestone

## Primary Users

### 1. Kyra
Primary operational observer and responder.

### 2. Chris / McKitrick
Human approvers, reviewers, and recipients of escalations and recommendations.

### 3. Future specialist ops agents
Dedicated responders for security, infra, cost, or memory hygiene.

## User Stories

### Monitoring
- As Kyra, I want to receive structured alerts about host, container, and runtime degradation so I can triage issues without relying on a human dashboard review.
- As a human operator, I want important incidents summarized in plain language with evidence and recommended next actions.

### Diagnosis
- As Kyra, I want to automatically gather logs, metrics, and recent run context when an incident fires so I can classify likely root causes.

### Bounded Action
- As Kyra, I want to know which actions are autonomous, which require approval, and which are forbidden, so I can operate safely.

### Continuous Improvement
- As Kyra, I want repeated incidents and repeated manual toil to generate improvement candidates automatically.
- As a human, I want visibility into recurring problems, proposed fixes, and expected leverage.

### Cognitive Observability
- As Kyra, I want prompt size, token usage, retrieval behavior, and tool failures tracked so I can detect and reduce agent-specific inefficiency.

## MVP Scope

### In Scope
1. **Telemetry intake**
   - Prometheus alerts
   - uptime and service checks
   - Loki or log-derived events
   - cron and job run status
   - OpenClaw health and status outputs
2. **Incident normalization**
   - convert raw alerts and events into a common incident schema
3. **Incident state**
   - active incidents
   - recurrence counts
   - dedup fingerprints
   - cooldown and suppression state
4. **Policy enforcement**
   - classify candidate actions into autonomous, approval-gated, or human-only
5. **Agent response workflow**
   - context gathering
   - diagnosis summary
   - safe diagnostic actions
   - optional safe remediation actions
   - verification
6. **Human escalation**
   - concise update with evidence, confidence, and requested approval if needed
7. **Improvement generation**
   - recurring incidents create lessons and improvement candidates
8. **Kyra-specific metrics**
   - token usage
   - prompt size
   - tool latency and failure
   - retrieval counts
   - cron outcome visibility

### Out of Scope
- multi-tenant support
- general-purpose approval UI
- advanced simulation framework
- cross-environment fleet management
- full CMDB or asset inventory

## Functional Requirements

### FR1: Signal Ingestion
The system must ingest signals from:
- host metrics
- container metrics
- uptime checks
- logs
- scheduled job outcomes
- OpenClaw status, health, and security checks
- app-level cognitive and runtime metrics

### FR2: Incident Normalization
The system must normalize incoming signals into incidents with:
- incident id
- fingerprint
- severity
- source
- affected component(s)
- time detected
- evidence
- confidence
- likely root-cause class
- allowed actions by policy class

### FR3: Deduplication and Recurrence Tracking
The system must:
- group repeated equivalent incidents
- track recurrence count
- prevent repeated spam or escalation for the same active issue
- preserve history of prior actions attempted

### FR4: Agent Investigation
When an incident opens, the agent must be able to:
- retrieve recent relevant logs
- retrieve a recent metrics snapshot
- inspect recent cron and job history
- inspect token, prompt, and retrieval metrics where relevant
- classify a likely root cause with confidence score

### FR5: Policy-Bounded Actions
The system must support action classes:
- autonomous
- approval-gated
- human-only

### FR6: Verification
After any action, the system must:
- re-check the relevant health signals
- record whether the action improved, worsened, or did not change the issue

### FR7: Human Summaries
For nontrivial incidents, the system must produce a concise message containing:
- what happened
- what evidence supports the diagnosis
- what was already tried
- current status
- what action is recommended next
- whether approval is required

### FR8: Improvement Candidate Generation
For incidents that recur, are noisy, expensive to diagnose, or require repeated manual intervention, the system must generate:
- a lesson
- at least one improvement candidate
- evidence supporting the candidate

### FR9: Cognitive Observability
The system must record and expose:
- prompt size
- token usage
- token cost estimate
- retrieval count
- retrieval usefulness marker if available
- tool latency and failure counts
- session or context saturation indicators where possible

## Non-Functional Requirements
- structured JSON-native internal data model
- auditable action history
- reversible or restricted automation
- low operational overhead for a single-host deployment
- OSS-first components where practical
- graceful degradation if some telemetry sources are unavailable

## Core Entities
- Signal
- Incident
- Policy
- Runbook
- Lesson
- Improvement

See `docs/claw-ops-schemas.md` for proposed shapes.

## MVP Use Cases
1. Detect host, container, or gateway degradation.
2. Detect cron failure streaks.
3. Detect disk pressure and identify likely source.
4. Detect token or prompt anomalies.
5. Gather context automatically and summarize likely cause.
6. Request approval for medium-risk remediation.
7. Generate a backlog-worthy improvement from repeated pain.

## Success Metrics

### Reliability
- mean time to detect (MTTD)
- mean time to resolve (MTTR)
- incident recurrence rate

### Human Load
- incidents requiring human involvement
- repeated approval rate
- alert noise rate

### Agent Quality
- false escalation rate
- remediation success rate
- confidence calibration quality

### Efficiency
- token cost per incident
- average prompt size during incident handling
- repeated diagnostic-step count

### Improvement
- percentage of meaningful incidents producing lessons
- percentage of lessons converted to backlog items or rule updates
- recurrence reduction after accepted improvements

## Rollout Phases

### Phase 1
- baseline telemetry
- normalized incidents
- human summaries
- read-only diagnostics

### Phase 2
- policy engine
- autonomous low-risk actions
- recurrence and dedup state

### Phase 3
- improvement candidate generation
- cognitive metrics integration
- recurring toil detection

### Phase 4
- tighter runbook automation
- trend-based optimization
- broader specialist-agent routing

## Open Questions
- Where should incident state live initially: sqlite, postgres, files, or existing app state?
- Should lessons and improvements be stored in workspace markdown, structured DB, or both?
- What approval UX is best: Discord replies, OpenClaw-native approvals, or both?
- How should cognitive metrics be emitted: app logs, metrics endpoint, or sidecar?
- How aggressive should autonomous remediation be in MVP?

## Launch Recommendation
Start with a single-host, single-gateway deployment and optimize for:
- observability quality
- incident normalization quality
- safety of agent actions
- usefulness of human summaries
- measurable recurrence reduction
