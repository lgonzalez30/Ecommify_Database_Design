-- =============================================================================
-- 00_extensions.sql — Extensiones de PostgreSQL para Ecommify
-- =============================================================================
-- Habilita las extensiones que justificó la Formativa de Andrés Camilo (U2).
-- Ejecutar como superusuario o usuario con CREATEROLE en Supabase.
-- Orden de ejecución dentro del schema: este es el primer script.
-- =============================================================================

-- PostGIS: tipos y funciones geoespaciales para cálculo de distancia
-- vendedor-cliente. Sustenta optimización de costos de envío.
CREATE EXTENSION IF NOT EXISTS postgis;

-- pg_trgm: índices trigram para búsqueda de texto tolerante a errores
-- tipográficos sobre nombres y descripciones de producto.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- pgcrypto: funciones criptográficas para protección de información sensible
-- y generación de UUIDs.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- hstore: pares clave-valor ligeros. Uso parcial — JSONB cubre la mayoría
-- de casos. Se habilita por si se requiere para metadata muy ligera.
CREATE EXTENSION IF NOT EXISTS hstore;

-- btree_gin: permite combinar índices GIN con tipos B-tree, útil para
-- índices compuestos sobre JSONB + columnas escalares.
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Verificación
DO $$
BEGIN
    RAISE NOTICE 'Extensiones habilitadas: postgis, pg_trgm, pgcrypto, hstore, btree_gin';
END $$;
