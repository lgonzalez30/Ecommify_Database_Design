#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export USERS="${1:-10}"
export DURATION_SECONDS="${2:-60}"
export RAMP_SECONDS="${3:-10}"
export RUN_ID="${4:-u6_$(date +%Y%m%d_%H%M%S)_u${USERS}}"

case "$USERS:$DURATION_SECONDS:$RAMP_SECONDS" in
  *[!0-9:]*|0:*|*:0:*|*:*:0)
    echo "Los parámetros usuarios, duración y rampa deben ser enteros positivos." >&2
    exit 2
    ;;
esac

mkdir -p resultados

echo "Levantando PostgreSQL, MongoDB y API de benchmark..."
docker compose up -d --build postgres-bench mongo-bench benchmark-api

echo "Esperando la API híbrida..."
ready=0
for _ in $(seq 1 60); do
  if curl --silent --fail http://localhost:3006/health >/dev/null; then
    ready=1
    break
  fi
  sleep 2
done

if [ "$ready" -ne 1 ]; then
  echo "La API no estuvo lista dentro del tiempo esperado." >&2
  docker compose ps
  exit 1
fi

echo "Ejecutando JMeter: usuarios=$USERS duración=${DURATION_SECONDS}s rampa=${RAMP_SECONDS}s run=$RUN_ID"
docker compose --profile load run --rm jmeter

echo "Prueba terminada."
echo "JTL: $SCRIPT_DIR/resultados/$RUN_ID.jtl"
echo "Reporte HTML: $SCRIPT_DIR/resultados/$RUN_ID-report/index.html"

