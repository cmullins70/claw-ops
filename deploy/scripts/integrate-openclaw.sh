#!/usr/bin/env bash
set -euo pipefail
#
# Claw Ops <> OpenClaw Integration Checklist
#
# Walks through the steps to connect a running Claw Ops stack to an
# existing OpenClaw installation on the same (or a reachable) host.
#
# Can be run interactively or used as a reference checklist.
# Safe to re-run — every step is idempotent.
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PASS=0
FAIL=0
SKIP=0

# --- helpers ---
green()  { printf "\033[32m✓ %s\033[0m\n" "$1"; }
red()    { printf "\033[31m✗ %s\033[0m\n" "$1"; }
yellow() { printf "\033[33m→ %s\033[0m\n" "$1"; }
header() { printf "\n\033[1m=== %s ===\033[0m\n" "$1"; }

check() {
  local label="$1"; shift
  if "$@" > /dev/null 2>&1; then
    green "$label"; PASS=$((PASS + 1))
  else
    red "$label"; FAIL=$((FAIL + 1))
  fi
}

# ---------------------------------------------------------------
header "Step 1: Claw Ops stack is running"
# ---------------------------------------------------------------

check "Event processor is healthy" curl -sf http://127.0.0.1:8787/health
check "Prometheus is reachable"    curl -sf http://127.0.0.1:9091/-/healthy
check "Alertmanager is reachable"  curl -sf http://127.0.0.1:9094/-/healthy
check "Grafana is reachable"       curl -sf http://127.0.0.1:3001/api/health

# ---------------------------------------------------------------
header "Step 2: Discover OpenClaw"
# ---------------------------------------------------------------

echo "Looking for OpenClaw containers..."

# Try common container name patterns
OPENCLAW_CONTAINER=""
for pattern in openclaw open-claw openclaw-gateway; do
  match=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -i "$pattern" | head -1 || true)
  if [ -n "$match" ]; then
    OPENCLAW_CONTAINER="$match"
    break
  fi
done

if [ -n "$OPENCLAW_CONTAINER" ]; then
  green "Found OpenClaw container: $OPENCLAW_CONTAINER"

  # Get the network(s) it's on
  OPENCLAW_NETWORKS=$(docker inspect "$OPENCLAW_CONTAINER" \
    --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null || echo "")
  if [ -n "$OPENCLAW_NETWORKS" ]; then
    green "OpenClaw network(s): $OPENCLAW_NETWORKS"
  fi

  # Get exposed ports
  OPENCLAW_PORTS=$(docker inspect "$OPENCLAW_CONTAINER" \
    --format '{{range $p, $conf := .NetworkSettings.Ports}}{{$p}}->{{(index $conf 0).HostPort}} {{end}}' 2>/dev/null || echo "")
  if [ -n "$OPENCLAW_PORTS" ]; then
    green "OpenClaw port(s): $OPENCLAW_PORTS"
  fi
else
  yellow "No OpenClaw container found automatically."
  yellow "If OpenClaw uses a different container name, set OPENCLAW_CONTAINER=<name> and re-run."
  SKIP=$((SKIP + 1))
fi

# ---------------------------------------------------------------
header "Step 3: Network connectivity"
# ---------------------------------------------------------------

echo "Claw Ops needs to reach OpenClaw for scraping and health probes."
echo ""

# Check if host.docker.internal resolves (Docker Desktop / modern Docker)
if docker run --rm alpine ping -c1 -W2 host.docker.internal > /dev/null 2>&1; then
  green "host.docker.internal is reachable from containers"
  OPENCLAW_HOST="host.docker.internal"
else
  # Fall back to host gateway
  HOST_GW=$(docker network inspect bridge --format '{{(index .IPAM.Config 0).Gateway}}' 2>/dev/null || echo "")
  if [ -n "$HOST_GW" ]; then
    green "Docker host gateway: $HOST_GW"
    OPENCLAW_HOST="$HOST_GW"
  else
    yellow "Could not determine host gateway. You may need to configure network manually."
    OPENCLAW_HOST="<HOST_IP>"
    SKIP=$((SKIP + 1))
  fi
fi

