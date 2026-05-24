# 04 — Matriz de decisión PostgreSQL vs MongoDB

## 1. Anclaje con Unidad 1

Este documento responde directamente a la pregunta de investigación 5 de Unidad 1:

> *"¿Cómo diseñar una arquitectura híbrida que balancee consistencia y escalabilidad?"*

La Unidad 1 ya seleccionó el enfoque arquitectónico (Opción 3: Políglota Híbrida). Lo que la Unidad 2 aporta es la operacionalización de esa decisión: matriz fila a fila justificando qué entidad reside en qué motor, criterios técnicos detrás de cada asignación y posición CAP por módulo.

## 2. Criterios de decisión utilizados

Cada asignación de entidad a motor se evalúa contra seis criterios objetivos:

| Criterio | Pregunta clave | Implicación |
|---|---|---|
| **Volumen** | ¿Cuánto se espera crecer en filas/documentos? | Volúmenes muy altos con esquema variable favorecen MongoDB. Volúmenes acotados con esquema estable favorecen PostgreSQL. |
| **Estructura** | ¿Es rígida o varía por instancia? | Estructura rígida con relaciones favorece PostgreSQL. Estructura variable o anidada profunda favorece MongoDB (o JSONB dentro de PostgreSQL si las relaciones siguen siendo críticas). |
| **Patrón de consulta dominante** | ¿OLTP, OLAP, búsqueda, agregación? | OLTP transaccional con joins → PostgreSQL. Agregación masiva append-only → MongoDB. |
| **Consistencia requerida** | ¿ACID estricto o eventual aceptable? | ACID estricto → PostgreSQL (MVCC + WAL). Consistencia eventual aceptable → MongoDB. |
| **Ratio lectura/escritura** | ¿Reads >> writes, writes >> reads, equilibrado? | Reads >> writes con denormalización favorece MongoDB. Writes con integridad referencial favorece PostgreSQL. |
| **Relaciones** | ¿Muchos joins o documentos autocontenidos? | Muchas relaciones críticas → PostgreSQL. Documentos autocontenidos sin joins → MongoDB. |

## 3. Matriz por entidad

| Entidad | Motor | Volumen | Estructura | Consultas | Consistencia | Lectura/Escritura | Relaciones | Justificación corta |
|---|---|---|---|---|---|---|---|---|
| **Customer** | PostgreSQL | Medio (130k año 1) | Rígida | Joins con Order, agregación | ACID | Equilibrado | Críticas (FK desde Order) | Datos personales con relaciones claras; integridad referencial es innegociable. |
| **Order** | PostgreSQL | Alto (150k año 1, +50%/año) | Rígida | Joins, agregaciones, particionada por fecha | ACID estricto | Writes pesadas, reads por rango temporal | Críticas (FK desde OrderItem, Payment) | Núcleo transaccional. Particionamiento por `order_purchase_timestamp` justificado por EDA. |
| **OrderItem** | PostgreSQL | Alto (170k año 1) | Rígida | Conjunta con Order, agregación por producto/seller | ACID estricto (conjunta con Order) | Writes con Order | Críticas (FK a Order, Product, Seller) | Líneas de detalle; sin sentido separarlas del motor de su Order. |
| **Payment** | PostgreSQL | Alto | Rígida | Transaccional, auditable | ACID estricto innegociable | Writes con Order | Críticas (FK a Order) | Dinero, auditable; no negociable salir de ACID. |
| **Product** (fuente de verdad) | PostgreSQL | Alto (40k año 1) | Híbrida: rígida + JSONB | Operativa, FK desde OrderItem, búsqueda con pg_trgm | ACID | Reads >> writes | Críticas (FK desde OrderItem, FK a Category) | Decisión de la Formativa de U2: los tipos avanzados nativos (JSONB, TEXT[], composite, HSTORE) cubren la flexibilidad necesaria sin perder integridad referencial. |
| **Seller** | PostgreSQL | Bajo (3.5k año 1) | Rígida | Joins, consultas geográficas con PostGIS | ACID | Reads >> writes | Críticas (FK desde OrderItem) | Integridad relacional con Order y Product. Geo-queries con PostGIS. |
| **Category** | PostgreSQL | Muy bajo (~80) | Rígida | Joins, agregación analítica | ACID | Reads >> writes | Críticas (FK desde Product) | Catálogo cerrado; soporta MV `mv_sales_by_category_monthly`. |
| **Promotion** | PostgreSQL | Bajo (~200/año) | Rígida con TSTZRANGE | Validación temporal por rango | ACID | Reads frecuentes en validación | A Category/Product por arrays | Vigencia temporal con tipo nativo `TSTZRANGE` indexable con GIST; integridad referencial. |
| **OrderStatusHistory** | PostgreSQL | Alto (proporcional a Order) | Rígida append-only | Joins con Order, agregaciones temporales | ACID conjunta con Order | Writes pesadas | A Order | Trazabilidad del ciclo de vida; debe ser consistente con Order. |
| **Geolocation** | PostgreSQL | Alto (~1M) | Rígida con PostGIS | Lookups espaciales por zip | Read-only en operación | Reads exclusivos | A Customer/Seller por trigger | Tabla de referencia espacial; PostGIS es la tecnología natural. |
| **product_catalog** (proyección) | MongoDB | Alto | Flexible (denormalizada, embedded refs) | Búsqueda, filtrado de frontend | Eventual respecto a PostgreSQL | Reads >>> writes (~99/1) | Autocontenido (embeds) | Latencia de frontend prioritaria; los embeds eliminan joins. |
| **Review** | MongoDB | Alto (150k año 1) | Semi-flexible (polymorphic) | Por producto, por usuario | Eventual | Writes intensas, reads moderadas | Lógicas a Order/Product (no enforced) | Volumen alto de escritura; contenido variable; consistencia eventual aceptable. |
| **analytics_events** | MongoDB | Muy alto (millones/año) | Append-only (bucket pattern) | Agregación analítica | Eventual | Writes muy intensas, reads agregadas | Sin relaciones críticas | Inmutables, throughput alto; sin necesidad de joins ni transacciones. |
| **user_sessions** | MongoDB | Medio | Flexible con TTL | Por sesión | Eventual | Equilibrado | Sin relaciones | Datos efímeros con TTL nativo de MongoDB. |

