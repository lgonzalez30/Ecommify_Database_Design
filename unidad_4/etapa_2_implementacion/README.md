# Etapa 2 - Implementación formativa

## Propósito

Aplicar optimizaciones prácticas en PostgreSQL y documentar mejoras cuantificables con `EXPLAIN (ANALYZE, BUFFERS)`.

## Scripts

| Orden | Archivo | Uso |
|---:|---|---|
| 0 | `sql/00_seed_synthetic_data.sql` | Genera el dataset sintético (~150k órdenes) para medir con volumen amplio |
| 1 | `sql/01_baseline_explain_analyze.sql` | Captura planes y métricas antes de aplicar índices U4 |
| 2 | `sql/02_indices_optimizacion_u4.sql` | Crea índices especializados adicionales |
| 3 | `sql/03_consultas_optimizadas.sql` | Ejecuta versiones optimizadas de las consultas |
| 4 | `sql/04_validacion_particionamiento.sql` | Valida particiones, pruning y mantenimiento |

## Ejecución local con Docker

Desde la raíz del repositorio:

```bash
./unidad_4/etapa_2_implementacion/run_etapa_2.sh
```

Este comando levanta PostgreSQL, espera el healthcheck, genera el dataset sintético, ejecuta baseline, crea índices, ejecuta consultas optimizadas, valida particionamiento y guarda archivos en `resultados/`.

El runner usa `docker-compose.u4.yml` y el contenedor `ecommify_postgres_u4` con volumen `pg_data_u4/`. Esto evita depender del volumen principal `pg_data/`, que puede quedar con estado local previo.

Ejecución manual:

```bash
docker compose -f docker-compose.u4.yml up -d postgres_u4
```

Datos sintéticos (~150k órdenes):

```bash
docker exec -i ecommify_postgres_u4 psql -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/00_seed_synthetic_data.sql
```

Baseline:

```bash
docker exec -i ecommify_postgres_u4 psql -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/01_baseline_explain_analyze.sql
```

Índices:

```bash
docker exec -i ecommify_postgres_u4 psql -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/02_indices_optimizacion_u4.sql
```

Consultas optimizadas:

```bash
docker exec -i ecommify_postgres_u4 psql -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/03_consultas_optimizadas.sql
```

Particionamiento:

```bash
docker exec -i ecommify_postgres_u4 psql -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/04_validacion_particionamiento.sql
```

## Cómo guardar evidencia

El script `run_etapa_2.sh` guarda automáticamente las salidas en:

- `resultados/documentacion_ejecucion.md` como explicación narrativa de lo ejecutado.
- `resultados/resumen_metricas.md` como resumen curado de resultados.
- `resultados/seed_synthetic_<timestamp>.txt`
- `resultados/baseline_explain_<timestamp>.txt`
- `resultados/indices_u4_<timestamp>.txt`
- `resultados/optimized_explain_<timestamp>.txt`
- `resultados/partition_validation_<timestamp>.txt`
- `resultados/resumen_metricas_<timestamp>.md`

Para guardar salida manualmente:

```bash
docker exec -i ecommify_postgres_u4 psql -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/01_baseline_explain_analyze.sql \
  > unidad_4/etapa_2_implementacion/resultados/baseline_explain.txt

docker exec -i ecommify_postgres_u4 psql -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/03_consultas_optimizadas.sql \
  > unidad_4/etapa_2_implementacion/resultados/optimized_explain.txt
```

Luego llenar `resultados/plantilla_metricas.md`.

## Técnicas aplicadas

- Reescritura de predicados para evitar funciones sobre columnas en `WHERE`.
- Filtrado temprano por fechas/estado para habilitar pruning.
- Uso de materialized views para agregaciones recurrentes.
- Índices especializados: BRIN, B-tree compuesto, GIN de expresión, parciales.
- Uso de `ST_DWithin` antes de `ST_Distance` en consultas espaciales.

## Nota

Con el dataset sintético (~150k órdenes) las mejoras son sustancialmente medibles y reproducibles. Si la base solo contiene los datos mock mínimos, el impacto medido será bajo.
