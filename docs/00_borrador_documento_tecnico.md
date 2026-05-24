# Documento Técnico de Diseño — Ecommify

## Módulo Transaccional PostgreSQL + Módulo NoSQL MongoDB

> Este es el **borrador consolidado** que mis compañeros (Andrés Fernando y Luis Alfredo) usarán como insumo para maquetar el PDF académico final (`Documento_Tecnico_Diseno.pdf`). Mantiene la estructura de la rúbrica de la Etapa 2 Evaluativa y referencia los archivos fuente de cada sección.

---

## a. Portada y resumen ejecutivo

### Portada
> **[PLACEHOLDER para maquetación]:** información formal del equipo, materia, profesor, fecha y logo institucional. Reutilizar el formato de la entrega de Unidad 1.

### Abstract (200 palabras)
> **[PLACEHOLDER]:** redactar al final, una vez consolidado el documento.

Sugerencia de elementos a incluir en el abstract:
- Naturaleza de Ecommify y dataset base (Olist).
- Decisión arquitectónica: Políglota Híbrida heredada de U1.
- Aporte de U2: profundización con tipos avanzados de PostgreSQL, materialized views, particionamiento, extensiones; complementación con MongoDB para datos NoSQL.
- Resultado: diseño documentado en ER 3FN, scripts DDL preliminares, esquemas de colecciones MongoDB, matriz de decisión con análisis CAP.

---

## b. Análisis de requisitos

> **Fuente:** `docs/01_analisis_requisitos.md` (incluir contenido completo).

### Declaración de continuidad con Unidad 1

Esta sección del documento técnico de U2 reutiliza y profundiza el análisis de requisitos iniciado en Unidad 1. Específicamente:

- El **enfoque arquitectónico Políglota Híbrida** se mantiene como decisión cerrada desde U1. No se re-justifica frente a las opciones Transaccional-Analítica o de Alta Disponibilidad. Lo que esta unidad aporta es la operacionalización: qué entidad reside en qué motor y por qué.
- Las **cinco preguntas de investigación** de U1 dan dirección al análisis CAP y a la matriz de decisión (sección f).
- Las **cuatro métricas de éxito** de U1 (100ms en queries PostgreSQL, 100k órdenes sin degradación, 200ms en inserciones MongoDB, 99% disponibilidad) se incorporan como requisitos no funcionales del sistema.
- Las **limitaciones técnicas** de plataformas gratuitas (Supabase free tier, MongoDB Atlas M0, Google Colab) sustentan decisiones de diseño físico como el particionamiento, el archivado y el uso de TTL en colecciones.
- El **inventario conceptual de entidades** (Customer, Order, OrderItem, Product, Seller, Payment, Review, Category) se reusa como base, agregando Promotion y OrderStatusHistory que la Formativa de U2 incorporó.

### Requisitos funcionales

> **Detalle completo en `docs/01_analisis_requisitos.md` sección 2.** Resumen por módulo: catálogo, órdenes, pagos, envíos, reviews, clientes, promociones, reportería.

### Requisitos no funcionales (reuso de U1)

| Categoría | Métrica/restricción |
|---|---|
| Latencia transaccional | < 100 ms en PostgreSQL |
| Latencia de inserciones documento | < 200 ms en MongoDB |
| Volumen mínimo soportado | 100,000 órdenes sin degradación |
| Disponibilidad | > 99% bajo carga |
| Consistencia | ACID en módulo transaccional, eventual en proyecciones de lectura y analíticas |

### Limitaciones técnicas

| Plataforma | Restricción | Implicación en el diseño |
|---|---|---|
| Supabase free tier | CPU/memoria limitada, concurrencia restringida | Particionamiento de `order`, índices selectivos, MV con refresh fuera de horas pico |
| MongoDB Atlas M0 | 512 MB, sin sharding, sin Change Streams completos | `product_catalog` solo con productos activos, TTL agresivo en eventos, sincronización por ETL fallback |
| Google Colab | Sesiones temporales, RAM limitada | Carga del dataset por chunks; EDA sin loads completos en memoria |

---

## c. Diseño conceptual

