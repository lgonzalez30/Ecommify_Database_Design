-- =============================================================================
-- 07_5_mock_data.sql — Datos de prueba para validar consultas avanzadas
-- =============================================================================

BEGIN;

-- 1. Insertar Categorías
INSERT INTO category (category_id, category_name, category_name_english) VALUES
                                                                             (1, 'Eletrônicos', 'electronics'),
                                                                             (2, 'Casa e Cozinha', 'home_appliances'),
                                                                             (3, 'Informática', 'computers')
    ON CONFLICT DO NOTHING;

-- 2. Insertar Productos (Con JSONB, Arrays, HStore y Composite Types)
INSERT INTO product (product_id, category_id, name, description, product_specifications, product_photos, product_tags, dimensions, base_price) VALUES
                                                                                                                                                   ('PROD-101', 2, 'Cafetera Expresso Italiana', 'Cafetera clásica de aluminio 6 tazas.',
                                                                                                                                                    '{"color": "plata", "capacity_cups": 6, "material": "aluminio"}',
                                                                                                                                                    ARRAY['img/cafe1.jpg', 'img/cafe2.jpg'],
                                                                                                                                                    ARRAY['cocina', 'hogar', 'cafe'],
                                                                                                                                                    ROW(15.0, 20.0, 10.0, 450.0)::product_dimensions,
                                                                                                                                                    120.50),

                                                                                                                                                   ('PROD-102', 1, 'TV Inteligente 55 Pulgadas 4K', 'Smart TV LED con colores vibrantes.',
                                                                                                                                                    '{"color": "negro", "resolution": "4K", "voltage": "110V-220V"}',
                                                                                                                                                    ARRAY['img/tv1.jpg'],
                                                                                                                                                    ARRAY['tecnologia', 'oferta', 'hogar'],
                                                                                                                                                    ROW(123.0, 71.0, 8.0, 15000.0)::product_dimensions,
                                                                                                                                                    3500.00),

                                                                                                                                                   ('PROD-103', 3, 'Teclado Mecánico RGB', 'Teclado para programadores y gamers.',
                                                                                                                                                    '{"color": "blanco", "switch": "brown", "voltage": "USB"}',
                                                                                                                                                    NULL,
                                                                                                                                                    ARRAY['computadoras', 'gamer'],
                                                                                                                                                    ROW(45.0, 15.0, 4.0, 800.0)::product_dimensions,
                                                                                                                                                    450.00)
    ON CONFLICT DO NOTHING;

-- 3. Insertar Promociones (Con rangos TSTZRANGE)
INSERT INTO promotion (name, discount_percentage, promotion_period, target_category_ids) VALUES
                                                                                             ('Black Friday', 20.00, tstzrange(NOW() - INTERVAL '1 day', NOW() + INTERVAL '10 days'), ARRAY[1, 3]),
                                                                                             ('Liquidación Verano', 15.00, tstzrange('2025-01-01 00:00:00Z', '2025-01-31 23:59:59Z'), ARRAY[2])
    ON CONFLICT DO NOTHING;

-- 4. Insertar Datos Geoespaciales (PostGIS)
INSERT INTO geolocation (geolocation_zip_code_prefix, geolocation_lat, geolocation_lng, geolocation_point, geolocation_city, geolocation_state) VALUES
                                                                                                                                                    (01000, -23.5489, -46.6388, ST_SetSRID(ST_MakePoint(-46.6388, -23.5489), 4326), 'São Paulo', 'SP'),
                                                                                                                                                    (20000, -22.9068, -43.1729, ST_SetSRID(ST_MakePoint(-43.1729, -22.9068), 4326), 'Rio de Janeiro', 'RJ')
    ON CONFLICT DO NOTHING;

-- 5. Insertar Clientes y Vendedores
INSERT INTO customer (customer_unique_id, customer_zip_code_prefix, customer_city, customer_state) VALUES
    ('CUST_ABC', 01000, 'São Paulo', 'SP') ON CONFLICT DO NOTHING;

INSERT INTO seller (seller_id, seller_zip_code_prefix, seller_city, seller_state) VALUES
    ('SELLER_XYZ', 20000, 'Rio de Janeiro', 'RJ') ON CONFLICT DO NOTHING;

-- 6. Insertar Órdenes (Usando el particionamiento)
-- Aseguramos que la fecha caiga en una partición válida (eg. 2026_01)
INSERT INTO "order" (order_id, customer_unique_id, order_status, order_purchase_timestamp, order_estimated_delivery_date) VALUES
    ('ORD-999', 'CUST_ABC', 'approved', '2026-01-15 10:00:00Z', '2026-01-20 10:00:00Z')
    ON CONFLICT DO NOTHING;

COMMIT;