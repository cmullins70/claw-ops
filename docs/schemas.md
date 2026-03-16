# Claw Ops Schemas

This document defines the initial machine-readable objects for Claw Ops MVP.

## 1. Signal
Raw or near-raw operational input before incident normalization.

```json
{
  "signal_id": "uuid",
  "timestamp": "ISO-8601",
  "source_type": "prometheus|loki|uptime|cron|openclaw|custom",
  "source_name": "string",
  "signal_name": "string",
  "component": "host|container|gateway|cron|memory|prompt|tooling|security",
  "entity_id": "string",
  "severity": "info|warning|high|critical",
  "summary": "string",
  "labels": {},
  "annotations": {},
  "evidence": {},
  "dedup_key": "string"
}
```

## 2. Incident
Normalized operational issue created from one or more signals.

```json
{
  "incident_id": "uuid",
  "fingerprint": "string",
  "title": "string",
  "status": "open|acknowledged|investigating|mitigated|resolved|suppressed",
  "severity": "info|warning|high|critical",
  "root_cause_class": "string|null",
  "confidence": 0.74,
  "components": ["gateway", "container"],
  "first_seen_at": "ISO-8601",
  "last_seen_at": "ISO-8601",
  "recurrence_count": 3,
  "evidence": [],
  "actions_attempted": [],
  "approval_state": null,
  "suppression_until": null,
  "linked_lessons": [],
  "linked_improvements": []
}
```

### Suggested Root Cause Classes
- host_unreachable
- memory_pressure
- disk_pressure
- container_restart_loop
- gateway_unavailable
- cron_failure
- provider_latency
- prompt_amplification
- retrieval_degradation
- tooling_failure
- security_drift
- observability_gap
- unknown

## 3. Action Attempt
Tracks what the system already tried for an incident.

```json
{
  "action_id": "uuid",
  "incident_id": "uuid",
  "action": "gateway.restart",
  "policy_class": "autonomous|approval_gated|human_only",
  "requested_at": "ISO-8601",
  "executed_at": "ISO-8601|null",
  "requested_by": "agent|human|system",
  "status": "proposed|approved|executed|blocked|failed|rolled_back",
  "result_summary": "string|null",
  "verification_result": "pending|improved|no_change|worsened|null"
}
```

## 4. Policy
Defines whether and how an action may be performed.

```json
{
  "policy_id": "restart_gateway",
  "action": "gateway.restart",
  "class": "autonomous|approval_gated|human_only",
  "preconditions": [
    "incident.component includes 'gateway'"
  ],
  "rollback": "restart previous service state if possible",
  "verification": [
    "gateway healthcheck passes within 60s"
  ],
  "notes": "Only approval-gated in MVP"
}
```

## 5. Runbook
Semi-executable workflow for response logic.

```json
{
  "runbook_id": "gateway_unavailable_v1",
  "name": "Gateway unavailable",
  "triggers": ["gateway healthcheck failed"],
  "facts_to_gather": [
    "recent gateway logs",
    "container status",
    "host reachability",
    "recent deploy or config change evidence"
  ],
  "classification_rules": [
    "if host reachable and container stopped => container failure",
    "if host unreachable => host/network issue"
  ],
  "autonomous_actions": [
    "collect diagnostics",
    "annotate incident"
  ],
  "approval_gated_actions": [
    "restart gateway",
    "restart container"
  ],
  "verification_checks": [
    "gateway healthcheck succeeds",
    "error rate falls below threshold"
  ],
  "human_escalation_template": "Gateway unavailable. Likely cause: {{cause}}. Confidence: {{confidence}}. Recommendation: {{next_action}}.",
  "improvement_prompts": [
    "Was there missing instrumentation?",
    "Should this incident have been prevented or detected earlier?"
  ]
}
```

## 6. Diagnosis
Structured output from the agent responder.

```json
{
  "incident_id": "uuid",
  "primary_hypothesis": "prompt_amplification",
  "confidence": 0.71,
  "alternative_hypotheses": [
    "provider_latency",
    "cron_overlap"
  ],
  "evidence_summary": [
    "prompt size p95 up 2.4x",
    "host CPU stable",
    "cron overlap began 6 minutes before latency spike"
  ],
  "recommended_next_actions": [
    "inspect overlapping cron windows",
    "cap retrieval volume for heartbeat flow"
  ],
  "missing_information": []
}
```

## 7. Lesson
Structured learning from an incident.

```json
{
  "lesson_id": "uuid",
  "incident_fingerprint": "string",
  "root_cause_class": "cron_overlap",
  "summary": "Overlapping heavy cron runs correlate with prompt and token spikes and latency degradation.",
  "evidence": [],
  "confidence": 0.82,
  "recommended_changes": [
    "stagger cron schedules by 10 minutes",
    "add prompt-size p95 dashboard"
  ],
  "status": "proposed|accepted|rejected|implemented"
}
```

## 8. Improvement
Tracked durable change proposal.

```json
{
  "improvement_id": "uuid",
  "title": "Stagger heavy background jobs to reduce prompt amplification periods",
  "category": "availability|security|efficiency|cognitive_health|continuous_improvement",
  "source": "recurring_incident|human_correction|token_anomaly|runbook_gap",
  "priority": "low|medium|high|critical",
  "expected_benefit": "reduce latency and token spikes",
  "effort": "low|medium|high",
  "approval_required": true,
  "status": "proposed|approved|in_progress|implemented|rejected",
  "linked_incidents": []
}
```

## 9. Human Summary Payload
Human-facing incident summary generated by the agent.

```json
{
  "incident_id": "uuid",
  "summary": "Gateway latency increased sharply over 10 minutes.",
  "likely_cause": "prompt_amplification",
  "confidence": 0.71,
  "evidence_highlights": [
    "prompt size p95 up 2.4x",
    "token spend up 1.9x",
    "host CPU remained stable"
  ],
  "actions_taken": [
    "collected logs",
    "captured current cron overlap state"
  ],
  "status": "investigating",
  "recommended_next_action": "Approve temporary stagger of two heavy cron jobs",
  "approval_required": true
}
```

## 10. Cognitive Metrics Event
Optional normalized object for Kyra-specific runtime health.

```json
{
  "metric_event_id": "uuid",
  "timestamp": "ISO-8601",
  "session_id": "string",
  "workflow": "heartbeat|discord_reply|cron|subagent|tool_chain",
  "prompt_tokens": 18420,
  "completion_tokens": 912,
  "estimated_cost_usd": 0.183,
  "retrieval_count": 3,
  "retrieval_latency_ms": 114,
  "tool_calls": 6,
  "tool_failures": 1,
  "context_saturation_pct": 0.81,
  "notes": "Large memory injection due to repeated daily-note retrieval"
}
```

## 11. Improvement Trigger Heuristics
These are not strict schemas, but recommended MVP rules for creating lessons or improvements.

Create a lesson or improvement when any of the following is true:
- same incident fingerprint recurs 3 or more times in 14 days
- identical approval-gated action requested 3 or more times in 30 days
- token cost of diagnosis exceeds threshold for the same incident family repeatedly
- repeated alert acknowledged as low-value or noisy
- root cause was difficult to establish due to missing telemetry
- human corrects agent diagnosis or remediation approach

## 12. Storage Recommendation
For MVP:
- structured objects in sqlite
- optional export or sync of accepted lessons and improvements into markdown docs for human review
- avoid storing secrets in any object payloads

## 13. Versioning Guidance
Each schema-bearing record should eventually include:
- `schema_name`
- `schema_version`

For MVP, versioning can be document-level if implementation speed matters.
