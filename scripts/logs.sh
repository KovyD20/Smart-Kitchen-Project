#!/usr/bin/env bash

SERVICE="${1:-}"
[[ -z "$SERVICE" ]] && { echo "Use: ./scripts/logs.sh <service>"; exit 1; }
docker compose logs -f "$SERVICE"