#!/usr/bin/env bash
# Verifica que un tag NO exista todavía como tag de git en el checkout
# actual, fallando con un mensaje claro si ya existe.
#
# Requiere que el checkout haya traído los tags (actions/checkout con
# fetch-tags: true) -- un checkout sin tags siempre va a reportar "no
# existe", incluso para un tag que sí está en el remoto.
#
# Uso: verificar-tag-no-existe.sh <tag>
set -euo pipefail

TAG="${1-}"

if [ -z "$TAG" ]; then
  echo "verificar-tag-no-existe: se esperaba el tag como argumento" >&2
  exit 1
fi

if git rev-parse --verify --quiet "refs/tags/$TAG" > /dev/null; then
  echo "verificar-tag-no-existe: el tag '$TAG' ya existe como tag de git." >&2
  exit 1
fi

exit 0
