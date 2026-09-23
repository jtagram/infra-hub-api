#!/usr/bin/env bash
set -euo pipefail

DOCKERHUB_USERNAME="${1-}"
IMAGE_TAG="${2-}"
REPOSITORY_OWNER="${3-}"

if [ -z "$DOCKERHUB_USERNAME" ] || [ -z "$IMAGE_TAG" ] || [ -z "$REPOSITORY_OWNER" ]; then
  echo "renderizar-resumen-deploy-infra-hub-api: se esperaban <dockerhub-username> <image-tag> <repository-owner>" >&2
  exit 1
fi

echo "## 🚀 Deploy aprobado y disparado hacia deploy-hub-api"
echo ""
echo "Este run pusheó \`$DOCKERHUB_USERNAME/infra-hub-api:$IMAGE_TAG\` y, una vez aprobado arriba, le avisó a \`deploy-hub-api\` que despliegue esa imagen en el cluster microk8s. deploy-hub-api la aplica automáticamente - no hace falta otra aprobación ahí."
echo ""
echo "**[▶ Ver el run de deploy en deploy-hub-api](https://github.com/$REPOSITORY_OWNER/deploy-hub-api/actions/workflows/deploy-infra-hub-api.yml)**"
