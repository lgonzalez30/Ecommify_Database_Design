// =============================================================================
// validation_queries.js — Consultas de validacion del modulo MongoDB
// =============================================================================
// Ejecutar con:
// docker exec -i ecommify_mongodb_local mongosh \
//   "mongodb://ecommify_app:AppMongoPass2026!@localhost:27017/ecommify" \
//   < mongodb/queries/validation_queries.js
// =============================================================================

print("== Ping ==");
printjson(db.runCommand({ ping: 1 }));

print("\n== Colecciones ==");
printjson(db.getCollectionNames().sort());

print("\n== Conteos ==");
printjson({
  product_catalog: db.product_catalog.countDocuments(),
  reviews: db.reviews.countDocuments(),
  analytics_events: db.analytics_events.countDocuments(),
  user_sessions: db.user_sessions.countDocuments(),
});

print("\n== Indices product_catalog ==");
printjson(db.product_catalog.getIndexes().map((idx) => ({ name: idx.name, key: idx.key, unique: idx.unique || false })));

print("\n== Indices reviews ==");
printjson(db.reviews.getIndexes().map((idx) => ({ name: idx.name, key: idx.key, unique: idx.unique || false })));

print("\n== Indices analytics_events ==");
printjson(db.analytics_events.getIndexes().map((idx) => ({
  name: idx.name,
  key: idx.key,
  unique: idx.unique || false,
  expireAfterSeconds: idx.expireAfterSeconds,
})));

print("\n== Indices user_sessions ==");
printjson(db.user_sessions.getIndexes().map((idx) => ({
  name: idx.name,
  key: idx.key,
  expireAfterSeconds: idx.expireAfterSeconds,
})));

print("\n== Catalogo con promocion activa ==");
db.product_catalog
  .find(
    { has_active_promotion: true },
    { _id: 0, product_id: 1, name: 1, price_current: 1, discount_percentage: 1 }
  )
  .forEach(printjson);

print("\n== Busqueda de texto ==");
db.product_catalog
  .find(
    { $text: { $search: "cafetera italiana" } },
    { _id: 0, product_id: 1, name: 1, score: { $meta: "textScore" } }
  )
  .sort({ score: { $meta: "textScore" } })
  .forEach(printjson);

print("\n== Reviews por producto ==");
db.reviews
  .find(
    { product_id: "PROD-101" },
    { _id: 0, review_id: 1, score: 1, title: 1, created_at: 1 }
  )
  .sort({ score: -1 })
  .forEach(printjson);

print("\n== Eventos por sesion ==");
db.analytics_events
  .find(
    { session_id: "sess_demo" },
    { _id: 0, bucket_hour: 1, event_count: 1, "events.type": 1 }
  )
  .forEach(printjson);

print("\n== Sesion activa ==");
db.user_sessions
  .find(
    { _id: "sess_demo" },
    { _id: 1, customer_unique_id: 1, last_activity_at: 1, expires_at: 1, cart: 1 }
  )
  .forEach(printjson);
