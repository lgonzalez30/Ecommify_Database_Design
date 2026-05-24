# 03 — Decisiones arquitectónicas

## 1. Enfoque arquitectónico

Ecommify implementa una **Arquitectura Políglota Híbrida** (Opción 3 del catálogo de enfoques de Unidad 1). Esta decisión fue tomada y justificada en U1 sobre la base del análisis del dataset Olist, que presenta dos tipos de datos claramente diferenciados:

- Datos estructurados con requisitos transaccionales (órdenes, pagos, clientes, vendedores).
- Datos semi-estructurados con requisitos de lectura intensa y flexibilidad de esquema (catálogo de productos enriquecido, reseñas, comportamiento de usuarios).

En U2 esta decisión se mantiene como invariante y se profundiza en su operacionalización. El presente documento explica cómo conviven PostgreSQL y MongoDB en Ecommify y bajo qué reglas se sincronizan.

## 2. Asignación PostgreSQL vs MongoDB

La asignación de entidades a motor se rige por la regla de precedencia documentada en el plan: la Formativa de U2 (Andrés Camilo) prevalece sobre U1 cuando hay divergencia; donde la Formativa no se pronuncia, U1 manda. Resultado:

### 2.1 PostgreSQL — núcleo transaccional y analítico

PostgreSQL es la **fuente de verdad** para todas las entidades estructuradas:

- `customer` con identidad estable por `customer_unique_id`.
- `order` particionada por fecha, `order_item`, `order_status_history`.
- `payment` con garantías ACID estrictas.
- `product` con tipos avanzados nativos: `JSONB` para `product_specifications`, `TEXT[]` para `product_photos` y `product_tags`, `HSTORE` para `product_metadata`, composite type `product_dimensions`.
- `category`, `seller`, `promotion` (con `TSTZRANGE`).
- `geolocation` con `GEOGRAPHY(POINT)` y extensión PostGIS.
- Materialized views `mv_sales_by_category_monthly` y `mv_customer_segments` para OLAP.

PostgreSQL cumple con los requisitos no funcionales de consistencia (ACID), latencia transaccional (<100ms) y escalabilidad acotada por particionamiento.

### 2.2 MongoDB — proyección de lectura y storage de datos NoSQL

MongoDB cumple tres roles complementarios, **no de fuente única**:

| Colección | Rol | Fuente |
|---|---|---|
| `product_catalog` | Proyección de lectura denormalizada para frontend | Sincronizada desde PostgreSQL |
| `reviews` | Storage primario | Escrituras directas; FK lógicas a PostgreSQL |
| `analytics_events` | Storage primario, append-only | Escrituras directas desde frontend/backend |
| `user_sessions` | Storage primario, efímero con TTL | Escrituras directas |

MongoDB asume consistencia eventual respecto a PostgreSQL en `product_catalog`, lo cual es aceptable por el patrón de uso (catálogo se lee miles de veces por cada actualización).

## 3. Flujos de sincronización PostgreSQL → MongoDB

### 3.1 Sincronización del catálogo (`product_catalog`)

**Estrategia primaria — CDC (Change Data Capture):**

```
┌──────────────┐       ┌─────────────┐       ┌──────────────────┐
│  PostgreSQL  │──WAL──▶   Debezium  │──────▶│ Kafka / Buffer   │
│  (product,   │       │  Connector  │       │                  │
│  category,   │       └─────────────┘       └────────┬─────────┘
│  seller,     │                                       │
│  promotion)  │                              ┌────────▼─────────┐
└──────────────┘                              │ ETL Transformer  │
                                              │ (denormaliza,    │
                                              │  enriquece,      │
                                              │  computa precio) │
                                              └────────┬─────────┘
                                                       │
                                              ┌────────▼─────────┐
                                              │  MongoDB Atlas   │
                                              │ product_catalog  │
                                              └──────────────────┘
```

**Estrategia fallback — ETL por lotes:**

En el entorno académico (MongoDB Atlas M0 sin replica set completo), se opta por un ETL nocturno por lotes que:

1. Lee `product` modificado desde PostgreSQL filtrando por `updated_at >= last_sync_timestamp`.
2. Enriquece embebiendo datos de `category`, `seller`, calcula precio actual cruzando con `promotion`, calcula `rating.avg` cruzando con la colección `reviews`.
3. Hace `bulkWrite` con `upsert` sobre `product_catalog`.

Cadencia: cada 6 horas para datos de catálogo; diario para datos derivados (rating, segmentos).

**Garantías:**

- **Idempotencia:** las escrituras usan `upsert` por `product_id` (índice único en MongoDB). Una misma operación aplicada múltiples veces produce el mismo resultado.
- **Orden:** se procesan eventos en orden de `updated_at` para evitar overwrites de datos más nuevos con datos más viejos. Comparación de timestamp antes del upsert (`source_updated_at` debe ser más reciente que el almacenado).
- **Manejo de errores:** los eventos fallidos van a una dead-letter queue para reintento. Después de 3 reintentos se alertan.

### 3.2 Sincronización inversa MongoDB → PostgreSQL

Las `reviews` se almacenan en MongoDB pero se agregan en PostgreSQL para alimentar `mv_seller_rating`. Flujo:

