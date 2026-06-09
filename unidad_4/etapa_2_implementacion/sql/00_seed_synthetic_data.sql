-- =============================================================================
-- Unidad 4 / Etapa 2 — Generador de datos sinteticos (~150k ordenes)
-- =============================================================================
-- Objetivo: poblar la base con volumen suficiente (>100.000 ordenes, criterio
-- de la guia) para medir de forma creible el impacto de indices, reescrituras
-- y particionamiento. Los datos mock de 07_5_mock_data.sql son minimos (1 orden,
-- 0 order_item, 0 payment) y producen consultas con 0 filas y tiempos triviales.
--
-- Este script:
--   - Respeta TODAS las restricciones de 05_constraints.sql (coherencia temporal
--     de order, shipping_limit_date >= purchase, state mayuscula 2 chars,
--     zip 1000..99999, price/freight >= 0, installments >= 1, value > 0).
--   - Distribuye order_purchase_timestamp solo dentro de las particiones
--     nombradas (2025-10-01 .. 2026-06-30), de modo que order_default quede en 0
--     y el partition pruning sea demostrable.
--   - Conserva los fixtures de 07_5_mock_data.sql (ORD-999, CUST_ABC, PROD-101..103,
--     SELLER_XYZ) y les agrega detalle (order_item + payment para ORD-999).
--   - Agrega una promocion ACTIVA para la categoria 2 (Q08 devolvia 0 filas).
--   - Agrupa ~40% de sellers cerca de Sao Paulo para que Q07 (ST_DWithin a 50 km
--     del cliente CUST_ABC en Sao Paulo) devuelva filas.
--
-- Ejecutar UNA vez sobre la base ya inicializada, ANTES del baseline.
-- Idempotente por ON CONFLICT DO NOTHING (re-ejecutar no duplica).
-- =============================================================================

\set ON_ERROR_STOP on
\timing on
SET search_path TO public;

\echo '== Seed U4: generando productos sinteticos =='
-- -----------------------------------------------------------------------------
-- 1. Productos PROD_1..PROD_1000 (ademas de PROD-101..103 del mock).
--    Varios nombres "Cafetera ..." dan volumen al indice trigram (Q05).
--    ~25% con product_specifications {"capacity_cups": 6} para Q04.
-- -----------------------------------------------------------------------------
INSERT INTO product (product_id, category_id, name, description, product_specifications, base_price)
SELECT
    'PROD_' || g,
    1 + (g % 3),                                   -- categorias 1,2,3
    CASE
        WHEN g % 7 = 0 THEN 'Cafetera Expresso Modelo ' || g
        WHEN g % 5 = 0 THEN 'Televisor Smart 4K ' || g
        WHEN g % 3 = 0 THEN 'Teclado Mecanico RGB ' || g
        ELSE 'Producto Generico ' || g
    END,
    'Producto sintetico para pruebas de rendimiento U4',
    CASE (g % 4)
        WHEN 0 THEN '{"capacity_cups": 6, "color": "plata", "material": "aluminio"}'::jsonb
        WHEN 1 THEN '{"resolution": "4K", "color": "negro", "voltage": "110V-220V"}'::jsonb
        WHEN 2 THEN '{"switch": "brown", "color": "blanco", "voltage": "USB"}'::jsonb
        ELSE NULL
    END,
    round((10 + random() * 3000)::numeric, 2)
FROM generate_series(1, 1000) AS g
ON CONFLICT DO NOTHING;

\echo '== Seed U4: generando clientes (~20k) con geo =='
-- -----------------------------------------------------------------------------
-- 2. Clientes CUST_1..CUST_20000. customer_geo explicito (el trigger derive_*
--    solo actua si viene NULL). Puntos dispersos por Brasil.
-- -----------------------------------------------------------------------------
INSERT INTO customer (customer_unique_id, customer_zip_code_prefix, customer_city, customer_state, customer_geo)
SELECT
    'CUST_' || g,
    1000 + (floor(random() * 98999))::int,
    'Ciudad_' || (g % 200),
    (ARRAY['SP','RJ','MG','RS','PR','BA','SC','PE','CE','GO']::char(2)[])[1 + (floor(random() * 10))::int],
    ST_SetSRID(
        ST_MakePoint(-46.6388 + (random() - 0.5) * 8.0, -23.5489 + (random() - 0.5) * 8.0),
        4326
    )::geography
