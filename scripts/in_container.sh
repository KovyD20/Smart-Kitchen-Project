#!/usr/bin/env bash

SERVICE="${1:-}"
if [[ -z "$SERVICE" ]]; then
  echo "Use: ./scripts/in.sh <backend1|backend2|postgres|nginx>"
  exit 1
fi

case "$SERVICE" in
  backend1|backend2|postgres|nginx) ;;
  *)
    echo "Unknown service: $SERVICE"
    exit 1
    ;;
esac

docker compose exec "$SERVICE" sh