-- =============================================================================
-- 05_constraints.sql — Restricciones de integridad adicionales
-- =============================================================================
-- Las FK básicas están en 02_tables.sql como REFERENCES inline.
-- Aquí se agregan las restricciones que requieren expresiones más complejas:
-- - CHECK constraints de negocio.
-- - Validaciones de coherencia temporal.
-- - Constraints sobre tipos compuestos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Order — validaciones de coherencia temporal del ciclo de vida
-- -----------------------------------------------------------------------------

-- order_estimated_delivery_date debe ser posterior a order_purchase_timestamp
ALTER TABLE "order"
    ADD CONSTRAINT chk_order_estimated_after_purchase
    CHECK (order_estimated_delivery_date > order_purchase_timestamp);

-- order_approved_at debe ser posterior o igual a order_purchase_timestamp
ALTER TABLE "order"
    ADD CONSTRAINT chk_order_approved_after_purchase
    CHECK (order_approved_at IS NULL OR order_approved_at >= order_purchase_timestamp);

-- order_delivered_carrier_date debe ser posterior a order_approved_at
ALTER TABLE "order"
    ADD CONSTRAINT chk_order_carrier_after_approved
    CHECK (
        order_delivered_carrier_date IS NULL OR
        order_approved_at IS NULL OR
        order_delivered_carrier_date >= order_approved_at
    );

-- order_delivered_customer_date debe ser posterior a order_delivered_carrier_date
ALTER TABLE "order"
    ADD CONSTRAINT chk_order_customer_after_carrier
    CHECK (
        order_delivered_customer_date IS NULL OR
        order_delivered_carrier_date IS NULL OR
        order_delivered_customer_date >= order_delivered_carrier_date
    );

-- -----------------------------------------------------------------------------
-- OrderItem — shipping_limit_date debe ser posterior a order_purchase_timestamp
-- -----------------------------------------------------------------------------
ALTER TABLE order_item
    ADD CONSTRAINT chk_order_item_shipping_after_purchase
    CHECK (shipping_limit_date >= order_purchase_timestamp);

-- -----------------------------------------------------------------------------
-- Product — validación de dimensiones físicas no negativas
-- -----------------------------------------------------------------------------
ALTER TABLE product
    ADD CONSTRAINT chk_product_dimensions_positive
    CHECK (
        dimensions IS NULL OR (
            (dimensions).length_cm >= 0 AND
            (dimensions).height_cm >= 0 AND
            (dimensions).width_cm  >= 0 AND
            (dimensions).weight_g  >= 0
        )
    );

-- -----------------------------------------------------------------------------
-- Promotion — el rango temporal no puede estar vacío ni invertido
-- -----------------------------------------------------------------------------
ALTER TABLE promotion
    ADD CONSTRAINT chk_promotion_period_not_empty
    CHECK (NOT isempty(promotion_period));

ALTER TABLE promotion
    ADD CONSTRAINT chk_promotion_period_bounded
    CHECK (
        lower(promotion_period) IS NOT NULL AND
        upper(promotion_period) IS NOT NULL
    );

-- -----------------------------------------------------------------------------
-- OrderStatusHistory — from_status y to_status no pueden ser iguales
-- -----------------------------------------------------------------------------
ALTER TABLE order_status_history
    ADD CONSTRAINT chk_status_change_distinct
    CHECK (from_status IS NULL OR from_status <> to_status);

-- -----------------------------------------------------------------------------
-- Customer y Seller — código de estado en mayúsculas y de exactamente 2 chars
-- -----------------------------------------------------------------------------
ALTER TABLE customer
    ADD CONSTRAINT chk_customer_state_uppercase
    CHECK (customer_state = UPPER(customer_state) AND length(customer_state) = 2);

ALTER TABLE seller
    ADD CONSTRAINT chk_seller_state_uppercase
    CHECK (seller_state = UPPER(seller_state) AND length(seller_state) = 2);

-- -----------------------------------------------------------------------------
-- Customer y Seller — zip_code_prefix debe estar en rango válido brasileño
-- (entre 1000 y 99999 para los 5 dígitos del CEP)
-- -----------------------------------------------------------------------------
ALTER TABLE customer
    ADD CONSTRAINT chk_customer_zip_range
    CHECK (customer_zip_code_prefix BETWEEN 1000 AND 99999);

ALTER TABLE seller
    ADD CONSTRAINT chk_seller_zip_range
    CHECK (seller_zip_code_prefix BETWEEN 1000 AND 99999);

-- Verificación
DO $$
DECLARE
    n_checks INT;
BEGIN
    SELECT COUNT(*) INTO n_checks
    FROM pg_constraint
    WHERE contype = 'c'
      AND conname LIKE 'chk_%';

    RAISE NOTICE 'CHECK constraints creados: %', n_checks;
END $$;