1. ETL nocturno consulta `reviews` en MongoDB filtrando por `created_at >= last_sync_timestamp`.
2. Agrega por `seller_id` y `product_id`: avg(score), count, distribución.
3. Inserta/actualiza en tabla `seller_rating_cache` en PostgreSQL.
4. Refresh de la MV `mv_customer_segments` aprovecha estos datos agregados.

### 3.3 Datos sin sincronización cross-motor

- `analytics_events` y `user_sessions` viven solo en MongoDB. No tienen contraparte en PostgreSQL.
- Para reportes analíticos sobre comportamiento, se hace un ETL diario que extrae métricas agregadas de MongoDB y las deposita en una MV de PostgreSQL `mv_user_behavior_daily` (fuera del alcance de la Etapa 2).

## 4. Trade-offs aceptados

### 4.1 Consistencia eventual del catálogo

Un producto modificado en PostgreSQL (cambio de precio, agregar imagen) tarda minutos en reflejarse en `product_catalog` de MongoDB. Aceptable porque:

- El frontend lee de MongoDB con un disclaimer implícito de "precio sujeto a verificación al checkout".
- El checkout (donde la decisión de compra se materializa) valida precio contra PostgreSQL, no MongoDB.
- Las promociones con `TSTZRANGE` se validan en tiempo real contra PostgreSQL al crear la orden.

### 4.2 Sin enforcement referencial cross-motor

`reviews.order_id` y `reviews.product_id` son referencias lógicas. MongoDB no garantiza que el `order_id` apuntado exista en PostgreSQL. Mitigación:

- La capa de aplicación valida la existencia del `order_id` en PostgreSQL antes de aceptar una review.
- ETL nocturno detecta reviews huérfanas (referencias rotas) y las marca como tales para limpieza.

### 4.3 Costo operativo de mantener dos motores

Implica dos esquemas, dos lenguajes de query, dos estrategias de backup, dos sets de credenciales. Aceptable porque:

- El beneficio (latencia de catálogo, throughput de eventos) supera el costo en este patrón de uso.
- La Formativa de U2 confirma que la mayoría de la complejidad del modelo se concentra en PostgreSQL (donde los tipos avanzados nativos compensan); MongoDB queda con responsabilidades acotadas.

## 5. Análisis CAP por módulo

| Módulo | Motor | Posición CAP | Justificación |
|---|---|---|---|
| Órdenes y pagos | PostgreSQL | CP | Sacrificio momentáneo de A ante particiones; consistencia ACID es innegociable en transacciones de dinero. |
| Catálogo (fuente de verdad) | PostgreSQL | CP | Mismo principio: cambios en `product` deben ser consistentes con `order_item` (FK). |
| Catálogo (proyección lectura) | MongoDB | AP | Disponibilidad y tolerancia a particiones priorizadas; lag aceptable. |
| Reviews | MongoDB | AP | Una review tarde no es crítica; el sistema debe seguir aceptando escrituras. |
| Analytics events | MongoDB | AP | Pérdida de eventos individuales es tolerable estadísticamente; el throughput es prioritario. |
| User sessions | MongoDB | AP | Sesiones son efímeras; perder una sesión por particionamiento es recoverable. |

Detalle ampliado de este análisis en `04_matriz_decision.md`.

## 6. Estrategia de mantenimiento de PostgreSQL

Heredada de la Formativa de Andrés Camilo:

- **VACUUM diario** en ventana de bajo tráfico (03:00 UTC).
- **REFRESH MATERIALIZED VIEW CONCURRENTLY** diario para `mv_sales_by_category_monthly`; semanal para `mv_customer_segments`.
- **Creación mensual de nuevas particiones** vía la función `create_monthly_order_partition(year, month)` ejecutada por job de mantenimiento (recomendado `pg_cron`).
- **Archivado de particiones cold** (más de 24 meses) a almacenamiento externo. Se mantiene como partición DETACHed para consultas analíticas ocasionales.

## 7. Diagrama de arquitectura

Ver `docs/diagrams/arquitectura_hibrida.drawio` (editable) y `docs/diagrams/arquitectura_hibrida.png` (exportado).

## 8. Resumen de la decisión

La arquitectura híbrida de Ecommify se justifica porque:

1. **Naturaleza dual de los datos.** El dataset presenta entidades estructuradas con relaciones críticas y entidades semi-estructuradas con flexibilidad necesaria.
2. **Patrones de acceso heterogéneos.** OLTP transaccional convive con catálogo de lectura intensa y eventos de alto throughput.
3. **Requisitos no funcionales diferenciados.** Algunos módulos exigen ACID, otros aceptan consistencia eventual a cambio de latencia y disponibilidad.
4. **Aprovechamiento óptimo de cada motor.** PostgreSQL con tipos avanzados nativos cubre la mayoría de necesidades del módulo transaccional. MongoDB complementa donde PostgreSQL pierde eficiencia (denormalización profunda, eventos append-only, sesiones efímeras).

Esta decisión responde directamente a la pregunta de investigación 5 de Unidad 1: *"¿Cómo diseñar una arquitectura híbrida que balancee consistencia y escalabilidad?"*.
