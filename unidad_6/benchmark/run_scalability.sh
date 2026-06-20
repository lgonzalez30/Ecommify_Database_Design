#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DURATION_SECONDS="${1:-120}"
REPETITIONS="${2:-3}"
USERS=10
RAMP_SECONDS=10

docker compose up -d --build postgres-bench mongo-bench benchmark-api

for level in M L; do
  bash scale_dataset.sh "$level"
  if [ "$level" = "M" ]; then
    export MAX_ORDERS=50000 MAX_PRODUCTS=20000
  else
    export MAX_ORDERS=100000 MAX_PRODUCTS=40000
  fi
  lower_level="$(printf '%s' "$level" | tr '[:upper:]' '[:lower:]')"

  for repetition in $(seq 1 "$REPETITIONS"); do
    run_id="scale_${lower_level}_u10_r${repetition}"
    if [ -f "resultados/${run_id}.jtl" ]; then
      echo "Omitiendo ${run_id}: ya existe."
      continue
    fi
    bash reset_state.sh
    bash run_benchmark.sh "$USERS" "$DURATION_SECONDS" "$RAMP_SECONDS" "$run_id"
  done
done

node scripts/consolidate_scalability.js resultados
