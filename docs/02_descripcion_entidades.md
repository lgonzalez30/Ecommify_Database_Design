# 02 — Descripción de entidades

Documento de soporte del diagrama ER (`docs/diagrams/ER_Ecommify.drawio`). Por cada entidad: propósito, atributos con tipo lógico, claves, restricciones, relaciones y mapeo al dataset Olist.

## Declaración de continuidad con Unidad 1

El ER de Ecommify se replantea desde cero respecto al diagrama de Unidad 1 por una razón técnica: los tipos avanzados nativos de PostgreSQL (JSONB, ARRAY, TSTZRANGE, HSTORE, composite types) que la Formativa de Unidad 2 justificó cambian la forma estructural de varias entidades. Pegarlos sobre el ER 3FN puro de U1 produciría un modelo inconsistente. Esto **no** significa que se ignora U1: el enfoque arquitectónico (Políglota Híbrida), las métricas de éxito, las limitaciones técnicas y las preguntas de investigación se mantienen. Lo único que se replantea es el diagrama. Ver `01_analisis_requisitos.md` para detalle.

## Mapeo dataset Olist → entidades U2

| Entidad U2 | Tabla(s) Olist origen | Transformación respecto a U1 |
|---|---|---|
| Customer | `olist_customers_dataset` | PK cambia de `customer_id` a `customer_unique_id`. `customer_id` se descarta. |
| Order | `olist_orders_dataset` | Se agrega particionamiento por `order_purchase_timestamp`. ENUM para `order_status`. |
| OrderItem | `olist_order_items_dataset` | Sin cambios estructurales. |
| Payment | `olist_order_payments_dataset` | `payment_type` se convierte en ENUM. |
| Review | `olist_order_reviews_dataset` | (entidad lógica; storage físico en MongoDB, no en PostgreSQL). |
| Product | `olist_products_dataset` | Se reemplazan `product_name_lenght`, `product_description_lenght`, `product_photos_qty` por estructuras nativas: `name TEXT`, `description TEXT`, `product_photos TEXT[]`. Se agregan `product_specifications JSONB`, `product_tags TEXT[]`, `product_metadata HSTORE`. Las cuatro dimensiones físicas se agrupan en composite type `product_dimensions`. |
| Category | derivada de atributo `product_category_name` en `olist_products_dataset` + `product_category_name_translation` | Se extrae como tabla independiente con PK propia, corrigiendo violación 3FN de U1. |
| Seller | `olist_sellers_dataset` | Sin cambios estructurales. |
| Geolocation | `olist_geolocation_dataset` | Se incorpora soporte PostGIS (`GEOGRAPHY(POINT)`). |
| Promotion | (nueva, no existe en Olist) | Nueva entidad de la Formativa, con `promotion_period TSTZRANGE`. |
| OrderStatusHistory | (derivada, no existe en Olist) | Nueva entidad débil de Order para trazabilidad del ciclo de vida. |

---

## Customer

**Propósito.** Cliente real del marketplace, identificable de forma estable a través de múltiples órdenes.

**Atributos.**

| Atributo | Tipo lógico | Nulo | Notas |
|---|---|---|---|
| `customer_unique_id` | UUID/VARCHAR | NO | **PK**. Identificador estable del cliente. |
| `customer_zip_code_prefix` | INT | NO | Prefijo de código postal (5 dígitos en Brasil). |
| `customer_city` | VARCHAR(100) | NO | |
| `customer_state` | CHAR(2) | NO | Código de estado (ej: SP, RJ). |
| `customer_geo` | GEOGRAPHY(POINT) | SÍ | Punto geográfico derivado, sustenta cálculo de envío. |
| `created_at` | TIMESTAMPTZ | NO | Default `NOW()`. |
| `updated_at` | TIMESTAMPTZ | NO | Mantenido por trigger. |

**Decisión clave.** En Olist `customer_id` cambia con cada orden (es identificador de sesión de compra, no de cliente). El EDA confirmó ratio ~1.03 órdenes por `customer_unique_id`. En Ecommify, `Customer` tiene PK `customer_unique_id`. El `customer_id` original se descarta o se conserva como atributo histórico de sesión.

**Relaciones.**
- Customer (1) → Order (N) — un cliente puede tener múltiples órdenes.

---

## Order

**Propósito.** Cabecera de orden, con ciclo de vida y trazabilidad temporal.

