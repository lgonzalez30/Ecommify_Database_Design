# MongoDB local — prueba del modulo NoSQL

Este directorio contiene la configuracion local para validar el modulo MongoDB de Ecommify. El servicio se levanta desde `docker-compose.yml` y ejecuta automaticamente los scripts de `mongodb/init/` cuando el volumen `mongo_data/` esta vacio.

## Servicio local

Credenciales de desarrollo:

| Campo | Valor |
|---|---|
| Host | `localhost` |
| Puerto | `27017` |
| Base de datos | `ecommify` |
| Usuario root | `admin` |
| Password root | `MongoRootPass2026!` |
| Usuario app | `ecommify_app` |
| Password app | `AppMongoPass2026!` |

URI de aplicacion:

```text
mongodb://ecommify_app:AppMongoPass2026!@localhost:27017/ecommify
```

## Levantar infraestructura

Desde la raiz del repositorio:

```bash
docker compose up -d mongodb
```

Para levantar PostgreSQL y MongoDB juntos:

```bash
docker compose up -d
```

## Validar conexion

```bash
docker exec -it ecommify_mongodb_local mongosh \
  "mongodb://ecommify_app:AppMongoPass2026!@localhost:27017/ecommify"
```

Comandos dentro de `mongosh`:

```javascript
db.runCommand({ ping: 1 })
show collections
db.product_catalog.countDocuments()
db.reviews.countDocuments()
db.analytics_events.countDocuments()
db.user_sessions.countDocuments()
```

Tambien se puede ejecutar el set completo de pruebas:

```bash
docker exec -i ecommify_mongodb_local mongosh \
  "mongodb://ecommify_app:AppMongoPass2026!@localhost:27017/ecommify" \
  < mongodb/queries/validation_queries.js
```

## Validar colecciones e indices

```javascript
db.product_catalog.getIndexes()
db.reviews.getIndexes()
db.analytics_events.getIndexes()
db.user_sessions.getIndexes()
```

Indices esperados:

- `product_catalog`: unico por `product_id`, filtros por categoria/seller/tags y text index sobre `name` + `description`.
- `reviews`: unico por `review_id`, busqueda por producto, seller, orden y timeline.
- `analytics_events`: unico por `session_id + bucket_hour` y TTL por `expires_at`.
- `user_sessions`: busqueda por usuario y TTL por `expires_at`.

## Consultas de prueba

Catalogo con promocion activa:

```javascript
db.product_catalog.find(
  { has_active_promotion: true },
  { _id: 0, product_id: 1, name: 1, price_current: 1, discount_percentage: 1 }
)
```

Busqueda de texto:

```javascript
db.product_catalog.find(
  { $text: { $search: "cafetera italiana" } },
  { _id: 0, product_id: 1, name: 1, score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } })
```

Reviews por producto:

```javascript
db.reviews.find(
  { product_id: "PROD-101" },
  { _id: 0, review_id: 1, score: 1, title: 1, created_at: 1 }
).sort({ score: -1 })
```

Eventos por sesion:

```javascript
db.analytics_events.find(
  { session_id: "sess_demo" },
  { _id: 0, bucket_hour: 1, event_count: 1, "events.type": 1 }
)
```

Sesion activa:

```javascript
db.user_sessions.find(
  { _id: "sess_demo" },
  { _id: 1, customer_unique_id: 1, last_activity_at: 1, expires_at: 1, cart: 1 }
)
```

## Reinicializar MongoDB

El script `mongodb/init/01_init_collections.js` solo corre cuando el volumen esta vacio. Para reiniciar completamente la base local:

```bash
docker compose down
rm -rf mongo_data
docker compose up -d mongodb
```

No versionar `mongo_data/`; esta carpeta queda ignorada por `.gitignore`.
