# Unidad 4 — Optimizacion avanzada de rendimiento en PostgreSQL

Esta carpeta organiza los insumos de la Unidad 4 para Ecommify. La base de datos se reutiliza desde la carpeta principal del proyecto (`Ecommify_Database_Design`) y se ejecuta localmente con Docker mediante `docker-compose.yml`.

## Objetivo

Aplicar tecnicas avanzadas de optimizacion en PostgreSQL:

- Analisis de planes de ejecucion con `EXPLAIN` y `EXPLAIN (ANALYZE, BUFFERS)`.
- Diseno de indices especializados: B-tree, GIN, GiST, BRIN, parciales y de expresion.
- Particionamiento declarativo y validacion de partition pruning.
- Reescritura de consultas criticas para reducir tiempo de ejecucion y bloques leidos.

## Estructura

```text
unidad_4/
├── README.md
├── etapa_1_investigacion/
│   ├── README.md
│   ├── 01_consultas_criticas.sql
│   ├── 02_matriz_indexacion.md
│   └── 03_particionamiento.md
└── etapa_2_implementacion/
    ├── README.md
    ├── sql/
    │   ├── 01_baseline_explain_analyze.sql
    │   ├── 02_indices_optimizacion_u4.sql
    │   ├── 03_consultas_optimizadas.sql
    │   └── 04_validacion_particionamiento.sql
    └── resultados/
        └── plantilla_metricas.md
```

## Prerrequisitos

Desde la raiz del repositorio:

```bash
docker compose up -d postgres
```

Para la Etapa 2 se recomienda usar el compose aislado `docker-compose.u4.yml`, que crea un volumen limpio `pg_data_u4/` y evita depender del `pg_data/` principal:

```bash
./unidad_4/etapa_2_implementacion/run_etapa_2.sh
```

Validar conexion:

```bash
docker exec -it ecommify_postgres_local psql -U postgres -d ecommify -c "SELECT version();"
```

## Orden recomendado de trabajo

1. Leer `etapa_1_investigacion/README.md`.
2. Ejecutar las consultas criticas de `etapa_1_investigacion/01_consultas_criticas.sql` con `EXPLAIN`.
3. Ejecutar el baseline real:

```bash
docker exec -i ecommify_postgres_local psql -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/01_baseline_explain_analyze.sql
```

4. Aplicar indices de optimizacion:

```bash
docker exec -i ecommify_postgres_local psql -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/02_indices_optimizacion_u4.sql
```

5. Ejecutar consultas optimizadas:

```bash
docker exec -i ecommify_postgres_local psql -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/03_consultas_optimizadas.sql
```

6. Validar particionamiento:

```bash
docker exec -i ecommify_postgres_local psql -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/04_validacion_particionamiento.sql
```

7. Registrar resultados en `etapa_2_implementacion/resultados/plantilla_metricas.md`.

## Nota sobre metricas

Las metricas reales dependen del volumen cargado. Con los datos mock actuales los tiempos seran muy bajos; para observar mejoras significativas conviene cargar una muestra amplia del dataset Olist o generar datos sinteticos antes de medir.
