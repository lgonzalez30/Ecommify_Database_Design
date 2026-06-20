#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

docker compose exec -T postgres-bench psql -v ON_ERROR_STOP=1 -U ecommify -d ecommify_bench <<'SQL'
BEGIN;
DELETE FROM payment WHERE order_id LIKE 'load-%';
DELETE FROM order_item WHERE order_id LIKE 'load-%';
DELETE FROM orders WHERE order_id LIKE 'load-%';
DELETE FROM integration_outbox;
UPDATE product SET stock = 1000;
COMMIT;
SQL

docker compose exec -T mongo-bench mongosh --quiet \
  --username ecommify --password ecommify_bench --authenticationDatabase admin \
  ecommify_bench --eval '
    db.analytics_events.deleteMany({bucket_id: /^jmeter-/});
    db.checkout_projection.deleteMany({});
    db.product_catalog.updateMany({}, {$set: {stock: 1000}});
  '

echo "Estado dinámico restaurado al baseline de la escala cargada."
