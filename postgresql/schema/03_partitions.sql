-- =============================================================================
-- 03_partitions.sql — Particionamiento de la tabla order
-- =============================================================================
-- Aplica el modelo hot/cold partitions que justificó Andrés Camilo en la
-- Formativa: particiones mensuales para los últimos 12 meses (hot) y anuales
-- para histórico (cold).
--
-- Justificación: EDA muestra crecimiento mensual sostenido de órdenes y
-- patrón de acceso por rango temporal (consultas operativas tocan últimos
-- meses, consultas analíticas barren histórico).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Particiones COLD: anuales históricas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_2016 PARTITION OF "order"
    FOR VALUES FROM ('2016-01-01 00:00:00+00') TO ('2017-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS order_2017 PARTITION OF "order"
    FOR VALUES FROM ('2017-01-01 00:00:00+00') TO ('2018-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS order_2018_h1 PARTITION OF "order"
    FOR VALUES FROM ('2018-01-01 00:00:00+00') TO ('2018-07-01 00:00:00+00');

-- -----------------------------------------------------------------------------
-- Particiones HOT: mensuales de los últimos 12 meses
-- Para producción, estas se crean dinámicamente via la función de mantenimiento.
-- Aquí se crean las del periodo actual del proyecto académico (2025-2026)
-- como ejemplo.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_2025_q4 PARTITION OF "order"
    FOR VALUES FROM ('2025-10-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS order_2026_01 PARTITION OF "order"
    FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-02-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS order_2026_02 PARTITION OF "order"
    FOR VALUES FROM ('2026-02-01 00:00:00+00') TO ('2026-03-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS order_2026_03 PARTITION OF "order"
    FOR VALUES FROM ('2026-03-01 00:00:00+00') TO ('2026-04-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS order_2026_04 PARTITION OF "order"
    FOR VALUES FROM ('2026-04-01 00:00:00+00') TO ('2026-05-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS order_2026_05 PARTITION OF "order"
    FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS order_2026_06 PARTITION OF "order"
    FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

-- -----------------------------------------------------------------------------
-- Partición DEFAULT — captura órdenes con timestamp fuera de los rangos
-- definidos. Sirve como red de seguridad mientras se ajustan particiones.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_default PARTITION OF "order" DEFAULT;

-- -----------------------------------------------------------------------------
-- FUNCIÓN DE MANTENIMIENTO: crear particiones mensuales automáticamente.
-- Se ejecuta vía pg_cron o desde job externo (ver 03_decisiones_arquitectonicas.md).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_monthly_order_partition(p_year INT, p_month INT)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date     TIMESTAMPTZ;
    end_date       TIMESTAMPTZ;
BEGIN
    partition_name := format('order_%s_%s', p_year, lpad(p_month::TEXT, 2, '0'));
    start_date     := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
    end_date       := start_date + INTERVAL '1 month';

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF "order" FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
    );

    RAISE NOTICE 'Partición creada: % (% → %)', partition_name, start_date, end_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_monthly_order_partition IS
    'Crea una partición mensual de order. Ejecutar mensualmente vía job para mantener cobertura futura.';

-- Ejemplo de uso para los próximos 3 meses:
-- SELECT create_monthly_order_partition(2026, 7);
-- SELECT create_monthly_order_partition(2026, 8);
-- SELECT create_monthly_order_partition(2026, 9);

-- Verificación
DO $$
DECLARE
    n_partitions INT;
BEGIN
    SELECT COUNT(*) INTO n_partitions
    FROM pg_inherits
    WHERE inhparent = '"order"'::regclass;

    RAISE NOTICE 'Particiones creadas para "order": %', n_partitions;
END $$;
