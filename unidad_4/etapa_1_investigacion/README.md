# Etapa 1 - Investigación formativa

## Propósito

Explorar técnicas de optimización para el módulo transaccional PostgreSQL de Ecommify antes de aplicarlas en la base real. Esta etapa se concentra en:

- Identificar consultas críticas del sistema.
- Interpretar planes de ejecución.
- Definir una estrategia de indexación especializada.
- Justificar el particionamiento declarativo de `order`.
- Planificar mantenimiento y archivado.

## Consultas críticas priorizadas

| ID | Consulta | Frecuencia esperada | Complejidad | Impacto negocio | Prioridad |
|---|---|---:|---:|---:|---:|
| Q01 | Órdenes activas recientes | Alta | Media | Alto | 1 |
| Q02 | Detalle completo de orden | Alta | Alta | Alto | 2 |
| Q03 | Ventas mensuales por categoría | Media | Alta | Alto | 3 |
| Q04 | Búsqueda por especificaciones JSONB | Alta | Media | Medio | 4 |
| Q05 | Búsqueda textual de productos | Alta | Media | Medio | 5 |
| Q06 | Desempeño de seller y entregas | Media | Alta | Alto | 6 |
| Q07 | Sellers cercanos a cliente | Media | Media | Medio | 7 |
| Q08 | Promociones activas por categoría | Alta | Media | Medio | 8 |
| Q09 | Segmentación de clientes | Baja | Alta | Medio | 9 |
| Q10 | Órdenes por rango mensual | Alta | Media | Alto | 10 |

## Hallazgos esperados al analizar planes

| Problema potencial | Señal en EXPLAIN | Riesgo | Acción candidata |
|---|---|---|---|
| Escaneo completo de `order` | `Seq Scan` o `Append` sobre muchas particiones | Alto I/O y latencia | Filtros por rango, particionamiento, índices por estado/fecha |
| JOIN costoso en detalle de orden | `Hash Join` con muchas filas | Latencia operativa | B-tree compuesto y filtrado temprano por PK |
| Agregación mensual lenta | `HashAggregate` sobre tablas grandes | Carga OLAP sobre OLTP | Materialized view o preagregación |
| Búsqueda JSONB lenta | `Seq Scan` con operador `@>` | Mala lectura de catálogo | GIN sobre `product_specifications` |
| Búsqueda textual lenta | `Seq Scan` con `ILIKE` | Mala experiencia frontend | GIN trigram o índice de expresión |
| Consulta espacial lenta | cálculo `ST_Distance` para muchas filas | Alto CPU | `ST_DWithin` + GiST antes de ordenar |
| Filtro con función en columna | planner no usa índice | Scan innecesario | Reescribir predicado con rangos |

## Entregables de esta etapa

- `01_consultas_criticas.sql`: consultas frecuentes y complejas para analizar con `EXPLAIN`.
- `02_matriz_indexacion.md`: matriz consulta -> índice -> justificación -> trade-off.
- `03_particionamiento.md`: selección de tabla, columna, granularidad y mantenimiento.

## Comando sugerido

```bash
docker exec -i ecommify_postgres_local psql -U postgres -d ecommify \
  < unidad_4/etapa_1_investigacion/01_consultas_criticas.sql
```
