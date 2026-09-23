#!/usr/bin/env bash
set -euo pipefail

DOCKERHUB_USERNAME="${1-}"

if [ -z "$DOCKERHUB_USERNAME" ]; then
  echo "renderizar-resumen-link-docker-hub: se esperaba el usuario de Docker Hub como argumento" >&2
  exit 1
fi

echo "## 🐳 Repositorio en Docker Hub"
echo ""
echo "**[Ver todos los tags de infra-hub-api](https://hub.docker.com/r/$DOCKERHUB_USERNAME/infra-hub-api/tags)**"
