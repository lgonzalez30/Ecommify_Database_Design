\set ON_ERROR_STOP on

CREATE TABLE product (
    product_id integer PRIMARY KEY,
    category text NOT NULL,
    name text NOT NULL,
    base_price numeric(12,2) NOT NULL CHECK (base_price >= 0),
    stock integer NOT NULL CHECK (stock >= 0)
);

CREATE TABLE customer (
    customer_id integer PRIMARY KEY,
    city text NOT NULL
);

CREATE TABLE orders (
    order_id text PRIMARY KEY,
    customer_id integer NOT NULL REFERENCES customer(customer_id),
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE order_item (
    order_id text NOT NULL REFERENCES orders(order_id),
    item_no integer NOT NULL,
    product_id integer NOT NULL REFERENCES product(product_id),
    quantity integer NOT NULL CHECK (quantity > 0),
    unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
    PRIMARY KEY (order_id, item_no)
);

CREATE TABLE payment (
    payment_id text PRIMARY KEY,
    order_id text NOT NULL REFERENCES orders(order_id),
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE integration_outbox (
    event_id text PRIMARY KEY,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    processed_at timestamptz
);

CREATE INDEX idx_orders_customer_created ON orders (customer_id, created_at DESC);
CREATE INDEX idx_order_item_product ON order_item (product_id);
CREATE INDEX idx_payment_order ON payment (order_id);
CREATE INDEX idx_outbox_pending ON integration_outbox (created_at) WHERE processed_at IS NULL;

SELECT setseed(0.26062026);

INSERT INTO product (product_id, category, name, base_price, stock)
SELECT i,
       (ARRAY['electronics','home','sports','books','fashion'])[1 + (i % 5)],
       'Producto ' || i,
       round((10 + random() * 990)::numeric, 2),
       1000
FROM generate_series(1, 5000) AS g(i);

INSERT INTO customer (customer_id, city)
SELECT i, (ARRAY['Bogota','Medellin','Cali','Barranquilla','Cartagena'])[1 + (i % 5)]
FROM generate_series(1, 5000) AS g(i);

INSERT INTO orders (order_id, customer_id, status, created_at)
SELECT 'ord-' || lpad(i::text, 8, '0'),
       1 + (i % 5000),
       (ARRAY['approved','shipped','delivered'])[1 + (i % 3)],
       timestamptz '2025-01-01 00:00:00+00' + (i || ' minutes')::interval
FROM generate_series(1, 10000) AS g(i);

INSERT INTO order_item (order_id, item_no, product_id, quantity, unit_price)
SELECT 'ord-' || lpad(i::text, 8, '0'), 1, 1 + (i % 5000), 1, p.base_price
FROM generate_series(1, 10000) AS g(i)
JOIN product p ON p.product_id = 1 + (i % 5000);

INSERT INTO payment (payment_id, order_id, amount, status, created_at)
SELECT 'pay-' || lpad(i::text, 8, '0'),
       'ord-' || lpad(i::text, 8, '0'),
       oi.unit_price,
       'captured',
       timestamptz '2025-01-01 00:00:00+00' + (i || ' minutes')::interval
FROM generate_series(1, 10000) AS g(i)
JOIN order_item oi ON oi.order_id = 'ord-' || lpad(i::text, 8, '0');

ANALYZE;