FROM generate_series(1, 20000) AS g
ON CONFLICT DO NOTHING;

\echo '== Seed U4: generando sellers (~1.5k), ~40% cerca de Sao Paulo =='
-- -----------------------------------------------------------------------------
-- 3. Sellers SELLER_1..SELLER_1500. ~40% agrupados a <~45 km de Sao Paulo
--    para que Q07 (ST_DWithin 50 km desde CUST_ABC) devuelva resultados.
-- -----------------------------------------------------------------------------
INSERT INTO seller (seller_id, seller_zip_code_prefix, seller_city, seller_state, seller_geo)
SELECT
    'SELLER_' || g,
    1000 + (floor(random() * 98999))::int,
    'Ciudad_' || (g % 100),
    (ARRAY['SP','RJ','MG','RS','PR']::char(2)[])[1 + (floor(random() * 5))::int],
    CASE WHEN g % 5 < 2
        THEN ST_SetSRID(ST_MakePoint(-46.6388 + (random() - 0.5) * 0.6, -23.5489 + (random() - 0.5) * 0.6), 4326)::geography
        ELSE ST_SetSRID(ST_MakePoint(-46.6388 + (random() - 0.5) * 10.0, -23.5489 + (random() - 0.5) * 10.0), 4326)::geography
    END
FROM generate_series(1, 1500) AS g
ON CONFLICT DO NOTHING;

\echo '== Seed U4: generando ordenes (~150k) en particiones 2025-10..2026-06 =='
-- -----------------------------------------------------------------------------
-- 4. Ordenes ORDG_1..ORDG_150000.
--    - Desactivamos trg_order_status_audit para no insertar 150k filas en
--      order_status_history durante la carga (velocidad). Se reactiva al final.
--    - 50% delivered (con fechas approved<carrier<customer coherentes), 40%
--      estados activos (created/approved/invoiced/shipped), 10% canceled.
--    - Timestamps solo dentro de particiones nombradas -> order_default = 0.
-- -----------------------------------------------------------------------------
ALTER TABLE "order" DISABLE TRIGGER trg_order_status_audit;

INSERT INTO "order" (
    order_id, customer_unique_id, order_status, order_purchase_timestamp,
    order_approved_at, order_delivered_carrier_date, order_delivered_customer_date,
    order_estimated_delivery_date
)
SELECT
    order_id,
    customer_unique_id,
    st,
    ts,
    CASE WHEN st IN ('approved','invoiced','shipped','delivered') THEN ts + INTERVAL '6 hours' END,
    CASE WHEN st IN ('shipped','delivered')                       THEN ts + INTERVAL '2 days'  END,
    CASE WHEN st =  'delivered'                                    THEN ts + INTERVAL '5 days'  END,
    ts + INTERVAL '10 days'
FROM (
    SELECT
        'ORDG_' || g                                                   AS order_id,
        'CUST_' || (1 + (floor(random() * 20000))::int)                AS customer_unique_id,
        (ARRAY['delivered','delivered','delivered','delivered','delivered',
               'shipped','invoiced','approved','created','canceled']::order_status[])
               [1 + (floor(random() * 10))::int]                       AS st,
        TIMESTAMPTZ '2025-10-01 00:00:00+00'
            + ((floor(random() * 270))::int) * INTERVAL '1 day'
            + ((floor(random() * 86400))::int) * INTERVAL '1 second'   AS ts
    FROM generate_series(1, 150000) AS g
) base
ON CONFLICT DO NOTHING;

ALTER TABLE "order" ENABLE TRIGGER trg_order_status_audit;

\echo '== Seed U4: generando order_items (2 por orden) =='
-- -----------------------------------------------------------------------------
-- 5. Order items: 2 lineas por orden (300.000 en total). Cantidad fija y
--    determinista para reproducibilidad. shipping_limit_date >= purchase (constraint).
--    order_purchase_timestamp identico al de la orden (FK compuesta).
-- -----------------------------------------------------------------------------
INSERT INTO order_item (
    order_id, order_item_id, order_purchase_timestamp,
    product_id, seller_id, shipping_limit_date, price, freight_value
)
SELECT
    o.order_id,
    gs.i,
    o.order_purchase_timestamp,
    'PROD_'   || (1 + (floor(random() * 1000))::int),
    'SELLER_' || (1 + (floor(random() * 1500))::int),
    o.order_purchase_timestamp + ((1 + (floor(random() * 7))::int)) * INTERVAL '1 day',
    round((10 + random() * 490)::numeric, 2),
    round((5  + random() * 45)::numeric, 2)
