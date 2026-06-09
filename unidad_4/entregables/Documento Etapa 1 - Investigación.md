# Unidad 4 - Etapa 1: Investigación
## Optimización de rendimiento en PostgreSQL - Proyecto Ecommify

**Asignatura:** Diseño y Optimización de Bases de Datos

**Programa:** Maestría en Arquitectura de Software - Universidad de La Sabana

**Profesor:** Miguel Alfonso Varela Fonseca

**Fecha:** 8 de junio de 2026

**Tipo de trabajo:** Colaborativo (Etapa formativa)

**Repositorio:** https://github.com/lgonzalez30/Ecommify_Database_Design

**Integrantes del equipo:**

- Andrés Fernando Díaz Moreno
- Andrés Camilo López Castro
- Luis Alfredo González Mercado
- Carlos Alberto Arévalo Martínez

---

## 1. Introducción

La Unidad 4 aborda técnicas avanzadas de optimización de rendimiento en PostgreSQL aplicadas al módulo transaccional (OLTP) de **Ecommify**, el marketplace cuyo modelo de datos se diseñó sobre la línea base empírica del dataset *Brazilian E-Commerce by Olist*. Esta Etapa 1 es de carácter **investigativo y formativo**: su finalidad es explorar y justificar las estrategias de optimización (análisis de planes de ejecución, indexación especializada y particionamiento declarativo) **antes** de implementarlas y medirlas sobre la base real en la Etapa 2.

### 1.1 Resultados de aprendizaje previstos

- Resolver problemas complejos de arquitectura de software enfocándose en la optimización de diseño, la seguridad integral y la funcionalidad general, utilizando técnicas avanzadas de análisis arquitectónico, pruebas sistemáticas y evaluación crítica.
- Optimizar el rendimiento de bases de datos mediante técnicas avanzadas de indexación, particionamiento/sharding y optimización de consultas/agregaciones.

### 1.2 Alcance de la Etapa 1

1. Análisis de planes de ejecución con `EXPLAIN` y `EXPLAIN ANALYZE`.
2. Diseño de una estrategia de indexación especializada (B-tree, GIN, GiST, BRIN, parciales y de expresión).
3. Definición del particionamiento declarativo de la tabla central `order`, su granularidad y su mantenimiento.

---

## 2. Análisis de planes de ejecución (EXPLAIN / EXPLAIN ANALYZE)

### 2.1 Metodología

La comprensión del optimizador de consultas permite identificar cuellos de botella. El procedimiento aplicado fue:

1. **Identificar consultas críticas** del sistema: listar entre 5 y 10 consultas frecuentes y priorizar las complejas (múltiples JOIN, agregaciones).
2. **Análisis con `EXPLAIN`:** obtener el plan estimado, interpretar el tipo de *scan* y el método de *JOIN*, e identificar las operaciones más costosas.
3. **Análisis con `EXPLAIN ANALYZE`:** obtener métricas reales de ejecución, comparar el tiempo estimado contra el real y documentar *planning time* vs. *execution time*.
4. **Documentar hallazgos:** construir una tabla con consultas y métricas base, identificar los problemas principales y priorizar las optimizaciones por impacto.

### 2.2 Consultas críticas priorizadas

Se seleccionaron diez consultas representativas del módulo transaccional, priorizadas por frecuencia esperada, complejidad e impacto de negocio. Están codificadas en `etapa_1_investigacion/01_consultas_criticas.sql` (con `EXPLAIN`).

| ID | Consulta | Frecuencia | Complejidad | Impacto | Prioridad |
|---|---|---|---|---|---:|
| Q01 | Órdenes activas recientes (estado + ventana temporal) | Alta | Media | Alto | 1 |
| Q02 | Detalle completo de una orden (5 JOIN) | Alta | Alta | Alto | 2 |
| Q03 | Ventas mensuales por categoría (agregación OLAP) | Media | Alta | Alto | 3 |
| Q04 | Búsqueda de catálogo por especificaciones JSONB + precio | Alta | Media | Medio | 4 |
| Q05 | Búsqueda textual tolerante a errores (trigram) | Alta | Media | Medio | 5 |
| Q06 | Desempeño de seller y entregas (SLA) | Media | Alta | Alto | 6 |
| Q07 | Sellers cercanos a un cliente (espacial PostGIS) | Media | Media | Medio | 7 |
| Q08 | Promociones activas por categoría (rango temporal + arrays) | Alta | Media | Medio | 8 |
| Q09 | Segmentación de clientes (CTE con agregaciones) | Baja | Alta | Medio | 9 |
| Q10 | Órdenes por rango mensual (validación de pruning) | Alta | Media | Alto | 10 |

