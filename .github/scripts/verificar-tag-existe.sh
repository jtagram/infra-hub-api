#!/usr/bin/env bash
# Verifica que un tag exista como tag de git en el checkout actual,
# fallando con un mensaje claro si no.
#
# Requiere que el checkout haya traído los tags (actions/checkout con
# fetch-tags: true) -- un checkout sin tags siempre va a reportar "no
# existe", incluso para un tag que sí está en el remoto.
#
# Uso: verificar-tag-existe.sh <tag>
set -euo pipefail

TAG="${1-}"

if [ -z "$TAG" ]; then
  echo "verificar-tag-existe: se esperaba el tag como argumento" >&2
  exit 1
fi

if ! git rev-parse --verify --quiet "refs/tags/$TAG" > /dev/null; then
  echo "verificar-tag-existe: el tag '$TAG' no existe como tag de git." >&2
  echo "verificar-tag-existe: si todavía no crearon ningún tag en este repositorio, esto es esperable -- es tu primer release. Creá el tag inicial manualmente (por ejemplo: git tag $TAG && git push origin $TAG) y volvé a correr el workflow." >&2
  exit 1
fi

exit 0
