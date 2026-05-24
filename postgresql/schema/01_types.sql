-- =============================================================================
-- 01_types.sql — Composite types y ENUMs para Ecommify
-- =============================================================================
-- Tipos personalizados que la Formativa de Andrés Camilo justificó.
-- Estos tipos se usan en las tablas creadas en 02_tables.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUM: order_status
-- Ciclo de vida de Order. Dominio cerrado según EDA.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM (
            'created',
            'approved',
            'invoiced',
            'shipped',
            'delivered',
            'canceled',
            'returned',
            'unavailable'
        );
    END IF;
END $$;

COMMENT ON TYPE order_status IS
    'Estados posibles del ciclo de vida de una Order. Inferidos del dataset Olist + extensiones de Ecommify.';

-- -----------------------------------------------------------------------------
-- ENUM: payment_type
-- Métodos de pago soportados. Dominio cerrado según EDA.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_type') THEN
        CREATE TYPE payment_type AS ENUM (
            'credit_card',
            'debit_card',
            'boleto',
            'voucher',
            'pix',
            'not_defined'
        );
    END IF;
END $$;

COMMENT ON TYPE payment_type IS
    'Métodos de pago soportados. pix es exclusivo del mercado brasileño pero se mantiene por compatibilidad con Olist.';

-- -----------------------------------------------------------------------------
-- COMPOSITE TYPE: product_dimensions
-- Agrupa los cuatro atributos físicos de un producto.
-- Justificado por la Formativa: reutilización estructural de atributos.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_dimensions') THEN
        CREATE TYPE product_dimensions AS (
            length_cm  NUMERIC(8,2),
            height_cm  NUMERIC(8,2),
            width_cm   NUMERIC(8,2),
            weight_g   NUMERIC(10,2)
        );
    END IF;
END $$;

COMMENT ON TYPE product_dimensions IS
    'Dimensiones físicas de un producto. Composite type que reemplaza 4 columnas sueltas.';

-- Verificación
DO $$
BEGIN
    RAISE NOTICE 'Tipos creados: order_status, payment_type, product_dimensions';
END $$;
