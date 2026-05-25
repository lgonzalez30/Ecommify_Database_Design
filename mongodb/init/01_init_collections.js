// =============================================================================
// 01_init_collections.js — Inicializacion local del modulo MongoDB de Ecommify
// =============================================================================
// Se ejecuta automaticamente dentro del contenedor oficial de MongoDB cuando
// /data/db esta vacio. Crea usuarios de aplicacion, colecciones con validadores,
// indices y datos mock para probar el esquema NoSQL.
// =============================================================================

const appDb = db.getSiblingDB("ecommify");

appDb.createUser({
  user: "ecommify_app",
  pwd: "AppMongoPass2026!",
  roles: [{ role: "readWrite", db: "ecommify" }],
});

const validationAction = "warn";

function recreateCollection(name, validator) {
  if (appDb.getCollectionNames().includes(name)) {
    return;
  }

  appDb.createCollection(name, {
    validator,
    validationLevel: "moderate",
    validationAction,
  });
}

recreateCollection("product_catalog", {
  $jsonSchema: {
    bsonType: "object",
    required: ["product_id", "sku", "name", "category", "seller", "base_price", "price_current", "synced_at", "source_updated_at"],
    properties: {
      product_id: { bsonType: "string" },
      sku: { bsonType: "string" },
      name: { bsonType: "string" },
      description: { bsonType: ["string", "null"] },
      category: {
        bsonType: "object",
        required: ["id", "name"],
        properties: {
          id: { bsonType: "int" },
          name: { bsonType: "string" },
          name_english: { bsonType: ["string", "null"] },
        },
      },
      seller: {
        bsonType: "object",
        required: ["id", "city", "state"],
        properties: {
          id: { bsonType: "string" },
          name: { bsonType: ["string", "null"] },
          city: { bsonType: "string" },
          state: { bsonType: "string" },
          rating: { bsonType: ["double", "int", "null"], minimum: 0, maximum: 5 },
        },
      },
      specifications: { bsonType: ["object", "null"] },
      images: { bsonType: ["array", "null"], items: { bsonType: "string" } },
      tags: { bsonType: ["array", "null"], items: { bsonType: "string" } },
      dimensions: { bsonType: ["object", "null"] },
      base_price: { bsonType: ["double", "int", "decimal"], minimum: 0 },
      price_current: { bsonType: ["double", "int", "decimal"], minimum: 0 },
      has_active_promotion: { bsonType: "bool" },
      discount_percentage: { bsonType: ["double", "int", "null"], minimum: 0, maximum: 100 },
      stock_status: { enum: ["in_stock", "out_of_stock", "preorder", "discontinued"] },
      synced_at: { bsonType: "date" },
      source_updated_at: { bsonType: "date" },
    },
  },
});

recreateCollection("reviews", {
  $jsonSchema: {
    bsonType: "object",
    required: ["review_id", "review_type", "order_id", "customer_unique_id", "score", "created_at"],
    properties: {
      review_id: { bsonType: "string" },
      review_type: { enum: ["product", "seller"] },
      order_id: { bsonType: "string" },
      product_id: { bsonType: ["string", "null"] },
      seller_id: { bsonType: ["string", "null"] },
      customer_unique_id: { bsonType: "string" },
      score: { bsonType: "int", minimum: 1, maximum: 5 },
      title: { bsonType: ["string", "null"] },
      message: { bsonType: ["string", "null"] },
      tags_auto: { bsonType: ["array", "null"], items: { bsonType: "string" } },
      language: { bsonType: ["string", "null"] },
      created_at: { bsonType: "date" },
      answered_at: { bsonType: ["date", "null"] },
      seller_response: { bsonType: ["object", "null"] },
    },
  },
});

recreateCollection("analytics_events", {
  $jsonSchema: {
    bsonType: "object",
    required: ["session_id", "bucket_hour", "event_count", "events", "expires_at"],
    properties: {
      session_id: { bsonType: "string" },
      customer_unique_id: { bsonType: ["string", "null"] },
      bucket_hour: { bsonType: "date" },
      event_count: { bsonType: "int", minimum: 0 },
      events: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["type", "ts"],
          properties: {
            type: { bsonType: "string" },
            ts: { bsonType: "date" },
          },
        },
      },
      expires_at: { bsonType: "date" },
    },
  },
});