> **Fuente del ER:** `docs/diagrams/ER_Ecommify.png` (insertar imagen) + `docs/diagrams/ER_Ecommify.drawio` (editable).
> **Fuente de la descripción detallada:** `docs/02_descripcion_entidades.md` (incluir contenido completo).

### Declaración explícita sobre el ER respecto a U1

El diagrama ER de Ecommify para U2 **se replantea desde cero** respecto al ER de U1. Esta decisión tiene justificación técnica precisa: los tipos avanzados nativos de PostgreSQL (JSONB, ARRAY, TSTZRANGE, HSTORE, composite types) que la Formativa de U2 incorporó cambian la forma estructural de varias entidades. Pegar estos tipos sobre el ER 3FN puro de U1 produciría un modelo inconsistente.

**Esto no es ruptura con U1, sino profundización.** El dominio modelado es el mismo (mismo dataset Olist, mismas entidades conceptuales). Lo que cambia es la representación lógica para aprovechar las capacidades nativas de PostgreSQL.

Correcciones específicas respecto a U1:
- `Category` se extrae como tabla aparte con PK propia (en U1 era atributo `product_category_name` dentro de `Product`, lo cual viola 3FN).
- La PK de `Customer` pasa a ser `customer_unique_id`, no `customer_id` (que en Olist es identificador por orden, no por cliente real — confirmado por EDA con ratio 1.03 órdenes por unique_id).
- `Product` incorpora `JSONB`, `TEXT[]`, `HSTORE`, composite type `product_dimensions` justificados por la Formativa.
- Se agregan entidades nuevas: `Promotion` con `TSTZRANGE`, `OrderStatusHistory` como entidad débil de Order para trazabilidad del ciclo de vida.
- `Geolocation` incorpora soporte PostGIS (`GEOGRAPHY(POINT)`).

### Mapeo dataset Olist → entidades U2

> **Tabla completa en `docs/02_descripcion_entidades.md` sección "Mapeo dataset Olist → entidades U2".**

### Inventario de entidades

| Entidad | Propósito | Motor | Notas |
|---|---|---|---|
| Customer | Cliente real del marketplace | PostgreSQL | PK customer_unique_id |
| Order | Cabecera de orden con ciclo de vida | PostgreSQL | Particionada por order_purchase_timestamp |
| OrderItem | Línea de detalle por orden | PostgreSQL | PK compuesta |
| OrderStatusHistory | Trazabilidad del ciclo de vida | PostgreSQL | Entidad débil de Order, alimentada por trigger |
| Payment | Pagos asociados a orden | PostgreSQL | PK compuesta, ACID estricto |
| Product | Catálogo con tipos avanzados | PostgreSQL | Fuente de verdad; tipos JSONB/ARRAY/HSTORE/composite |
| Category | Categoría de producto | PostgreSQL | Corrección de violación 3FN de U1 |
| Seller | Vendedor del marketplace | PostgreSQL | seller_geo con PostGIS |
| Promotion | Promoción con vigencia temporal | PostgreSQL | promotion_period como TSTZRANGE |
| Geolocation | Mapeo zip → coordenadas | PostgreSQL | Read-only; sustenta cálculos de envío |
| Review | Reseña de cliente | MongoDB | Storage primario; FK lógicas a PostgreSQL |

### Restricciones de integridad clave

- FK con `ON DELETE RESTRICT` en relaciones críticas (Product, Seller).
- FK con `ON DELETE CASCADE` en relaciones de composición (Order → OrderItem, Order → Payment, Order → OrderStatusHistory).
- CHECK constraints de negocio: precios y fletes no negativos, scores 1-5, fechas de ciclo de vida coherentes, código de estado en mayúsculas y 2 caracteres, rangos de zip válidos.
- UNIQUE constraints en nombres de categoría.
- Verificación de 3FN entidad por entidad (ver `02_descripcion_entidades.md` última sección).

---

## d. Diseño lógico — Módulo PostgreSQL

> **Fuente:** `postgresql/schema/00_extensions.sql` a `07_materialized_views.sql` (incluir resumen tabla por tabla).

### Resumen del esquema

