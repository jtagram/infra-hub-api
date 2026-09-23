#!/usr/bin/env bash
set -u

if [ "$#" -ne 2 ]; then
  echo "validar-formato-de-tag: se esperaban exactamente dos argumentos (el nombre del tag y su valor)" >&2
  exit 1
fi

TAG_NAME="$1"
TAG_VALUE="$2"

TRIMMED_VALUE="$(printf '%s' "$TAG_VALUE" | tr -d '[:space:]')"

if [ -z "$TRIMMED_VALUE" ]; then
  echo "validar-formato-de-tag: el tag requerido $TAG_NAME no está definido" >&2
  exit 1
fi

if [[ ! "$TAG_VALUE" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "validar-formato-de-tag: el tag $TAG_NAME (\"$TAG_VALUE\") no tiene el formato esperado vNUMERO.NUMERO.NUMERO (ejemplo: v0.9.10)" >&2
  exit 1
fi

exit 0
