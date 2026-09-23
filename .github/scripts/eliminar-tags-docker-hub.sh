#!/usr/bin/env bash
# Elimina de un repositorio de Docker Hub todos los tags listados (uno
# por línea) en un archivo.
#
# Requiere las variables de entorno DOCKERHUB_USERNAME y HUB_API_TOKEN.
#
# Uso: eliminar-tags-docker-hub.sh <repositorio> <archivo-tags-a-eliminar>
set -euo pipefail

REPOSITORIO="${1-}"
ARCHIVO_TAGS_A_ELIMINAR="${2-}"

if [ -z "$REPOSITORIO" ] || [ -z "$ARCHIVO_TAGS_A_ELIMINAR" ]; then
  echo "eliminar-tags-docker-hub: se esperaban <repositorio> <archivo-tags-a-eliminar>" >&2
  exit 1
fi

if [ ! -f "$ARCHIVO_TAGS_A_ELIMINAR" ]; then
  echo "eliminar-tags-docker-hub: no se encontró el archivo '$ARCHIVO_TAGS_A_ELIMINAR'" >&2
  exit 1
fi

if [ -z "${DOCKERHUB_USERNAME-}" ] || [ -z "${HUB_API_TOKEN-}" ]; then
  echo "eliminar-tags-docker-hub: DOCKERHUB_USERNAME y HUB_API_TOKEN deben estar definidos" >&2
  exit 1
fi

while IFS= read -r TAG; do
  [ -z "$TAG" ] && continue
  echo "eliminar-tags-docker-hub: eliminando el tag '$TAG'..."
  curl -sf -X DELETE \
    -H "Authorization: JWT $HUB_API_TOKEN" \
    "https://hub.docker.com/v2/repositories/$DOCKERHUB_USERNAME/$REPOSITORIO/tags/$TAG/"
done < "$ARCHIVO_TAGS_A_ELIMINAR"
