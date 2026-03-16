#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
docker compose -f docker-compose.phase1.yml config >/dev/null

echo "Compose config is valid."
