# Unidad 4 - Etapa 2: Implementación y Resultados
## Optimización de rendimiento en PostgreSQL - Proyecto Ecommify

**Asignatura:** Diseño y Optimización de Bases de Datos

**Programa:** Maestría en Arquitectura de Software - Universidad de La Sabana

**Profesor:** Miguel Alfonso Varela Fonseca

**Fecha:** 8 de junio de 2026

**Tipo de trabajo:** Grupal (Etapa formativa)

**Repositorio:** https://github.com/lgonzalez30/Ecommify_Database_Design

**Integrantes del equipo:**

- Andrés Fernando Díaz Moreno
- Andrés Camilo López Castro
- Luis Alfredo González Mercado
- Carlos Alberto Arévalo Martínez

---

## 1. Introducción

Este documento reporta la **implementación práctica** y los **resultados medidos** de las técnicas de optimización investigadas en la Etapa 1, aplicadas al módulo transaccional PostgreSQL de Ecommify. El objetivo es demostrar, con evidencia cuantificable de `EXPLAIN (ANALYZE, BUFFERS)`, el impacto de: (a) la creación de índices especializados, (b) la reescritura de consultas críticas, y (c) el particionamiento declarativo.

---

## 2. Entorno de ejecución

| Elemento | Valor |
|---|---|
| Motor | PostgreSQL 16.4 + PostGIS |
| Despliegue | Docker (`docker-compose.u4.yml`, contenedor `ecommify_postgres_u4`) |
| Puerto local | 55432 |
| Base de datos | `ecommify` |
| Inicialización | Scripts `postgresql/schema/00..08` |
| Datos | Dataset sintético ~150.000 órdenes (`sql/00_seed_synthetic_data.sql`) |
| Fecha de ejecución | 2026-06-08 |

### 2.1 Nota sobre Supabase vs. Docker local

En este proyecto se ejecutó sobre **PostgreSQL 16 + PostGIS en Docker local**, que es exactamente el mismo motor que Supabase administra como servicio. La decisión privilegia la **reproducibilidad** (un volumen aislado, limpio y versionable) y evita depender de credenciales o cuotas de un servicio externo. Los cuatro scripts SQL son **portables**: pueden ejecutarse sin modificación sobre una instancia Supabase usando su cadena de conexión, ya que solo emplean características estándar de PostgreSQL (particionamiento declarativo, BRIN/GIN/GiST, `pg_trgm`, PostGIS y materialized views).

### 2.2 Justificación del dataset sintético

Los datos mock incluidos en el esquema (`07_5_mock_data.sql`) son mínimos (1 orden, 0 order_items, 0 payments) y producen consultas con 0 filas y tiempos triviales (microsegundos), insuficientes como evidencia. Se generó por ello un **dataset sintético** que cumple el criterio de la guía (>100.000 registros) y respeta **todas** las restricciones de integridad (`05_constraints.sql`): coherencia temporal de las fechas de la orden, `shipping_limit_date ≥ purchase`, estado en mayúsculas de 2 caracteres, rango de zip, `price/freight ≥ 0`, `installments ≥ 1`, `value > 0`.

| Tabla | Filas generadas |
|---|---:|
| category | 3 |
| product | 1 003 |
| customer | 20 001 |
| seller | 1 501 |
| promotion | 3 |
| order | 150 001 |
| order_item | 300 002 |
| payment | 150 001 |

Las órdenes se distribuyen entre 2025-10-01 y 2026-06-30 (solo particiones nombradas → `order_default` = 0), con ~50% en estado `delivered`. Cada orden tiene **2 ítems** (300.000 líneas en total) y un pago. Se conservan los fixtures (`ORD-999`, `CUST_ABC`, `PROD-101..103`, `SELLER_XYZ`) y se agregó una promoción activa para la categoría 2.

---

## 3. Procedimiento ejecutado

Todo el flujo se automatiza con `run_etapa_2.sh`:

