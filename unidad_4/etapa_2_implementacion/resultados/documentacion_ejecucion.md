# Documentación de ejecución - Unidad 4 Etapa 2

## Propósito de la prueba

Esta etapa valida, sobre una base PostgreSQL real levantada con Docker, las técnicas de optimización propuestas para el módulo transaccional de Ecommify:

- Análisis de planes con `EXPLAIN (ANALYZE, BUFFERS)`.
- Implementación de índices especializados.
- Reescritura de consultas críticas.
- Validación de particionamiento declarativo y partition pruning.
- Medición antes/después con tiempos de ejecución y lectura de buffers.

## Entorno usado

| Elemento | Valor |
|---|---|
| Fecha | 2026-06-08 |
| Motor | PostgreSQL 16.4 + PostGIS |
| Contenedor | `ecommify_postgres_u4` |
| Compose | `docker-compose.u4.yml` |
| Puerto local | `55432` |
| Base de datos | `ecommify` |
| Scripts base | `postgresql/schema/00_extensions.sql` a `08_roles_permissions.sql` |
| Datos | **Dataset sintético ~150k órdenes** (`sql/00_seed_synthetic_data.sql`) |

Se usó `docker-compose.u4.yml` (volumen aislado `pg_data_u4/`, contenedor `ecommify_postgres_u4`) para garantizar una ejecución reproducible y limpia, sin depender del estado previo del volumen principal `pg_data/`.

### Nota sobre Supabase

Aquí se ejecutó sobre **PostgreSQL 16 + PostGIS en Docker local**, que es el mismo motor que ofrece Supabase. Esta decisión privilegia la reproducibilidad y evita el manejo de credenciales externas. Los cuatro scripts SQL son portables y pueden ejecutarse sin cambios sobre una instancia Supabase mediante su cadena de conexión.

## Dataset sintético

Los datos mock originales (`07_5_mock_data.sql`) son mínimos (1 orden, 0 order_items, 0 payments) y no permiten medir mejoras significativas (varias consultas devuelven 0 filas). Por eso se generó un dataset sintético con `sql/00_seed_synthetic_data.sql`, respetando todas las restricciones de `05_constraints.sql`:

| Tabla | Filas |
|---|---:|
| category | 3 |
| product | 1 003 |
| customer | 20 001 |
| seller | 1 501 |
| promotion | 3 |
| order | 150 001 |
| order_item | 300 002 |
| payment | 150 001 |

Las órdenes se distribuyen entre 2025-10-01 y 2026-06-30 (solo particiones nombradas, por lo que `order_default` queda en 0), con ~50% en estado `delivered`. Cada orden tiene 2 ítems (300.000 líneas en total) y un pago. Se conservan los fixtures del mock (`ORD-999`, `CUST_ABC`, `PROD-101..103`, `SELLER_XYZ`), se les agrega detalle (order_item + payment para `ORD-999`) y se inserta una promoción activa para la categoría 2.

## Flujo ejecutado

El flujo completo se ejecuta con:

```bash
./unidad_4/etapa_2_implementacion/run_etapa_2.sh
```

El runner realiza estas acciones:

1. Verifica que Docker esté disponible.
2. Levanta PostgreSQL con `docker-compose.u4.yml`.
3. Espera el `healthcheck` del contenedor.
4. Espera explícitamente que exista la tabla particionada `public."order"`.
5. **Genera el dataset sintético** con `00_seed_synthetic_data.sql`.
6. Ejecuta el baseline con `01_baseline_explain_analyze.sql`.
7. Crea índices especializados con `02_indices_optimizacion_u4.sql`.
8. Ejecuta consultas optimizadas con `03_consultas_optimizadas.sql`.
9. Valida particionamiento con `04_validacion_particionamiento.sql`.
10. Guarda evidencias crudas en `resultados/` y genera un resumen automático.

> Para esta medición, el baseline y el conjunto optimizado se ejecutaron **dos veces**
> y se reportó la **segunda corrida** (caché caliente) para reducir la varianza por I/O en frío.

## Baseline: qué se midió antes

El baseline ejecuta 10 consultas críticas con `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)`. Cada plan permite observar el tipo de scan, el método de join, las particiones leídas, `Planning Time`, `Execution Time` y los buffers.

Resultados de tiempo del baseline (caché caliente):

| Query | Execution (ms) | Buffers (shared) | Observación |
|---|---:|---:|---|
| Q01 Órdenes activas recientes | 0.367 | 102 | Rápida, usa índices |
| Q02 Detalle de orden | 0.213 | 29 | Recupera ORD-999 con detalle |
| Q03 Ventas mensuales por categoría | **1470.622** | **699 131** + temp | Agregación OLAP costosa sobre tablas base |
| Q04 Catálogo por JSONB y precio | 0.089 | 26 | Pocos productos |
| Q05 Búsqueda textual de producto | 2.184 | 29 | Trigram sobre ~1.000 productos |
| Q06 Desempeño de seller y entregas | **10475.732** | **1 067 023** + temp | JOIN masivo sin filtrado temprano |
| Q07 Sellers cercanos a cliente | 10.157 | 193 | Cálculo espacial |
| Q08 Promociones activas por categoría | 0.022 | 1 | Conjunto pequeño |
| Q09 Segmentación de clientes | **872.522** | 5 798 + temp | Agregación recurrente sobre órdenes/items |
| Q10 Conteo mensual con `date_trunc` | 35.423 | 1 900 | Anti-patrón: función sobre columna de partición |