recreateCollection("user_sessions", {
  $jsonSchema: {
    bsonType: "object",
    required: ["_id", "started_at", "last_activity_at", "expires_at"],
    properties: {
      _id: { bsonType: "string" },
      customer_unique_id: { bsonType: ["string", "null"] },
      started_at: { bsonType: "date" },
      last_activity_at: { bsonType: "date" },
      expires_at: { bsonType: "date" },
      ip_hash: { bsonType: ["string", "null"] },
      user_agent: { bsonType: ["string", "null"] },
      device: { bsonType: ["object", "null"] },
      cart: { bsonType: ["array", "null"] },
    },
  },
});

appDb.product_catalog.createIndex({ product_id: 1 }, { unique: true });
appDb.product_catalog.createIndex({ "category.id": 1 });
appDb.product_catalog.createIndex({ "seller.id": 1 });
appDb.product_catalog.createIndex({ tags: 1 });
appDb.product_catalog.createIndex({ name: "text", description: "text" });

appDb.reviews.createIndex({ review_id: 1 }, { unique: true });
appDb.reviews.createIndex({ product_id: 1, score: -1 });
appDb.reviews.createIndex({ seller_id: 1, score: -1 });
appDb.reviews.createIndex({ order_id: 1 });
appDb.reviews.createIndex({ created_at: -1 });

appDb.analytics_events.createIndex({ session_id: 1, bucket_hour: 1 }, { unique: true });
appDb.analytics_events.createIndex({ customer_unique_id: 1, bucket_hour: -1 });
appDb.analytics_events.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });

appDb.user_sessions.createIndex({ customer_unique_id: 1, last_activity_at: -1 });
appDb.user_sessions.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });

const now = new Date();
const in180Days = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
const bucketHour = new Date(now);
bucketHour.setMinutes(0, 0, 0);

appDb.product_catalog.updateOne(
  { product_id: "PROD-101" },
  {
    $set: {
      product_id: "PROD-101",
      sku: "PROD-101",
      name: "Cafetera Expresso Italiana",
      description: "Cafetera clasica de aluminio 6 tazas.",
      category: { id: 2, name: "Casa e Cozinha", name_english: "home_appliances" },
      seller: { id: "SELLER_XYZ", name: "Seller Demo", city: "Rio de Janeiro", state: "RJ", rating: 4.7 },
      specifications: { color: "plata", capacity_cups: 6, material: "aluminio" },
      images: ["img/cafe1.jpg", "img/cafe2.jpg"],
      tags: ["cocina", "hogar", "cafe"],
      dimensions: { length_cm: 15, height_cm: 20, width_cm: 10, weight_g: 450 },
      base_price: 120.5,
      price_current: 96.4,
      has_active_promotion: true,
      discount_percentage: 20,
      stock_status: "in_stock",
      synced_at: now,
      source_updated_at: now,
    },
  },
  { upsert: true }
);

appDb.reviews.updateOne(
  { review_id: "REV-001" },
  {
    $set: {
      review_id: "REV-001",
      review_type: "product",
      order_id: "ORD-999",
      product_id: "PROD-101",
      seller_id: "SELLER_XYZ",
      customer_unique_id: "CUST_ABC",
      score: 5,
      title: "Excelente",
      message: "Entrega rapida y producto en buen estado.",
      tags_auto: ["envio_rapido", "calidad"],
      language: "es",
      created_at: now,
      answered_at: null,
      seller_response: null,
    },
  },
  { upsert: true }
);

appDb.analytics_events.updateOne(
  { session_id: "sess_demo", bucket_hour },
  {
    $set: {
      session_id: "sess_demo",
      customer_unique_id: "CUST_ABC",
      bucket_hour,
      event_count: 3,
      events: [
        { type: "page_view", path: "/p/PROD-101", ts: now },
        { type: "search", query: "cafetera italiana", ts: now },
        { type: "add_to_cart", product_id: "PROD-101", qty: 1, ts: now },
      ],
      expires_at: in180Days,
    },
  },
  { upsert: true }
);

appDb.user_sessions.updateOne(
  { _id: "sess_demo" },
  {
    $set: {
      _id: "sess_demo",
      customer_unique_id: "CUST_ABC",
      started_at: now,
      last_activity_at: now,
      expires_at: in30Days,
      ip_hash: "sha256-demo",
      user_agent: "Mozilla/5.0 demo",
      device: { type: "desktop", os: "macOS", browser: "Chrome" },
      cart: [{ product_id: "PROD-101", qty: 1, price_snapshot: 96.4 }],
    },
  },
  { upsert: true }
);

print("MongoDB inicializado: ecommify_app, colecciones, validadores, indices y datos mock.");
