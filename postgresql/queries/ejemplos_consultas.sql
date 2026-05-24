-- =============================================================================
-- ejemplos_consultas.sql — Consultas que aprovechan los tipos avanzados
-- =============================================================================
-- Este archivo demuestra el valor de los tipos avanzados que justificó la
-- Formativa de Andrés Camilo: JSONB, ARRAY, TSTZRANGE, PostGIS, pg_trgm.
-- Cada consulta tiene un caso de uso real del marketplace.
-- =============================================================================

-- =============================================================================
-- 1. JSONB — Búsqueda estructurada en product_specifications
-- =============================================================================

-- 1.1. Productos cuyo color es "rojo" (operador @> de contención).
-- Usa idx_product_specs_gin.
SELECT product_id, name, product_specifications
  FROM product
 WHERE product_specifications @> '{"color":"rojo"}';

-- 1.2. Productos con cualquier capacidad >= 6 tazas.
-- Usa la función jsonb_path_query con operadores de comparación.
SELECT product_id, name,
       (product_specifications->>'capacity_cups')::INT AS capacity
  FROM product
 WHERE jsonb_path_exists(
           product_specifications,
           '$.capacity_cups ? (@ >= 6)'
       );

-- 1.3. Productos electrónicos con voltaje específico.
-- Combinación de filtro por categoría + filtro JSONB.
SELECT p.product_id, p.name, p.product_specifications->>'voltage' AS voltage
  FROM product p
  JOIN category c ON p.category_id = c.category_id
 WHERE c.category_name_english = 'electronics'
   AND p.product_specifications @> '{"voltage":"110V"}';

-- =============================================================================
-- 2. ARRAY — Tags y fotos múltiples
-- =============================================================================

-- 2.1. Productos con la etiqueta "oferta" entre sus tags.
-- Usa idx_product_tags_gin.
SELECT product_id, name, product_tags
  FROM product
 WHERE 'oferta' = ANY(product_tags);

-- 2.2. Productos que tienen AL MENOS UNA de varias etiquetas (cualquier match).
SELECT product_id, name, product_tags
  FROM product
 WHERE product_tags && ARRAY['cocina', 'hogar', 'electrodomestico'];

-- 2.3. Productos con TODAS las etiquetas requeridas (intersección).
SELECT product_id, name, product_tags
  FROM product
 WHERE product_tags @> ARRAY['cocina', 'oferta'];

-- 2.4. Productos sin foto principal (array vacío o NULL).
SELECT product_id, name
  FROM product
 WHERE product_photos IS NULL
    OR array_length(product_photos, 1) IS NULL
    OR array_length(product_photos, 1) = 0;

-- =============================================================================
-- 3. TSTZRANGE — Promociones vigentes
-- =============================================================================

-- 3.1. Promociones activas en este preciso momento.
-- Usa idx_promotion_period_gist con operador <@.
SELECT promotion_id, name, promotion_period
  FROM promotion
 WHERE NOW() <@ promotion_period;

-- 3.2. Promociones que se solapan con un periodo dado (útil para no
-- programar dos promociones simultáneas sobre la misma categoría).
SELECT promotion_id, name, promotion_period
  FROM promotion
 WHERE promotion_period && tstzrange('2026-12-01', '2026-12-31');

-- 3.3. Promociones que aplican a una categoría específica y están activas.
SELECT p.promotion_id, p.name, p.discount_percentage, p.discount_amount
  FROM promotion p
 WHERE NOW() <@ p.promotion_period
   AND 12 = ANY(p.target_category_ids);

-- =============================================================================
-- 4. PostGIS — Distancia y cobertura geográfica
-- =============================================================================

-- 4.1. Distancia en kilómetros entre un cliente y un seller específicos.
SELECT
    ST_Distance(c.customer_geo::geography, s.seller_geo::geography) / 1000
        AS distance_km
  FROM customer c, seller s
 WHERE c.customer_unique_id = 'CUST_ABC'
   AND s.seller_id = 'SELLER_XYZ';

-- 4.2. Sellers dentro de 50 km del cliente (top 10 por cercanía).
SELECT s.seller_id, s.seller_city,
       ST_Distance(c.customer_geo::geography, s.seller_geo::geography) / 1000 AS dist_km
  FROM seller s, customer c
 WHERE c.customer_unique_id = 'CUST_ABC'
   AND ST_DWithin(c.customer_geo::geography, s.seller_geo::geography, 50000)
 ORDER BY dist_km ASC
 LIMIT 10;

