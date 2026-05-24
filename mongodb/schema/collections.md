# Colecciones MongoDB de Ecommify

Este documento describe el módulo MongoDB de Ecommify. Aplica la decisión arquitectónica heredada de Unidad 1 (Políglota Híbrida) ajustada por la regla de precedencia de la Formativa: PostgreSQL es la fuente de verdad de los datos transaccionales y del catálogo; MongoDB cumple tres roles complementarios.

## 1. Rol de MongoDB en Ecommify

| Rol | Colección | Razón |
|---|---|---|
| Proyección de lectura | `product_catalog` | PostgreSQL es la fuente de verdad de `Product`. MongoDB recibe una copia denormalizada y enriquecida (seller, category, imágenes embebidas) para servir consultas de frontend con baja latencia. Sincronización vía CDC/ETL desde PostgreSQL. |
| Storage primario | `reviews` | Alto volumen de escritura, contenido semi-estructurado, consistencia eventual aceptable. Referencias lógicas a PostgreSQL (`order_id`, `product_id`) sin enforcement por motor. |
| Storage primario | `analytics_events` | Logs de comportamiento del usuario (vistas de producto, clics, búsquedas). Append-only, alto throughput. |
| Storage primario | `user_sessions` | Sesiones efímeras con TTL nativo de MongoDB. No requiere joins ni relaciones. |

## 2. Patrones de modelado aplicados

### 2.1 Extended Reference

Aplicado en `product_catalog` para los campos `seller` y `category`. En lugar de almacenar solo el `seller_id` (que obligaría a un join contra PostgreSQL), se embeben los atributos más usados en el frontend: `id`, `name`, `rating` para seller; `id`, `name`, `name_english` para category. Cuando estos atributos cambian en PostgreSQL, la sincronización los actualiza en MongoDB.

**Trade-off:** mayor tamaño del documento a cambio de evitar lookups cross-motor. Justificado porque las consultas de frontend que listan productos no toleran latencia de joins.

### 2.2 Computed Pattern

Aplicado en `product_catalog` para el campo `price_current` y atributos derivados (`has_active_promotion`, `discount_percentage`). En lugar de calcular el precio efectivo en tiempo de lectura cruzando `Product` con `Promotion`, se precalcula durante la sincronización y se almacena directamente. Reduce latencia de queries.

### 2.3 Bucket Pattern

Aplicado en `analytics_events` agrupando eventos por sesión y hora. En lugar de un documento por evento (millones de documentos pequeños), se bucketean N eventos por documento padre. Reduce overhead de almacenamiento y mejora throughput de escritura.

### 2.4 Polymorphic Pattern

Aplicado en `reviews` para soportar reviews de producto y reviews de seller en la misma colección. Discriminador: campo `review_type` con valores `"product"` o `"seller"`. Atributos específicos se embeben según el tipo.

## 3. Detalle de las colecciones

### 3.1 `product_catalog`

**Rol:** proyección de lectura denormalizada del catálogo. Optimizada para frontend.

**Sincronización:** CDC desde PostgreSQL (o ETL nocturno como fallback en Atlas M0 sin Change Streams).

**Estructura general:**

```json
{
  "_id": ObjectId(...),
  "product_id": "PRD-00123",
  "sku": "PRD-00123",
  "name": "...",
  "description": "...",
  "category": { "id": 4, "name": "...", "name_english": "..." },
  "seller": { "id": "slr_042", "name": "...", "city": "...", "state": "SP", "rating": 4.7 },
  "specifications": { ... },
  "images": ["url1", "url2", ...],
  "tags": ["...", "..."],
  "dimensions": { "length_cm": 12, "height_cm": 8, "width_cm": 6, "weight_g": 480 },
  "base_price": 89000,
  "price_current": 71200,
  "has_active_promotion": true,
  "discount_percentage": 20,
  "stock_status": "in_stock",
  "synced_at": ISODate("..."),
  "source_updated_at": ISODate("...")
}
```

**Índices recomendados:**
- `{ "product_id": 1 }` único.
- `{ "category.id": 1 }` para filtrado por categoría.
- `{ "seller.id": 1 }`.
- `{ "tags": 1 }` multikey.
- Text index sobre `name` y `description` para búsqueda.

### 3.2 `reviews`

**Rol:** storage primario de reseñas. Referencias lógicas a PostgreSQL.

**Estructura general:**

