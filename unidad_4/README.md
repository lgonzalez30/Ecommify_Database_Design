# Unidad 4 - Optimización avanzada de rendimiento en PostgreSQL

Esta carpeta organiza los insumos de la Unidad 4 para Ecommify. La base de datos se reutiliza desde la carpeta principal del proyecto (`Ecommify_Database_Design`) y se ejecuta localmente con Docker.

## Objetivo

Aplicar técnicas avanzadas de optimización en PostgreSQL:

- Análisis de planes de ejecución con `EXPLAIN` y `EXPLAIN (ANALYZE, BUFFERS)`.
- Diseño de índices especializados: B-tree, GIN, GiST, BRIN, parciales y de expresión.
- Particionamiento declarativo y validación de partition pruning.
- Reescritura de consultas críticas para reducir tiempo de ejecución y bloques leídos.

## Estructura

```text
unidad_4/
├── README.md
├── entregables/
│   ├── Documento_Etapa1_Investigacion.md      # Entregable formal Etapa 1 (+ .docx)
│   └── Documento_Etapa2_Implementacion_Resultados.md  # Entregable formal Etapa 2 (+ .docx)
├── etapa_1_investigacion/
│   ├── README.md
│   ├── 01_consultas_criticas.sql
│   ├── 02_matriz_indexacion.md
│   └── 03_particionamiento.md
└── etapa_2_implementacion/
    ├── README.md
    ├── run_etapa_2.sh
    ├── sql/
    │   ├── 00_seed_synthetic_data.sql
    │   ├── 01_baseline_explain_analyze.sql
    │   ├── 02_indices_optimizacion_u4.sql
    │   ├── 03_consultas_optimizadas.sql
    │   └── 04_validacion_particionamiento.sql
    └── resultados/
        ├── documentacion_ejecucion.md
        ├── plantilla_metricas.md
        └── resumen_metricas.md
```

## Prerrequisitos

Para la Etapa 2 se usa el compose aislado `docker-compose.u4.yml`, que crea un volumen limpio `pg_data_u4/` (contenedor `ecommify_postgres_u4`) y evita depender del `pg_data/` principal:

```bash
docker compose -f docker-compose.u4.yml up -d postgres_u4
```

Validar conexión:

```bash
docker exec -it ecommify_postgres_u4 psql -U postgres -d ecommify -c "SELECT version();"
```

## Orden recomendado de trabajo

1. Leer `etapa_1_investigacion/README.md`.
2. Ejecutar las consultas críticas de `etapa_1_investigacion/01_consultas_criticas.sql` con `EXPLAIN`.
3. Ejecutar el flujo completo de la Etapa 2 (genera datos, baseline, índices, optimizado y validación):

```bash
./unidad_4/etapa_2_implementacion/run_etapa_2.sh
```

   De forma manual, el orden es: `00_seed_synthetic_data.sql` → `01_baseline_explain_analyze.sql` → `02_indices_optimizacion_u4.sql` → `03_consultas_optimizadas.sql` → `04_validacion_particionamiento.sql`.
4. Registrar resultados en `etapa_2_implementacion/resultados/plantilla_metricas.md`.

## Nota sobre métricas

Las métricas reales dependen del volumen cargado. El script `00_seed_synthetic_data.sql` genera ~150.000 órdenes (con `order_item` y `payment`) distribuidas en las particiones 2025-2026, de modo que las mejoras de índices, reescrituras y particionamiento sean medibles y reproducibles.