-- 4.3. Concentración geográfica: contar clientes por estado y mostrar el centroide.
SELECT customer_state,
       COUNT(*)                                                          AS n_clientes,
       ST_AsText(ST_Centroid(ST_Collect(customer_geo::geometry)))        AS centroide
  FROM customer
 WHERE customer_geo IS NOT NULL
 GROUP BY customer_state
 ORDER BY n_clientes DESC;

-- =============================================================================
-- 5. pg_trgm — Búsqueda tolerante a errores tipográficos
-- =============================================================================

-- 5.1. Productos con nombre similar a "cafetera" (errores tipográficos OK).
-- Usa idx_product_name_trgm.
SELECT product_id, name,
       similarity(name, 'cafetera') AS sim
  FROM product
 WHERE name % 'cafetera'
 ORDER BY sim DESC
 LIMIT 20;

-- 5.2. Búsqueda full-text-like con ILIKE acelerada por trigram.
SELECT product_id, name
  FROM product
 WHERE name ILIKE '%italiana%'
 LIMIT 50;

-- 5.3. Productos cuyo nombre o descripción matchean con "cafe".
SELECT product_id, name,
       GREATEST(
           similarity(name, 'cafe'),
           similarity(description, 'cafe')
       ) AS best_sim
  FROM product
 WHERE name % 'cafe' OR description % 'cafe'
 ORDER BY best_sim DESC
 LIMIT 20;

-- =============================================================================
-- 6. Partitioning — Consultas que aprovechan partition pruning
-- =============================================================================

-- 6.1. Órdenes del último mes. PostgreSQL debe escanear solo la partición
-- mensual correspondiente.
EXPLAIN
SELECT order_id, order_status, customer_unique_id
  FROM "order"
 WHERE order_purchase_timestamp >= date_trunc('month', NOW())
   AND order_purchase_timestamp <  date_trunc('month', NOW()) + INTERVAL '1 month';

-- 6.2. Órdenes activas en los últimos 7 días. Usa el índice parcial.
SELECT order_id, order_status, customer_unique_id, order_purchase_timestamp
  FROM "order"
 WHERE order_purchase_timestamp >= NOW() - INTERVAL '7 days'
   AND order_status IN ('created', 'approved', 'invoiced', 'shipped')
 ORDER BY order_purchase_timestamp DESC
 LIMIT 100;

-- =============================================================================
-- 7. Composite type — Acceso a campos de product_dimensions
-- =============================================================================

-- 7.1. Productos pesados (más de 5 kg).
SELECT product_id, name, (dimensions).weight_g AS weight_g
  FROM product
 WHERE (dimensions).weight_g > 5000
 ORDER BY (dimensions).weight_g DESC;

-- 7.2. Productos voluminosos (volumen calculado).
SELECT product_id, name,
       (dimensions).length_cm * (dimensions).height_cm * (dimensions).width_cm
           AS volume_cm3
  FROM product
 WHERE dimensions IS NOT NULL
 ORDER BY volume_cm3 DESC NULLS LAST
 LIMIT 20;

-- =============================================================================
-- 8. Materialized views — Consultas analíticas que NO golpean el OLTP
-- =============================================================================

-- 8.1. Top 5 categorías por ingreso en el último año.
SELECT category_name_english,
       SUM(gross_revenue)::NUMERIC(14,2) AS revenue_12m,
       SUM(n_orders)                     AS orders_12m
  FROM mv_sales_by_category_monthly
 WHERE sales_month >= date_trunc('month', NOW()) - INTERVAL '12 months'
 GROUP BY category_name_english
 ORDER BY revenue_12m DESC
 LIMIT 5;

-- 8.2. Clientes VIP por estado.
SELECT customer_state,
       COUNT(*)                              AS n_vip,
       SUM(lifetime_value)::NUMERIC(14,2)    AS total_ltv
  FROM mv_customer_segments
 WHERE segment = 'VIP'
 GROUP BY customer_state
 ORDER BY total_ltv DESC;

-- 8.3. Distribución de clientes por segmento.
SELECT segment, COUNT(*) AS n_clientes
  FROM mv_customer_segments
 GROUP BY segment
 ORDER BY n_clientes DESC;