## 4. Análisis del Teorema CAP aplicado a Ecommify

El Teorema CAP establece que un sistema distribuido puede garantizar simultáneamente solo dos de las tres propiedades: Consistencia (C), Disponibilidad (A) y Tolerancia a Particiones (P). En la práctica, la tolerancia a particiones (P) es ineludible en sistemas distribuidos, por lo que la elección real es entre CP (consistencia y partición) y AP (disponibilidad y partición).

Ecommify no toma una sola posición CAP global porque sus módulos tienen requisitos distintos. Esta es precisamente la razón que justifica el enfoque Políglota Híbrida.

### 4.1 Posición CAP por módulo

| Módulo | Motor | Posición CAP | Justificación |
|---|---|---|---|
| Pagos | PostgreSQL | **CP** | Una transacción de pago debe ser consistente. Si hay particionamiento de red, el sistema prefiere rechazar la transacción (sacrificar A) antes que permitir inconsistencias monetarias. |
| Órdenes | PostgreSQL | **CP** | Una orden debe reflejar correctamente sus ítems y su pago. Sacrificio de A momentánea ante particiones es aceptable. |
| Catálogo (fuente de verdad) | PostgreSQL | **CP** | El catálogo en PostgreSQL es la base de FK desde `order_item` y otras tablas. Inconsistencias rompen integridad referencial. |
| Catálogo (proyección lectura) | MongoDB | **AP** | El catálogo en MongoDB es proyección. Si hay particiones, el frontend prefiere servir un catálogo levemente desactualizado a servir un error. |
| Reviews | MongoDB | **AP** | Recibir una review tarde no es crítico. El sistema debe seguir aceptando escrituras incluso si hay particiones de red. |
| Analytics events | MongoDB | **AP** | Pérdida estadísticamente baja de eventos es tolerable. El throughput es prioritario. |
| User sessions | MongoDB | **AP** | Las sesiones son efímeras y reconstruibles. Perder una sesión por particionamiento es recoverable. |

### 4.2 Por qué no hay una respuesta CAP única para Ecommify

Forzar todo el sistema a CP (todo en PostgreSQL con ACID estricto) implicaría:
- Latencia inaceptable en lecturas de catálogo (joins profundos en cada page view).
- Throughput insuficiente para eventos analíticos (cada inserción atomizada).
- Riesgo de bloqueos en sesiones efímeras.

Forzar todo a AP (todo en MongoDB con consistencia eventual) implicaría:
- Inconsistencias inaceptables en pagos (cobros duplicados, perdidos o desbalanceados).
- Imposibilidad de enforcement referencial en órdenes (items sin producto válido).
- Pérdida del modelo OLAP estructurado vía materialized views.

La hibridación permite que cada módulo opte por la posición CAP correcta para su naturaleza. Esto responde la pregunta de investigación 5 de U1.

## 5. Referencias técnicas

### 5.1 PostgreSQL

