const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const { MongoClient } = require("mongodb");

const port = Number(process.env.PORT || 3000);
const pg = new Pool({ max: 20, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
const mongo = new MongoClient(process.env.MONGO_URL, { maxPoolSize: 20, serverSelectionTimeoutMS: 5_000 });
let mongodb;

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(payload) });
  res.end(payload);
}

async function jsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function numericId(value, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), max) : 1;
}

async function health(res) {
  await Promise.all([pg.query("SELECT 1"), mongodb.command({ ping: 1 })]);
  send(res, 200, { status: "ok", postgres: "ok", mongodb: "ok" });
}

async function catalog(url, res) {
  const category = url.searchParams.get("category") || "electronics";
  const limit = Math.min(numericId(url.searchParams.get("limit") || "20", 100), 100);
  const products = await mongodb.collection("product_catalog")
    .find({ category, stock: { $gt: 0 } }, { projection: { _id: 0 } })
    .sort({ price: 1 })
    .limit(limit)
    .toArray();
  send(res, 200, { count: products.length, products });
}

async function orderDetail(idValue, res) {
  const id = `ord-${String(numericId(idValue, 1_000_000)).padStart(8, "0")}`;
  const result = await pg.query(
    `SELECT o.order_id, o.status, o.created_at, o.customer_id,
            json_agg(json_build_object('product_id', oi.product_id, 'quantity', oi.quantity, 'unit_price', oi.unit_price)) AS items,
            sum(p.amount) AS paid
       FROM orders o
       JOIN order_item oi ON oi.order_id = o.order_id
       JOIN payment p ON p.order_id = o.order_id
      WHERE o.order_id = $1
      GROUP BY o.order_id`,
    [id]
  );
  if (!result.rowCount) return send(res, 404, { error: "order_not_found" });
  send(res, 200, result.rows[0]);
}

async function recordEvent(req, res) {
  const body = await jsonBody(req);
  const sessionId = String(body.session_id || "anonymous").slice(0, 100);
  const eventType = String(body.event_type || "view").slice(0, 50);
  const now = new Date();
  const bucketMinute = new Date(now);
  bucketMinute.setUTCSeconds(0, 0);
  const bucketId = `${sessionId}-${bucketMinute.toISOString()}-${eventType}`;
  await mongodb.collection("analytics_events").updateOne(
    { bucket_id: bucketId },
    {
      $setOnInsert: { bucket_id: bucketId, session_id: sessionId, bucket_minute: bucketMinute, event_type: eventType },
      $inc: { event_count: 1 }
    },
    { upsert: true }
  );
  send(res, 201, { accepted: true, bucket_id: bucketId });
}

async function checkout(req, res) {
  const body = await jsonBody(req);
  const productId = numericId(body.product_id, 100_000);
  const customerId = numericId(body.customer_id, 5000);
  const quantity = Math.min(numericId(body.quantity || 1, 5), 5);
  const orderId = `load-${randomUUID()}`;
  const paymentId = `pay-${randomUUID()}`;
  const eventId = randomUUID();
  const client = await pg.connect();
  let total;
  try {
    await client.query("BEGIN");
    const product = await client.query(
      "UPDATE product SET stock = stock - $1 WHERE product_id = $2 AND stock >= $1 RETURNING base_price",
      [quantity, productId]
    );
    if (!product.rowCount) {
      await client.query("ROLLBACK");
      return send(res, 409, { error: "insufficient_stock" });
    }
    total = Number(product.rows[0].base_price) * quantity;
    await client.query("INSERT INTO orders(order_id, customer_id, status) VALUES ($1,$2,'approved')", [orderId, customerId]);
    await client.query("INSERT INTO order_item(order_id,item_no,product_id,quantity,unit_price) VALUES ($1,1,$2,$3,$4)", [orderId, productId, quantity, product.rows[0].base_price]);
    await client.query("INSERT INTO payment(payment_id,order_id,amount,status) VALUES ($1,$2,$3,'captured')", [paymentId, orderId, total]);
    await client.query(
      "INSERT INTO integration_outbox(event_id,event_type,payload) VALUES ($1,'order_created',$2::jsonb)",
      [eventId, JSON.stringify({ order_id: orderId, product_id: productId, quantity, total })]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  try {
    await Promise.all([
      mongodb.collection("product_catalog").updateOne({ product_id: productId }, { $inc: { stock: -quantity } }),
      mongodb.collection("checkout_projection").updateOne(
        { order_id: orderId },
        { $set: { order_id: orderId, product_id: productId, quantity, total, projected_at: new Date() } },
        { upsert: true }
      )
    ]);
    await pg.query("UPDATE integration_outbox SET processed_at = clock_timestamp() WHERE event_id = $1", [eventId]);
    send(res, 201, { order_id: orderId, total, projection: "synchronized" });
  } catch (error) {
    send(res, 202, { order_id: orderId, total, projection: "pending", event_id: eventId });
  }
}

async function dashboard(res) {
  const [sales, events] = await Promise.all([
    pg.query("SELECT count(*)::int AS orders, coalesce(sum(amount),0)::numeric(14,2) AS revenue FROM payment"),
    mongodb.collection("analytics_events").aggregate([
      { $group: { _id: "$event_type", events: { $sum: "$event_count" } } },
      { $sort: { events: -1 } }
    ]).toArray()
  ]);
  send(res, 200, { sales: sales.rows[0], behavior: events });
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname === "/health") return health(res);
  if (req.method === "GET" && url.pathname === "/catalog") return catalog(url, res);
  if (req.method === "GET" && url.pathname.startsWith("/orders/")) return orderDetail(url.pathname.split("/").pop(), res);
  if (req.method === "POST" && url.pathname === "/events") return recordEvent(req, res);
  if (req.method === "POST" && url.pathname === "/checkout") return checkout(req, res);
  if (req.method === "GET" && url.pathname === "/hybrid/dashboard") return dashboard(res);
  send(res, 404, { error: "not_found" });
}

async function main() {
  await mongo.connect();
  mongodb = mongo.db("ecommify_bench");
  await pg.query("SELECT 1");
  const server = http.createServer((req, res) => {
    route(req, res).catch((error) => {
      console.error(error);
      if (!res.headersSent) send(res, 500, { error: "internal_error" });
      else res.end();
    });
  });
  server.listen(port, "0.0.0.0", () => console.log(`Benchmark API listening on ${port}`));
}

async function shutdown() {
  await Promise.allSettled([pg.end(), mongo.close()]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
main().catch((error) => { console.error(error); process.exit(1); });
