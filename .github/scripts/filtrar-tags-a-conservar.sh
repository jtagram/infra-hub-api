#!/usr/bin/env bash
# Filtra un archivo con un tag de Docker Hub por línea y deja solo los
# que hay que conservar (el tag estable anterior y el nuevo tag).
#
# Uso: filtrar-tags-a-conservar.sh <archivo-todos-los-tags> <tag-a> <tag-b>
set -euo pipefail

ARCHIVO_TODOS_LOS_TAGS="${1-}"
TAG_A="${2-}"
TAG_B="${3-}"

if [ -z "$ARCHIVO_TODOS_LOS_TAGS" ] || [ -z "$TAG_A" ] || [ -z "$TAG_B" ]; then
  echo "filtrar-tags-a-conservar: se esperaban <archivo-todos-los-tags> <tag-a> <tag-b>" >&2
  exit 1
fi

if [ ! -f "$ARCHIVO_TODOS_LOS_TAGS" ]; then
  echo "filtrar-tags-a-conservar: no se encontró el archivo '$ARCHIVO_TODOS_LOS_TAGS'" >&2
  exit 1
fi

grep -Fx -e "$TAG_A" -e "$TAG_B" "$ARCHIVO_TODOS_LOS_TAGS" || true
