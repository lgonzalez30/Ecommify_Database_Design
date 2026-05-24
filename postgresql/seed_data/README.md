# Seed data — instrucciones de carga

Este directorio está reservado para los archivos CSV o scripts SQL de carga inicial desde el dataset Brazilian E-Commerce de Olist. Por restricciones de tamaño y propiedad del dataset, no se versionan los CSV originales aquí.

## Procedencia del dataset

- **Origen:** [Brazilian E-Commerce by Olist en Kaggle](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce)
- **Archivos esperados (9 CSV):**
  - `olist_customers_dataset.csv`
  - `olist_geolocation_dataset.csv`
  - `olist_order_items_dataset.csv`
  - `olist_order_payments_dataset.csv`
  - `olist_order_reviews_dataset.csv`
  - `olist_orders_dataset.csv`
  - `olist_products_dataset.csv`
  - `olist_sellers_dataset.csv`
  - `product_category_name_translation.csv`

## Orden de carga sugerido

Por dependencias de FK:

1. `geolocation` (sin dependencias).
2. `category` (sin dependencias) — derivada de `product_category_name_translation.csv`.
3. `customer` (sin dependencias respecto a las anteriores). Importante: cargar como `customer_unique_id` distinto, **no** `customer_id`.
4. `seller` (sin dependencias).
5. `product` (depende de `category`).
6. `order` (depende de `customer`). PostgreSQL ruteará a la partición correcta por `order_purchase_timestamp`.
7. `order_item` (depende de `order`, `product`, `seller`).
8. `payment` (depende de `order`).
9. **Reviews → MongoDB**, no PostgreSQL (ver `mongodb/schema/collections.md`).

## Transformaciones a aplicar durante la carga

- **`customer_id` → `customer_unique_id`**: Olist usa `customer_id` por orden. En Ecommify, se usa `customer_unique_id` como PK del cliente real. Para órdenes, hay que mapear `customer_id` de Olist a `customer_unique_id` vía la tabla original `olist_customers_dataset`.
- **`product_category_name`**: insertar en `category` y reemplazar por `category_id` en `product`. Usar `product_category_name_translation.csv` para `category_name_english`.
- **`product_specifications`, `product_photos`, `product_tags`, `product_metadata`, `dimensions`**: el dataset Olist no incluye esta información. Se pueden generar valores sintéticos para fines de demostración o dejar como `NULL`.
- **`promotion`**: el dataset Olist no tiene promociones. Crear un seed de ejemplo con 5 a 10 promociones sintéticas con `TSTZRANGE` válido.
- **`customer_geo` / `seller_geo`**: el trigger `derive_customer_geo` / `derive_seller_geo` los calcula automáticamente vía lookup en `geolocation` después de cargar esa tabla primero.

## Estrategia recomendada

Por las limitaciones de memoria de Supabase free tier y Google Colab, se sugiere cargar los CSV por chunks:

```python
import pandas as pd
from sqlalchemy import create_engine

engine = create_engine("postgresql+psycopg2://USER:PASS@HOST:5432/DB")

# Geolocation primero, por chunks
for chunk in pd.read_csv("olist_geolocation_dataset.csv", chunksize=50_000):
    # transformación: punto geográfico
    chunk["geolocation_point"] = "POINT(" + chunk["geolocation_lng"].astype(str) + " " + chunk["geolocation_lat"].astype(str) + ")"
    chunk.to_sql("geolocation", engine, if_exists="append", index=False)
```

## Post-carga

Después de cargar las tablas transaccionales, ejecutar:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_by_category_monthly;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_segments;
```

Y verificar conteos:

```sql
SELECT 'customer' AS tbl, COUNT(*) FROM customer
UNION ALL SELECT 'order', COUNT(*) FROM "order"
UNION ALL SELECT 'order_item', COUNT(*) FROM order_item
UNION ALL SELECT 'product', COUNT(*) FROM product
UNION ALL SELECT 'seller', COUNT(*) FROM seller
UNION ALL SELECT 'payment', COUNT(*) FROM payment
UNION ALL SELECT 'category', COUNT(*) FROM category;
```

Valores esperados de Olist (línea base):
- customer: ~96k filas (clientes únicos)
- order: ~99k filas
- order_item: ~113k filas
- product: ~33k filas
- seller: ~3k filas
- payment: ~104k filas
- category: ~71 filas
