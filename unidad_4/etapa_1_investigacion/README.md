# Etapa 1 — Investigacion formativa

## Proposito

Explorar tecnicas de optimizacion para el modulo transaccional PostgreSQL de Ecommify antes de aplicarlas en la base real. Esta etapa se concentra en:

- Identificar consultas criticas del sistema.
- Interpretar planes de ejecucion.
- Definir una estrategia de indexacion especializada.
- Justificar el particionamiento declarativo de `order`.
- Planificar mantenimiento y archivado.

## Consultas criticas priorizadas

| ID | Consulta | Frecuencia esperada | Complejidad | Impacto negocio | Prioridad |
|---|---|---:|---:|---:|---:|
| Q01 | Ordenes activas recientes | Alta | Media | Alto | 1 |
| Q02 | Detalle completo de orden | Alta | Alta | Alto | 2 |
| Q03 | Ventas mensuales por categoria | Media | Alta | Alto | 3 |
| Q04 | Busqueda por especificaciones JSONB | Alta | Media | Medio | 4 |
| Q05 | Busqueda textual de productos | Alta | Media | Medio | 5 |
| Q06 | Desempeno de seller y entregas | Media | Alta | Alto | 6 |
| Q07 | Sellers cercanos a cliente | Media | Media | Medio | 7 |
| Q08 | Promociones activas por categoria | Alta | Media | Medio | 8 |
| Q09 | Segmentacion de clientes | Baja | Alta | Medio | 9 |
| Q10 | Ordenes por rango mensual | Alta | Media | Alto | 10 |

## Hallazgos esperados al analizar planes

| Problema potencial | Senal en EXPLAIN | Riesgo | Accion candidata |
|---|---|---|---|
| Escaneo completo de `order` | `Seq Scan` o `Append` sobre muchas particiones | Alto I/O y latencia | Filtros por rango, particionamiento, indices por estado/fecha |
| JOIN costoso en detalle de orden | `Hash Join` con muchas filas | Latencia operativa | B-tree compuesto y filtrado temprano por PK |
| Agregacion mensual lenta | `HashAggregate` sobre tablas grandes | Carga OLAP sobre OLTP | Materialized view o preagregacion |
| Busqueda JSONB lenta | `Seq Scan` con operador `@>` | Mala lectura de catalogo | GIN sobre `product_specifications` |
| Busqueda textual lenta | `Seq Scan` con `ILIKE` | Mala experiencia frontend | GIN trigram o indice de expresion |
| Consulta espacial lenta | calculo `ST_Distance` para muchas filas | Alto CPU | `ST_DWithin` + GiST antes de ordenar |
| Filtro con funcion en columna | planner no usa indice | Scan innecesario | Reescribir predicado con rangos |

## Entregables de esta etapa

- `01_consultas_criticas.sql`: consultas frecuentes y complejas para analizar con `EXPLAIN`.
- `02_matriz_indexacion.md`: matriz consulta -> indice -> justificacion -> trade-off.
- `03_particionamiento.md`: seleccion de tabla, columna, granularidad y mantenimiento.

## Comando sugerido

```bash
docker exec -i ecommify_postgres_local psql -U postgres -d ecommify \
  < unidad_4/etapa_1_investigacion/01_consultas_criticas.sql
```