**Atributos.**

| Atributo | Tipo lógico | Nulo | Notas |
|---|---|---|---|
| `order_id` | UUID/VARCHAR | NO | **PK**. |
| `customer_unique_id` | UUID/VARCHAR | NO | **FK** → Customer. |
| `order_status` | order_status (ENUM) | NO | created, approved, invoiced, shipped, delivered, canceled, returned. |
| `order_purchase_timestamp` | TIMESTAMPTZ | NO | **Clave de particionamiento.** |
| `order_approved_at` | TIMESTAMPTZ | SÍ | |
| `order_delivered_carrier_date` | TIMESTAMPTZ | SÍ | |
| `order_delivered_customer_date` | TIMESTAMPTZ | SÍ | |
| `order_estimated_delivery_date` | TIMESTAMPTZ | NO | |
| `updated_at` | TIMESTAMPTZ | NO | Mantenido por trigger. |

**Decisión clave.** Particionada por `RANGE (order_purchase_timestamp)`. Particiones mensuales para los últimos 12 meses (hot), anuales para histórico (cold). Justificado por volumen proyectado de 150k órdenes/año con crecimiento de 50% anual y patrón de acceso por rango temporal (ver EDA Sección 5 y `01_analisis_requisitos.md` Sección 7).

**Relaciones.**
- Customer (1) → Order (N).
- Order (1) → OrderItem (N).
- Order (1) → Payment (N) — soporta múltiples instrumentos de pago.
- Order (1) → OrderStatusHistory (N).
- Order (1) → Review (N) — confirmado por EDA (existen órdenes con múltiples reviews).

---

## OrderItem

**Propósito.** Línea de detalle de una orden, vincula producto y seller.

**Atributos.**

| Atributo | Tipo lógico | Nulo | Notas |
|---|---|---|---|
| `order_id` | UUID/VARCHAR | NO | **PK (parte 1)**, **FK** → Order. |
| `order_item_id` | INT | NO | **PK (parte 2)**. Número secuencial dentro de la orden. |
| `product_id` | UUID/VARCHAR | NO | **FK** → Product. |
| `seller_id` | UUID/VARCHAR | NO | **FK** → Seller. |
| `shipping_limit_date` | TIMESTAMPTZ | NO | Fecha límite de despacho. |
| `price` | NUMERIC(12,2) | NO | CHECK `price >= 0`. |
| `freight_value` | NUMERIC(12,2) | NO | CHECK `freight_value >= 0`. |

**Relaciones.**
- Order (1) → OrderItem (N).
- Product (1) → OrderItem (N).
- Seller (1) → OrderItem (N).

---

## Payment

**Propósito.** Pago asociado a orden. Soporta múltiples métodos por orden.

**Atributos.**

| Atributo | Tipo lógico | Nulo | Notas |
|---|---|---|---|
| `order_id` | UUID/VARCHAR | NO | **PK (parte 1)**, **FK** → Order. |
| `payment_sequential` | INT | NO | **PK (parte 2)**. |
| `payment_type` | payment_type (ENUM) | NO | credit_card, debit_card, boleto, voucher, pix. |
| `payment_installments` | INT | NO | CHECK `payment_installments >= 1`. |
| `payment_value` | NUMERIC(12,2) | NO | CHECK `payment_value > 0`. |

**Decisión clave.** PK compuesta confirma soporte de múltiples métodos por orden (split payment). `payment_type` como ENUM porque el dominio es cerrado (EDA Sección 3 confirma).

**Relaciones.**
- Order (1) → Payment (N).

---

## OrderStatusHistory

**Propósito.** Trazabilidad del ciclo de vida de Order. Entidad débil. Permite reconstruir el journey de una orden y calcular métricas operativas (tiempo en cada estado).

**Atributos.**

| Atributo | Tipo lógico | Nulo | Notas |
|---|---|---|---|
| `history_id` | BIGSERIAL | NO | **PK**. |
| `order_id` | UUID/VARCHAR | NO | **FK** → Order. |
| `from_status` | order_status | SÍ | Null en la primera transición. |
| `to_status` | order_status | NO | |
| `changed_at` | TIMESTAMPTZ | NO | Default `NOW()`. |
| `changed_by` | VARCHAR | SÍ | Usuario o sistema que disparó el cambio. |

