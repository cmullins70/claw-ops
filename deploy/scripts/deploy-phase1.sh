#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Claw Ops Phase 1 Deploy ==="

# Check for .env
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  echo "ERROR: deploy/.env not found."
  echo "  cp ../.env.example .env   # then fill in CLAW_OPS_SHARED_SECRET"
  exit 1
fi

# Source .env to validate required vars
set -a
source "$DEPLOY_DIR/.env"
set +a

if [ -z "${CLAW_OPS_SHARED_SECRET:-}" ]; then
  echo "ERROR: CLAW_OPS_SHARED_SECRET is not set in deploy/.env"
  exit 1
fi

cd "$DEPLOY_DIR"

echo "[1/3] Building event processor image..."
docker compose -f docker-compose.phase1.yml build claw-ops-event-processor

echo "[2/3] Starting stack..."
docker compose -f docker-compose.phase1.yml up -d

echo "[3/3] Waiting for health..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8787/health > /dev/null 2>&1; then
    echo ""
    echo "=== Claw Ops is healthy ==="
    curl -s http://127.0.0.1:8787/health | python3 -m json.tool 2>/dev/null || curl -s http://127.0.0.1:8787/health
    echo ""
    echo "Services:"
    docker compose -f docker-compose.phase1.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "Next: run  scripts/integrate-openclaw.sh  to connect to your OpenClaw install."
    exit 0
  fi
  printf "."
  sleep 2
done

echo ""
echo "WARNING: event processor did not become healthy in 60s."
echo "Check logs:  docker compose -f docker-compose.phase1.yml logs claw-ops-event-processor"
exit 1