| Tabla | Propósito | Particularidad técnica |
|---|---|---|
| `category` | Jerarquía de categorías | Autorrelación opcional via `parent_category_id` |
| `customer` | Cliente real | PK `customer_unique_id`; `customer_geo GEOGRAPHY(POINT)` derivado por trigger |
| `seller` | Vendedor | `seller_geo GEOGRAPHY(POINT)` derivado por trigger |
| `product` | Catálogo, fuente de verdad | `JSONB`, `TEXT[]`, `HSTORE`, composite `product_dimensions` |
| `promotion` | Promociones con vigencia | `promotion_period TSTZRANGE`, arrays de targets |
| `"order"` | Órdenes (particionada) | `PARTITION BY RANGE (order_purchase_timestamp)` |
| `order_item` | Detalle de líneas | FK compuesta a `"order"` |
| `payment` | Pagos con PK compuesta | FK compuesta a `"order"`, ENUM `payment_type` |
| `order_status_history` | Trazabilidad ciclo de vida | Alimentada por trigger `log_order_status_change` |
| `geolocation` | Referencia espacial | `GEOGRAPHY(POINT)`, índice GIST |

### Aplicación de tipos avanzados (cruzar con Formativa)

| Tipo | Entidad | Uso |
|---|---|---|
| `JSONB` | `product.product_specifications` | Atributos variables por categoría sin tablas auxiliares |
| `TEXT[]` | `product.product_photos`, `product.product_tags` | URLs e identificadores múltiples |
| `HSTORE` | `product.product_metadata` | Metadata ligera (uso parcial, JSONB cubre el grueso) |
| Composite | `product.dimensions` | Agrupa 4 dimensiones físicas en un solo tipo |
| `TSTZRANGE` | `promotion.promotion_period` | Vigencia temporal indexable con GIST |
| `ENUM` | `order.order_status`, `payment.payment_type` | Dominios cerrados confirmados por EDA |
| `GEOGRAPHY(POINT)` | `customer.customer_geo`, `seller.seller_geo`, `geolocation.geolocation_point` | Cálculo eficiente de distancia |

### Extensiones habilitadas

`postgis`, `pg_trgm`, `pgcrypto`, `hstore`, `btree_gin`.

### Estrategia de particionamiento

`"order"` particionada por `RANGE (order_purchase_timestamp)`:
- **Particiones hot:** mensuales para los últimos 12 meses, donde se concentra la mayor parte del tráfico operativo.
- **Particiones cold:** anuales para histórico, optimizadas para consultas analíticas que barren grandes ventanas.
- **Partición DEFAULT:** captura eventos fuera de rango como red de seguridad.
- **Función de mantenimiento:** `create_monthly_order_partition(year, month)` para crear particiones futuras vía job recurrente.

### Estrategia de índices

- B-tree en FKs y columnas de filtrado frecuente.
- GIN sobre `product_specifications` (JSONB), `product_tags`, `product_photos`.
- GIN con `gin_trgm_ops` sobre `product.name` y `product.description`.
- GIST sobre columnas PostGIS (`customer_geo`, `seller_geo`, `geolocation_point`).
- GIST sobre `promotion.promotion_period` (TSTZRANGE).
- Índice parcial sobre `"order"` filtrado por estados operativos.
- Índices únicos en MVs para permitir REFRESH CONCURRENTLY.

### Triggers

- `update_updated_at_column()` aplicado a `customer`, `seller`, `product`, `"order"`.
- `log_order_status_change()` para alimentar `order_status_history` automáticamente.
- `derive_customer_geo` y `derive_seller_geo` para calcular puntos PostGIS por lookup en `geolocation`.

### Materialized views

| MV | Propósito | Refresh |
|---|---|---|
| `mv_sales_by_category_monthly` | Ventas agregadas por categoría y mes | Diario |
| `mv_customer_segments` | Segmentación RFM-like (VIP, Recurrente, Inactivo, Nuevo) | Semanal |

Refresh con `CONCURRENTLY` para no bloquear lecturas; cada MV tiene un índice único requerido para esta operación.

---

## e. Diseño lógico preliminar — Módulo MongoDB

> **Fuente:** `mongodb/schema/collections.md` (incluir contenido completo).
> **Ejemplos:** `mongodb/schema/product_catalog.json`, `mongodb/schema/reviews.json`, `mongodb/schema/analytics_events.json`.