1. Levanta PostgreSQL (`docker-compose.u4.yml`) y espera el healthcheck y el esquema.
2. **Genera el dataset sintético** (`00_seed_synthetic_data.sql`).
3. Ejecuta el **baseline** (`01_baseline_explain_analyze.sql`) - planes antes de los índices U4.
4. Crea los **índices U4** (`02_indices_optimizacion_u4.sql`) y ejecuta `ANALYZE`.
5. Ejecuta las **consultas optimizadas** (`03_consultas_optimizadas.sql`) - refresca las MV y mide.
6. **Valida el particionamiento** (`04_validacion_particionamiento.sql`).

Para reducir la varianza por I/O en frío, el baseline y el conjunto optimizado se ejecutaron **dos veces**, reportándose la **segunda corrida** (caché caliente). Las evidencias crudas quedan en `etapa_2_implementacion/resultados/*.txt` (timestamp `2026-06-08_19-56-56`).

---

## 4. Optimización de consultas: resultados antes/después

Medición con `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)`. `Buffers` = bloques `shared` acumulados del nodo raíz. Se aplicaron **más de tres técnicas distintas**: índices especializados, CTE de filtrado temprano (materializado), materialized views, reescritura de predicados por rango y uso de `ST_DWithin` antes de `ST_Distance`.

| Query | Técnica | Exec antes (ms) | Exec después (ms) | Mejora tiempo | Buffers antes | Buffers después | Mejora buffers |
|---|---|---:|---:|---:|---:|---:|---:|
| Q01 Órdenes activas | B-tree parcial/compuesto + pruning | 0.367 | 0.114 | **68.9%** | 102 | 102 | 0% |
| Q02 Detalle de orden | CTE filtrado temprano | 0.213 | 0.113 | **47.0%** | 29 | 24 | 17.2% |
| Q03 Ventas categoría/mes | Materialized view | 1470.622 | 0.075 | **~100%** | 699 131 | 1 | ~100% |
| Q04 Catálogo JSONB + precio | GIN + B-tree | 0.089 | 0.083 | 6.7% | 26 | 26 | 0% |
| Q05 Búsqueda textual | GIN trigram de expresión | 2.184 | 2.480 | -13.6% | 29 | 29 | 0% |
| Q06 Seller/SLA | CTE ventana + B-tree compuesto | 10475.732 | 1145.813 | **89.1%** | 1 067 023 | 5 625 | 99.5% |
| Q07 Sellers cercanos | `ST_DWithin` + GiST | 10.157 | 10.326 | -1.7% | 193 | 196 | -1.6% |
| Q08 Promociones activas | Operadores indexables GiST/GIN | 0.022 | 0.019 | 13.6% | 1 | 1 | 0% |
| Q09 Segmentación clientes | Materialized view | 872.522 | 0.444 | **99.9%** | 5 798 | 102 | 98.2% |
| Q10 Conteo mensual | Reescritura por rango (pruning) | 35.423 | 3.173 | **91.0%** | 1 900 | 218 | 88.5% |

```text
Mejora % = ((antes - después) / antes) * 100
```

### 4.1 Análisis por caso

- **Q03 y Q09 (materialized views):** la mayor ganancia. Al precomputar las agregaciones (`mv_sales_by_category_monthly`, `mv_customer_segments`), Q03 pasa de leer 699 131 buffers y 1.47 s a leer **1 buffer en 0.075 ms**. Es el caso canónico de mover carga OLAP fuera del camino OLTP.
- **Q06 (filtrado temprano + índice compuesto):** de **10.48 s a 1.15 s** (89.1%) y de 1.07 M a 5 625 buffers (99.5%). El CTE materializado reduce `order_item` por la ventana de envío **antes** del JOIN con `order`, evitando un hash join masivo que derramaba a disco.
- **Q10 (reescritura por rango):** sustituir `date_trunc(order_purchase_timestamp) = '2026-01-01'` por `>= '2026-01-01' AND < '2026-02-01'` habilita partition pruning: el plan pasa de un `Append` sobre 12 particiones a un `Seq Scan` sobre una sola (`order_2026_01`), bajando de 35.4 ms a 3.17 ms (91%).
- **Q01 y Q02:** mejoras sólidas (68.9% y 47%) por índice parcial/compuesto y filtrado temprano.
- **Q04, Q05, Q07, Q08 (conjuntos pequeños):** mejora marginal o levemente negativa. El catálogo (~1.000 productos) y el objetivo espacial (1 cliente) son demasiado pequeños para amortizar el costo fijo del índice/CTE. Es el comportamiento **esperado** y se reporta con honestidad: una optimización debe justificarse con volumen y selectividad reales.

