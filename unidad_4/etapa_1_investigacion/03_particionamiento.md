# Particionamiento declarativo

## Analisis de candidatos

| Tabla | Volumen esperado | Patron de consulta | Candidata | Justificacion |
|---|---:|---|---|---|
| `order` | 150k año 1, +50% anual | Filtros por fecha, estado, cliente | Si | Tabla transaccional central, crecimiento alto, filtros temporales frecuentes |
| `order_item` | 170k año 1 | JOIN por orden, producto, seller | Parcialmente | Depende de `order`; se mantiene sin particionar para evitar complejidad adicional |
| `payment` | 156k año 1 | Auditoria por orden/metodo | No inicial | Alta relacion con `order`; particionar solo si auditoria crece |
| `geolocation` | ~1M referencia | Lookup por zip y geo | No | Read-only; se optimiza con B-tree/GiST |
| `product` | 40k año 1 | Catalogo, busqueda | No | Volumen moderado; indices GIN/trigram son suficientes |

## Seleccion

- Tabla seleccionada: `"order"`.
- Columna de particion: `order_purchase_timestamp`.
- Tipo: `RANGE`.
- Razon: las consultas operativas y analiticas filtran por ventanas temporales; PostgreSQL puede aplicar partition pruning y evitar leer particiones fuera de rango.

## Granularidad

| Tipo de dato | Granularidad | Ejemplo |
|---|---|---|
| Historico cold | Anual o semestral | `order_2016`, `order_2017`, `order_2018_h1` |
| Operativo hot | Mensual | `order_2026_01`, `order_2026_02` |
| Seguridad | DEFAULT | `order_default` |

La granularidad mensual es adecuada para ventanas operativas y dashboards recientes. La granularidad anual/semestral reduce el numero de particiones historicas.

## Implementacion existente

La base ya implementa particionamiento en:

- `postgresql/schema/02_tables.sql`: define `"order"` con `PARTITION BY RANGE (order_purchase_timestamp)`.
- `postgresql/schema/03_partitions.sql`: crea particiones historicas, mensuales y `order_default`.
- `create_monthly_order_partition(year, month)`: funcion de mantenimiento para particiones futuras.

## Politica de mantenimiento

| Actividad | Frecuencia | Responsable | Comando/estrategia |
|---|---|---|---|
| Crear particion futura | Mensual | DBA/job | `SELECT create_monthly_order_partition(2026, 7);` |
| Validar DEFAULT vacia | Semanal | DBA | `SELECT COUNT(*) FROM order_default;` |
| Analizar estadisticas | Diario/semanal | DBA | `ANALYZE "order";` |
| Archivado cold | Mensual/trimestral | DBA | `ALTER TABLE "order" DETACH PARTITION order_2016;` |
| Reindexacion si aplica | Bajo trafico | DBA | `REINDEX INDEX CONCURRENTLY ...` |

## Validaciones de rendimiento

La Etapa 2 debe comparar:

1. Consulta por rango mensual sobre `"order"` y confirmar que el plan lea solo la particion esperada.
2. Consulta sin filtro temporal y confirmar que el plan lee varias particiones.
3. Impacto de BRIN/B-tree sobre filtros temporales.
4. Conteo de filas en cada particion para detectar desbalance.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
|---|---|---|
| Ordenes caen en `order_default` | Pierde pruning esperado | Crear particiones futuras antes de inicio de mes |
| Demasiadas particiones pequeñas | Overhead del planner | Mantener monthly solo para hot y agrupar cold |
| Indices duplicados por particion | Mayor almacenamiento | Crear solo indices justificados por patrones medidos |
| Queries sin filtro temporal | Escaneo de muchas particiones | Reescritura de consultas y filtros obligatorios por ventana |
