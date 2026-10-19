#!/usr/bin/env bash
set -u

if [ "$#" -ne 2 ]; then
  echo "validar-parametro: se esperaban exactamente dos argumentos (el nombre del parámetro y su valor)" >&2
  exit 1
fi

PARAMETER_NAME="$1"
PARAMETER_VALUE="$2"

TRIMMED_VALUE="$(printf '%s' "$PARAMETER_VALUE" | tr -d '[:space:]')"

if [ -z "$TRIMMED_VALUE" ]; then
  echo "validar-parametro: el parámetro requerido $PARAMETER_NAME llegó vacío, en blanco o no se envió. Revisá el bloque 'with:' del workflow que llama a release.yml" >&2
  exit 1
fi

exit 0
