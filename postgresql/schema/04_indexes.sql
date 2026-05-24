-- =============================================================================
-- 04_indexes.sql — Índices del módulo PostgreSQL
-- =============================================================================
-- Crea los índices necesarios para soportar:
-- - Búsqueda eficiente sobre JSONB (GIN).
-- - Búsqueda tolerante a errores tipográficos (pg_trgm con GIN).
-- - Consultas espaciales sobre PostGIS (GIST).
-- - Joins frecuentes en FKs (B-tree).
-- - Consultas operativas sobre órdenes pendientes (índice parcial).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Customer
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_customer_state
    ON customer (customer_state);

CREATE INDEX IF NOT EXISTS idx_customer_zip
    ON customer (customer_zip_code_prefix);

-- Índice espacial sobre customer_geo (GIST es el tipo correcto para PostGIS)
CREATE INDEX IF NOT EXISTS idx_customer_geo
    ON customer USING GIST (customer_geo);

-- -----------------------------------------------------------------------------
-- Seller
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_seller_state
    ON seller (seller_state);

CREATE INDEX IF NOT EXISTS idx_seller_zip
    ON seller (seller_zip_code_prefix);

CREATE INDEX IF NOT EXISTS idx_seller_geo
    ON seller USING GIST (seller_geo);

-- -----------------------------------------------------------------------------
-- Category
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_category_parent
    ON category (parent_category_id)
    WHERE parent_category_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Product — concentra varios tipos de índices avanzados
-- -----------------------------------------------------------------------------

-- B-tree sobre FK (joins frecuentes con OrderItem)
CREATE INDEX IF NOT EXISTS idx_product_category
    ON product (category_id);

-- GIN sobre product_specifications JSONB para búsquedas estructurales
-- Permite: WHERE product_specifications @> '{"color":"rojo"}'
CREATE INDEX IF NOT EXISTS idx_product_specs_gin
    ON product USING GIN (product_specifications);

-- GIN sobre product_tags para búsqueda por etiqueta
-- Permite: WHERE 'oferta' = ANY(product_tags)
CREATE INDEX IF NOT EXISTS idx_product_tags_gin
    ON product USING GIN (product_tags);

-- Trigram sobre name para búsqueda tolerante a errores tipográficos
-- Permite: WHERE name % 'cafetera' (similarity > 0.3)
-- Permite: WHERE name ILIKE '%cafe%' con buena performance
CREATE INDEX IF NOT EXISTS idx_product_name_trgm
    ON product USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_product_description_trgm
    ON product USING GIN (description gin_trgm_ops);

-- Índice sobre base_price para filtros y rangos
CREATE INDEX IF NOT EXISTS idx_product_price
    ON product (base_price);

-- -----------------------------------------------------------------------------
-- Promotion — índice GIST sobre el TSTZRANGE
-- -----------------------------------------------------------------------------

-- GIST sobre promotion_period para queries activas eficientes
-- Permite: WHERE NOW() <@ promotion_period
CREATE INDEX IF NOT EXISTS idx_promotion_period_gist
    ON promotion USING GIST (promotion_period);

-- GIN sobre arrays de targets para búsqueda de promociones aplicables
CREATE INDEX IF NOT EXISTS idx_promotion_target_categories
    ON promotion USING GIN (target_category_ids);

CREATE INDEX IF NOT EXISTS idx_promotion_target_products
    ON promotion USING GIN (target_product_ids);

-- -----------------------------------------------------------------------------
-- Order — índices sobre la tabla particionada
-- PostgreSQL replica el índice a cada partición automáticamente.
-- -----------------------------------------------------------------------------

-- B-tree sobre customer (joins frecuentes)
CREATE INDEX IF NOT EXISTS idx_order_customer
    ON "order" (customer_unique_id);

-- B-tree sobre order_status (filtros operativos por estado)
CREATE INDEX IF NOT EXISTS idx_order_status
    ON "order" (order_status);

-- ÍNDICE PARCIAL: solo órdenes en estados operativos (pending, approved).
-- Reduce drásticamente el tamaño del índice porque los estados terminales
-- (delivered, canceled, returned) son la mayoría del histórico.
-- Acelera consultas operativas tipo "qué órdenes están abiertas".
CREATE INDEX IF NOT EXISTS idx_order_active_status
    ON "order" (order_purchase_timestamp DESC, customer_unique_id)
    WHERE order_status IN ('created', 'approved', 'invoiced', 'shipped');

-- -----------------------------------------------------------------------------
-- OrderItem — FKs y agregaciones por producto/seller
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_order_item_product
    ON order_item (product_id);

CREATE INDEX IF NOT EXISTS idx_order_item_seller
    ON order_item (seller_id);

-- Búsqueda por orden (recuperar todos los items de una orden)
CREATE INDEX IF NOT EXISTS idx_order_item_order
    ON order_item (order_id);

-- -----------------------------------------------------------------------------
-- Payment — agregaciones por método de pago
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_payment_type
    ON payment (payment_type);

CREATE INDEX IF NOT EXISTS idx_payment_order
    ON payment (order_id);

-- -----------------------------------------------------------------------------
-- OrderStatusHistory — consultas por orden y por fecha
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_status_history_order
    ON order_status_history (order_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_status_history_changed_at
    ON order_status_history (changed_at DESC);

-- -----------------------------------------------------------------------------
-- Geolocation — índice espacial para lookups de zip → punto
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_geolocation_zip
    ON geolocation (geolocation_zip_code_prefix);

CREATE INDEX IF NOT EXISTS idx_geolocation_point_gist
    ON geolocation USING GIST (geolocation_point);

-- Verificación
DO $$
DECLARE
    n_indexes INT;
BEGIN
    SELECT COUNT(*) INTO n_indexes
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname LIKE 'idx_%';

    RAISE NOTICE 'Índices creados: %', n_indexes;
END $$;
