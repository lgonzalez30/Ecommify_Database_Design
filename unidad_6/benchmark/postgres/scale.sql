\set ON_ERROR_STOP on

TRUNCATE payment, order_item, integration_outbox, orders, product, customer RESTART IDENTITY CASCADE;

INSERT INTO product (product_id, category, name, base_price, stock)
SELECT i,
       (ARRAY['electronics','home','sports','books','fashion'])[1 + (i % 5)],
       'Producto ' || i,
       round((10 + ((i * 37) % 99000) / 100.0)::numeric, 2),
       1000
FROM generate_series(1, :product_count) AS g(i);

INSERT INTO customer (customer_id, city)
SELECT i, (ARRAY['Bogota','Medellin','Cali','Barranquilla','Cartagena'])[1 + (i % 5)]
FROM generate_series(1, 5000) AS g(i);

INSERT INTO orders (order_id, customer_id, status, created_at)
SELECT 'ord-' || lpad(i::text, 8, '0'),
       1 + (i % 5000),
       (ARRAY['approved','shipped','delivered'])[1 + (i % 3)],
       timestamptz '2024-01-01 00:00:00+00' + (i || ' seconds')::interval
FROM generate_series(1, :order_count) AS g(i);

INSERT INTO order_item (order_id, item_no, product_id, quantity, unit_price)
SELECT 'ord-' || lpad(i::text, 8, '0'), 1, 1 + (i % :product_count), 1, p.base_price
FROM generate_series(1, :order_count) AS g(i)
JOIN product p ON p.product_id = 1 + (i % :product_count);

INSERT INTO payment (payment_id, order_id, amount, status, created_at)
SELECT 'pay-' || lpad(i::text, 8, '0'),
       'ord-' || lpad(i::text, 8, '0'),
       oi.unit_price,
       'captured',
       timestamptz '2024-01-01 00:00:00+00' + (i || ' seconds')::interval
FROM generate_series(1, :order_count) AS g(i)
JOIN order_item oi ON oi.order_id = 'ord-' || lpad(i::text, 8, '0');

ANALYZE;

