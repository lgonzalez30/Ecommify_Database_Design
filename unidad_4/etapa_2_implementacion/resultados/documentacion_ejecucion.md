# Documentacion de ejecucion — Unidad 4 Etapa 2

## Proposito de la prueba

Esta etapa valida, sobre una base PostgreSQL real levantada con Docker, las tecnicas de optimizacion propuestas para el modulo transaccional de Ecommify:

- Analisis de planes con `EXPLAIN (ANALYZE, BUFFERS)`.
- Implementacion de indices especializados.
- Reescritura de consultas criticas.
- Validacion de particionamiento declarativo y partition pruning.
- Medicion antes/despues con tiempos de ejecucion y lectura de buffers.

## Entorno usado

| Elemento | Valor |
|---|---|
| Fecha | 2026-06-08 |
| Motor | PostgreSQL 16 + PostGIS |
| Contenedor | `ecommify_postgres_u4` |
| Compose | `docker-compose.u4.yml` |
| Puerto local | `55432` |
| Base de datos | `ecommify` |
| Scripts base | `postgresql/schema/00_extensions.sql` a `08_roles_permissions.sql` |
| Datos | Datos mock controlados de `postgresql/schema/07_5_mock_data.sql` |

Se uso `docker-compose.u4.yml` en lugar de `docker-compose.yml` porque el volumen principal `pg_data/` tenia estado local previo. El compose de Unidad 4 usa un volumen aislado `pg_data_u4/`, lo que permite ejecutar pruebas reproducibles sin depender de datos corruptos o residuales.

## Flujo ejecutado

El flujo completo se ejecuta con:

```bash
./unidad_4/etapa_2_implementacion/run_etapa_2.sh
```

El runner realiza estas acciones:

1. Verifica que Docker este disponible.
2. Levanta PostgreSQL con `docker-compose.u4.yml`.
3. Espera el `healthcheck` del contenedor.
4. Espera explicitamente que exista la tabla particionada `public."order"`.
5. Ejecuta el baseline con `01_baseline_explain_analyze.sql`.
6. Crea indices especializados con `02_indices_optimizacion_u4.sql`.
7. Ejecuta consultas optimizadas con `03_consultas_optimizadas.sql`.
8. Valida particionamiento con `04_validacion_particionamiento.sql`.
9. Guarda evidencias crudas en `resultados/`.
10. Genera un resumen automatico timestamped.

## Archivos generados

| Archivo | Proposito |
|---|---|
| `baseline_explain_2026-06-08_14-20-21.txt` | Planes antes de aplicar indices y reescrituras U4. |
| `indices_u4_2026-06-08_14-20-21.txt` | Creacion de indices, `ANALYZE` y tamaño reportado. |
| `optimized_explain_2026-06-08_14-20-21.txt` | Planes despues de aplicar optimizaciones. |
| `partition_validation_2026-06-08_14-20-21.txt` | Evidencia de particiones, default partition y pruning. |
| `resumen_metricas_2026-06-08_14-20-21.md` | Resumen automatico generado por el runner. |
| `resumen_metricas.md` | Resumen curado y versionable para entrega. |

Los archivos `.txt` y los resumenes timestamped no se versionan porque son salidas generadas. El archivo que resume resultados para entrega es `resumen_metricas.md`.

## Baseline: que se midio antes

