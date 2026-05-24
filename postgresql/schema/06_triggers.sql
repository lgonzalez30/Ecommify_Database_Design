-- =============================================================================
-- 06_triggers.sql — Triggers del módulo PostgreSQL
-- =============================================================================
-- Implementa los triggers que justificó Andrés Camilo en la Formativa:
-- - updated_at automático en orders, products, customers, sellers.
-- - Trigger adicional: log automático de cambios de order_status en
--   order_status_history para garantizar trazabilidad.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FUNCIÓN: update_updated_at_column
-- Genérica, se aplica a cualquier tabla con columna updated_at.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column IS
    'Actualiza automáticamente la columna updated_at al modificar una fila.';

-- -----------------------------------------------------------------------------
-- TRIGGERS updated_at — tablas que la Formativa identificó como críticas
-- -----------------------------------------------------------------------------

-- Customer
DROP TRIGGER IF EXISTS trg_customer_updated_at ON customer;
CREATE TRIGGER trg_customer_updated_at
    BEFORE UPDATE ON customer
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seller
DROP TRIGGER IF EXISTS trg_seller_updated_at ON seller;
CREATE TRIGGER trg_seller_updated_at
    BEFORE UPDATE ON seller
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Product
DROP TRIGGER IF EXISTS trg_product_updated_at ON product;
CREATE TRIGGER trg_product_updated_at
    BEFORE UPDATE ON product
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Order
DROP TRIGGER IF EXISTS trg_order_updated_at ON "order";
CREATE TRIGGER trg_order_updated_at
    BEFORE UPDATE ON "order"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- FUNCIÓN: log_order_status_change
-- Inserta automáticamente un registro en order_status_history cuando
-- el order_status cambia. Garantiza trazabilidad sin depender de la
-- capa de aplicación.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo registramos si efectivamente cambió el estado
    IF (TG_OP = 'UPDATE' AND OLD.order_status IS DISTINCT FROM NEW.order_status) THEN
        INSERT INTO order_status_history (
            order_id,
            order_purchase_timestamp,
            from_status,
            to_status,
            changed_at,
            changed_by
        ) VALUES (
            NEW.order_id,
            NEW.order_purchase_timestamp,
            OLD.order_status,
            NEW.order_status,
            NOW(),
            current_user
        );
    ELSIF (TG_OP = 'INSERT') THEN
        -- Primera entrada: registramos el estado inicial
        INSERT INTO order_status_history (
            order_id,
            order_purchase_timestamp,
            from_status,
            to_status,
            changed_at,
            changed_by
        ) VALUES (
            NEW.order_id,
            NEW.order_purchase_timestamp,
            NULL,
            NEW.order_status,
            NOW(),
            current_user
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_order_status_change IS
    'Inserta una entrada en order_status_history cada vez que cambia el order_status.';

-- Trigger sobre order para auditoría automática
DROP TRIGGER IF EXISTS trg_order_status_audit ON "order";
CREATE TRIGGER trg_order_status_audit
    AFTER INSERT OR UPDATE OF order_status ON "order"
    FOR EACH ROW
    EXECUTE FUNCTION log_order_status_change();

-- -----------------------------------------------------------------------------
-- FUNCIÓN: derive_geo_point
-- Calcula automáticamente customer_geo / seller_geo a partir del
-- zip_code_prefix mediante lookup en geolocation.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION derive_customer_geo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.customer_geo IS NULL THEN
        SELECT geolocation_point
          INTO NEW.customer_geo
          FROM geolocation
         WHERE geolocation_zip_code_prefix = NEW.customer_zip_code_prefix
         LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION derive_seller_geo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.seller_geo IS NULL THEN
        SELECT geolocation_point
          INTO NEW.seller_geo
          FROM geolocation
         WHERE geolocation_zip_code_prefix = NEW.seller_zip_code_prefix
         LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customer_geo ON customer;
CREATE TRIGGER trg_customer_geo
    BEFORE INSERT OR UPDATE OF customer_zip_code_prefix ON customer
    FOR EACH ROW
    EXECUTE FUNCTION derive_customer_geo();

DROP TRIGGER IF EXISTS trg_seller_geo ON seller;
CREATE TRIGGER trg_seller_geo
    BEFORE INSERT OR UPDATE OF seller_zip_code_prefix ON seller
    FOR EACH ROW
    EXECUTE FUNCTION derive_seller_geo();

-- Verificación
DO $$
DECLARE
    n_triggers INT;
BEGIN
    SELECT COUNT(*) INTO n_triggers
    FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname LIKE 'trg_%';

    RAISE NOTICE 'Triggers creados: %', n_triggers;
END $$;
