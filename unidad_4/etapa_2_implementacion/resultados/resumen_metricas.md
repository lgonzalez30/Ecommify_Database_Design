# Resumen de métricas - Unidad 4 Etapa 2

Para la explicación completa de lo ejecutado, ver `documentacion_ejecucion.md`.

Fecha de ejecución: 2026-06-08
Entorno: Docker local, contenedor `ecommify_postgres_u4`, PostgreSQL 16.4 + PostGIS
Base: `ecommify` inicializada desde `postgresql/schema/`
Datos: **dataset sintético ~150.000 órdenes** generado con `sql/00_seed_synthetic_data.sql`
(150.001 órdenes, 300.002 order_items, 150.001 payments, 20.001 clientes, 1.501 sellers, 1.003 productos)

> Nota: esta corrida reemplaza las cifras preliminares previas (que se habían
> redactado con los datos mock mínimos). Las métricas de abajo provienen de una
> ejecución real sobre el dataset sintético, con caché caliente (segunda corrida).

## Archivos crudos generados localmente

Generados con:

```bash
./unidad_4/etapa_2_implementacion/run_etapa_2.sh
```

Última ejecución usada para este resumen (timestamp `2026-06-08_19-56-56`):

- `seed_synthetic_2026-06-08_19-56-56.txt`
- `baseline_explain_2026-06-08_19-56-56.txt`
- `indices_u4_2026-06-08_19-56-56.txt`
- `optimized_explain_2026-06-08_19-56-56.txt`
- `partition_validation_2026-06-08_19-56-56.txt`

Los `.txt` quedan ignorados en Git para no subir evidencia voluminosa generada.

## Comparación antes/después

Medición con `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)`, segunda corrida (caché caliente).
`Buffers` = bloques `shared` del nodo raíz (acumulado de la consulta).

| Query | Optimización aplicada | Exec baseline (ms) | Exec optimizada (ms) | Mejora tiempo % | Buffers baseline | Buffers optimizada | Mejora buffers % |
|---|---|---:|---:|---:|---:|---:|---:|
| Q01 Órdenes activas recientes | B-tree parcial/compuesto + pruning | 0.367 | 0.114 | **68.9** | 102 | 102 | 0.0 |
| Q02 Detalle de orden | CTE de filtrado temprano | 0.213 | 0.113 | **47.0** | 29 | 24 | 17.2 |
| Q03 Ventas por categoría | Materialized view | 1470.622 | 0.075 | **~100.0** | 699 131 | 1 | ~100.0 |
| Q04 JSONB catálogo | GIN + B-tree precio | 0.089 | 0.083 | 6.7 | 26 | 26 | 0.0 |
| Q05 Búsqueda textual | GIN trigram de expresión `lower(name)` | 2.184 | 2.480 | -13.6 | 29 | 29 | 0.0 |
| Q06 Seller/SLA | CTE de ventana + B-tree compuesto seller/envío | 10475.732 | 1145.813 | **89.1** | 1 067 023 | 5 625 | 99.5 |
| Q07 Sellers cercanos | `ST_DWithin` antes de `ST_Distance` (GiST) | 10.157 | 10.326 | -1.7 | 193 | 196 | -1.6 |
| Q08 Promociones activas | Operadores indexables GiST/GIN | 0.022 | 0.019 | 13.6 | 1 | 1 | 0.0 |
| Q09 Segmentación clientes | Materialized view | 872.522 | 0.444 | **99.9** | 5 798 | 102 | 98.2 |
| Q10 Rango mensual | Reescritura sin `date_trunc` en columna (pruning) | 35.423 | 3.173 | **91.0** | 1 900 | 218 | 88.5 |

Fórmula usada:

```text
Mejora % = ((baseline - optimizada) / baseline) * 100
```

Notas:
- Q03 y Q06 baseline derraman a disco (`temp read/written`) por el hash/sort sobre cientos de miles de filas; la versión optimizada (MV / filtrado temprano) elimina o reduce ese derrame.
- Q05, Q07, Q08 y Q04 operan sobre conjuntos pequeños (catálogo de ~1.000 productos, 1 cliente objetivo); el costo fijo del índice/CTE no se amortiza y la diferencia es marginal o levemente negativa. Es el comportamiento esperado y coherente con la teoría.

