#!/usr/bin/env bash
set -euo pipefail

TOKEN_SIN_VALIDAR="${1-}"

if [ -z "$TOKEN_SIN_VALIDAR" ] || [ "$TOKEN_SIN_VALIDAR" = "null" ]; then
  echo "validar-token-docker-hub: no se pudo iniciar sesión en la Hub API de Docker Hub" >&2
  exit 1
fi

exit 0