**Relaciones.**
- Order (1) → OrderStatusHistory (N).

---

## Product

**Propósito.** Producto del catálogo. Concentra los tipos avanzados de PostgreSQL.

**Atributos.**

| Atributo | Tipo lógico | Nulo | Notas |
|---|---|---|---|
| `product_id` | UUID/VARCHAR | NO | **PK**. |
| `category_id` | INT | NO | **FK** → Category. |
| `name` | TEXT | NO | Nombre comercial. |
| `description` | TEXT | SÍ | Descripción extendida. |
| `product_specifications` | JSONB | SÍ | Atributos variables por categoría (color, material, capacidad...). |
| `product_photos` | TEXT[] | SÍ | URLs de imágenes. |
| `product_tags` | TEXT[] | SÍ | Etiquetas de búsqueda. |
| `product_metadata` | HSTORE | SÍ | Pares clave-valor ligeros (uso parcial; JSONB cubre el grueso). |
| `dimensions` | product_dimensions (composite) | SÍ | `(length_cm, height_cm, width_cm, weight_g)`. |
| `base_price` | NUMERIC(12,2) | NO | CHECK `base_price >= 0`. |
| `created_at` | TIMESTAMPTZ | NO | |
| `updated_at` | TIMESTAMPTZ | NO | Mantenido por trigger. |

**Decisiones clave (heredadas de la Formativa de Andrés Camilo).**
- `product_specifications JSONB` para atributos variables por categoría sin crear tablas auxiliares por tipo de producto. Indexado con GIN.
- `product_photos TEXT[]` para múltiples imágenes sin tabla auxiliar.
- `product_tags TEXT[]` para etiquetas, indexado con GIN.
- `product_metadata HSTORE` queda como opción para pares clave-valor ligeros (uso parcial).
- `dimensions` como composite type agrupa los cuatro campos físicos.

**Relaciones.**
- Category (1) → Product (N).
- Product (1) → OrderItem (N).
- Product (N) ↔ Promotion (N) — relación N:M a través de tabla intermedia o array dentro de Promotion.

---

## Category

**Propósito.** Categoría de producto. Tabla nueva en U2 que corrige la violación de 3FN del ER de U1 (donde `product_category_name` vivía dentro de `Product`).

**Atributos.**

| Atributo | Tipo lógico | Nulo | Notas |
|---|---|---|---|
| `category_id` | SERIAL | NO | **PK**. |
| `category_name` | VARCHAR(100) | NO | UNIQUE. Nombre original en portugués. |
| `category_name_english` | VARCHAR(100) | SÍ | Traducción (viene de `product_category_name_translation`). |
| `parent_category_id` | INT | SÍ | **FK** → Category, soporte de jerarquía. |

**Relaciones.**
- Category (1) → Product (N).
- Category (1) → Category (N) — autorrelación opcional para jerarquía.

---

## Seller

**Propósito.** Vendedor del marketplace.

**Atributos.**

| Atributo | Tipo lógico | Nulo | Notas |
|---|---|---|---|
| `seller_id` | UUID/VARCHAR | NO | **PK**. |
| `seller_zip_code_prefix` | INT | NO | |
| `seller_city` | VARCHAR(100) | NO | |
| `seller_state` | CHAR(2) | NO | |
| `seller_geo` | GEOGRAPHY(POINT) | SÍ | Punto PostGIS, sustenta cálculo de distancia con Customer. |
| `created_at` | TIMESTAMPTZ | NO | |
| `updated_at` | TIMESTAMPTZ | NO | Mantenido por trigger. |

**Relaciones.**
- Seller (1) → OrderItem (N).

---

## Promotion

**Propósito.** Promoción con vigencia temporal acotada. Entidad nueva incorporada por la Formativa de Andrés Camilo.

**Atributos.**

| Atributo | Tipo lógico | Nulo | Notas |
|---|---|---|---|
| `promotion_id` | UUID | NO | **PK**. |
| `name` | VARCHAR(200) | NO | |
| `discount_percentage` | NUMERIC(5,2) | SÍ | CHECK `BETWEEN 0 AND 100`. |
| `discount_amount` | NUMERIC(12,2) | SÍ | Alternativa a porcentaje. |
| `promotion_period` | TSTZRANGE | NO | Vigencia con tipo nativo de rango temporal. |
| `target_category_ids` | INT[] | SÍ | Aplicable a una o varias categorías. |
| `target_product_ids` | UUID[] | SÍ | Aplicable a productos específicos. |

