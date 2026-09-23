#!/usr/bin/env bash
set -euo pipefail

LOGIN_BODY="${1-}"

if [ -z "$LOGIN_BODY" ]; then
  echo "llamar-login-docker-hub: se esperaba el body JSON de login como argumento" >&2
  exit 1
fi

if ! echo "$LOGIN_BODY" | jq -e '
    type == "object"
    and (.username | type == "string") and (.username | length > 0)
    and (.password | type == "string") and (.password | length > 0)
  ' > /dev/null 2>&1; then
  echo "llamar-login-docker-hub: el body de login no tiene la estructura esperada {\"username\": \"...\", \"password\": \"...\"} con ambos valores no vacíos" >&2
  exit 1
fi

curl -sf -X POST "https://hub.docker.com/v2/users/login/" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_BODY" | jq -r '.token'
