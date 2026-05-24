-- =============================================================================
-- 02_tables.sql — Tablas principales del módulo PostgreSQL
-- =============================================================================
-- Define las tablas en 3FN aplicando los tipos avanzados que justificó
-- Andrés Camilo en la Formativa: JSONB, ARRAY, HSTORE, TSTZRANGE, composite.
-- Las FK, CHECK, UNIQUE detalladas viven en 05_constraints.sql.
-- Los índices viven en 04_indexes.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Category — extracción de product_category_name como tabla aparte.
-- Corrige la violación de 3FN del ER de U1.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS category (
    category_id            SERIAL          PRIMARY KEY,
    category_name          VARCHAR(100)    NOT NULL UNIQUE,
    category_name_english  VARCHAR(100),
    parent_category_id     INT             REFERENCES category(category_id)
                                            ON DELETE SET NULL
);

COMMENT ON TABLE category IS
    'Categorías de producto. Soporta jerarquía vía parent_category_id (autorrelación opcional).';

-- -----------------------------------------------------------------------------
-- Customer — PK es customer_unique_id (resolución de ambigüedad confirmada
-- por EDA: customer_id de Olist cambia por orden, no es cliente real).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer (
    customer_unique_id       VARCHAR(64)     PRIMARY KEY,
    customer_zip_code_prefix INT             NOT NULL,
    customer_city            VARCHAR(100)    NOT NULL,
    customer_state           CHAR(2)         NOT NULL,
    customer_geo             GEOGRAPHY(POINT, 4326),
    created_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE customer IS
    'Cliente real del marketplace. PK customer_unique_id (no customer_id de Olist).';
COMMENT ON COLUMN customer.customer_geo IS
    'Punto geográfico derivado del zip_code_prefix vía lookup en geolocation. Sustenta cálculo de distancia.';

-- -----------------------------------------------------------------------------
-- Seller — vendedor del marketplace.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller (
    seller_id              VARCHAR(64)     PRIMARY KEY,
    seller_zip_code_prefix INT             NOT NULL,
    seller_city            VARCHAR(100)    NOT NULL,
    seller_state           CHAR(2)         NOT NULL,
    seller_geo             GEOGRAPHY(POINT, 4326),
    created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE seller IS
    'Vendedor del marketplace. seller_geo permite cálculo de distancia con customer_geo usando PostGIS.';

-- -----------------------------------------------------------------------------
-- Product — concentra los tipos avanzados de la Formativa.
-- product_specifications JSONB para atributos variables por categoría.
-- product_photos / product_tags como ARRAY de texto.
-- product_metadata HSTORE para pares clave-valor ligeros (uso parcial).
-- dimensions como composite type product_dimensions.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product (
    product_id              VARCHAR(64)         PRIMARY KEY,
    category_id             INT                 NOT NULL REFERENCES category(category_id)
                                                  ON DELETE RESTRICT,
    name                    TEXT                NOT NULL,
    description             TEXT,
    product_specifications  JSONB,
    product_photos          TEXT[],
    product_tags            TEXT[],
    product_metadata        HSTORE,
    dimensions              product_dimensions,
    base_price              NUMERIC(12,2)       NOT NULL CHECK (base_price >= 0),
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE product IS
    'Catálogo de productos. Concentra los tipos avanzados PostgreSQL. PostgreSQL es la fuente de verdad; MongoDB tiene una proyección de lectura (ver mongodb/schema/collections.md).';
COMMENT ON COLUMN product.product_specifications IS
    'Atributos variables por categoría (color, material, capacidad, etc). Indexado con GIN.';
COMMENT ON COLUMN product.product_photos IS
    'URLs de imágenes del producto. Decisión Formativa: ARRAY en lugar de tabla auxiliar.';

-- -----------------------------------------------------------------------------
-- Promotion — vigencia temporal con TSTZRANGE.
-- Decisión Formativa de Andrés Camilo: tipo nativo de rango permite
-- validación eficiente de promociones activas con WHERE NOW() <@ promotion_period.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promotion (
    promotion_id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  VARCHAR(200)    NOT NULL,
    discount_percentage   NUMERIC(5,2)    CHECK (discount_percentage BETWEEN 0 AND 100),
    discount_amount       NUMERIC(12,2)   CHECK (discount_amount >= 0),
    promotion_period      TSTZRANGE       NOT NULL,
    target_category_ids   INT[],
    target_product_ids    UUID[],
    -- Una promoción usa porcentaje o monto fijo, no ambos nulos ni ambos definidos
    CHECK (
        (discount_percentage IS NOT NULL AND discount_amount IS NULL) OR
        (discount_percentage IS NULL AND discount_amount IS NOT NULL)
    )
);

COMMENT ON TABLE promotion IS
    'Promociones con vigencia temporal. Aplicable a categorías o productos específicos vía arrays.';
COMMENT ON COLUMN promotion.promotion_period IS
    'Rango temporal de vigencia. Consultas activas: WHERE NOW() <@ promotion_period.';

-- -----------------------------------------------------------------------------
-- Order — particionada por order_purchase_timestamp.
-- Las particiones específicas se crean en 03_partitions.sql.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "order" (
    order_id                       VARCHAR(64)     NOT NULL,
    customer_unique_id             VARCHAR(64)     NOT NULL,
    order_status                   order_status    NOT NULL DEFAULT 'created',
    order_purchase_timestamp       TIMESTAMPTZ     NOT NULL,
    order_approved_at              TIMESTAMPTZ,
    order_delivered_carrier_date   TIMESTAMPTZ,
    order_delivered_customer_date  TIMESTAMPTZ,
    order_estimated_delivery_date  TIMESTAMPTZ     NOT NULL,
    updated_at                     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    -- PK debe incluir clave de particionamiento
    PRIMARY KEY (order_id, order_purchase_timestamp),
    -- FK se define aquí porque ON DELETE no funciona en tablas particionadas en algunas versiones
    FOREIGN KEY (customer_unique_id) REFERENCES customer(customer_unique_id)
        ON DELETE RESTRICT
) PARTITION BY RANGE (order_purchase_timestamp);

COMMENT ON TABLE "order" IS
    'Cabecera de orden. Tabla particionada por rango temporal sobre order_purchase_timestamp.';
COMMENT ON COLUMN "order".order_purchase_timestamp IS
    'Clave de particionamiento. Particiones mensuales para hot (últimos 12 meses) y anuales para cold.';

-- -----------------------------------------------------------------------------
-- OrderItem — líneas de detalle. No particionada (volumen manejable).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_item (
    order_id                  VARCHAR(64)     NOT NULL,
    order_item_id             INT             NOT NULL,
    order_purchase_timestamp  TIMESTAMPTZ     NOT NULL, -- denormalizado para FK compuesta
    product_id                VARCHAR(64)     NOT NULL REFERENCES product(product_id)
                                                ON DELETE RESTRICT,
    seller_id                 VARCHAR(64)     NOT NULL REFERENCES seller(seller_id)
                                                ON DELETE RESTRICT,
    shipping_limit_date       TIMESTAMPTZ     NOT NULL,
    price                     NUMERIC(12,2)   NOT NULL CHECK (price >= 0),
    freight_value             NUMERIC(12,2)   NOT NULL CHECK (freight_value >= 0),
    PRIMARY KEY (order_id, order_item_id, order_purchase_timestamp),
    FOREIGN KEY (order_id, order_purchase_timestamp)
        REFERENCES "order"(order_id, order_purchase_timestamp)
        ON DELETE CASCADE
);

COMMENT ON TABLE order_item IS
    'Líneas de detalle de orden. Incluye order_purchase_timestamp denormalizado para soportar FK a tabla particionada.';

-- -----------------------------------------------------------------------------
-- Payment — pagos asociados a orden. PK compuesta confirmada por EDA.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment (
    order_id                  VARCHAR(64)     NOT NULL,
    payment_sequential        INT             NOT NULL,
    order_purchase_timestamp  TIMESTAMPTZ     NOT NULL, -- denormalizado para FK compuesta
    payment_type              payment_type    NOT NULL,
    payment_installments      INT             NOT NULL CHECK (payment_installments >= 1),
    payment_value             NUMERIC(12,2)   NOT NULL CHECK (payment_value > 0),
    PRIMARY KEY (order_id, payment_sequential, order_purchase_timestamp),
    FOREIGN KEY (order_id, order_purchase_timestamp)
        REFERENCES "order"(order_id, order_purchase_timestamp)
        ON DELETE CASCADE
);

COMMENT ON TABLE payment IS
    'Pagos asociados a una orden. Una orden puede tener múltiples pagos (split payment, múltiples instrumentos).';

-- -----------------------------------------------------------------------------
-- OrderStatusHistory — trazabilidad del ciclo de vida.
-- Entidad débil de Order.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_status_history (
    history_id                BIGSERIAL       PRIMARY KEY,
    order_id                  VARCHAR(64)     NOT NULL,
    order_purchase_timestamp  TIMESTAMPTZ     NOT NULL, -- denormalizado para FK compuesta
    from_status               order_status,
    to_status                 order_status    NOT NULL,
    changed_at                TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    changed_by                VARCHAR(100),
    FOREIGN KEY (order_id, order_purchase_timestamp)
        REFERENCES "order"(order_id, order_purchase_timestamp)
        ON DELETE CASCADE
);

COMMENT ON TABLE order_status_history IS
    'Trazabilidad del ciclo de vida de Order. Permite reconstruir el journey y calcular métricas operativas (tiempo en cada estado).';

-- -----------------------------------------------------------------------------
-- Geolocation — tabla de referencia para resolver zip_code_prefix a lat/lng.
-- Read-only en operación normal.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS geolocation (
    geolocation_id              BIGSERIAL       PRIMARY KEY,
    geolocation_zip_code_prefix INT             NOT NULL,
    geolocation_lat             NUMERIC(9,6)    NOT NULL,
    geolocation_lng             NUMERIC(9,6)    NOT NULL,
    geolocation_point           GEOGRAPHY(POINT, 4326) NOT NULL,
    geolocation_city            VARCHAR(100)    NOT NULL,
    geolocation_state           CHAR(2)         NOT NULL
);

COMMENT ON TABLE geolocation IS
    'Mapeo zip_code_prefix → lat/lng/punto geográfico. Tabla de referencia (read-only en operación normal).';

-- Verificación
DO $$
BEGIN
    RAISE NOTICE 'Tablas creadas: category, customer, seller, product, promotion, order (particionada), order_item, payment, order_status_history, geolocation';
END $$;