### 2.3 Hallazgos esperados al analizar los planes

A partir de la naturaleza de cada consulta y del modelo físico, se anticiparon los siguientes problemas y acciones candidatas, que orientan las Etapas de indexación y particionamiento:

| Problema potencial | Señal en `EXPLAIN` | Riesgo | Acción candidata |
|---|---|---|---|
| Escaneo completo de `order` | `Seq Scan` o `Append` sobre muchas particiones | Alto I/O y latencia | Filtros por rango, particionamiento, índices por estado/fecha |
| JOIN costoso en detalle de orden | `Hash Join` con muchas filas | Latencia operativa | B-tree compuesto y filtrado temprano por PK |
| Agregación mensual lenta | `HashAggregate` sobre tablas grandes | Carga OLAP sobre OLTP | Materialized view o preagregación |
| Búsqueda JSONB lenta | `Seq Scan` con operador `@>` | Mala lectura de catálogo | GIN sobre `product_specifications` |
| Búsqueda textual lenta | `Seq Scan` con `ILIKE` | Mala experiencia frontend | GIN trigram o índice de expresión |
| Consulta espacial lenta | cálculo de `ST_Distance` para muchas filas | Alto consumo de CPU | `ST_DWithin` + GiST antes de ordenar |
| Filtro con función sobre la columna | el planner no usa el índice | Scan innecesario | Reescribir el predicado con rangos |

---

## 3. Estrategia de indexación especializada

### 3.1 Criterios de selección

Se definió una matriz de decisión que asocia el patrón de consulta con el tipo de índice más apropiado:

| Criterio | Pregunta | Tipo de índice candidato |
|---|---|---|
| Igualdad o rango sobre columna escalar | `WHERE col = ?`, `BETWEEN`, `ORDER BY` | B-tree |
| Filtros por múltiples columnas | Predicados combinados o JOIN frecuente | B-tree compuesto |
| JSONB con contención | `product_specifications @> ...` | GIN |
| Arrays | `@>`, `&&`, `ANY` sobre arrays | GIN |
| Texto tolerante a errores | `%`, `similarity`, `ILIKE '%texto%'` | GIN + `gin_trgm_ops` |
| Geografía | `ST_DWithin`, `ST_Intersects` | GiST |
| Rango temporal nativo | `NOW() <@ promotion_period`, `&&` | GiST |
| Tabla grande append-only | Filtros por fecha sobre datos ordenados | BRIN |
| Subconjunto operativo | Solo estados activos o no nulos | Parcial |
| Función en búsqueda | `lower(name)` o expresión calculada | Expresión |

### 3.2 Matriz consulta → índice → justificación → trade-off

