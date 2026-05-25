-- =============================================================================
-- 08_roles_permissions.sql — RBAC (Role-Based Access Control)
-- =============================================================================

-- 1. Rol para la aplicación Backend (OLTP)
CREATE ROLE ecommify_api_user WITH LOGIN PASSWORD 'ApiSecurePass2026!';
GRANT CONNECT ON DATABASE ecommify TO ecommify_api_user;
GRANT USAGE ON SCHEMA public TO ecommify_api_user;

-- Permisos DML sobre tablas transaccionales
GRANT SELECT, INSERT, UPDATE ON
    customer, seller, product, category, promotion,
    "order", order_item, payment, order_status_history
    TO ecommify_api_user;

-- Permiso para usar secuencias (necesario para campos SERIAL/BIGSERIAL)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ecommify_api_user;

-- El API NO debe poder borrar registros (Soft-delete es preferido, o anulación de estado)
-- REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM ecommify_api_user;

-- 2. Rol para Analítica y BI (OLAP)
CREATE ROLE ecommify_analyst WITH LOGIN PASSWORD 'AnalystPass2026!';
GRANT CONNECT ON DATABASE ecommify TO ecommify_analyst;
GRANT USAGE ON SCHEMA public TO ecommify_analyst;

-- Solo lectura, incluyendo vistas materializadas
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ecommify_analyst;

DO $$
BEGIN
    RAISE NOTICE 'Roles creados: ecommify_api_user (OLTP) y ecommify_analyst (OLAP)';
END $$;