FROM "order" o
CROSS JOIN LATERAL generate_series(1, 2) AS gs(i)
WHERE o.order_id LIKE 'ORDG\_%'
ON CONFLICT DO NOTHING;

\echo '== Seed U4: generando payments (1 por orden) =='
-- -----------------------------------------------------------------------------
-- 6. Pagos: 1 por orden. installments >= 1, value > 0.
-- -----------------------------------------------------------------------------
INSERT INTO payment (
    order_id, payment_sequential, order_purchase_timestamp,
    payment_type, payment_installments, payment_value
)
SELECT
    o.order_id,
    1,
    o.order_purchase_timestamp,
    (ARRAY['credit_card','credit_card','credit_card','boleto','pix','debit_card','voucher']::payment_type[])
        [1 + (floor(random() * 7))::int],
    1 + (floor(random() * 12))::int,
    round((20 + random() * 1980)::numeric, 2)
FROM "order" o
WHERE o.order_id LIKE 'ORDG\_%'
ON CONFLICT DO NOTHING;

\echo '== Seed U4: fixtures puntuales (ORD-999 detalle, promocion categoria 2) =='
-- -----------------------------------------------------------------------------
-- 7. Detalle para ORD-999 (Q02) usando productos/seller del mock.
-- -----------------------------------------------------------------------------
INSERT INTO order_item (order_id, order_item_id, order_purchase_timestamp, product_id, seller_id, shipping_limit_date, price, freight_value)
VALUES
    ('ORD-999', 1, TIMESTAMPTZ '2026-01-15 10:00:00+00', 'PROD-101', 'SELLER_XYZ', TIMESTAMPTZ '2026-01-18 10:00:00+00', 120.50, 15.00),
    ('ORD-999', 2, TIMESTAMPTZ '2026-01-15 10:00:00+00', 'PROD-102', 'SELLER_XYZ', TIMESTAMPTZ '2026-01-19 10:00:00+00', 3500.00, 40.00)
ON CONFLICT DO NOTHING;

INSERT INTO payment (order_id, payment_sequential, order_purchase_timestamp, payment_type, payment_installments, payment_value)
VALUES
    ('ORD-999', 1, TIMESTAMPTZ '2026-01-15 10:00:00+00', 'credit_card', 3, 3676.00)
ON CONFLICT DO NOTHING;

-- Promocion ACTIVA que apunta a la categoria 2 (la del mock apunta a [1,3]).
INSERT INTO promotion (name, discount_percentage, promotion_period, target_category_ids)
VALUES
    ('Oferta Cocina Junio 2026', 10.00, tstzrange(NOW() - INTERVAL '1 day', NOW() + INTERVAL '20 days'), ARRAY[2])
ON CONFLICT DO NOTHING;

\echo '== Seed U4: ANALYZE de todas las tablas =='
ANALYZE category;
ANALYZE product;
ANALYZE customer;
ANALYZE seller;
ANALYZE promotion;
ANALYZE "order";
ANALYZE order_item;
ANALYZE payment;

\echo '== Seed U4: conteos resultantes =='
SELECT 'category'   AS tabla, COUNT(*) AS filas FROM category
UNION ALL SELECT 'product',    COUNT(*) FROM product
UNION ALL SELECT 'customer',   COUNT(*) FROM customer
UNION ALL SELECT 'seller',     COUNT(*) FROM seller
UNION ALL SELECT 'promotion',  COUNT(*) FROM promotion
UNION ALL SELECT 'order',      COUNT(*) FROM "order"
UNION ALL SELECT 'order_item', COUNT(*) FROM order_item
UNION ALL SELECT 'payment',    COUNT(*) FROM payment
ORDER BY tabla;

\echo '== Seed U4: filas en order_default (debe ser 0) =='
SELECT COUNT(*) AS rows_in_default FROM order_default;
