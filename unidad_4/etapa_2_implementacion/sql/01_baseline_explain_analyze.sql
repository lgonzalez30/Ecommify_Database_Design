-- =============================================================================
-- Unidad 4 / Etapa 2 — Baseline con EXPLAIN (ANALYZE, BUFFERS)
-- =============================================================================
-- Ejecutar antes de aplicar sql/02_indices_optimizacion_u4.sql.
-- Registrar Planning Time, Execution Time, buffers leidos y tipo de scan.
-- =============================================================================

\pset pager off
\timing on
SET search_path TO public;

SELECT 'Q01_BASELINE_ordenes_activas_recientes' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT order_id, order_status, customer_unique_id, order_purchase_timestamp
FROM "order"
WHERE order_purchase_timestamp >= TIMESTAMPTZ '2026-01-01 00:00:00+00'
  AND order_purchase_timestamp <  TIMESTAMPTZ '2026-02-01 00:00:00+00'
  AND order_status IN ('created', 'approved', 'invoiced', 'shipped')
ORDER BY order_purchase_timestamp DESC
LIMIT 100;

SELECT 'Q02_BASELINE_detalle_orden' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
    o.order_id,
    o.order_status,
    o.order_purchase_timestamp,
    c.customer_state,
    oi.order_item_id,
    p.product_id,
    p.name AS product_name,
    s.seller_id,
    pay.payment_type,
    pay.payment_value
FROM "order" o
JOIN customer c
    ON c.customer_unique_id = o.customer_unique_id
JOIN order_item oi
    ON oi.order_id = o.order_id
   AND oi.order_purchase_timestamp = o.order_purchase_timestamp
JOIN product p
    ON p.product_id = oi.product_id
JOIN seller s
    ON s.seller_id = oi.seller_id
LEFT JOIN payment pay
    ON pay.order_id = o.order_id
   AND pay.order_purchase_timestamp = o.order_purchase_timestamp
WHERE o.order_id = 'ORD-999'
  AND o.order_purchase_timestamp = TIMESTAMPTZ '2026-01-15 10:00:00+00';

SELECT 'Q03_BASELINE_ventas_categoria_mes_tablas_base' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
    c.category_name_english,
    date_trunc('month', o.order_purchase_timestamp)::DATE AS sales_month,
    COUNT(DISTINCT o.order_id) AS n_orders,
    SUM(oi.price + oi.freight_value) AS total_revenue
FROM "order" o
JOIN order_item oi
    ON oi.order_id = o.order_id
   AND oi.order_purchase_timestamp = o.order_purchase_timestamp
JOIN product p
    ON p.product_id = oi.product_id
JOIN category c
    ON c.category_id = p.category_id
WHERE o.order_status IN ('delivered', 'shipped', 'invoiced')
  AND o.order_purchase_timestamp >= TIMESTAMPTZ '2026-01-01 00:00:00+00'
  AND o.order_purchase_timestamp <  TIMESTAMPTZ '2026-07-01 00:00:00+00'
GROUP BY c.category_name_english, date_trunc('month', o.order_purchase_timestamp)
ORDER BY sales_month DESC, total_revenue DESC;

SELECT 'Q04_BASELINE_jsonb_catalogo' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT product_id, name, base_price, product_specifications
FROM product
WHERE product_specifications @> '{"capacity_cups": 6}'
  AND base_price BETWEEN 50 AND 200
ORDER BY base_price ASC
LIMIT 20;

SELECT 'Q05_BASELINE_texto_producto' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT product_id, name, similarity(name, 'cafetera') AS sim
FROM product
WHERE name % 'cafetera'
ORDER BY sim DESC
LIMIT 20;

SELECT 'Q06_BASELINE_seller_delivery_performance' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
    s.seller_id,
    s.seller_state,
    COUNT(DISTINCT o.order_id) AS n_orders,
    SUM(oi.price + oi.freight_value) AS gross_revenue,
    AVG(EXTRACT(EPOCH FROM (o.order_delivered_customer_date - o.order_purchase_timestamp)) / 86400) AS avg_delivery_days
FROM seller s
JOIN order_item oi
    ON oi.seller_id = s.seller_id
JOIN "order" o
    ON o.order_id = oi.order_id
   AND o.order_purchase_timestamp = oi.order_purchase_timestamp
WHERE o.order_status = 'delivered'
  AND oi.shipping_limit_date >= TIMESTAMPTZ '2026-01-01 00:00:00+00'
  AND oi.shipping_limit_date <  TIMESTAMPTZ '2026-07-01 00:00:00+00'
GROUP BY s.seller_id, s.seller_state
ORDER BY gross_revenue DESC
LIMIT 20;

SELECT 'Q07_BASELINE_geo_sellers_cercanos' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
    s.seller_id,
    s.seller_city,
    ST_Distance(c.customer_geo, s.seller_geo) / 1000 AS distance_km
FROM customer c
JOIN seller s
    ON ST_DWithin(c.customer_geo, s.seller_geo, 50000)
WHERE c.customer_unique_id = 'CUST_ABC'
ORDER BY distance_km ASC
LIMIT 10;

SELECT 'Q08_BASELINE_promociones_activas_categoria' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT promotion_id, name, discount_percentage, discount_amount
FROM promotion
WHERE NOW() <@ promotion_period
  AND target_category_ids @> ARRAY[2];

SELECT 'Q09_BASELINE_segmentacion_tablas_base' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
WITH customer_revenue AS (
    SELECT
        o.customer_unique_id,
        COUNT(DISTINCT o.order_id) AS n_orders,
        MAX(o.order_purchase_timestamp) AS last_order_at,
        SUM(oi.price + oi.freight_value) AS lifetime_value
    FROM "order" o
    JOIN order_item oi
        ON oi.order_id = o.order_id
       AND oi.order_purchase_timestamp = o.order_purchase_timestamp
    WHERE o.order_status = 'delivered'
    GROUP BY o.customer_unique_id
)
SELECT *
FROM customer_revenue
WHERE n_orders >= 2 OR lifetime_value > 1000
ORDER BY lifetime_value DESC
LIMIT 100;

SELECT 'Q10_BASELINE_anti_patron_funcion_en_where' AS query_id;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT COUNT(*) AS n_orders_january
FROM "order"
WHERE date_trunc('month', order_purchase_timestamp) = DATE '2026-01-01';
