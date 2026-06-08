# Resumen de metricas — Unidad 4 Etapa 2

Fecha de ejecucion: 2026-06-08  
Entorno: Docker local, contenedor `ecommify_postgres_u4`, PostgreSQL 16 + PostGIS  
Base: `ecommify` inicializada desde `postgresql/schema/`  
Datos: mock controlado de `07_5_mock_data.sql`

## Archivos crudos generados localmente

Los archivos `.txt` con planes completos se generan con:

```bash
./unidad_4/etapa_2_implementacion/run_etapa_2.sh
```

Ultima ejecucion usada para este resumen:

- `baseline_explain_2026-06-08_14-20-21.txt`
- `indices_u4_2026-06-08_14-20-21.txt`
- `optimized_explain_2026-06-08_14-20-21.txt`
- `partition_validation_2026-06-08_14-20-21.txt`

Los `.txt` quedan ignorados en Git para no subir evidencia voluminosa generada.

## Comparacion antes/despues

| Query | Optimizacion aplicada | Execution baseline ms | Execution optimizada ms | Mejora tiempo % | Observacion |
|---|---|---:|---:|---:|---|
| Q01 Ordenes activas recientes | Indices U4 + pruning por enero 2026 | 3.092 | 1.138 | 63.2 | Mejora por plan mas corto y datos ya cacheados; lee solo `order_2026_01`. |
| Q02 Detalle de orden | CTE de filtrado temprano | 1.231 | 2.500 | -103.1 | Con datos mock, el CTE materializado agrega overhead; en alto volumen puede reducir joins. |
| Q03 Ventas por categoria | Uso de materialized view | 3.076 | 0.693 | 77.5 | Mejora clara al evitar joins y agregacion sobre tablas base. |
| Q04 JSONB catalogo | GIN/B-tree disponibles | 0.598 | 0.475 | 20.6 | Mejora menor por bajo volumen; en Olist completo GIN deberia aportar mas. |
| Q05 Busqueda textual | GIN trigram de expresion `lower(name)` | 0.689 | 0.840 | -21.8 | El indice no compensa con 3 productos; esperado en dataset pequeno. |
| Q06 Seller/SLA | CTE de ventana + B-tree compuesto seller/envio | 1.105 | 0.527 | 52.3 | Mejora por filtrado temprano de `order_item`. |
| Q07 Sellers cercanos | `ST_DWithin` antes de `ST_Distance` | 187.922 | 116.412 | 35.9 | La consulta espacial sigue siendo la mas costosa; GiST reduce candidatos. |
| Q08 Promociones activas | Operadores indexables GiST/GIN | 0.379 | 0.499 | -31.7 | Bajo volumen; el overhead del plan supera beneficio. |
| Q09 Segmentacion clientes | Materialized view | 0.493 | 0.208 | 57.8 | Mejora al consultar MV en vez de agregacion con JOIN. |
| Q10 Rango mensual | Reescritura sin `date_trunc` en columna | 0.975 | 0.691 | 29.1 | El predicado por rango habilita pruning directo. |

Formula usada:

```text
Mejora % = ((baseline_ms - optimizada_ms) / baseline_ms) * 100
```

## Indices U4 creados

| Indice | Tipo | Tabla | Tamaño reportado | Patron |
|---|---|---|---:|---|
| `idx_u4_order_purchase_brin` | BRIN | `order` particionada | Sin almacenamiento en padre | Rango temporal append-only |
| `idx_u4_order_status_purchase` | B-tree compuesto | `order` particionada | Sin almacenamiento en padre | Estado + fecha |
| `idx_u4_order_delivered_customer` | B-tree parcial | `order` particionada | Sin almacenamiento en padre | Segmentacion por delivered |
| `idx_u4_order_item_seller_shipping` | B-tree compuesto | `order_item` | 8192 bytes | Seller + ventana de envio |
| `idx_u4_product_name_lower_trgm` | GIN de expresion | `product` | 16 kB | Busqueda textual case-insensitive |
| `idx_u4_payment_type_installments_value` | B-tree compuesto | `payment` | 8192 bytes | Auditoria de pagos |

Nota: los indices creados sobre la tabla particionada se materializan en particiones hijas, por eso el reporte directo de `pg_stat_user_indexes` solo muestra algunos indices con almacenamiento propio.

## Validacion de particionamiento

| Evidencia | Resultado |
|---|---|
| Tabla `"order"` particionada | Si |
| Particiones existentes | Historicas, hot mensuales, `order_default` y `order_2026_07` creada por mantenimiento |
| Filas en `order_default` | 0 |
| Funcion de mantenimiento | `create_monthly_order_partition(2026, 7)` ejecuto correctamente |
| Query por enero 2026 | Plan lee solo `order_2026_01` |
| Query sin filtro temporal | Plan usa `Append` y revisa multiples particiones |
| Anti-patron con `date_trunc(order_purchase_timestamp)` | Plan usa `Append` y evalua multiples particiones |

## Hallazgos

1. Las mejores optimizaciones medidas fueron materialized views para agregaciones recurrentes (Q03, Q09), filtrado por rango temporal (Q10) y filtrado temprano de `order_item` (Q06).
2. El particionamiento funciona: los predicados por rango sobre `order_purchase_timestamp` permiten partition pruning; aplicar funciones sobre la columna evita ese beneficio.
3. Algunas optimizaciones empeoran con datos mock (Q02, Q05, Q08), lo cual es esperado porque el costo fijo de usar CTEs/indices supera el beneficio cuando hay pocas filas.
4. La consulta espacial Q07 sigue siendo costosa aun con GiST; para produccion conviene limitar radio, precalcular zonas o cachear sellers cercanos por region.

## Limitacion importante

Los resultados son validos como evidencia de ejecucion y comparacion de planes, pero no representan rendimiento productivo porque la base local contiene pocos datos mock. Para una medicion academica mas fuerte, repetir el runner despues de cargar una muestra amplia de Olist o datos sinteticos superiores a 100.000 ordenes.