### 4.2 Evidencia de cambio de plan (Seq Scan → Index/MV)

- Q03: `Hash Join` + `HashAggregate` sobre tablas base (con derrame a `temp`) → **`Seq Scan` sobre la materialized view** (1 buffer).
- Q10: `Append` sobre 12 particiones → **`Seq Scan` sobre `order_2026_01`** únicamente.
- Q06: `Hash Join` masivo `seller × order_item × order` → **CTE materializado** `items_window` + JOIN reducido.

---

## 5. Índices especializados creados

Se implementaron seis índices `idx_u4_*` que cubren **al menos cuatro tipos diferentes** (BRIN, B-tree compuesto, B-tree parcial y GIN de expresión):

| Índice | Tipo | Tabla | Justificación técnica | Patrón que optimiza | Trade-off | Tamaño |
|---|---|---|---|---|---|---:|
| `idx_u4_order_purchase_brin` | BRIN | `order` | Tabla grande, append-only, físicamente correlacionada por fecha | Rango temporal | Menor precisión que B-tree | **~24 kB/partición** |
| `idx_u4_order_status_purchase` | B-tree compuesto | `order` | Filtra por estado operativo y ordena por fecha | Estado + ventana temporal | Mayor costo de escritura | ~0.5–1.6 MB/partición |
| `idx_u4_order_delivered_customer` | B-tree parcial (`WHERE delivered`) | `order` | Reduce el índice al subconjunto entregado | Segmentación RFM | Solo aplica a `delivered` | ~0.3–1.0 MB/partición |
| `idx_u4_order_item_seller_shipping` | B-tree compuesto | `order_item` | Filtra ítems por seller y ventana de envío | Desempeño de seller/SLA | Espacio adicional | 14 MB |
| `idx_u4_product_name_lower_trgm` | GIN de expresión | `product` | Búsqueda textual case-insensitive tolerante a errores | `lower(name) % lower(?)` | Alto espacio relativo | 128 kB |
| `idx_u4_payment_type_installments_value` | B-tree compuesto | `payment` | Auditoría de pagos por método/cuotas/valor | Consultas de riesgo | Depende de selectividad | 4640 kB |

**Hallazgo de espacio (BRIN):** sobre la tabla particionada, el BRIN se mantiene en **~24 kB por partición** sin importar el volumen, frente a ~1 MB del índice `pkey` (B-tree) de la misma partición. Es evidencia directa del trade-off espacio/precisión que justifica BRIN en tablas grandes append-only.

> Nota técnica: los índices definidos sobre la tabla particionada se materializan en las particiones hijas; por eso `pg_stat_user_indexes` del padre muestra tamaño propio solo para las tablas no particionadas (`order_item`, `product`, `payment`).

---

## 6. Particionamiento declarativo

La tabla `"order"` está particionada por `PARTITION BY RANGE (order_purchase_timestamp)`.

### 6.1 Estructura y distribución observadas

| Partición | Rango | Filas estimadas | Tamaño |
|---|---|---:|---:|
| order_2016 / 2017 / 2018_h1 | histórico (cold) | 0 | 96 kB c/u |
| order_2025_q4 | 2025-10 → 2026-01 | ~50 999 | 14 MB |
| order_2026_01 | enero 2026 | ~17 234 | 4984 kB |
| order_2026_02 … 2026_06 | feb–jun 2026 | ~15k–17k c/u | ~4.4–5.0 MB c/u |
| order_default | DEFAULT | **0** | 96 kB |
| order_2026_07 | creada en la prueba | 0 | - |

### 6.2 Evidencia de partition pruning

