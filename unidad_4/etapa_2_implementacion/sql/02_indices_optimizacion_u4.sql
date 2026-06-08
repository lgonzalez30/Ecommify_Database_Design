-- =============================================================================
-- Unidad 4 / Etapa 2 — Indices especializados adicionales
-- =============================================================================
-- Complementa postgresql/schema/04_indexes.sql con indices orientados a
-- medicion de la Unidad 4. Todos usan prefijo idx_u4_.
-- =============================================================================

\pset pager off
\timing on
SET search_path TO public;

-- 1. BRIN sobre tabla particionada order.
-- Caso: filtros por rango temporal en tabla grande append-only.
CREATE INDEX IF NOT EXISTS idx_u4_order_purchase_brin
    ON "order" USING BRIN (order_purchase_timestamp)
    WITH (pages_per_range = 32);

-- 2. B-tree compuesto sobre estado + fecha.
-- Caso: ordenes por estado operativo y ventana temporal.
CREATE INDEX IF NOT EXISTS idx_u4_order_status_purchase
    ON "order" (order_status, order_purchase_timestamp DESC);

-- 3. Parcial para clientes con ordenes entregadas.
-- Caso: segmentacion RFM y calculo de lifetime value.
CREATE INDEX IF NOT EXISTS idx_u4_order_delivered_customer
    ON "order" (customer_unique_id, order_purchase_timestamp DESC)
    WHERE order_status = 'delivered';

-- 4. B-tree compuesto para rendimiento de seller y SLA.
-- Caso: consultas por seller + ventana de shipping_limit_date.
CREATE INDEX IF NOT EXISTS idx_u4_order_item_seller_shipping
    ON order_item (seller_id, shipping_limit_date, order_purchase_timestamp);

-- 5. GIN de expresion con trigram.
-- Caso: busqueda textual case-insensitive con lower(name) % lower(?).
CREATE INDEX IF NOT EXISTS idx_u4_product_name_lower_trgm
    ON product USING GIN (lower(name) gin_trgm_ops);

-- 6. B-tree compuesto para pagos por metodo, cuotas y valor.
-- Caso: auditoria de pagos y consultas de riesgo.
CREATE INDEX IF NOT EXISTS idx_u4_payment_type_installments_value
    ON payment (payment_type, payment_installments, payment_value);

ANALYZE customer;
ANALYZE seller;
ANALYZE category;
ANALYZE product;
ANALYZE promotion;
ANALYZE "order";
ANALYZE order_item;
ANALYZE payment;
ANALYZE order_status_history;
ANALYZE geolocation;

SELECT
    schemaname,
    indexrelname AS indexname,
    relname AS tablename,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE indexrelname LIKE 'idx_u4_%'
ORDER BY indexrelname;
