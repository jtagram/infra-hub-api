#!/usr/bin/env bash
set -euo pipefail

PREVIOUS_STABLE_TAG="${1-}"
NEW_TAG="${2-}"
ARCHIVO_TAGS_CONSERVADOS="${3-}"

if [ -z "$PREVIOUS_STABLE_TAG" ] || [ -z "$NEW_TAG" ] || [ -z "$ARCHIVO_TAGS_CONSERVADOS" ]; then
  echo "renderizar-resumen-tags-conservados-docker-hub: se esperaban <previous-stable-tag> <new-tag> <archivo-tags-conservados>" >&2
  exit 1
fi

if [ ! -f "$ARCHIVO_TAGS_CONSERVADOS" ]; then
  echo "renderizar-resumen-tags-conservados-docker-hub: no se encontró el archivo '$ARCHIVO_TAGS_CONSERVADOS'" >&2
  exit 1
fi

echo "## 🏷️ Tags conservados"
echo ""
echo "- \`$PREVIOUS_STABLE_TAG\` (estable anterior)"
echo "- \`$NEW_TAG\` (nuevo)"
