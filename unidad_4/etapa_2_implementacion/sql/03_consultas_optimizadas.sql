-- =============================================================================
-- Unidad 4 / Etapa 2 — Consultas optimizadas
-- =============================================================================
-- Ejecutar despues de sql/02_indices_optimizacion_u4.sql.
-- Comparar contra sql/01_baseline_explain_analyze.sql.
-- =============================================================================

\pset pager off
\timing on
SET search_path TO public;

-- Las materialized views base se crean WITH NO DATA en 07_materialized_views.sql.
-- Para medir consultas sobre MV, primero se hace refresh no concurrente.
REFRESH MATERIALIZED VIEW mv_sales_by_category_monthly;
REFRESH MATERIALIZED VIEW mv_customer_segments;

SELECT 'Q01_OPT_ordenes_activas_recientes_indice_parcial_compuesto' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT order_id, order_status, customer_unique_id, order_purchase_timestamp
FROM "order"
WHERE order_status IN ('created', 'approved', 'invoiced', 'shipped')
  AND order_purchase_timestamp >= TIMESTAMPTZ '2026-01-01 00:00:00+00'
  AND order_purchase_timestamp <  TIMESTAMPTZ '2026-02-01 00:00:00+00'
ORDER BY order_purchase_timestamp DESC
LIMIT 100;

SELECT 'Q02_OPT_detalle_orden_filtrado_temprano' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
WITH target_order AS MATERIALIZED (
    SELECT order_id, order_status, order_purchase_timestamp, customer_unique_id
    FROM "order"
    WHERE order_id = 'ORD-999'
      AND order_purchase_timestamp = TIMESTAMPTZ '2026-01-15 10:00:00+00'
)
SELECT
    o.order_id,
    o.order_status,
    o.order_purchase_timestamp,
    c.customer_state,
    oi.order_item_id,
    p.product_id,
    p.name AS product_name,
    oi.seller_id,
    pay.payment_type,
    pay.payment_value
FROM target_order o
JOIN customer c
    ON c.customer_unique_id = o.customer_unique_id
JOIN order_item oi
    ON oi.order_id = o.order_id
   AND oi.order_purchase_timestamp = o.order_purchase_timestamp
JOIN product p
    ON p.product_id = oi.product_id
LEFT JOIN payment pay
    ON pay.order_id = o.order_id
   AND pay.order_purchase_timestamp = o.order_purchase_timestamp;

SELECT 'Q03_OPT_ventas_categoria_materialized_view' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
    category_name_english,
    sales_month,
    SUM(n_orders) AS n_orders,
    SUM(total_with_freight) AS total_revenue
FROM mv_sales_by_category_monthly
WHERE sales_month >= DATE '2026-01-01'
  AND sales_month <  DATE '2026-07-01'
GROUP BY category_name_english, sales_month
ORDER BY sales_month DESC, total_revenue DESC;

SELECT 'Q04_OPT_jsonb_catalogo_bitmap_and' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT product_id, name, base_price, product_specifications
FROM product
WHERE product_specifications @> '{"capacity_cups": 6}'
  AND base_price >= 50
  AND base_price <= 200
ORDER BY base_price ASC
LIMIT 20;

SELECT 'Q05_OPT_texto_producto_lower_expression_index' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT product_id, name, similarity(lower(name), lower('cafetera')) AS sim
FROM product
WHERE lower(name) % lower('cafetera')
ORDER BY sim DESC
LIMIT 20;

SELECT 'Q06_OPT_seller_delivery_filtrado_temprano' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
WITH items_window AS MATERIALIZED (
    SELECT order_id, order_purchase_timestamp, seller_id, price, freight_value
    FROM order_item
    WHERE shipping_limit_date >= TIMESTAMPTZ '2026-01-01 00:00:00+00'
      AND shipping_limit_date <  TIMESTAMPTZ '2026-07-01 00:00:00+00'
)
SELECT
    iw.seller_id,
    COUNT(DISTINCT o.order_id) AS n_orders,
    SUM(iw.price + iw.freight_value) AS gross_revenue,
    AVG(EXTRACT(EPOCH FROM (o.order_delivered_customer_date - o.order_purchase_timestamp)) / 86400) AS avg_delivery_days
FROM items_window iw
JOIN "order" o
    ON o.order_id = iw.order_id
   AND o.order_purchase_timestamp = iw.order_purchase_timestamp
WHERE o.order_status = 'delivered'
GROUP BY iw.seller_id
ORDER BY gross_revenue DESC
LIMIT 20;

SELECT 'Q07_OPT_geo_sellers_dwithin_antes_distance' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
WITH target_customer AS MATERIALIZED (
    SELECT customer_geo
    FROM customer
    WHERE customer_unique_id = 'CUST_ABC'
      AND customer_geo IS NOT NULL
)
SELECT
    s.seller_id,
    s.seller_city,
    ST_Distance(tc.customer_geo, s.seller_geo) / 1000 AS distance_km
FROM target_customer tc
JOIN seller s
    ON s.seller_geo IS NOT NULL
   AND ST_DWithin(tc.customer_geo, s.seller_geo, 50000)
ORDER BY distance_km ASC
LIMIT 10;

SELECT 'Q08_OPT_promociones_activas_operadores_indexables' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT promotion_id, name, discount_percentage, discount_amount
FROM promotion
WHERE promotion_period @> NOW()
  AND target_category_ids @> ARRAY[2];

SELECT 'Q09_OPT_segmentacion_materialized_view' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
    customer_unique_id,
    n_orders,
    last_order_at,
    lifetime_value,
    segment
FROM mv_customer_segments
WHERE segment IN ('VIP', 'Recurrente')
   OR lifetime_value > 1000
ORDER BY lifetime_value DESC
LIMIT 100;

SELECT 'Q10_OPT_reescritura_rango_sin_funcion_en_where' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT COUNT(*) AS n_orders_january
FROM "order"
WHERE order_purchase_timestamp >= TIMESTAMPTZ '2026-01-01 00:00:00+00'
  AND order_purchase_timestamp <  TIMESTAMPTZ '2026-02-01 00:00:00+00';