| Consulta | Patrón | Índice propuesto/existente | Tipo | Justificación | Trade-off |
|---|---|---|---|---|---|
| Q01 Órdenes activas recientes | Estado + rango temporal + orden descendente | `idx_order_active_status` | B-tree parcial | Reduce el índice a estados operativos y ordena por fecha | No ayuda a estados terminales |
| Q01/Q10 Órdenes por fecha | Rango sobre `order_purchase_timestamp` | `idx_u4_order_purchase_brin` | BRIN | Bajo costo en tablas grandes particionadas/append-only | Menos preciso que B-tree; depende de la correlación física |
| Q02 Detalle de orden | JOIN por `order_id + order_purchase_timestamp` | PK + `idx_order_item_order`, `idx_payment_order` | B-tree | Recupera el detalle por orden sin scan completo | Índices adicionales consumen espacio |
| Q03 Ventas categoría mes | JOIN Order → OrderItem → Product → Category | `idx_u4_order_status_purchase`, `idx_order_item_product` | B-tree compuesto | Filtra primero por estado y fecha antes de la agregación | Mayor costo de escritura en cambios de estado |
| Q04 JSONB catálogo | `@>` en `product_specifications` | `idx_product_specs_gin` | GIN | Acelera la contención JSONB | Índice grande; mantenimiento más costoso |
| Q04 precio | `base_price BETWEEN` | `idx_product_price` | B-tree | Rango ordenado por precio | Poco útil si la selectividad es baja |
| Q05 texto | `name % 'cafetera'` | `idx_product_name_trgm` | GIN trigram | Búsqueda tolerante a errores | Alto espacio para textos largos |
| Q05 texto normalizado | `lower(name) % lower(?)` | `idx_u4_product_name_lower_trgm` | GIN de expresión | Evita dependencia de mayúsculas/minúsculas | Debe coincidir la expresión en la query |
| Q06 seller SLA | `seller_id + shipping_limit_date` | `idx_u4_order_item_seller_shipping` | B-tree compuesto | Filtra ítems por seller y ventana de envío | No ayuda sin filtro temporal |
| Q07 geo | `ST_DWithin(customer_geo, seller_geo, radio)` | `idx_customer_geo`, `idx_seller_geo` | GiST | Usa *bounding boxes* antes del cálculo exacto | Los cálculos espaciales siguen siendo intensivos en CPU |
| Q08 promociones | rango temporal + categoría array | `idx_promotion_period_gist`, `idx_promotion_target_categories` | GiST + GIN | Combina vigencia temporal y aplicabilidad | Dos índices pueden requerir *bitmap-and* |
| Q09 segmentación | agregación de cliente con `delivered` | `idx_u4_order_delivered_customer` | B-tree parcial | Reduce el histórico a órdenes entregadas | No sirve para estados no entregados |

### 3.3 Índices a implementar en la Etapa 2

La base ya cuenta con índices relevantes en `postgresql/schema/04_indexes.sql`. Para la Unidad 4 se agregan índices complementarios orientados a la medición, que cubren al menos cuatro tipos diferentes (BRIN, B-tree compuesto, B-tree parcial y GIN de expresión):

1. `idx_u4_order_purchase_brin` - BRIN sobre la fecha de la orden.
2. `idx_u4_order_status_purchase` - B-tree compuesto sobre estado y fecha.
3. `idx_u4_product_name_lower_trgm` - GIN trigram de expresión sobre `lower(name)`.
4. `idx_u4_order_item_seller_shipping` - B-tree compuesto para seller/SLA.
5. `idx_u4_order_delivered_customer` - B-tree parcial para la segmentación de clientes entregados.

---

## 4. Particionamiento declarativo

### 4.1 Análisis de candidatos

| Tabla | Volumen esperado | Patrón de consulta | Candidata | Justificación |
|---|---|---|---|---|
| `order` | 150k año 1, +50% anual | Filtros por fecha, estado, cliente | Sí | Tabla transaccional central, crecimiento alto, filtros temporales frecuentes |
| `order_item` | 170k año 1 | JOIN por orden, producto, seller | Parcialmente | Depende de `order`; se mantiene sin particionar para evitar complejidad adicional |
| `payment` | 156k año 1 | Auditoría por orden/método | No inicial | Alta relación con `order`; particionar solo si la auditoría crece |
| `geolocation` | ~1M referencia | Lookup por zip y geo | No | Read-only; se optimiza con B-tree/GiST |
| `product` | 40k año 1 | Catálogo, búsqueda | No | Volumen moderado; los índices GIN/trigram son suficientes |

### 4.2 Selección

- **Tabla seleccionada:** `"order"`.
- **Columna de partición:** `order_purchase_timestamp`.
- **Tipo:** `RANGE`.
- **Razón:** las consultas operativas y analíticas filtran por ventanas temporales; PostgreSQL puede aplicar *partition pruning* y evitar leer particiones fuera de rango.

### 4.3 Granularidad

