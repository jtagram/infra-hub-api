#!/usr/bin/env bash
# Filtra un archivo con un tag de Docker Hub por línea y deja todos los
# tags EXCEPTO el tag estable anterior y el nuevo tag (los que hay que
# eliminar en la limpieza de Docker Hub).
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

grep -Fxv -e "$TAG_A" -e "$TAG_B" "$ARCHIVO_TODOS_LOS_TAGS" || true
