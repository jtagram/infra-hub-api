#!/usr/bin/env bash
# Filtra un archivo con un tag de Docker Hub por línea y deja todos los
# tags EXCEPTO el tag estable anterior y el nuevo tag (los que hay que
# eliminar en la limpieza de Docker Hub).
#
# Solo considera los tags del mismo ambiente que el nuevo tag (tag-b):
# dev-vN.N.N, prod-vN.N.N o, sin prefijo, vN.N.N. Los tags de otros
# ambientes (por ejemplo local, local-v*, prod-v* en un release de dev)
# nunca se eliminan.
#
# Uso: filtrar-tags-a-eliminar.sh <archivo-todos-los-tags> <tag-a> <tag-b>
set -euo pipefail

ARCHIVO_TODOS_LOS_TAGS="${1-}"
TAG_A="${2-}"
TAG_B="${3-}"

if [ -z "$ARCHIVO_TODOS_LOS_TAGS" ] || [ -z "$TAG_A" ] || [ -z "$TAG_B" ]; then
  echo "filtrar-tags-a-eliminar: se esperaban <archivo-todos-los-tags> <tag-a> <tag-b>" >&2
  exit 1
fi

if [ ! -f "$ARCHIVO_TODOS_LOS_TAGS" ]; then
  echo "filtrar-tags-a-eliminar: no se encontró el archivo '$ARCHIVO_TODOS_LOS_TAGS'" >&2
  exit 1
fi

case "$TAG_B" in
  dev-*) PREFIJO="dev-" ;;
  prod-*) PREFIJO="prod-" ;;
  *) PREFIJO="" ;;
esac

{ grep -E "^${PREFIJO}v[0-9]+\.[0-9]+\.[0-9]+$" "$ARCHIVO_TODOS_LOS_TAGS" || true; } \
  | { grep -Fxv -e "$TAG_A" -e "$TAG_B" || true; }
