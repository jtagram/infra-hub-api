#!/usr/bin/env bash
set -euo pipefail

REPOSITORIO="${1-}"

if [ -z "$REPOSITORIO" ]; then
  echo "listar-tags-docker-hub: se esperaba exactamente un argumento (el nombre del repositorio)" >&2
  exit 1
fi

if [ -z "${DOCKERHUB_USERNAME-}" ] || [ -z "${HUB_API_TOKEN-}" ]; then
  echo "listar-tags-docker-hub: DOCKERHUB_USERNAME y HUB_API_TOKEN deben estar definidos" >&2
  exit 1
fi

PAGE_URL="https://hub.docker.com/v2/repositories/$DOCKERHUB_USERNAME/$REPOSITORIO/tags/?page_size=100"

while [ -n "$PAGE_URL" ] && [ "$PAGE_URL" != "null" ]; do
  PAGE_RESPONSE="$(curl -sf -H "Authorization: JWT $HUB_API_TOKEN" "$PAGE_URL")"
  echo "$PAGE_RESPONSE" | jq -r '.results[].name'
  PAGE_URL="$(echo "$PAGE_RESPONSE" | jq -r '.next')"
done
