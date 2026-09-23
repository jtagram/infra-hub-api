#!/usr/bin/env bash
# Verifica que un tag NO exista todavía en un repositorio de Docker Hub,
# fallando con un mensaje claro si ya existe.
#
# Requiere las variables de entorno DOCKERHUB_USERNAME y HUB_API_TOKEN.
#
# Uso: verificar-tag-docker-hub-no-existe.sh <repositorio> <tag>
set -euo pipefail

REPOSITORIO="${1-}"
TAG="${2-}"

if [ -z "$REPOSITORIO" ]; then
  echo "verificar-tag-docker-hub-no-existe: se esperaba el repositorio como primer argumento" >&2
  exit 1
fi

if [ -z "$TAG" ]; then
  echo "verificar-tag-docker-hub-no-existe: se esperaba el tag como segundo argumento" >&2
  exit 1
fi

if [ -z "${DOCKERHUB_USERNAME-}" ] || [ -z "${HUB_API_TOKEN-}" ]; then
  echo "verificar-tag-docker-hub-no-existe: DOCKERHUB_USERNAME y HUB_API_TOKEN deben estar definidos" >&2
  exit 1
fi

HTTP_STATUS="$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $HUB_API_TOKEN" \
  "https://hub.docker.com/v2/namespaces/$DOCKERHUB_USERNAME/repositories/$REPOSITORIO/tags/$TAG")"

if [ "$HTTP_STATUS" = "200" ]; then
  echo "verificar-tag-docker-hub-no-existe: el tag '$TAG' ya existe en el repositorio '$DOCKERHUB_USERNAME/$REPOSITORIO' de Docker Hub." >&2
  exit 1
fi

if [ "$HTTP_STATUS" != "404" ]; then
  echo "verificar-tag-docker-hub-no-existe: la Hub API de Docker Hub respondió con un código inesperado ($HTTP_STATUS) al consultar '$DOCKERHUB_USERNAME/$REPOSITORIO:$TAG'." >&2
  exit 1
fi

exit 0
