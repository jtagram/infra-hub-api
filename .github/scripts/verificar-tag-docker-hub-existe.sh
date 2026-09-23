#!/usr/bin/env bash
# Verifica que un tag exista en un repositorio de Docker Hub, fallando
# con un mensaje claro si no.
#
# Requiere las variables de entorno DOCKERHUB_USERNAME y HUB_API_TOKEN.
#
# Uso: verificar-tag-docker-hub-existe.sh <repositorio> <tag>
set -euo pipefail

REPOSITORIO="${1-}"
TAG="${2-}"

if [ -z "$REPOSITORIO" ]; then
  echo "verificar-tag-docker-hub-existe: se esperaba el repositorio como primer argumento" >&2
  exit 1
fi

if [ -z "$TAG" ]; then
  echo "verificar-tag-docker-hub-existe: se esperaba el tag como segundo argumento" >&2
  exit 1
fi

if [ -z "${DOCKERHUB_USERNAME-}" ] || [ -z "${HUB_API_TOKEN-}" ]; then
  echo "verificar-tag-docker-hub-existe: DOCKERHUB_USERNAME y HUB_API_TOKEN deben estar definidos" >&2
  exit 1
fi

HTTP_STATUS="$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $HUB_API_TOKEN" \
  "https://hub.docker.com/v2/namespaces/$DOCKERHUB_USERNAME/repositories/$REPOSITORIO/tags/$TAG")"

if [ "$HTTP_STATUS" = "404" ]; then
  echo "verificar-tag-docker-hub-existe: el tag '$TAG' no existe en el repositorio '$DOCKERHUB_USERNAME/$REPOSITORIO' de Docker Hub." >&2
  echo "verificar-tag-docker-hub-existe: si todavía no publicaron ninguna imagen en este repositorio, esto es esperable -- es tu primer release. Publicá la imagen inicial de forma manual (docker build + docker push a $DOCKERHUB_USERNAME/$REPOSITORIO:$TAG) y volvé a correr el workflow." >&2
  exit 1
fi

if [ "$HTTP_STATUS" != "200" ]; then
  echo "verificar-tag-docker-hub-existe: la Hub API de Docker Hub respondió con un código inesperado ($HTTP_STATUS) al consultar '$DOCKERHUB_USERNAME/$REPOSITORIO:$TAG'." >&2
  exit 1
fi

exit 0
