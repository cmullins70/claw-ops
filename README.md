# Claw Ops

Agent-first monitoring, incident response, and continuous improvement for OpenClaw-like systems.

## What it is
Claw Ops is a generic operational control plane for agentic systems. It is designed around an agent-first operating model where an agent is the first observer, first triager, and bounded first responder, while humans retain control over high-risk actions.

## Core ideas
- structured signals over ad hoc logs
- incidents as machine-readable state
- policy-bounded autonomy
- executable runbooks
- cognitive/runtime observability
- continuous improvement from repeated pain

## Repository structure
- `docs/` — product, architecture, schema, and execution docs
- `deploy/` — Compose files and deployment config
- `policies/` — machine-readable action policies
- `runbooks/` — machine-readable runbooks
- `app/` — event processor and core application code

## Current status
This repository is scaffold-first. The initial focus is a safe Phase 1 deployment profile plus the smallest working app spine:
- `/health`
- alert intake
- normalized events
- incident persistence
- policy/runbook loading

## Phase 1 principles
- private-by-default
- explicit resource limits
- conservative retention
- no broad autonomous remediation
- side-stack deployment rather than modifying the primary app container

## Safety model
Claw Ops distinguishes between:
- autonomous actions
- approval-gated actions
- human-only actions

High-risk system changes should never be executed automatically in the initial phases.

## Next steps
1. scaffold the event processor app
2. implement Alertmanager webhook intake
3. persist normalized incidents in sqlite
4. load policies and runbooks with validation
5. connect the Phase 1 observability stack end-to-end
