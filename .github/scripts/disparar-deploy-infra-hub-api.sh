#!/usr/bin/env bash
# Dispara (workflow_dispatch) el workflow de deploy de infra-hub-api en el
# repositorio deploy-hub-api, pasándole el tag de imagen recién publicado
# en Docker Hub.
#
# Requiere GH_TOKEN con permiso de Actions sobre el repositorio
# deploy-hub-api.
#
# Uso: disparar-deploy-infra-hub-api.sh <owner> <tag-de-imagen> [workflow-de-deploy]
#   workflow-de-deploy: archivo del workflow en deploy-hub-api (por defecto
#   deploy-infra-hub-api.yml; el release dev usa deploy-infra-hub-api-dev.yml)
set -euo pipefail

OWNER="${1-}"
IMAGE_TAG="${2-}"
DEPLOY_WORKFLOW="${3:-deploy-infra-hub-api.yml}"

if [ -z "$OWNER" ]; then
  echo "disparar-deploy-infra-hub-api: se esperaba el owner del repositorio como primer argumento" >&2
  exit 1
fi

if [ -z "$IMAGE_TAG" ]; then
  echo "disparar-deploy-infra-hub-api: se esperaba el tag de imagen como segundo argumento" >&2
  exit 1
fi

if [ -z "${GH_TOKEN-}" ]; then
  echo "disparar-deploy-infra-hub-api: GH_TOKEN debe estar definido" >&2
  exit 1
fi

gh workflow run "$DEPLOY_WORKFLOW" \
  --repo "$OWNER/deploy-hub-api" \
  --field image_tag="$IMAGE_TAG"