| Escenario | Particiones leídas | Buffers | Execution |
|---|---|---:|---:|
| Filtro por rango (enero 2026) | **1** (`order_2026_01`) | 218 | 3.98 ms |
| Sin filtro temporal | múltiples (`Append`) | - | 19.7 ms |
| Anti-patrón `date_trunc(col) = ...` | **12** (todas, `Append`) | 1 900 | 38.77 ms |

La comparación directa (mismo conteo de enero 2026) muestra que **evitar la función sobre la columna de partición** reduce ~90% el tiempo y ~88% los buffers, exclusivamente por habilitar el pruning.

### 6.3 Mantenimiento validado

- `order_default` permanece en **0 filas** (todas las órdenes caen en particiones nombradas).
- La función `create_monthly_order_partition(2026, 7)` creó correctamente `order_2026_07`, demostrando la estrategia de creación automática de particiones futuras.

---

## 7. Hallazgos

1. Las **materialized views** (Q03, Q09) ofrecen la mayor mejora para agregaciones recurrentes: hasta ~100% en tiempo y buffers.
2. El **filtrado temprano** antes del JOIN (Q06) reduce un join masivo de 10.5 s a 1.1 s (99.5% menos buffers).
3. La **reescritura por rango** (Q10) habilita partition pruning real (12 → 1 partición, 91% menos tiempo).
4. La **reducción de buffers** acompaña a la de tiempo en las consultas pesadas, confirmando menos I/O lógico además de menos CPU.
5. En conjuntos pequeños (Q04, Q05, Q07, Q08) las optimizaciones no se amortizan; documentarlo es parte del rigor.

---

## 8. Limitaciones y trabajo futuro

- Los tiempos dependen del hardware del contenedor y de la caché local; no son un benchmark productivo, pero sí evidencia reproducible del **efecto relativo** de cada técnica.
- Para acercarse a producción: cargar el dataset **Olist** completo o ampliar el volumen sintético (>1 M de órdenes), automatizar el `REFRESH` de las MV con `pg_cron`, y monitorear el costo de escritura de los índices.
- La consulta espacial (Q07) merece estrategia adicional en producción (limitar radio, precalcular zonas o cachear sellers cercanos por región).

---

## 9. Anexos

### 9.1 Orden de ejecución (manual)

```bash
docker compose -f docker-compose.u4.yml up -d postgres_u4
docker exec -i ecommify_postgres_u4 psql -U postgres -d ecommify < unidad_4/etapa_2_implementacion/sql/00_seed_synthetic_data.sql
docker exec -i ecommify_postgres_u4 psql -U postgres -d ecommify < unidad_4/etapa_2_implementacion/sql/01_baseline_explain_analyze.sql
docker exec -i ecommify_postgres_u4 psql -U postgres -d ecommify < unidad_4/etapa_2_implementacion/sql/02_indices_optimizacion_u4.sql
docker exec -i ecommify_postgres_u4 psql -U postgres -d ecommify < unidad_4/etapa_2_implementacion/sql/03_consultas_optimizadas.sql
docker exec -i ecommify_postgres_u4 psql -U postgres -d ecommify < unidad_4/etapa_2_implementacion/sql/04_validacion_particionamiento.sql
```

### 9.2 Evidencia cruda

`unidad_4/etapa_2_implementacion/resultados/` (archivos `*_2026-06-08_19-56-56.txt`): `seed_synthetic`, `baseline_explain`, `indices_u4`, `optimized_explain`, `partition_validation`. Resúmenes versionados: `resumen_metricas.md` y `documentacion_ejecucion.md`.

---

## 10. Referencias

- The PostgreSQL Global Development Group. *PostgreSQL 16 Documentation - Using EXPLAIN; Indexes; Table Partitioning; BRIN*. https://www.postgresql.org/docs/16/
- PostGIS Development Team. *PostGIS Manual - `ST_DWithin`, índices GiST*. https://postgis.net/docs/
- The PostgreSQL Global Development Group. *pg_trgm - Trigram matching*. https://www.postgresql.org/docs/16/pgtrgm.html
- Olist. *Brazilian E-Commerce Public Dataset by Olist*. Kaggle.