El baseline ejecuta 10 consultas criticas con:

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
```

Cada plan permite observar:

- tipo de scan (`Seq Scan`, `Index Scan`, `Bitmap Heap Scan`, `Append`);
- metodo de join (`Nested Loop`, `Hash Join`, etc.);
- particiones leidas;
- `Planning Time`;
- `Execution Time`;
- buffers usados o leidos.

Las consultas evaluadas fueron:

| Query | Descripcion | Riesgo buscado |
|---|---|---|
| Q01 | Ordenes activas recientes | Escaneo de particiones o falta de indice parcial. |
| Q02 | Detalle completo de orden | JOINs innecesarios si no se filtra temprano. |
| Q03 | Ventas mensuales por categoria | Agregacion OLAP costosa sobre tablas base. |
| Q04 | Catalogo por JSONB y precio | Escaneo completo en atributos variables. |
| Q05 | Busqueda textual de producto | `Seq Scan` por busqueda tolerante a errores. |
| Q06 | Desempeno de seller y entregas | JOINs y filtros por ventana de envio. |
| Q07 | Sellers cercanos a cliente | Costo alto de calculo espacial. |
| Q08 | Promociones activas por categoria | Combinacion de rango temporal y arrays. |
| Q09 | Segmentacion de clientes | Agregacion recurrente sobre ordenes/items. |
| Q10 | Conteo mensual con `date_trunc` | Anti-patron que limita partition pruning. |

## Optimizaciones aplicadas

### 1. Indices especializados

Se crearon indices con prefijo `idx_u4_`:

| Indice | Tipo | Objetivo |
|---|---|---|
| `idx_u4_order_purchase_brin` | BRIN | Rango temporal en tabla `order` particionada y append-only. |
| `idx_u4_order_status_purchase` | B-tree compuesto | Filtros por estado + fecha. |
| `idx_u4_order_delivered_customer` | B-tree parcial | Segmentacion sobre ordenes entregadas. |
| `idx_u4_order_item_seller_shipping` | B-tree compuesto | Consultas por seller y ventana de envio. |
| `idx_u4_product_name_lower_trgm` | GIN de expresion | Busqueda textual case-insensitive con trigram. |
| `idx_u4_payment_type_installments_value` | B-tree compuesto | Auditoria de pagos por metodo/cuotas/valor. |

Despues de crear indices se ejecuto `ANALYZE` sobre las tablas principales para actualizar estadisticas del planner.

### 2. Reescritura de consultas

Se aplicaron reescrituras para comparar contra baseline:

| Query | Reescritura aplicada |
|---|---|
| Q02 | CTE materializado para filtrar primero la orden objetivo. |
| Q03 | Consulta sobre `mv_sales_by_category_monthly` en vez de tablas base. |
| Q05 | Uso de `lower(name)` para coincidir con indice de expresion. |
| Q06 | CTE materializado para filtrar `order_item` por ventana de envio antes del JOIN. |
| Q07 | `ST_DWithin` antes de ordenar por `ST_Distance`. |
| Q09 | Consulta sobre `mv_customer_segments` en vez de agregacion en vivo. |
| Q10 | Reemplazo de `date_trunc(order_purchase_timestamp)` por rango `>=` y `<`. |

### 3. Particionamiento

La tabla `"order"` ya estaba particionada por:

```sql
PARTITION BY RANGE (order_purchase_timestamp)
```

La validacion comprobó:

- existencia de particiones historicas y mensuales;
- existencia de `order_default`;
- `order_default` sin filas;
- creacion de particion futura `order_2026_07`;
- lectura de solo `order_2026_01` cuando se filtra enero 2026;
- lectura de multiples particiones cuando no hay filtro temporal;
- efecto negativo de usar `date_trunc` sobre la columna de particion.

## Resultados principales

| Query | Resultado |
|---|---|
| Q03 | La materialized view redujo el tiempo de ejecucion de 3.076 ms a 0.693 ms. |
| Q06 | El filtrado temprano por ventana de envio redujo el tiempo de 1.105 ms a 0.527 ms. |
| Q07 | La consulta espacial bajo de 187.922 ms a 116.412 ms, aunque sigue siendo la mas costosa. |
| Q09 | La segmentacion con materialized view bajo de 0.493 ms a 0.208 ms. |
| Q10 | La reescritura por rango bajo de 0.975 ms a 0.691 ms y habilito pruning directo. |

Tambien hubo casos donde la optimizacion no mejoro con datos mock:

- Q02: el CTE materializado agrego overhead.
- Q05: el indice trigram no compensa con solo 3 productos.
- Q08: el overhead de indices supera beneficio con 2 promociones.

Esto no invalida la tecnica; muestra que los indices y CTEs deben justificarse con volumen suficiente y selectividad real.

## Como interpretar las metricas

La mejora porcentual se calcula con:

```text
Mejora % = ((execution_baseline - execution_optimizada) / execution_baseline) * 100
```

Un valor positivo indica mejora. Un valor negativo indica que la version optimizada fue mas lenta en el entorno medido.

## Limitaciones

La base local contiene pocos datos mock. Por eso:

- algunos planes usan `Seq Scan` porque la tabla es demasiado pequeña;
- algunos indices no son elegidos por el planner;
- los tiempos son de milisegundos y pueden variar por cache;
- los resultados sirven como evidencia de ejecucion, no como benchmark productivo.

Para una medicion mas fuerte se recomienda cargar Olist completo o generar datos sinteticos con mas de 100.000 ordenes antes de repetir el runner.

## Conclusiones

1. Las optimizaciones con mayor impacto fueron materialized views, filtrado por rango temporal y uso correcto de particionamiento.
2. El particionamiento de `order` esta correctamente implementado y el planner aplica pruning cuando el predicado usa rangos directos sobre `order_purchase_timestamp`.
3. Los indices especializados quedan implementados, pero su impacto real debe evaluarse con mayor volumen.
4. La consulta espacial requiere atencion adicional en produccion: limitar radio, precalcular zonas o cachear resultados por region.
