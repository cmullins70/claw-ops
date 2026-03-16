# Claw Ops Starter Runbooks and Policies

This document defines the first runbooks and action policies for Claw Ops MVP.

## Policy Classes

### Autonomous
The agent may perform these without human approval when the relevant runbook allows them:
- collect logs
- collect metrics snapshots
- collect recent cron/job history
- annotate incident state
- suppress duplicate incidents for a short cooldown
- rerun read-only health checks
- create lesson or improvement candidates

### Approval-Gated
The agent may propose these, but must not execute them without explicit human approval:
- restart OpenClaw gateway
- restart application container
- stop or pause a noisy cron
- prune temp files or caches
- reduce log retention settings
- restart non-core observability services

### Human-Only
The agent must never perform these autonomously in MVP:
- firewall changes
- SSH or access control changes
- secret rotation or credential replacement
- package upgrades on host
- deletion of durable memory, lessons, or archived logs
- global model/provider changes
- backup retention or restore actions that risk data loss

---

## Global Policy Guardrails
- Always gather diagnostics before proposing remediation unless the incident class is explicitly exempt.
- Always verify after any executed action.
- Never expose secrets in summaries, lessons, or improvements.
- Never repeat the same autonomous action indefinitely; use retry budgets.
- Escalate when confidence is low, evidence is conflicting, or remediation fails.
- Treat observability impairment as its own incident class.

---

## Runbook 1: Gateway Unavailable

### Trigger
- gateway healthcheck fails
- OpenClaw status endpoint unavailable
- repeated inbound failures suggest gateway unreachability

### Facts to Gather
- gateway process/container status
- recent gateway logs
- host reachability
- recent deploy, config, or restart evidence
- reverse proxy or ingress signals if present

### Classification Heuristics
- if host unreachable -> likely host/network issue
- if host reachable and container stopped -> likely container or process failure
- if process up but healthcheck failing -> likely application failure or dependency issue

### Autonomous Actions
- collect logs
- collect recent metrics snapshot
- annotate incident
- rerun read-only health/status checks

### Approval-Gated Actions
- restart gateway process
- restart application container

### Human-Only Actions
- modify exposure, proxy, firewall, DNS, or auth settings

### Verification
- gateway healthcheck passes within 60 seconds
- inbound error rate falls
- no immediate restart loop resumes

### Improvement Prompts
- Was there an earlier warning signal we failed to surface?
- Should gateway dependency health be monitored separately?
- Should a safe restart path be automated after approval?

---

## Runbook 2: Container Restart Loop

### Trigger
- container restart count exceeds threshold in rolling window
- repeated exit events detected

### Facts to Gather
- restart count over time
- last exit code
- recent container logs
- host memory/disk pressure
- deploy or config changes preceding loop

### Classification Heuristics
- exit 137 + high memory pressure -> likely OOM or memory pressure
- immediate restart after deploy -> likely bad config/image/startup path
- disk nearly full -> likely write/start failure

### Autonomous Actions
- collect container logs
- collect host memory/disk metrics
- annotate likely cause candidates

### Approval-Gated Actions
- restart container manually
- temporarily pause dependent cron load if clearly contributing

### Human-Only Actions
- change image, compose topology, secrets, or host-level runtime config

### Verification
- restart count stabilizes
- container remains healthy for configured interval
- memory or disk pressure is reduced or stable

### Improvement Prompts
- Should memory limits or alerts be adjusted?
- Do we need pre-deploy health validation?
- Should this incident have auto-correlated with disk/memory metrics?

---

## Runbook 3: Disk Pressure High

### Trigger
- disk usage exceeds warning or critical threshold
- inode usage exceeds threshold

### Facts to Gather
- top growing paths
- recent log volume growth
- artifact/transcript/temp growth
- Loki/chunk retention growth if applicable
- available inodes and write failures

### Classification Heuristics
- logs growing rapidly -> retention or verbosity issue
- artifacts/temp growing -> cleanup or retention issue
- container overlay growth -> image/container/runtime issue

### Autonomous Actions
- gather top disk consumers
- gather recent growth rates
- annotate likely source path
- rerun disk checks after cooldown

### Approval-Gated Actions
- prune temp artifacts or caches
- reduce retention windows
- restart a service if log runaway is caused by restart storm and restart is approved

### Human-Only Actions
- delete durable archives
- resize storage or repartition disks
- alter backup retention destructively

### Verification
- disk usage trend flattens or drops
- write failures stop
- no critical service remains at imminent risk

### Improvement Prompts
- Should retention be lowered?
- Should large artifact classes be isolated onto separate storage?
- Should disk growth per path be monitored continuously?

---

## Runbook 4: Cron Failure Streak

### Trigger
- same cron/job fails multiple times in a row
- scheduled task misses expected success window

### Facts to Gather
- last successful run
- last N failures
- error output/logs
- external dependency status
- overlapping jobs and load conditions

### Classification Heuristics
- auth-related error text -> credential or connector drift
- timeout under heavy load -> overlap/resource contention
- repeated schema/tooling failure -> integration contract drift

### Autonomous Actions
- collect job history
- collect last failure logs
- correlate with host/container/cognitive load around failures
- annotate suspected dependency or overlap cause