**Decisión clave.** `TSTZRANGE` permite validar promociones activas con `WHERE NOW() <@ promotion_period`, mucho más eficiente y expresivo que dos columnas `start_date`/`end_date`. Indexable con GIST.

**Relaciones.**
- Promotion (N) ↔ Category (N) — a través de `target_category_ids`.
- Promotion (N) ↔ Product (N) — a través de `target_product_ids`.

---

## Review

**Propósito.** Reseña del cliente sobre una orden. **Storage físico en MongoDB**, no en PostgreSQL. Aquí se documenta su forma lógica para completitud del modelo conceptual.

**Atributos.**

| Atributo | Tipo lógico | Nulo | Notas |
|---|---|---|---|
| `review_id` | UUID | NO | **PK**. |
| `order_id` | UUID/VARCHAR | NO | Referencia lógica al `order_id` de PostgreSQL. |
| `product_id` | UUID/VARCHAR | SÍ | Referencia opcional al producto reseñado. |
| `review_score` | INT | NO | CHECK `BETWEEN 1 AND 5`. |
| `review_comment_title` | VARCHAR(200) | SÍ | |
| `review_comment_message` | TEXT | SÍ | |
| `review_creation_date` | TIMESTAMPTZ | NO | |
| `review_answer_timestamp` | TIMESTAMPTZ | SÍ | |

**Decisión clave.** Reside en MongoDB por alto volumen de escritura, contenido semi-estructurado y consistencia eventual aceptable. La FK a Order es lógica (referencia por `order_id`), no enforced por motor. Ver `mongodb/schema/collections.md`.

**Relaciones lógicas.**
- Order (1) → Review (N).
- Product (1) → Review (N) — opcional.

---

## Geolocation

**Propósito.** Tabla de referencia para resolver `zip_code_prefix` a coordenadas geográficas. Read-only en operación normal.

**Atributos.**

| Atributo | Tipo lógico | Nulo | Notas |
|---|---|---|---|
| `geolocation_zip_code_prefix` | INT | NO | |
| `geolocation_lat` | NUMERIC(9,6) | NO | |
| `geolocation_lng` | NUMERIC(9,6) | NO | |
| `geolocation_point` | GEOGRAPHY(POINT) | NO | Calculado a partir de lat/lng. |
| `geolocation_city` | VARCHAR(100) | NO | |
| `geolocation_state` | CHAR(2) | NO | |

**Decisión clave.** Indexada con GIST para queries espaciales eficientes. Se considera tabla de catálogo, no transaccional.

**Relaciones.** Sin FK directas. Customer y Seller resuelven sus puntos geográficos por lookup contra esta tabla en la carga inicial.

---

## Resumen de cardinalidades del ER

| Relación | Cardinalidad |
|---|---|
| Customer — Order | 1:N |
| Order — OrderItem | 1:N |
| Order — Payment | 1:N |
| Order — Review | 1:N |
| Order — OrderStatusHistory | 1:N |
| Category — Product | 1:N |
| Category — Category (jerarquía) | 1:N opcional |
| Product — OrderItem | 1:N |
| Seller — OrderItem | 1:N |
| Promotion — Category | N:M (vía array) |
| Promotion — Product | N:M (vía array) |

## Verificación de 3FN

- **1FN.** Todos los atributos del modelo lógico relacional son atómicos. Los tipos avanzados de PostgreSQL (`JSONB`, `TEXT[]`, `HSTORE`, `TSTZRANGE`, composite types) **no se interpretan como violación de 1FN**, sino como denormalización justificada usando tipos nativos del motor. Esto está respaldado por la práctica estándar moderna de modelado relacional con PostgreSQL.
- **2FN.** Las únicas PKs compuestas son OrderItem (`order_id`, `order_item_id`) y Payment (`order_id`, `payment_sequential`). Todos sus atributos no clave dependen de la PK completa, no de una parte.
- **3FN.** No hay dependencias transitivas. La extracción de `Category` como tabla aparte resuelve la dependencia transitiva `product_id → product_category_name → ...` que existía en U1. La geografía en Customer y Seller queda como atributos directos por simplicidad (no se crea Address normalizada porque `zip + city + state` es indivisible en este dominio).
