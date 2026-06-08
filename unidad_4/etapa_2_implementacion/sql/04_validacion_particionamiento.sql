-- =============================================================================
-- Unidad 4 / Etapa 2 — Validacion de particionamiento declarativo
-- =============================================================================
-- Objetivo: comprobar estructura, particion DEFAULT, pruning y mantenimiento.
-- =============================================================================

\pset pager off
\timing on
SET search_path TO public;

SELECT 'PARTICIONES_DE_ORDER' AS section;
SELECT
    parent.relname AS parent_table,
    child.relname AS partition_name,
    pg_get_expr(child.relpartbound, child.oid) AS partition_bound,
    pg_size_pretty(pg_total_relation_size(child.oid)) AS total_size
FROM pg_inherits i
JOIN pg_class parent ON parent.oid = i.inhparent
JOIN pg_class child  ON child.oid = i.inhrelid
WHERE parent.relname = 'order'
ORDER BY child.relname;

SELECT 'FILAS_ESTIMADAS_POR_PARTICION' AS section;
SELECT
    c.relname AS partition_name,
    c.reltuples::BIGINT AS estimated_rows,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_inherits i
JOIN pg_class p ON p.oid = i.inhparent
JOIN pg_class c ON c.oid = i.inhrelid
WHERE p.relname = 'order'
ORDER BY c.relname;

SELECT 'ORDENES_EN_DEFAULT_PARTITION' AS section;
SELECT COUNT(*) AS rows_in_default_partition
FROM order_default;

SELECT 'CREACION_PARTICION_FUTURA_EJEMPLO' AS section;
SELECT create_monthly_order_partition(2026, 7);

SELECT 'PLAN_CON_PARTITION_PRUNING_ENERO_2026' AS section;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT COUNT(*) AS n_orders_january
FROM "order"
WHERE order_purchase_timestamp >= TIMESTAMPTZ '2026-01-01 00:00:00+00'
  AND order_purchase_timestamp <  TIMESTAMPTZ '2026-02-01 00:00:00+00';

SELECT 'PLAN_SIN_FILTRO_TEMPORAL_ESCANEA_MAS_PARTICIONES' AS section;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT COUNT(*) AS n_orders_active_all_time
FROM "order"
WHERE order_status IN ('created', 'approved', 'invoiced', 'shipped');

SELECT 'ANTI_PATRON_FUNCION_EN_COLUMNA' AS section;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT COUNT(*) AS n_orders_january
FROM "order"
WHERE date_trunc('month', order_purchase_timestamp) = DATE '2026-01-01';

SELECT 'INDICES_EN_PARTICIONES_ORDER' AS section;
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_indexes
WHERE tablename LIKE 'order_%'
  AND schemaname = 'public'
ORDER BY tablename, indexname;
