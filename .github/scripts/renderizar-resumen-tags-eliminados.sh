#!/usr/bin/env bash
set -euo pipefail

ARCHIVO_TAGS_ELIMINADOS="${1-}"

if [ -z "$ARCHIVO_TAGS_ELIMINADOS" ]; then
  echo "renderizar-resumen-tags-eliminados: se esperaba el archivo de tags eliminados como argumento" >&2
  exit 1
fi

if [ ! -f "$ARCHIVO_TAGS_ELIMINADOS" ]; then
  echo "renderizar-resumen-tags-eliminados: no se encontró el archivo '$ARCHIVO_TAGS_ELIMINADOS'" >&2
  exit 1
fi

echo "## 🗑️ Tags eliminados"
echo ""

if [ ! -s "$ARCHIVO_TAGS_ELIMINADOS" ]; then
  echo "No se eliminó ningún tag en esta limpieza."
else
  while IFS= read -r TAG; do
    [ -z "$TAG" ] && continue
    echo "- \`$TAG\`"
  done < "$ARCHIVO_TAGS_ELIMINADOS"
fi