### Resumen de colecciones

| Colección | Rol | Patrón aplicado |
|---|---|---|
| `product_catalog` | Proyección de lectura del catálogo de PostgreSQL | Extended Reference + Computed |
| `reviews` | Storage primario de reseñas | Polymorphic |
| `analytics_events` | Storage primario de eventos de comportamiento | Bucket |
| `user_sessions` | Sesiones HTTP efímeras | TTL nativo |

### Patrones de modelado aplicados

- **Extended Reference** (en `product_catalog`): embeber atributos frecuentemente usados de `seller` y `category` para evitar joins cross-motor.
- **Computed Pattern** (en `product_catalog`): precalcular `price_current`, `has_active_promotion`, `discount_percentage`, `rating.avg` durante la sincronización.
- **Bucket Pattern** (en `analytics_events`): agrupar N eventos en un documento padre por sesión y hora para reducir overhead.
- **Polymorphic Pattern** (en `reviews`): discriminador `review_type` para soportar reviews de producto y de seller en una sola colección.
- **TTL Indexes** (en `user_sessions` y `analytics_events`): borrado automático de documentos expirados.

### Decisión arquitectónica sobre el catálogo

Por la regla de precedencia (la Formativa de U2 prevalece sobre U1), `Product` con sus tipos avanzados nativos vive en PostgreSQL como **fuente de verdad**. MongoDB `product_catalog` es una **proyección de lectura denormalizada** sincronizada desde PostgreSQL vía CDC (Debezium → Kafka → ETL) o ETL nocturno como fallback en Atlas M0. Esto resuelve la aparente tensión entre la decisión de U1 (catálogo en MongoDB) y la decisión de la Formativa (tipos avanzados de Product en PostgreSQL).

### Ejemplos de documentos

Ver archivos JSON en `mongodb/schema/`.

---

## f. Decisiones arquitectónicas justificadas

> **Fuente:** `docs/03_decisiones_arquitectonicas.md` (flujos de sincronización) + `docs/04_matriz_decision.md` (matriz con análisis CAP). Incluir contenido completo de ambos.

### Decisión 1: Enfoque Políglota Híbrida

Heredado de U1. No re-justificado frente a otras opciones. Lo que esta unidad aporta es la operacionalización: matriz de decisión fila a fila justificando qué entidad va a qué motor, criterios técnicos detrás y posición CAP por módulo.

### Decisión 2: PostgreSQL como fuente de verdad del catálogo

Por la regla de precedencia Formativa > U1: los tipos avanzados nativos de PostgreSQL (JSONB, ARRAY, HSTORE, composite, TSTZRANGE) cubren la flexibilidad necesaria sin perder integridad referencial. MongoDB recibe una proyección de lectura optimizada para frontend.

### Decisión 3: Particionamiento de `order` por fecha

Justificado por el patrón de acceso por rango temporal (consultas operativas tocan últimos meses, consultas analíticas barren histórico) y el volumen proyectado (150k órdenes año 1, +50%/año).

### Decisión 4: Materialized views para OLAP dentro de PostgreSQL

Justificado por las limitaciones de Atlas M0 (no se puede mover analítica masiva a MongoDB) y por la naturaleza de las consultas analíticas (joins con dimensiones, agregaciones estables).

### Decisión 5: Reviews en MongoDB (no PostgreSQL)

Aunque la Formativa lista reviews en su tabla de procesos OLTP, no las incluye en los triggers `updated_at` para PostgreSQL. Esto indica que la Formativa describe el patrón de acceso de las reviews (transaccional, alta escritura) sin pronunciarse sobre su residencia física. Por lo tanto se mantiene la decisión de U1: reviews en MongoDB.

### Flujos de sincronización

> **Detalle en `docs/03_decisiones_arquitectonicas.md` sección 3.** Resumen:

- **PostgreSQL → MongoDB (`product_catalog`):** CDC primario; ETL nocturno fallback. Idempotente, ordenado por `updated_at`.
- **MongoDB → PostgreSQL (`reviews` agregadas):** ETL nocturno para alimentar MV `mv_seller_rating`.

### Análisis CAP por módulo

