-- =============================================================================
-- 07_materialized_views.sql — Materialized views para reporting OLAP
-- =============================================================================
-- Implementa las dos materialized views que justificó Andrés Camilo en la
-- Formativa para soportar consultas analíticas sin impactar el OLTP:
-- - mv_sales_by_category_monthly: ventas agregadas por categoría y mes.
-- - mv_customer_segments: segmentación de clientes por comportamiento.
--
-- Las MVs deben refrescarse con REFRESH MATERIALIZED VIEW CONCURRENTLY,
-- lo cual requiere un índice único sobre cada MV.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- MV: mv_sales_by_category_monthly
-- Ventas agregadas por categoría y mes. Sirve consultas analíticas tipo
-- "evolución de ventas de Hogar/Cocina en los últimos 12 meses".
-- -----------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_sales_by_category_monthly;
CREATE MATERIALIZED VIEW mv_sales_by_category_monthly AS
SELECT
    c.category_id,
    c.category_name,
    c.category_name_english,
    date_trunc('month', o.order_purchase_timestamp)::DATE AS sales_month,
    COUNT(DISTINCT o.order_id)                    AS n_orders,
    COUNT(oi.order_item_id)                       AS n_items,
    SUM(oi.price)                                 AS gross_revenue,
    SUM(oi.freight_value)                         AS total_freight,
    SUM(oi.price + oi.freight_value)              AS total_with_freight,
    AVG(oi.price)::NUMERIC(12,2)                  AS avg_item_price,
    COUNT(DISTINCT oi.seller_id)                  AS n_sellers,
    COUNT(DISTINCT o.customer_unique_id)          AS n_unique_customers
FROM "order" o
JOIN order_item oi
    ON o.order_id = oi.order_id
   AND o.order_purchase_timestamp = oi.order_purchase_timestamp
JOIN product p
    ON oi.product_id = p.product_id
JOIN category c
    ON p.category_id = c.category_id
WHERE o.order_status IN ('delivered', 'shipped', 'invoiced')
GROUP BY c.category_id, c.category_name, c.category_name_english,
         date_trunc('month', o.order_purchase_timestamp)
WITH NO DATA;

COMMENT ON MATERIALIZED VIEW mv_sales_by_category_monthly IS
    'Ventas mensuales por categoría. Refrescar diariamente fuera de horas pico (REFRESH MATERIALIZED VIEW CONCURRENTLY).';

-- Índice ÚNICO requerido para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_sales_cat_unique
    ON mv_sales_by_category_monthly (category_id, sales_month);

-- Índices secundarios para consultas
CREATE INDEX idx_mv_sales_cat_month
    ON mv_sales_by_category_monthly (sales_month DESC);

CREATE INDEX idx_mv_sales_cat_revenue
    ON mv_sales_by_category_monthly (gross_revenue DESC);

-- -----------------------------------------------------------------------------
-- MV: mv_customer_segments
-- Segmentación RFM-like de clientes. Soporta análisis de retención,
-- identificación de clientes de alto valor, churn, etc.
-- -----------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_customer_segments;
CREATE MATERIALIZED VIEW mv_customer_segments AS
WITH customer_orders AS (
    SELECT
        o.customer_unique_id,
        COUNT(DISTINCT o.order_id)                      AS n_orders,
        MIN(o.order_purchase_timestamp)                 AS first_order_at,
        MAX(o.order_purchase_timestamp)                 AS last_order_at,
        AVG(EXTRACT(EPOCH FROM (
            o.order_delivered_customer_date - o.order_purchase_timestamp
        )) / 86400)::NUMERIC(6,2)                       AS avg_delivery_days
    FROM "order" o
    WHERE o.order_status = 'delivered'
    GROUP BY o.customer_unique_id
),
customer_revenue AS (
    SELECT
        o.customer_unique_id,
        SUM(oi.price + oi.freight_value)                AS lifetime_value,
        SUM(oi.price)                                   AS lifetime_gmv,
        COUNT(oi.order_item_id)                         AS lifetime_items
    FROM "order" o
    JOIN order_item oi
        ON o.order_id = oi.order_id
       AND o.order_purchase_timestamp = oi.order_purchase_timestamp
    WHERE o.order_status = 'delivered'
    GROUP BY o.customer_unique_id
)
SELECT
    co.customer_unique_id,
    c.customer_state,
    co.n_orders,
    co.first_order_at,
    co.last_order_at,
    EXTRACT(DAY FROM (NOW() - co.last_order_at))::INT  AS days_since_last_order,
    co.avg_delivery_days,
    cr.lifetime_value,
    cr.lifetime_gmv,
    cr.lifetime_items,
    -- Segmentación simple en 4 buckets
    CASE
        WHEN co.n_orders >= 5 AND cr.lifetime_value > 1000 THEN 'VIP'
        WHEN co.n_orders >= 2                                  THEN 'Recurrente'
        WHEN EXTRACT(DAY FROM (NOW() - co.last_order_at)) > 365 THEN 'Inactivo'
        ELSE 'Nuevo'
    END AS segment
FROM customer_orders co
JOIN customer_revenue cr ON co.customer_unique_id = cr.customer_unique_id
JOIN customer c          ON co.customer_unique_id = c.customer_unique_id
WITH NO DATA;

COMMENT ON MATERIALIZED VIEW mv_customer_segments IS
    'Segmentación RFM-like de clientes. Refrescar semanalmente. Soporta retención y análisis de valor.';

-- Índice ÚNICO requerido para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_customer_segments_unique
    ON mv_customer_segments (customer_unique_id);

-- Índices secundarios
CREATE INDEX idx_mv_customer_segments_segment
    ON mv_customer_segments (segment);

CREATE INDEX idx_mv_customer_segments_ltv
    ON mv_customer_segments (lifetime_value DESC);

-- -----------------------------------------------------------------------------
-- Comentario operativo sobre el refresh
-- -----------------------------------------------------------------------------
-- Refresh de las MVs (ejecutar con cron / pg_cron en producción):
--
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_by_category_monthly;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_segments;
--
-- Cadencia recomendada:
--   mv_sales_by_category_monthly → diariamente a las 03:00 UTC
--   mv_customer_segments        → semanalmente, domingo 03:00 UTC

DO $$
BEGIN
    RAISE NOTICE 'Materialized views creadas (sin datos). Ejecutar REFRESH MATERIALIZED VIEW para poblarlas después de cargar la información transaccional.';
END $$;
