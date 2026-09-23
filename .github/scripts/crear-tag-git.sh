#!/usr/bin/env bash
# Crea un tag de git y lo sube al repositorio remoto.
#
# Uso: crear-tag-git.sh <tag>
set -euo pipefail

TAG="${1-}"

if [ -z "$TAG" ]; then
  echo "crear-tag-git: se esperaba el tag como argumento" >&2
  exit 1
fi

git tag "$TAG"
git push origin "$TAG"