| Módulo | Motor | CAP |
|---|---|---|
| Pagos | PostgreSQL | CP |
| Órdenes | PostgreSQL | CP |
| Catálogo (fuente) | PostgreSQL | CP |
| Catálogo (proyección) | MongoDB | AP |
| Reviews | MongoDB | AP |
| Analytics events | MongoDB | AP |
| User sessions | MongoDB | AP |

### Diagrama de arquitectura

> **Insertar imagen:** `docs/diagrams/arquitectura_hibrida.png`.

---

## g. Anexos

### g.1 EDA del dataset Olist

> **Fuente:** `notebooks/Data_Exploration_Analysis.ipynb` (referenciar; el notebook completo con gráficos va como anexo separado o se incluyen las figuras clave).

Hallazgos clave del EDA que sustentan el diseño:
- 96k clientes únicos (`customer_unique_id`) con ratio de 1.03 órdenes/cliente.
- 99k órdenes en ~2 años de datos, con crecimiento mensual sostenido.
- 71 categorías cubriendo 33k productos (alta redundancia, justifica extraer `Category`).
- 100k reviews con 1:N hacia Order (justifica relación 1:N, no 1:1 como podría asumirse).
- Distribución geográfica concentrada en SP (>40% de clientes y sellers).
- Outliers de precio y flete legítimos (productos premium, envíos cross-country).
- Review score correlacionado inversamente con tiempo de entrega.

### g.2 Diccionario de datos

Por brevedad, el diccionario completo vive en `docs/02_descripcion_entidades.md`. Resumen de PKs:

| Entidad | PK | Tipo |
|---|---|---|
| Customer | customer_unique_id | VARCHAR |
| Order | (order_id, order_purchase_timestamp) | VARCHAR + TIMESTAMPTZ |
| OrderItem | (order_id, order_item_id, order_purchase_timestamp) | VARCHAR + INT + TIMESTAMPTZ |
| Payment | (order_id, payment_sequential, order_purchase_timestamp) | VARCHAR + INT + TIMESTAMPTZ |
| Product | product_id | VARCHAR |
| Seller | seller_id | VARCHAR |
| Category | category_id | SERIAL |
| Promotion | promotion_id | UUID |
| OrderStatusHistory | history_id | BIGSERIAL |
| Review (MongoDB) | review_id | UUID |

### g.3 Scripts SQL preliminares

Ver `postgresql/schema/`:
- `00_extensions.sql`
- `01_types.sql`
- `02_tables.sql`
- `03_partitions.sql`
- `04_indexes.sql`
- `05_constraints.sql`
- `06_triggers.sql`
- `07_materialized_views.sql`

Y consultas de ejemplo en `postgresql/queries/ejemplos_consultas.sql`.

### g.4 Esquemas MongoDB

Ver `mongodb/schema/`:
- `collections.md`
- `product_catalog.json`
- `reviews.json`
- `analytics_events.json`

### g.5 Referencias bibliográficas

> Para maquetar en formato APA 7 (responsabilidad de Fernando y Luis durante la consolidación final).

- PostgreSQL Global Development Group. (2025). *Data types*. PostgreSQL 16 Documentation. https://www.postgresql.org/docs/16/datatype.html
- PostgreSQL Global Development Group. (2025). *Database design*. PostgreSQL 16 Documentation. https://www.postgresql.org/docs/16/ddl.html
- PostgreSQL Global Development Group. (2025). *Concurrency Control (MVCC)*. https://www.postgresql.org/docs/16/mvcc.html
- PostgreSQL Global Development Group. (2025). *Write-Ahead Logging (WAL)*. https://www.postgresql.org/docs/16/wal.html
- PostgreSQL Global Development Group. (2025). *Table Partitioning*. https://www.postgresql.org/docs/16/ddl-partitioning.html
- PostgreSQL Global Development Group. (2025). *JSON Types*. https://www.postgresql.org/docs/16/datatype-json.html
- PostgreSQL Global Development Group. (2025). *Range Types*. https://www.postgresql.org/docs/16/rangetypes.html
- PostgreSQL Global Development Group. (2025). *pg_trgm*. https://www.postgresql.org/docs/16/pgtrgm.html
- PostGIS Project. (2025). *PostGIS Documentation*. https://postgis.net/documentation/
- MongoDB, Inc. (2025). *Data modeling introduction*. MongoDB Manual. https://www.mongodb.com/docs/manual/core/data-modeling-introduction/
- MongoDB, Inc. (2025). *Write Concern*. https://www.mongodb.com/docs/manual/reference/write-concern/
- MongoDB, Inc. (2025). *Read Preference*. https://www.mongodb.com/docs/manual/core/read-preference/
- MongoDB, Inc. (2025). *TTL Indexes*. https://www.mongodb.com/docs/manual/core/index-ttl/
- Bradshaw, S., Brazil, E., & Chodorow, K. (2019). *MongoDB: The definitive guide* (3rd ed.). O'Reilly Media.
- Brewer, E. (2012). CAP twelve years later: How the "rules" have changed. *IEEE Computer*, 45(2), 23-29.
- Gilbert, S., & Lynch, N. (2002). Brewer's conjecture and the feasibility of consistent, available, partition-tolerant web services. *ACM SIGACT News*, 33(2), 51-59.

