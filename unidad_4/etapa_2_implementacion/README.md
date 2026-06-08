# Etapa 2 — Implementacion formativa

## Proposito

Aplicar optimizaciones practicas en PostgreSQL y documentar mejoras cuantificables con `EXPLAIN (ANALYZE, BUFFERS)`.

## Scripts

| Orden | Archivo | Uso |
|---:|---|---|
| 1 | `sql/01_baseline_explain_analyze.sql` | Captura planes y metricas antes de aplicar indices U4 |
| 2 | `sql/02_indices_optimizacion_u4.sql` | Crea indices especializados adicionales |
| 3 | `sql/03_consultas_optimizadas.sql` | Ejecuta versiones optimizadas de las consultas |
| 4 | `sql/04_validacion_particionamiento.sql` | Valida particiones, pruning y mantenimiento |

## Ejecucion local con Docker

Desde la raiz del repositorio:

```bash
./unidad_4/etapa_2_implementacion/run_etapa_2.sh
```

Este comando levanta PostgreSQL, espera el healthcheck, ejecuta baseline, crea indices, ejecuta consultas optimizadas, valida particionamiento y guarda archivos en `resultados/`.

Ejecucion manual equivalente:

```bash
docker compose up -d postgres
```

Baseline:

```bash
docker exec -i ecommify_postgres_local psql -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/01_baseline_explain_analyze.sql
```

Indices:

```bash
docker exec -i ecommify_postgres_local psql -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/02_indices_optimizacion_u4.sql
```

Consultas optimizadas:

```bash
docker exec -i ecommify_postgres_local psql -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/03_consultas_optimizadas.sql
```

Particionamiento:

```bash
docker exec -i ecommify_postgres_local psql -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/04_validacion_particionamiento.sql
```

## Como guardar evidencia

El script `run_etapa_2.sh` guarda automaticamente las salidas en:

- `resultados/baseline_explain_<timestamp>.txt`
- `resultados/indices_u4_<timestamp>.txt`
- `resultados/optimized_explain_<timestamp>.txt`
- `resultados/partition_validation_<timestamp>.txt`
- `resultados/resumen_metricas_<timestamp>.md`

Para guardar salida manualmente:

```bash
docker exec -i ecommify_postgres_local psql -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/01_baseline_explain_analyze.sql \
  > unidad_4/etapa_2_implementacion/resultados/baseline_explain.txt

docker exec -i ecommify_postgres_local psql -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/03_consultas_optimizadas.sql \
  > unidad_4/etapa_2_implementacion/resultados/optimized_explain.txt
```

Luego llenar `resultados/plantilla_metricas.md`.

## Tecnicas aplicadas

- Reescritura de predicados para evitar funciones sobre columnas en `WHERE`.
- Filtrado temprano por fechas/estado para habilitar pruning.
- Uso de materialized views para agregaciones recurrentes.
- Indices especializados: BRIN, B-tree compuesto, GIN de expresion, parciales.
- Uso de `ST_DWithin` antes de `ST_Distance` en consultas espaciales.

## Nota

Si la base solo contiene datos mock, el impacto medido sera bajo. La evidencia mas fuerte se obtiene cargando datos Olist o generando datos sinteticos antes de comparar planes.