```json
{
  "_id": ObjectId(...),
  "review_id": "rev_abc123",
  "review_type": "product",
  "order_id": "ORD-...",
  "product_id": "PRD-...",
  "customer_unique_id": "CUST-...",
  "score": 5,
  "title": "...",
  "message": "...",
  "tags_auto": ["calidad", "envio_rapido"],
  "language": "pt",
  "created_at": ISODate("..."),
  "answered_at": ISODate("..."),
  "seller_response": { "text": "...", "responded_at": ISODate("...") }
}
```

**Índices recomendados:**
- `{ "review_id": 1 }` único.
- `{ "product_id": 1, "score": -1 }` para listar reviews por producto.
- `{ "order_id": 1 }`.
- `{ "created_at": -1 }` para timeline.

### 3.3 `analytics_events`

**Rol:** logs de comportamiento del usuario, inmutables.

**Estructura con Bucket Pattern:**

```json
{
  "_id": ObjectId(...),
  "session_id": "sess_xyz",
  "customer_unique_id": "CUST-...",
  "bucket_hour": ISODate("2026-05-22T14:00:00Z"),
  "event_count": 47,
  "events": [
    { "type": "page_view", "path": "/p/PRD-001", "ts": ISODate("...") },
    { "type": "search",    "query": "cafetera italiana", "ts": ISODate("...") },
    { "type": "add_to_cart", "product_id": "PRD-001", "qty": 1, "ts": ISODate("...") }
  ]
}
```

**Índices recomendados:**
- `{ "session_id": 1, "bucket_hour": 1 }`.
- `{ "customer_unique_id": 1, "bucket_hour": -1 }`.
- `{ "bucket_hour": 1 }` con TTL de 180 días para limitar crecimiento en Atlas M0.

### 3.4 `user_sessions`

**Rol:** sesiones HTTP del frontend, datos efímeros.

**Estructura general:**

```json
{
  "_id": "sess_xyz",
  "customer_unique_id": "CUST-...",
  "started_at": ISODate("..."),
  "last_activity_at": ISODate("..."),
  "expires_at": ISODate("..."),
  "ip_hash": "...",
  "user_agent": "...",
  "device": { "type": "mobile", "os": "iOS", "browser": "Safari" },
  "cart": [ { "product_id": "PRD-...", "qty": 1, "price_snapshot": 89000 } ]
}
```

**TTL:** índice TTL sobre `expires_at` para borrado automático.

**Índices recomendados:**
- `{ "customer_unique_id": 1, "last_activity_at": -1 }`.
- `{ "expires_at": 1 }` con TTL (`expireAfterSeconds: 0`).

## 4. Flujos de sincronización con PostgreSQL

| Origen | Destino | Tipo | Cadencia |
|---|---|---|---|
| PostgreSQL `product` | MongoDB `product_catalog` | CDC vía Debezium o ETL nocturno | Tiempo real (CDC) o cada 6h (ETL fallback) |
| PostgreSQL `category` | MongoDB `product_catalog` (campo embebido) | ETL re-sync | Diario |
| PostgreSQL `seller` | MongoDB `product_catalog` (campo embebido) | ETL re-sync | Diario |
| PostgreSQL `promotion` | MongoDB `product_catalog` (campos derivados) | ETL nocturno | Diario |
| MongoDB `reviews` | PostgreSQL (agregaciones para MV) | ETL nocturno hacia `mv_seller_rating` | Diario |

Detalle de la sincronización en `docs/03_decisiones_arquitectonicas.md`.

## 5. Limitaciones técnicas

El entorno operativo de la Etapa 2 (MongoDB Atlas M0) impone:

- **512 MB de almacenamiento total.** Implicación: `analytics_events` con TTL agresivo de 180 días. `user_sessions` con TTL de 30 días. `product_catalog` se sincroniza solo con productos activos.
- **Sin sharding.** Implicación: el diseño no asume distribución horizontal de la carga. Para producción se documenta `shard key` candidato en cada colección.
- **Sin Change Streams en M0 sin replica set completo.** Implicación: la sincronización desde PostgreSQL se hará por ETL nocturno como fallback en el entorno académico, no CDC en tiempo real.

## 6. Trade-offs CAP de las colecciones MongoDB

Todas las colecciones MongoDB de Ecommify priorizan **AP** (disponibilidad + tolerancia a particiones) sobre consistencia estricta. Detalle en `docs/04_matriz_decision.md`.
