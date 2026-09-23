#!/usr/bin/env bash
# Verifica que dos tags conservados sigan existiendo en un repositorio de
# Docker Hub (chequeo posterior a la limpieza de tags), fallando con un
# mensaje claro si alguno falta.
#
# Requiere las variables de entorno DOCKERHUB_USERNAME y HUB_API_TOKEN.
#
# Uso: verificar-tags-conservados-docker-hub.sh <repositorio> <tag-a> <tag-b>
set -euo pipefail

REPOSITORIO="${1-}"
TAG_A="${2-}"
TAG_B="${3-}"

if [ -z "$REPOSITORIO" ] || [ -z "$TAG_A" ] || [ -z "$TAG_B" ]; then
  echo "verificar-tags-conservados-docker-hub: se esperaban <repositorio> <tag-a> <tag-b>" >&2
  exit 1
fi

if [ -z "${DOCKERHUB_USERNAME-}" ] || [ -z "${HUB_API_TOKEN-}" ]; then
  echo "verificar-tags-conservados-docker-hub: DOCKERHUB_USERNAME y HUB_API_TOKEN deben estar definidos" >&2
  exit 1
fi

for TAG in "$TAG_A" "$TAG_B"; do
  HTTP_STATUS="$(curl -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $HUB_API_TOKEN" \
    "https://hub.docker.com/v2/namespaces/$DOCKERHUB_USERNAME/repositories/$REPOSITORIO/tags/$TAG")"

  if [ "$HTTP_STATUS" != "200" ]; then
    echo "verificar-tags-conservados-docker-hub: el tag '$TAG' no existe en el repositorio '$DOCKERHUB_USERNAME/$REPOSITORIO' de Docker Hub tras la limpieza (código HTTP $HTTP_STATUS)." >&2
    exit 1
  fi
done

exit 0