### Approval-Gated Actions
- pause the cron temporarily
- stagger the cron schedule
- rerun the job manually if safe and approved

### Human-Only Actions
- rotate credentials
- reauthorize external integrations
- change business-critical external behavior without review

### Verification
- next run succeeds
- failure streak resets
- correlated system pressure subsides if that was causal

### Improvement Prompts
- Should this cron emit richer structured outcomes?
- Should overlapping jobs be staggered by policy?
- Should auth drift have its own pre-incident detector?

---

## Runbook 5: Provider Latency Degradation

### Trigger
- model/provider latency exceeds threshold
- request timeout rate increases
- responses slow without corresponding host pressure

### Facts to Gather
- provider latency p50/p95 trend
- timeout and retry counts
- host CPU/memory state
- prompt size trend
- concurrent workflow volume

### Classification Heuristics
- provider latency up, host stable, prompt stable -> provider issue likely
- provider latency up, prompt up sharply -> prompt amplification may be primary or contributing
- latency + retry surge -> upstream instability

### Autonomous Actions
- gather recent latency/token metrics
- gather retry/error counts
- annotate whether issue seems provider-side or self-induced

### Approval-Gated Actions
- fail over to alternate provider/model path if such a policy exists
- temporarily disable nonessential high-cost workflows

### Human-Only Actions
- permanent provider/model strategy changes
- commercial contract/escalation changes

### Verification
- latency returns toward baseline
- timeout rate declines
- response success rate improves

### Improvement Prompts
- Do we need provider-specific SLOs?
- Should prompt size be part of provider-latency triage every time?
- Do we need failover policies for premium workflows?

---

## Runbook 6: Prompt or Token Anomaly

### Trigger
- prompt tokens exceed threshold for workflow baseline
- token cost spikes beyond configured budget band
- prompt size p95 regresses sharply

### Facts to Gather
- workflow/session involved
- prompt token trend
- completion token trend
- memory retrieval count/size
- repeated file reads/tool outputs
- concurrent cron/subagent conditions

### Classification Heuristics
- retrieval count up sharply -> retrieval overfetch likely
- repeated large file reads -> context duplication likely
- overlapping background workflows -> schedule/design issue likely
- completion spike without prompt spike -> downstream verbosity issue likely

### Autonomous Actions
- gather prompt/token metrics
- correlate with retrieval and tool-call patterns
- annotate likely amplification source

### Approval-Gated Actions
- temporarily pause the offending scheduled workflow
- apply temporary budget caps if such controls exist

### Human-Only Actions
- change global prompt policy
- permanently reduce context injection globally without review

### Verification
- prompt/token levels return toward baseline
- workflow still completes successfully
- latency and cost impact improve

### Improvement Prompts
- Should this workflow become a specialist agent?
- Should retrieval limits be tightened?
- Should repeated file contexts be summarized or cached?

---

## Runbook 7: Memory Retrieval Degradation

### Trigger
- retrieval latency spikes
- retrieval usefulness falls
- irrelevant memory repeatedly included in prompts
- memory lookup errors increase

### Facts to Gather
- retrieval latency and hit counts
- source documents retrieved
- usefulness markers or human corrections
- memory corpus size and recent growth
- repeated retrieval patterns by workflow

### Classification Heuristics
- large noisy corpus + irrelevant hits -> curation/index problem likely
- latency spike + large corpus growth -> scaling/index issue likely
- repeated wrong memories -> ranking or scope problem likely

### Autonomous Actions
- gather retrieval traces and stats
- identify repeated noisy documents
- create lesson/improvement candidate for curation if thresholds hit

### Approval-Gated Actions
- schedule memory cleanup task
- temporarily narrow retrieval scope for selected workflow if supported

### Human-Only Actions
- delete durable memory entries
- broad memory policy changes without review

### Verification
- retrieval latency improves
- irrelevant-hit rate declines
- user-facing workflow quality improves if measurable

### Improvement Prompts
- Should memory be tiered more aggressively?
- Should stale notes be archived?
- Should retrieval be scoped differently by workflow?

---

## Retry and Cooldown Policy
- Autonomous diagnostic actions: up to 2 retries when transient failure is likely.
- Autonomous remediation actions: none in MVP unless explicitly approved in policy.
- Approval-gated actions: no repeat proposal more than once per cooldown window unless incident severity increases.
- Duplicate incident summary suppression: 15 minutes by default for same active fingerprint unless severity worsens.

---

## Starter Approval Prompts

### Restart Gateway
"Gateway appears unhealthy. I collected diagnostics and recommend restarting the gateway. Approve restart?"

### Restart Container
"The application container is in a restart loop. I collected logs and host pressure metrics. Approve one restart attempt?"

### Pause Noisy Cron
"This scheduled job appears to be failing repeatedly and contributing to load/noise. Approve temporarily pausing it while we investigate?"

### Prune Temp Artifacts
"Disk pressure appears driven by temporary artifacts or caches. Approve pruning temporary data only, not durable archives?"

---

## Suggested Next Additions
After MVP, add runbooks for:
- observability pipeline impairment
- backup failure or stale backups
- security drift or permission drift
- Discord/channel delivery failures
- connector auth drift
