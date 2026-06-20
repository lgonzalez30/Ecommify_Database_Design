const database = db.getSiblingDB("ecommify_bench");

database.createCollection("product_catalog");
database.createCollection("analytics_events");
database.createCollection("checkout_projection");

database.product_catalog.createIndex({ product_id: 1 }, { unique: true });
database.product_catalog.createIndex({ category: 1, price: 1 });
database.product_catalog.createIndex({ name: "text" });
database.analytics_events.createIndex({ bucket_id: 1 }, { unique: true });
database.analytics_events.createIndex({ bucket_minute: -1, event_type: 1 });
database.checkout_projection.createIndex({ order_id: 1 }, { unique: true });

const categories = ["electronics", "home", "sports", "books", "fashion"];
let batch = [];
for (let i = 1; i <= 5000; i += 1) {
  batch.push({
    product_id: i,
    category: categories[i % categories.length],
    name: `Producto ${i}`,
    price: Number((10 + ((i * 37) % 99000) / 100).toFixed(2)),
    stock: 1000,
    rating: { average: 3 + (i % 20) / 10, count: 10 + (i % 500) },
    tags: [categories[i % categories.length], `tag-${i % 20}`]
  });
  if (batch.length === 1000) {
    database.product_catalog.insertMany(batch);
    batch = [];
  }
}
if (batch.length) database.product_catalog.insertMany(batch);

batch = [];
for (let i = 1; i <= 10000; i += 1) {
  const bucketMinute = new Date(Date.UTC(2025, 0, 1, 0, i % 60));
  batch.push({
    bucket_id: `seed-${i}`,
    session_id: `seed-session-${i % 1000}`,
    bucket_minute: bucketMinute,
    event_type: ["view", "search", "add_to_cart", "checkout"][i % 4],
    event_count: 10
  });
  if (batch.length === 1000) {
    database.analytics_events.insertMany(batch);
    batch = [];
  }
}
if (batch.length) database.analytics_events.insertMany(batch);

print("MongoDB benchmark inicializado: 5.000 productos y 100.000 eventos representados en 10.000 buckets.");

