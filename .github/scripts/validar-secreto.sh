#!/usr/bin/env bash
set -u

if [ "$#" -ne 2 ]; then
  echo "validar-secreto: se esperaban exactamente dos argumentos (el nombre del secreto y su valor)" >&2
  exit 1
fi

SECRET_NAME="$1"
SECRET_VALUE="$2"

TRIMMED_VALUE="$(printf '%s' "$SECRET_VALUE" | tr -d '[:space:]')"

if [ -z "$TRIMMED_VALUE" ]; then
  echo "validar-secreto: el secreto requerido $SECRET_NAME no está definido" >&2
  exit 1
fi

exit 0