- **MVCC (Multi-Version Concurrency Control).** PostgreSQL implementa concurrencia mediante MVCC, lo que permite lectores y escritores simultáneos sin bloqueos mutuos. Cada transacción ve una snapshot consistente del estado de la base. Ref: PostgreSQL Global Development Group (2025), [*Concurrency Control*](https://www.postgresql.org/docs/16/mvcc.html).
- **WAL (Write-Ahead Logging).** Toda modificación se escribe primero al log de transacciones antes de aplicarse al heap. Garantiza durabilidad (D de ACID) y permite replicación lógica + recuperación point-in-time. Ref: PostgreSQL Global Development Group (2025), [*Write-Ahead Logging*](https://www.postgresql.org/docs/16/wal.html).
- **JSONB.** Almacenamiento binario indexable de documentos JSON. Soporta operadores de contención (`@>`), existencia (`?`), path (`#>`) y construcción de índices GIN. Ref: PostgreSQL Global Development Group (2025), [*JSON Types*](https://www.postgresql.org/docs/16/datatype-json.html).
- **TSTZRANGE.** Tipo nativo de rango temporal con zona horaria. Soporta operadores de contención (`<@`), solapamiento (`&&`), adyacencia (`-|-`). Indexable con GIST. Ref: PostgreSQL Global Development Group (2025), [*Range Types*](https://www.postgresql.org/docs/16/rangetypes.html).
- **Particionamiento declarativo.** Soporte nativo de particionamiento por rango, lista y hash desde PostgreSQL 10+. Partition pruning automático en query planner. Ref: PostgreSQL Global Development Group (2025), [*Table Partitioning*](https://www.postgresql.org/docs/16/ddl-partitioning.html).
- **PostGIS.** Extensión espacial que agrega tipos `GEOMETRY` y `GEOGRAPHY` con operadores espaciales completos. Ref: [PostGIS Documentation](https://postgis.net/documentation/).
- **pg_trgm.** Extensión para búsqueda por similitud trigram. Permite consultas tolerantes a errores tipográficos con índices GIN. Ref: PostgreSQL Global Development Group (2025), [*pg_trgm*](https://www.postgresql.org/docs/16/pgtrgm.html).

### 5.2 MongoDB

- **writeConcern.** Configura el nivel de garantía de durabilidad de las escrituras. Valores típicos: `{w: "majority"}` para fuerte durabilidad, `{w: 1}` para baja latencia con riesgo de pérdida ante caída inmediata del primario. Ref: MongoDB, Inc. (2025), [*Write Concern*](https://www.mongodb.com/docs/manual/reference/write-concern/).
- **readPreference.** Configura desde qué miembro del replica set se sirven las lecturas. `primary` para consistencia fuerte; `secondaryPreferred` para distribuir carga aceptando lag. Ref: MongoDB, Inc. (2025), [*Read Preference*](https://www.mongodb.com/docs/manual/core/read-preference/).
- **Data modeling patterns.** Los patrones aplicados (Extended Reference, Computed, Bucket, Polymorphic) están documentados oficialmente. Ref: MongoDB, Inc. (2025), [*Data Modeling Introduction*](https://www.mongodb.com/docs/manual/core/data-modeling-introduction/).
- **TTL Indexes.** Índices que automáticamente eliminan documentos después de un tiempo de expiración. Usado en `user_sessions` y `analytics_events`. Ref: MongoDB, Inc. (2025), [*TTL Indexes*](https://www.mongodb.com/docs/manual/core/index-ttl/).

### 5.3 Teorema CAP

- Gilbert, S., & Lynch, N. (2002). *Brewer's conjecture and the feasibility of consistent, available, partition-tolerant web services*. ACM SIGACT News, 33(2), 51-59.
- Brewer, E. (2012). *CAP twelve years later: How the "rules" have changed*. IEEE Computer, 45(2), 23-29.

## 6. Conclusión

La hibridación de PostgreSQL y MongoDB en Ecommify no es una decisión de moda ni una concesión a la heterogeneidad. Es una decisión informada que se sustenta en:

1. **Análisis empírico del dataset** (EDA de Sección 7) que revela patrones de acceso, volúmenes y cardinalidades.
2. **Análisis CAP por módulo** que demuestra que no existe una posición única óptima para todo el sistema.
3. **Aprovechamiento de tipos avanzados nativos de PostgreSQL** que reducen la necesidad de migrar entidades a MongoDB.
4. **Aprovechamiento de patrones de modelado de MongoDB** (Extended Reference, Computed, Bucket, Polymorphic, TTL) donde sí aporta valor (latencia, throughput, datos efímeros).

La asignación resultante es defendible fila a fila, no por preferencia personal sino por criterios técnicos objetivos.
