# Plantilla de métricas - Unidad 4 Etapa 2 (diligenciada)

Valores tomados de la ejecución del `2026-06-08` (segunda corrida, caché caliente) sobre el dataset sintético ~150k. Fuentes:

- `sql/01_baseline_explain_analyze.sql`
- `sql/03_consultas_optimizadas.sql`
- `sql/04_validacion_particionamiento.sql`

## Ambiente de prueba

| Campo | Valor |
|---|---|
| Fecha de ejecución | 2026-06-08 |
| Motor | PostgreSQL 16.4 + PostGIS |
| Entorno | Docker local (`ecommify_postgres_u4`, puerto 55432) |
| Volumen de datos | Sintético (~150.000 órdenes, 300.002 order_items, 150.001 payments) |
| Comando de ejecución | `./unidad_4/etapa_2_implementacion/run_etapa_2.sh` |

## Resumen ejecutivo

| Indicador | Resultado |
|---|---|
| Consultas evaluadas | 10 (Q01-Q10) |
| Optimizaciones aplicadas | Índices especializados, CTE de filtrado temprano, materialized views, reescritura por rango, `ST_DWithin` |
| Mayor mejora en tiempo | Q03 ~100% (1470.622 → 0.075 ms) |
| Mayor reducción de buffers | Q03 ~100% (699 131 → 1) |
| Índices creados | 6 (`idx_u4_*`: BRIN, B-tree compuesto ×3, B-tree parcial, GIN expresión) |
| Particionamiento validado | Sí (pruning a 1 partición; `order_default` = 0) |

## Tabla de métricas antes/después

`Buffers` = bloques `shared` del nodo raíz (acumulado). Plan antes/después resumido.

| Query | Técnica aplicada | Plan antes | Plan después | Planning antes (ms) | Planning después (ms) | Exec antes (ms) | Exec después (ms) | Mejora tiempo % | Buffers antes | Buffers después | Mejora buffers % |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Q01 Órdenes activas | Índice parcial/compuesto + pruning | Index Scan | Index Scan (1 partición) | 2.689 | 0.229 | 0.367 | 0.114 | 68.9 | 102 | 102 | 0.0 |
| Q02 Detalle orden | Filtrado temprano CTE | Nested Loop | CTE materializado | 12.348 | 4.050 | 0.213 | 0.113 | 47.0 | 29 | 24 | 17.2 |
| Q03 Ventas categoría | Materialized view | Hash Join + HashAggregate | Scan sobre MV | 13.215 | 3.353 | 1470.622 | 0.075 | ~100.0 | 699 131 | 1 | ~100.0 |
| Q04 JSONB catálogo | GIN + B-tree precio | Bitmap/Index Scan | Bitmap/Index Scan | 0.144 | 0.149 | 0.089 | 0.083 | 6.7 | 26 | 26 | 0.0 |
| Q05 Texto producto | GIN trigram expresión | Seq/Index Scan | GIN expresión | 0.558 | 0.604 | 2.184 | 2.480 | -13.6 | 29 | 29 | 0.0 |
| Q06 Seller SLA | B-tree compuesto + CTE | Hash Join masivo + temp | CTE ventana + JOIN | 21.564 | 1.179 | 10475.732 | 1145.813 | 89.1 | 1 067 023 | 5 625 | 99.5 |
| Q07 Geo sellers | GiST + ST_DWithin | Index Scan GiST | Index Scan GiST | 8.306 | 10.796 | 10.157 | 10.326 | -1.7 | 193 | 196 | -1.6 |
| Q08 Promociones | GiST + GIN arrays | Seq/Index Scan | Operadores indexables | 3.494 | 3.807 | 0.022 | 0.019 | 13.6 | 1 | 1 | 0.0 |
| Q09 Segmentación | MV + índice parcial | Hash Join + Aggregate + temp | Scan sobre MV | 0.903 | 3.249 | 872.522 | 0.444 | 99.9 | 5 798 | 102 | 98.2 |
| Q10 Fecha mensual | Reescritura sin función en WHERE | Append (12 particiones) | Seq Scan (1 partición) | 0.524 | 0.121 | 35.423 | 3.173 | 91.0 | 1 900 | 218 | 88.5 |

Fórmula:

```text
Mejora tiempo % = ((execution_antes - execution_despues) / execution_antes) * 100
Mejora buffers % = ((buffers_antes - buffers_despues) / buffers_antes) * 100
```

## Índices creados

| Índice | Tipo | Tabla | Patrón optimizado | Tamaño | Trade-off |
|---|---|---|---|---:|---|
| `idx_u4_order_purchase_brin` | BRIN | `order` | Rango temporal | ~24 kB/partición | Bajo espacio, menor precisión |
| `idx_u4_order_status_purchase` | B-tree compuesto | `order` | Estado + fecha | ~0.5-1.6 MB/partición | Mayor costo de escritura |
| `idx_u4_order_delivered_customer` | B-tree parcial | `order` | Segmentación delivered | ~0.3-1.0 MB/partición | Solo aplica a `delivered` |
| `idx_u4_order_item_seller_shipping` | B-tree compuesto | `order_item` | Seller + envío | 14 MB | Espacio adicional |
| `idx_u4_product_name_lower_trgm` | GIN expresión | `product` | Búsqueda textual normalizada | 128 kB | Alto espacio relativo |
| `idx_u4_payment_type_installments_value` | B-tree compuesto | `payment` | Auditoría de pagos | 4640 kB | Utilidad depende de selectividad |

## Validación de particionamiento

| Evidencia | Resultado |
|---|---|
| Número de particiones de `order` | 11 base + `order_2026_07` creada = 12 |
| Filas en `order_default` | 0 |
| Partición futura creada | `order_2026_07` (vía `create_monthly_order_partition(2026,7)`) |
| Plan con filtro enero 2026 lee solo la partición esperada | Sí (`order_2026_01`, 218 buffers, 3.98 ms) |
| Plan sin filtro temporal lee múltiples particiones | Sí (`Append`, 19.7 ms) |
| Anti-patrón con `date_trunc` impide pruning eficiente | Sí (`Append` 12 particiones, 1900 buffers, 38.8 ms) |

## Hallazgos

1. Las materialized views (Q03, Q09) y el filtrado temprano (Q06) producen las mayores mejoras de tiempo y buffers.
2. La reescritura por rango (Q10) habilita partition pruning real: de 12 particiones a 1 (~90% tiempo, ~88% buffers).
3. En conjuntos pequeños (Q04, Q05, Q07, Q08) la optimización es marginal o levemente negativa, como predice la teoría.

## Riesgos residuales

| Riesgo | Mitigación |
|---|---|
| Tiempos no representan producción (hardware del contenedor) | Repetir con Olist completo o más volumen sintético |
| Índices aumentan costo de escritura | Mantener solo índices con impacto medido |
| Particiones futuras no creadas a tiempo | Programar `create_monthly_order_partition` |
| Consultas sin filtro temporal escanean histórico | Exigir ventanas temporales en endpoints/reportes |
