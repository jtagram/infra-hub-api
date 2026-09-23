#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_OWNER="${1-}"
SINCE_TIMESTAMP="${2-}"

if [ -z "$REPOSITORY_OWNER" ] || [ -z "$SINCE_TIMESTAMP" ]; then
  echo "esperar-deploy-infra-hub-api: se esperaban <repository-owner> <since-timestamp-utc>" >&2
  exit 1
fi

REPO="$REPOSITORY_OWNER/deploy-hub-api"
WORKFLOW="deploy-infra-hub-api.yml"
MAX_INTENTOS="${ESPERAR_DEPLOY_INFRA_HUB_API_MAX_INTENTOS:-12}"
SEGUNDOS_ESPERA="${ESPERAR_DEPLOY_INFRA_HUB_API_SEGUNDOS_ESPERA:-5}"

RUN_ID=""
for _ in $(seq 1 "$MAX_INTENTOS"); do
  RUN_ID="$(gh run list --repo "$REPO" --workflow="$WORKFLOW" --event=workflow_dispatch --json databaseId,createdAt | \
    jq -r --arg since "$SINCE_TIMESTAMP" \
      '[.[] | select(.createdAt >= $since)] | sort_by(.createdAt) | .[0].databaseId // empty')"
  if [ -n "$RUN_ID" ]; then
    break
  fi
  sleep "$SEGUNDOS_ESPERA"
done

if [ -z "$RUN_ID" ]; then
  echo "esperar-deploy-infra-hub-api: no se encontró ningún run de $WORKFLOW en $REPO creado en o después de $SINCE_TIMESTAMP" >&2
  exit 1
fi

echo "Siguiendo el run $RUN_ID de deploy-hub-api..."
gh run watch "$RUN_ID" --repo "$REPO" --exit-status
