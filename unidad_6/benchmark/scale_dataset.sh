#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LEVEL="${1:-}"
case "$LEVEL" in
  M) PRODUCT_COUNT=20000; ORDER_COUNT=50000 ;;
  L) PRODUCT_COUNT=40000; ORDER_COUNT=100000 ;;
  *) echo "Uso: $0 M|L" >&2; exit 2 ;;
esac

echo "Cargando PostgreSQL escala $LEVEL..."
docker compose exec -T postgres-bench psql -v ON_ERROR_STOP=1 \
  -v product_count="$PRODUCT_COUNT" -v order_count="$ORDER_COUNT" \
  -U ecommify -d ecommify_bench -f /benchmark/scale.sql

echo "Cargando MongoDB escala $LEVEL..."
docker compose exec -T -e SCALE_LEVEL="$LEVEL" mongo-bench mongosh --quiet \
  --username ecommify --password ecommify_bench --authenticationDatabase admin \
  ecommify_bench /benchmark/scale.js

echo "Dataset $LEVEL cargado."