| Tipo de dato | Granularidad | Ejemplo |
|---|---|---|
| Histórico (cold) | Anual o semestral | `order_2016`, `order_2017`, `order_2018_h1` |
| Operativo (hot) | Mensual | `order_2026_01`, `order_2026_02` |
| Seguridad | DEFAULT | `order_default` |

La granularidad mensual es adecuada para ventanas operativas y dashboards recientes, mientras que la anual/semestral reduce el número de particiones históricas.

### 4.4 Implementación existente

El particionamiento ya está implementado en el esquema base:

- `postgresql/schema/02_tables.sql`: define `"order"` con `PARTITION BY RANGE (order_purchase_timestamp)`.
- `postgresql/schema/03_partitions.sql`: crea particiones históricas, mensuales y `order_default`.
- `create_monthly_order_partition(year, month)`: función de mantenimiento para crear particiones futuras.

### 4.5 Política de mantenimiento

| Actividad | Frecuencia | Responsable | Comando/estrategia |
|---|---|---|---|
| Crear partición futura | Mensual | DBA/job | `SELECT create_monthly_order_partition(2026, 7);` |
| Validar DEFAULT vacía | Semanal | DBA | `SELECT COUNT(*) FROM order_default;` |
| Analizar estadísticas | Diario/semanal | DBA | `ANALYZE "order";` |
| Archivado cold | Mensual/trimestral | DBA | `ALTER TABLE "order" DETACH PARTITION order_2016;` |
| Reindexación si aplica | Bajo tráfico | DBA | `REINDEX INDEX CONCURRENTLY ...` |

### 4.6 Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Órdenes caen en `order_default` | Pierde el pruning esperado | Crear particiones futuras antes del inicio de mes |
| Demasiadas particiones pequeñas | Overhead del planner | Mantener mensuales solo para hot y agrupar cold |
| Índices duplicados por partición | Mayor almacenamiento | Crear solo índices justificados por patrones medidos |
| Queries sin filtro temporal | Escaneo de muchas particiones | Reescritura de consultas y filtros obligatorios por ventana |

### 4.7 Validaciones planificadas para la Etapa 2

1. Consulta por rango mensual sobre `"order"` y confirmar que el plan lea solo la partición esperada.
2. Consulta sin filtro temporal y confirmar que el plan lee varias particiones (`Append`).
3. Impacto de BRIN/B-tree sobre los filtros temporales.
4. Conteo de filas por partición para detectar desbalance y verificar que `order_default` permanezca vacía.

---

## 5. Conclusiones de la investigación

1. Se identificaron y priorizaron diez consultas críticas que cubren los patrones operativos (OLTP) y analíticos (OLAP) del marketplace, lo que permite enfocar el esfuerzo de optimización donde mayor impacto de negocio existe.
2. La estrategia de indexación combina **al menos cuatro tipos** de índices especializados (BRIN, B-tree compuesto, B-tree parcial y GIN de expresión), cada uno justificado por un patrón de consulta y con sus trade-offs documentados.
3. La tabla `order` es la candidata natural a **particionamiento declarativo por rango** sobre `order_purchase_timestamp`, con granularidad mixta hot/cold y una partición `DEFAULT` como red de seguridad.
4. Estos hallazgos constituyen la hipótesis de optimización que la **Etapa 2** valida empíricamente con `EXPLAIN (ANALYZE, BUFFERS)` y métricas cuantificables de antes/después.

---

## 6. Referencias

- The PostgreSQL Global Development Group. *PostgreSQL 16 Documentation - Chapter 14: Performance Tips (Using EXPLAIN)*. https://www.postgresql.org/docs/16/using-explain.html
- The PostgreSQL Global Development Group. *PostgreSQL 16 Documentation - Chapter 11: Indexes*. https://www.postgresql.org/docs/16/indexes.html
- The PostgreSQL Global Development Group. *PostgreSQL 16 Documentation - Chapter 5.11: Table Partitioning*. https://www.postgresql.org/docs/16/ddl-partitioning.html
- PostGIS Development Team. *PostGIS Manual - Spatial Indexing and `ST_DWithin`*. https://postgis.net/docs/
- Olist. *Brazilian E-Commerce Public Dataset by Olist*. Kaggle.