Las consultas Q03, Q06 y Q09 son los cuellos de botella claros; Q10 evidencia el anti-patrón que impide el pruning.

## Optimizaciones aplicadas

### 1. Índices especializados

Se crearon índices con prefijo `idx_u4_` (al menos cuatro tipos distintos: BRIN, B-tree compuesto, B-tree parcial y GIN de expresión):

| Índice | Tipo | Objetivo |
|---|---|---|
| `idx_u4_order_purchase_brin` | BRIN | Rango temporal en `order` particionada/append-only (~24 kB por partición) |
| `idx_u4_order_status_purchase` | B-tree compuesto | Filtros por estado + fecha |
| `idx_u4_order_delivered_customer` | B-tree parcial (`WHERE delivered`) | Segmentación sobre órdenes entregadas |
| `idx_u4_order_item_seller_shipping` | B-tree compuesto | Consultas por seller y ventana de envío (14 MB) |
| `idx_u4_product_name_lower_trgm` | GIN de expresión | Búsqueda textual case-insensitive (128 kB) |
| `idx_u4_payment_type_installments_value` | B-tree compuesto | Auditoría de pagos (4640 kB) |

Después de crear índices se ejecutó `ANALYZE` para actualizar estadísticas del planner.

### 2. Reescritura de consultas

| Query | Reescritura aplicada |
|---|---|
| Q02 | CTE materializado para filtrar primero la orden objetivo. |
| Q03 | Consulta sobre `mv_sales_by_category_monthly` en vez de tablas base. |
| Q05 | Uso de `lower(name)` para coincidir con el índice de expresión. |
| Q06 | CTE materializado para filtrar `order_item` por ventana de envío antes del JOIN. |
| Q07 | `ST_DWithin` antes de ordenar por `ST_Distance`. |
| Q09 | Consulta sobre `mv_customer_segments` en vez de agregación en vivo. |
| Q10 | Reemplazo de `date_trunc(order_purchase_timestamp)` por un rango `>=` y `<`. |

### 3. Particionamiento

La tabla `"order"` está particionada por `PARTITION BY RANGE (order_purchase_timestamp)`. La validación comprobó:

- existencia de particiones históricas (2016, 2017, 2018_h1), hot mensuales (2025_q4, 2026_01..06) y `order_default`;
- distribución de filas: ~51k en 2025_q4 y ~15k–17k por mes de 2026;
- `order_default` con **0 filas**;
- creación de la partición futura `order_2026_07` con `create_monthly_order_partition(2026, 7)`;
- lectura de **solo** `order_2026_01` cuando se filtra enero 2026 por rango (218 buffers, 3.98 ms);
- lectura de **múltiples particiones** (`Append`) cuando no hay filtro temporal;
- efecto negativo de usar `date_trunc` sobre la columna de partición: `Append` sobre las 12 particiones (1900 buffers, 38.8 ms), sin pruning.

## Resultados principales (antes → después)

| Query | Resultado |
|---|---|
| Q03 | La materialized view redujo el tiempo de **1470.622 ms a 0.075 ms** (~100%) y los buffers de **699 131 a 1**. |
| Q06 | El filtrado temprano + B-tree compuesto bajó de **10475.732 ms a 1145.813 ms** (89.1%) y los buffers de **1 067 023 a 5 625** (99.5%). |
| Q09 | La segmentación con materialized view bajó de **872.522 ms a 0.444 ms** (99.9%) y los buffers de **5 798 a 102** (98.2%). |
| Q10 | La reescritura por rango bajó de **35.423 ms a 3.173 ms** (91.0%), habilitando pruning (de 12 particiones a 1; buffers 1900 → 218). |
| Q01 | Índice parcial/compuesto + pruning: de 0.367 ms a 0.114 ms (68.9%). |
| Q02 | CTE de filtrado temprano: de 0.213 ms a 0.113 ms (47.0%). |

Casos donde la optimización no mejoró (conjuntos pequeños, comportamiento esperado):

- Q05 (trigram): de 2.184 ms a 2.480 ms; el índice no se amortiza con ~1.000 productos.
- Q07 (espacial): de 10.157 ms a 10.326 ms; prácticamente igual con 1 cliente objetivo.
- Q08 (promociones): de 0.022 ms a 0.019 ms; diferencia marginal con pocas filas.

Esto no invalida las técnicas: muestra que los índices y CTEs deben justificarse con volumen y selectividad reales.

## Cómo interpretar las métricas

```text
Mejora % = ((execution_baseline - execution_optimizada) / execution_baseline) * 100
```

Un valor positivo indica mejora; uno negativo, que la versión optimizada fue más lenta en el entorno medido.

## Conclusiones

1. Las optimizaciones de mayor impacto fueron las **materialized views** (Q03, Q09), el **filtrado temprano** antes del JOIN (Q06) y la **reescritura por rango** que habilita partition pruning (Q10).
2. El particionamiento de `order` está correctamente implementado y el planner aplica **pruning** cuando el predicado usa rangos directos sobre `order_purchase_timestamp`; envolver la columna en una función anula el beneficio.
3. Los índices especializados quedan implementados y medidos; el BRIN demuestra su eficiencia de espacio (~24 kB por partición).
4. La reducción de buffers acompaña a la de tiempo en las consultas pesadas, confirmando menos I/O lógico además de menos CPU.
