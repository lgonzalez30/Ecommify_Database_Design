#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DURATION_SECONDS="${1:-120}"
REPETITIONS="${2:-5}"
RAMP_SECONDS="${3:-10}"
USERS_LEVELS=(1 10 25 50 100)

case "$DURATION_SECONDS:$REPETITIONS:$RAMP_SECONDS" in
  *[!0-9:]*|0:*|*:0:*|*:*:0)
    echo "Duración, repeticiones y rampa deben ser enteros positivos." >&2
    exit 2
    ;;
esac

echo "Preparando entorno para la matriz formal..."
docker compose up -d --build postgres-bench mongo-bench benchmark-api

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
  exit 1
fi

for users in "${USERS_LEVELS[@]}"; do
  for repetition in $(seq 1 "$REPETITIONS"); do
    run_id="formal_s_u${users}_r${repetition}"
    if [ -f "resultados/${run_id}.jtl" ]; then
      echo "Omitiendo ${run_id}: ya existe evidencia JTL."
      continue
    fi

    echo "Restaurando baseline antes de ${run_id}..."
    bash reset_state.sh
    bash run_benchmark.sh "$users" "$DURATION_SECONDS" "$RAMP_SECONDS" "$run_id"
  done
done

node scripts/consolidate_results.js resultados
echo "Matriz formal terminada y consolidada en resultados/consolidado_metricas.csv."

