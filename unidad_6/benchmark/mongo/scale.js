const configurations = {
  M: { products: 20000, buckets: 50000 },
  L: { products: 40000, buckets: 100000 }
};
const level = process.env.SCALE_LEVEL;
const configuration = configurations[level];
if (!configuration) throw new Error(`Escala no válida: ${level}`);

const database = db.getSiblingDB("ecommify_bench");
database.product_catalog.deleteMany({});
database.analytics_events.deleteMany({});
database.checkout_projection.deleteMany({});

const categories = ["electronics", "home", "sports", "books", "fashion"];
let operations = [];
for (let i = 1; i <= configuration.products; i += 1) {
  operations.push({ insertOne: { document: {
    product_id: i,
    category: categories[i % categories.length],
    name: `Producto ${i}`,
    price: Number((10 + ((i * 37) % 99000) / 100).toFixed(2)),
    stock: 1000,
    rating: { average: 3 + (i % 20) / 10, count: 10 + (i % 500) },
    tags: [categories[i % categories.length], `tag-${i % 20}`]
  } } });
  if (operations.length === 2000) {
    database.product_catalog.bulkWrite(operations, { ordered: false });
    operations = [];
  }
}
if (operations.length) database.product_catalog.bulkWrite(operations, { ordered: false });

operations = [];
for (let i = 1; i <= configuration.buckets; i += 1) {
  operations.push({ insertOne: { document: {
    bucket_id: `seed-${level}-${i}`,
    session_id: `seed-session-${i % 10000}`,
    bucket_minute: new Date(Date.UTC(2025, 0, 1, 0, i % 60)),
    event_type: ["view", "search", "add_to_cart", "checkout"][i % 4],
    event_count: 10
  } } });
  if (operations.length === 2000) {
    database.analytics_events.bulkWrite(operations, { ordered: false });
    operations = [];
  }
}
if (operations.length) database.analytics_events.bulkWrite(operations, { ordered: false });

print(`Escala ${level}: ${configuration.products} productos y ${configuration.buckets * 10} eventos representados.`);
