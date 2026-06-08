# Plantilla de metricas — Unidad 4 Etapa 2

Completar esta plantilla con la salida de:

- `sql/01_baseline_explain_analyze.sql`
- `sql/03_consultas_optimizadas.sql`
- `sql/04_validacion_particionamiento.sql`

## Ambiente de prueba

| Campo | Valor |
|---|---|
| Fecha de ejecucion |  |
| Motor | PostgreSQL 16 + PostGIS |
| Entorno | Docker local / Supabase |
| Volumen de datos | Mock / Olist parcial / Olist completo / sintetico |
| Comando de ejecucion |  |

## Resumen ejecutivo

| Indicador | Resultado |
|---|---|
| Consultas evaluadas |  |
| Optimizaciones aplicadas |  |
| Mayor mejora en tiempo |  |
| Mayor reduccion de buffers |  |
| Indices creados |  |
| Particionamiento validado | Si / No |

## Tabla de metricas antes/despues

| Query | Tecnica aplicada | Plan antes | Plan despues | Planning antes ms | Planning despues ms | Execution antes ms | Execution despues ms | Mejora tiempo % | Buffers antes | Buffers despues | Mejora buffers % |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Q01 Ordenes activas | Indice parcial/compuesto + pruning |  |  |  |  |  |  |  |  |  |  |
| Q02 Detalle orden | Filtrado temprano CTE |  |  |  |  |  |  |  |  |  |  |
| Q03 Ventas categoria | Materialized view |  |  |  |  |  |  |  |  |  |  |
| Q04 JSONB catalogo | GIN + B-tree precio |  |  |  |  |  |  |  |  |  |  |
| Q05 Texto producto | GIN trigram expresion |  |  |  |  |  |  |  |  |  |  |
| Q06 Seller SLA | B-tree compuesto + CTE |  |  |  |  |  |  |  |  |  |  |
| Q07 Geo sellers | GiST + ST_DWithin |  |  |  |  |  |  |  |  |  |  |
| Q08 Promociones | GiST + GIN arrays |  |  |  |  |  |  |  |  |  |  |
| Q09 Segmentacion | MV + indice parcial |  |  |  |  |  |  |  |  |  |  |
| Q10 Fecha mensual | Reescritura sin funcion WHERE |  |  |  |  |  |  |  |  |  |  |

Formula sugerida:

```text
Mejora tiempo % = ((execution_antes - execution_despues) / execution_antes) * 100
Mejora buffers % = ((buffers_antes - buffers_despues) / buffers_antes) * 100
```

## Indices creados

| Indice | Tipo | Tabla | Patron optimizado | Tamaño | Trade-off |
|---|---|---|---|---:|---|
| `idx_u4_order_purchase_brin` | BRIN | `order` | Rango temporal |  | Bajo espacio, menor precision |
| `idx_u4_order_status_purchase` | B-tree compuesto | `order` | Estado + fecha |  | Mayor costo de escritura |
| `idx_u4_order_delivered_customer` | B-tree parcial | `order` | Segmentacion delivered |  | Solo aplica a estado delivered |
| `idx_u4_order_item_seller_shipping` | B-tree compuesto | `order_item` | Seller + envio |  | Espacio adicional |
| `idx_u4_product_name_lower_trgm` | GIN expresion | `product` | Busqueda textual normalizada |  | Alto espacio relativo |
| `idx_u4_payment_type_installments_value` | B-tree compuesto | `payment` | Auditoria de pagos |  | Utilidad depende de selectividad |

## Validacion de particionamiento

| Evidencia | Resultado |
|---|---|
| Numero de particiones de `order` |  |
| Filas en `order_default` |  |
| Particion futura creada |  |
| Plan con filtro enero 2026 lee solo particion esperada | Si / No |
| Plan sin filtro temporal lee multiples particiones | Si / No |
| Anti-patron con `date_trunc` impide pruning eficiente | Si / No |

## Hallazgos

1. 
2. 
3. 

## Riesgos residuales

| Riesgo | Mitigacion |
|---|---|
| Datos mock no muestran mejora significativa | Ejecutar con Olist completo o datos sinteticos |
| Indices aumentan costo de escritura | Mantener solo indices con impacto medido |
| Particiones futuras no creadas a tiempo | Programar `create_monthly_order_partition` |
| Consultas sin filtro temporal escanean historico | Exigir ventanas temporales en endpoints/reportes |