## Índices U4 creados

| Índice | Tipo | Tabla | Tamaño reportado | Patrón |
|---|---|---|---:|---|
| `idx_u4_order_purchase_brin` | BRIN | `order` (particionada) | ~24 kB por partición | Rango temporal append-only |
| `idx_u4_order_status_purchase` | B-tree compuesto | `order` (particionada) | ~0.5–1.6 MB por partición | Estado + fecha |
| `idx_u4_order_delivered_customer` | B-tree parcial (`WHERE delivered`) | `order` (particionada) | ~0.3–1.0 MB por partición | Segmentación por delivered |
| `idx_u4_order_item_seller_shipping` | B-tree compuesto | `order_item` | 14 MB | Seller + ventana de envío |
| `idx_u4_product_name_lower_trgm` | GIN de expresión | `product` | 128 kB | Búsqueda textual case-insensitive |
| `idx_u4_payment_type_installments_value` | B-tree compuesto | `payment` | 4640 kB | Auditoría de pagos |

Nota: los índices sobre la tabla particionada se materializan en las particiones hijas; por eso `pg_stat_user_indexes` del padre muestra solo los de tablas no particionadas. El BRIN se mantiene en ~24 kB por partición independientemente del volumen, frente a ~1 MB del `pkey` B-tree de la misma partición: evidencia directa de su eficiencia de espacio.

## Validación de particionamiento

| Evidencia | Resultado |
|---|---|
| Tabla `"order"` particionada | Sí, `PARTITION BY RANGE (order_purchase_timestamp)` |
| Particiones existentes | Históricas (2016, 2017, 2018_h1), hot mensuales (2025_q4, 2026_01..06), `order_default` y `order_2026_07` creada por mantenimiento |
| Distribución de filas | ~51k en 2025_q4 y ~15k–17k por mes 2026 (sin desbalance severo) |
| Filas en `order_default` | **0** |
| Función de mantenimiento | `create_monthly_order_partition(2026, 7)` creó `order_2026_07` |
| Query por enero 2026 (rango) | Plan lee **solo** `order_2026_01` (218 buffers, 3.98 ms) |
| Query sin filtro temporal | Plan usa `Append` y revisa múltiples particiones (19.7 ms) |
| Anti-patrón `date_trunc(order_purchase_timestamp)` | `Append` sobre **todas** las particiones (1900 buffers, 38.8 ms) → sin pruning |

Comparación directa del particionamiento (mismo conteo de enero 2026):

| Escenario | Particiones leídas | Buffers | Execution (ms) |
|---|---|---:|---:|
| Filtro por rango (`>=` y `<`) | 1 (`order_2026_01`) | 218 | 3.98 |
| Anti-patrón `date_trunc(...) = ...` | 12 (todas) | 1900 | 38.77 |

Reducción por habilitar pruning: **~90% en tiempo y ~88% en buffers**.

## Hallazgos

1. Las mayores mejoras provienen de **materialized views** para agregaciones recurrentes (Q03 ~100%, Q09 99.9%), del **filtrado temprano** de `order_item` antes del JOIN (Q06 89.1%) y de la **reescritura por rango** que habilita partition pruning (Q10 91.0%).
2. El **particionamiento funciona**: los predicados por rango sobre `order_purchase_timestamp` permiten partition pruning real (1 partición vs 12); aplicar funciones sobre la columna anula ese beneficio.
3. La **reducción de buffers** acompaña a la de tiempo en las consultas pesadas (Q03 ~100%, Q06 99.5%, Q09 98.2%, Q10 88.5%), confirmando menos I/O lógico, no solo menos CPU.
4. En consultas sobre conjuntos pequeños (Q04, Q05, Q07, Q08) la optimización es marginal o levemente negativa: el costo fijo del índice/CTE no se amortiza con pocos datos. Es coherente y se documenta como tal.

## Limitación importante

Los resultados son evidencia real de ejecución sobre ~150.000 órdenes sintéticas distribuidas en las particiones 2025–2026. No representan un benchmark productivo (hardware del contenedor, caché local), pero sí demuestran de forma reproducible el efecto de cada técnica.