echo ""
echo "Recommended Prometheus target for OpenClaw:"
echo "  If OpenClaw exposes a health/metrics port on the host:"
echo "    - targets: ['${OPENCLAW_HOST:-<HOST_IP>}:<OPENCLAW_PORT>']"
echo ""
echo "  To add OpenClaw scraping, edit:"
echo "    deploy/config/prometheus/prometheus.phase1.yml"
echo "  Add under scrape_configs:"
echo "    - job_name: 'openclaw'"
echo "      static_configs:"
echo "        - targets: ['${OPENCLAW_HOST:-<HOST_IP>}:<PORT>']"
echo ""

# ---------------------------------------------------------------
header "Step 4: Blackbox probe target"
# ---------------------------------------------------------------

echo "Blackbox exporter can probe OpenClaw's health endpoint."
echo ""
echo "  Current probe target (in prometheus.phase1.yml):"
grep -A2 "blackbox" "$DEPLOY_DIR/config/prometheus/prometheus.phase1.yml" 2>/dev/null | grep "targets" || echo "    (not found)"
echo ""
echo "  To probe OpenClaw, add its health URL to the blackbox targets:"
echo "    - targets: ['http://${OPENCLAW_HOST:-<HOST_IP>}:<PORT>/health']"
echo ""

# ---------------------------------------------------------------
header "Step 5: Alertmanager -> Event Processor"
# ---------------------------------------------------------------

check "Alertmanager routes to event processor" \
  grep -q "claw-ops-event-processor:8787" "$DEPLOY_DIR/config/alertmanager/alertmanager.yml"

echo "  Alerts fire from Prometheus -> Alertmanager -> Claw Ops webhook."
echo "  This is pre-configured. No action needed unless you changed ports."

# ---------------------------------------------------------------
header "Step 6: Send a test alert"
# ---------------------------------------------------------------

echo "Sending synthetic test alert to verify the full pipeline..."

TEST_RESULT=$(curl -sf -X POST http://127.0.0.1:8787/webhooks/alertmanager \
  -H 'Content-Type: application/json' \
  -d '{
    "alerts": [{
      "status": "firing",
      "labels": {
        "alertname": "IntegrationTestAlert",
        "severity": "info",
        "component": "gateway"
      },
      "annotations": {
        "summary": "Integration checklist test alert"
      },
      "startsAt": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
    }]
  }' 2>&1 || echo "FAILED")

if echo "$TEST_RESULT" | grep -q '"accepted":true'; then
  green "Test alert accepted by event processor"
  echo "  $TEST_RESULT"

  # Verify it created an incident
  INCIDENTS=$(curl -sf http://127.0.0.1:8787/incidents 2>&1 || echo "")
  if echo "$INCIDENTS" | grep -q "Integration checklist test alert"; then
    green "Test incident created and visible at /incidents"
  else
    red "Test incident not found at /incidents"
    FAIL=$((FAIL + 1))
  fi
else
  red "Test alert was not accepted: $TEST_RESULT"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------
header "Step 7: Optional add-ons"
# ---------------------------------------------------------------

echo "The following are optional and not required for core Claw Ops:"
echo ""

# Check if Loki overlay is active
if curl -sf http://127.0.0.1:3101/ready > /dev/null 2>&1; then
  green "Loki is running (log ingestion active)"
  echo "  Promtail ingests /var/log and Docker container logs."
  echo "  Ensure OpenClaw containers use the Docker json log driver."
else
  yellow "Loki is not running (this is normal for default installs)"
  echo "  To enable log ingestion, start with the Loki overlay:"
  echo "    docker compose -f docker-compose.phase1.yml -f docker-compose.loki.yml up -d"
  SKIP=$((SKIP + 1))
fi

# ---------------------------------------------------------------
header "Summary"
# ---------------------------------------------------------------

echo ""
printf "  Passed: %d   Failed: %d   Skipped: %d\n" "$PASS" "$FAIL" "$SKIP"
echo ""

if [ "$FAIL" -eq 0 ]; then
  green "Integration baseline looks good."
else
  yellow "Review the failures above before relying on the stack."
fi

echo ""
echo "Remaining manual steps:"
echo "  1. Add OpenClaw scrape target to deploy/config/prometheus/prometheus.phase1.yml"
echo "  2. Add OpenClaw health URL to blackbox probe targets"
echo "  3. Reload Prometheus:  curl -X POST http://127.0.0.1:9091/-/reload"
echo "  4. Verify in Grafana (http://127.0.0.1:3001) that OpenClaw targets appear"
echo ""
