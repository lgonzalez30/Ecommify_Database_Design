# 01 — Análisis de requisitos

## 1. Contexto de Ecommify

Ecommify es una plataforma de comercio electrónico multivendedor (marketplace) inspirada en el modelo del dataset Brazilian E-Commerce de Olist. El sistema debe soportar:

- **Cargas transaccionales** (OLTP): creación de órdenes, procesamiento de pagos, gestión de inventario, actualizaciones de estado, reviews de cliente.
- **Cargas analíticas** (OLAP): ventas por categoría, segmentación de clientes, rendimiento de sellers, tendencias temporales, distribución geográfica.

El dataset Olist se utiliza como base empírica del diseño. Sus volúmenes reales (~100k órdenes, ~96k clientes únicos, ~33k productos, ~3k sellers) son la línea base de los volúmenes esperados de Ecommify (ver Sección 6).

## 2. Requisitos funcionales

Agrupados por módulo:

### 2.1 Módulo Catálogo
- RF-CAT-01: gestión de productos con atributos variables por categoría (especificaciones técnicas, dimensiones, peso).
- RF-CAT-02: cada producto puede tener múltiples imágenes asociadas.
- RF-CAT-03: cada producto pertenece a exactamente una categoría.
- RF-CAT-04: búsqueda de productos por nombre y descripción tolerante a errores tipográficos.
- RF-CAT-05: filtrado de productos por categoría, rango de precio, seller y disponibilidad geográfica.

### 2.2 Módulo Órdenes
- RF-ORD-01: creación de orden con uno o más ítems (de uno o varios sellers).
- RF-ORD-02: ciclo de vida con estados: created, approved, invoiced, shipped, delivered, canceled, returned.
- RF-ORD-03: trazabilidad de cambios de estado con timestamps (purchase, approved, delivered_carrier, delivered_customer).
- RF-ORD-04: estimación de fecha de entrega al momento de la compra.

### 2.3 Módulo Pagos
- RF-PAY-01: soporte para múltiples métodos: credit_card, debit_card, boleto, voucher, pix.
- RF-PAY-02: pagos con cuotas (installments).
- RF-PAY-03: una orden puede tener múltiples registros de pago (split o múltiples instrumentos).

### 2.4 Módulo Envíos
- RF-SHP-01: cálculo de costo de envío basado en distancia geográfica seller-customer.
- RF-SHP-02: fecha límite de envío (`shipping_limit_date`) por ítem.
- RF-SHP-03: registro de fechas reales de entrega para auditoría y métricas.

### 2.5 Módulo Reviews
- RF-REV-01: una orden puede recibir una o más reviews del cliente.
- RF-REV-02: cada review tiene score entero entre 1 y 5, título opcional y mensaje opcional.
- RF-REV-03: registro de timestamp de creación y de respuesta del seller.

### 2.6 Módulo Clientes
- RF-CUS-01: cliente identificable globalmente más allá de una orden individual (resolución de ambigüedad `customer_id` vs `customer_unique_id`).
- RF-CUS-02: ubicación geográfica del cliente para cálculo de envío.

### 2.7 Módulo Promociones
- RF-PRM-01: promociones con vigencia temporal (fecha inicio y fin).
- RF-PRM-02: aplicabilidad por categoría, producto o seller.

### 2.8 Módulo Reportería
- RF-RPT-01: ventas por categoría agregadas por mes.
- RF-RPT-02: segmentación de clientes por comportamiento de compra.
- RF-RPT-03: rendimiento de sellers (volumen, score promedio de reviews, tiempo de entrega promedio).

## 3. Requisitos no funcionales (reuso directo de Unidad 1)

Las métricas y limitaciones técnicas vienen de las decisiones tomadas en la Unidad 1 y se mantienen como contrato del sistema.

### 3.1 Rendimiento
- RNF-PERF-01: tiempo de respuesta de consultas transaccionales en PostgreSQL menor a **100 ms** (métrica U1).
- RNF-PERF-02: tiempo de inserción de documentos en MongoDB menor a **200 ms** (métrica U1).
- RNF-PERF-03: refresh de materialized views OLAP en ventana de mantenimiento, sin afectar OLTP.

### 3.2 Escalabilidad
- RNF-ESC-01: soportar al menos **100,000 órdenes** sin degradación significativa del rendimiento (métrica U1).
- RNF-ESC-02: crecimiento esperado de 50% anual en volumen transaccional.

### 3.3 Disponibilidad
- RNF-DIS-01: disponibilidad superior al **99%** durante pruebas de carga (métrica U1).

### 3.4 Consistencia
- RNF-CON-01: garantías ACID en módulo transaccional (Order, OrderItem, Payment).
- RNF-CON-02: consistencia eventual aceptable en proyecciones de lectura (catálogo en MongoDB) y en datos analíticos.

### 3.5 Tolerancia a particiones
- RNF-TOL-01: cada módulo tiene su trade-off CAP explícito. Análisis detallado en `04_matriz_decision.md`.

### 3.6 Seguridad
- RNF-SEC-01: información sensible cifrada en reposo mediante `pgcrypto`.
- RNF-SEC-02: auditoría de cambios en tablas críticas vía triggers `updated_at`.

## 4. Limitaciones técnicas (reuso directo de Unidad 1)

Estas restricciones son del entorno de plataformas gratuitas seleccionado en U1 y condicionan el diseño físico.

