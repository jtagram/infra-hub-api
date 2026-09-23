#!/usr/bin/env bash
set -euo pipefail

if [ -z "${DOCKERHUB_USERNAME-}" ] || [ -z "${DOCKERHUB_TOKEN-}" ]; then
  echo "construir-body-login-docker-hub: DOCKERHUB_USERNAME y DOCKERHUB_TOKEN deben estar definidos" >&2
  exit 1
fi

jq -n -c --arg username "$DOCKERHUB_USERNAME" --arg password "$DOCKERHUB_TOKEN" \
  '{username: $username, password: $password}'