---

## Notas para mis compañeros (Fernando y Luis)

### Lo que está listo y revisado

- Estructura del repositorio.
- README raíz.
- Notebook de EDA con 27 celdas en 8 secciones, listo para ejecutarse en Colab con el dataset Olist.
- 4 documentos markdown principales (`01_analisis_requisitos.md`, `02_descripcion_entidades.md`, `03_decisiones_arquitectonicas.md`, `04_matriz_decision.md`).
- ER en `.drawio` (editable) y `.png` (exportado con Graphviz como render preliminar).
- Diagrama de arquitectura híbrida en `.drawio` y `.png`.
- 8 scripts SQL numerados (extensiones, tipos, tablas, particiones, índices, constraints, triggers, materialized views).
- Ejemplos de consultas SQL que aprovechan los tipos avanzados.
- 4 archivos MongoDB (descripción + 3 ejemplos JSON).
- Este borrador del documento técnico.

### Lo que es placeholder (requiere su mano)

- Portada formal con logo, nombres y fecha.
- Abstract de 200 palabras.
- Maquetación APA 7 del documento final como PDF.
- Inserción de imágenes en el flujo del PDF (ER, arquitectura, gráficos del EDA).
- Presentación ejecutiva (`Presentacion_Ejecutiva.pdf`).

### Lo que requiere validación de ustedes

- Los scripts SQL los validé sintácticamente con análisis manual, pero **no** los ejecuté contra Supabase real. Al desplegarlos, vigilar:
  - Que las extensiones `postgis`, `pg_trgm`, `pgcrypto`, `hstore`, `btree_gin` estén disponibles en el plan free de Supabase. Si alguna no lo está, ajustar.
  - Que las particiones de `order` cubran el rango temporal de los datos a cargar.
  - El refresh inicial de las MVs después de cargar datos.
- El layout del ER se puede mejorar manualmente abriendo `ER_Ecommify.drawio` en draw.io y reorganizando las entidades para que las líneas no crucen. El PNG actual se generó con Graphviz como respaldo.

### Lo que les recomiendo enriquecer

- Si tienen tiempo: ejecutar el notebook con el dataset y agregar capturas de los gráficos al PDF para subir la calidad visual del EDA (objetivo: "Excelente" en el criterio de 1.0 puntos de la rúbrica).
- Si tienen tiempo: agregar 2 o 3 ejemplos extra a `ejemplos_consultas.sql` con explicaciones inline para usarlos como muestras en la presentación ejecutiva.
- Sugerencia para la presentación ejecutiva: estructura en 5 bloques — (1) qué es Ecommify y por qué híbrida, (2) ER y entidades clave, (3) PostgreSQL con tipos avanzados, (4) MongoDB como complemento, (5) matriz CAP y conclusión.

### Decisión clave que documento explícitamente

El ER se replantea desde cero respecto a U1 por incorporación de tipos avanzados nativos. **No es ruptura con U1, es profundización.** Esta declaración aparece en `docs/02_descripcion_entidades.md` y en este documento (sección c). Es importante que la presentación ejecutiva no transmita "rehicimos todo" sino "consolidamos U1 y U2 con criterio técnico".