### 4.1 Supabase free tier (PostgreSQL)
- Recursos limitados de CPU y memoria.
- Restricciones en concurrencia y volumen de datos.
- Implicación: justifica particionamiento de `orders` para mantener performance, archivado de particiones históricas, y diseño cuidadoso de índices.

### 4.2 MongoDB Atlas M0
- Capacidad de almacenamiento limitada (512 MB).
- Sin soporte para sharding.
- Rendimiento restringido en operaciones intensivas.
- Implicación: justifica que `product_catalog` en MongoDB sea proyección de lectura (no fuente de verdad), y que las colecciones de eventos tengan políticas de TTL o archivado.

### 4.3 Google Colab
- Sesiones temporales con RAM limitada.
- Posible pérdida de estado en ejecuciones prolongadas.
- Implicación: el EDA y los scripts de carga se diseñan para ejecutar por chunks, no cargando todo el dataset en memoria al mismo tiempo.

## 5. Preguntas de investigación (reuso directo de Unidad 1)

Estas preguntas guían el diseño y se responden a lo largo del documento técnico. La pregunta 5 es el puente directo con el análisis CAP de la Fase 7.

1. ¿Cómo optimizar el almacenamiento y consulta de órdenes para garantizar alta eficiencia en PostgreSQL? → Respuesta en `02_descripcion_entidades.md` (particionamiento) y `postgresql/schema/03_partitions.sql`.
2. ¿Qué estructura de datos permite manejar de forma flexible el catálogo de productos en MongoDB? → Respuesta en `mongodb/schema/collections.md`.
3. ¿Cómo influye la distribución geográfica de los clientes en el rendimiento del sistema? → Respuesta en `notebooks/Data_Exploration_Analysis.ipynb` Sección 6 y `03_decisiones_arquitectonicas.md`.
4. ¿Qué impacto tiene la normalización en el rendimiento de consultas transaccionales? → Respuesta en `02_descripcion_entidades.md` (trade-off normalización vs JSONB/ARRAY).
5. ¿Cómo diseñar una arquitectura híbrida que balancee consistencia y escalabilidad? → Respuesta en `04_matriz_decision.md` con análisis CAP por módulo.

## 6. Entidades del dominio

Lista cerrada, input directo de la Fase 3 (construcción del ER).

Entidades heredadas del inventario conceptual de U1:

1. **Customer** — cliente real (PK `customer_unique_id`, no `customer_id` como en Olist).
2. **Order** — cabecera de orden con ciclo de vida.
3. **OrderItem** — línea de detalle por orden.
4. **Product** — producto con atributos variables (JSONB) y múltiples imágenes (TEXT[]).
5. **Seller** — vendedor.
6. **Payment** — pago asociado a orden.
7. **Review** — reseña de cliente sobre orden.
8. **Category** — categoría de producto (corrección de violación 3FN de U1: en el ER de U1 era atributo de Product).

Entidades incorporadas por la Formativa de U2:

9. **Promotion** — promoción con vigencia temporal (`TSTZRANGE`).
10. **OrderStatusHistory** — entidad débil de Order para trazabilidad del ciclo de vida (registra cada transición con timestamp).

Entidades opcionales según decisión de modelado:

- **Address** — solo si se decide normalizar la dirección de Customer y Seller en una tabla aparte. Por simplicidad y dado que las direcciones aquí son a nivel `zip_code_prefix + city + state`, se opta por mantenerlas embebidas en Customer y Seller.
- **Geolocation** — tabla espacial con PostGIS, derivada del dataset `olist_geolocation_dataset`. Se opta por mantenerla como tabla auxiliar de referencia (read-only) para soportar el cálculo de distancia.

## 7. Volúmenes de datos esperados

Línea base extraída del EDA (Sección 7.1 del notebook) con proyección a 12 meses de Ecommify.

| Entidad | Volumen Olist (línea base) | Proyección año 1 Ecommify | Crecimiento año 2 | Patrón de acceso dominante |
|---|---:|---:|---:|---|
| Customer | 96k unique_ids | 130k | +30% | Lectura por orden, escritura moderada |
| Order | 100k | 150k | +50% | Escritura intensa, lectura por rango temporal |
| OrderItem | 113k | 170k | +50% | Escritura conjunta con Order |
| Product | 33k | 40k | +20% | Lectura intensa (catálogo), escritura baja |
| Seller | 3k | 3.5k | +10% | Lectura intensa, escritura baja |
| Payment | 104k | 156k | +50% | Escritura conjunta con Order, lectura por auditoría |
| Review | 100k | 150k | +50% | Escritura intensa, lectura por producto |
| Category | 71 | 80 | bajo | Lectura intensa, escritura mínima |
| Promotion | (nueva) | 200 | bajo | Lectura por validación, escritura mínima |
| Geolocation | 1M | 1M | bajo | Lectura como referencia, sin escritura |

### Implicaciones derivadas de estos volúmenes

- **Particionamiento de `Order`** justificado por crecimiento de 50% anual y patrón de acceso por rango temporal.
- **Materialized views** justificadas porque las cargas analíticas (ventas por categoría, segmentación) deben servirse sin pegarle al OLTP.
- **MongoDB como proyección de catálogo** justificado por la diferencia de patrones: PostgreSQL escribe Products lento pero MongoDB sirve lectura rápida al frontend.
- **Reviews en MongoDB** justificado por volumen alto de escritura (150k/año) y baja necesidad de relación referencial estricta.
