#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
docker compose -f docker-compose.phase1.yml up -d

echo "Claw Ops Phase 1 stack started."
