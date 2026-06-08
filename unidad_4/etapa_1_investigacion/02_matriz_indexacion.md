# Matriz de indexacion especializada

## Criterios aplicados

| Criterio | Pregunta | Tipo de indice candidato |
|---|---|---|
| Igualdad o rango sobre columna escalar | `WHERE col = ?`, `BETWEEN`, `ORDER BY` | B-tree |
| Filtros por multiples columnas | Predicados combinados o JOIN frecuente | B-tree compuesto |
| JSONB con contencion | `product_specifications @> ...` | GIN |
| Arrays | `@>`, `&&`, `ANY` sobre arrays | GIN |
| Texto tolerante a errores | `%`, `similarity`, `ILIKE '%texto%'` | GIN + `gin_trgm_ops` |
| Geografia | `ST_DWithin`, `ST_Intersects` | GiST |
| Rango temporal nativo | `NOW() <@ promotion_period`, `&&` | GiST |
| Tabla grande append-only | Filtros por fecha sobre datos ordenados | BRIN |
| Subconjunto operativo | Solo estados activos o no nulos | Parcial |
| Funcion en busqueda | `lower(name)` o expresion calculada | Expresion |

## Matriz consulta -> indice

| Consulta | Patron | Indice propuesto/existente | Tipo | Justificacion | Trade-off |
|---|---|---|---|---|---|
| Q01 Ordenes activas recientes | Estado + rango temporal + orden descendente | `idx_order_active_status` | B-tree parcial | Reduce indice a estados operativos y ordena por fecha | No ayuda a estados terminales |
| Q01/Q10 Ordenes por fecha | Rango sobre `order_purchase_timestamp` | `idx_u4_order_purchase_brin` | BRIN | Bajo costo en tablas grandes particionadas/append-only | Menos preciso que B-tree; depende de correlacion fisica |
| Q02 Detalle de orden | JOIN por `order_id + order_purchase_timestamp` | PK + `idx_order_item_order`, `idx_payment_order` | B-tree | Recupera detalle por orden sin scan completo | Indices adicionales consumen espacio |
| Q03 Ventas categoria mes | JOIN Order -> OrderItem -> Product -> Category | `idx_u4_order_status_purchase`, `idx_order_item_product` | B-tree compuesto | Filtra primero por estado y fecha antes de agregacion | Mayor costo de escritura en cambios de estado |
| Q04 JSONB catalogo | `@>` en `product_specifications` | `idx_product_specs_gin` | GIN | Acelera contencion JSONB | Indice grande; mantenimiento mas costoso |
| Q04 precio | `base_price BETWEEN` | `idx_product_price` | B-tree | Rango ordenado por precio | Poco util si selectividad es baja |
| Q05 texto | `name % 'cafetera'` | `idx_product_name_trgm` | GIN trigram | Busqueda tolerante a errores | Alto espacio para textos largos |
| Q05 texto normalizado | `lower(name) % lower(?)` | `idx_u4_product_name_lower_trgm` | GIN de expresion | Evita dependencia de mayusculas/minusculas | Debe coincidir la expresion en query |
| Q06 seller SLA | `seller_id + shipping_limit_date` | `idx_u4_order_item_seller_shipping` | B-tree compuesto | Filtra items por seller y ventana de envio | No ayuda si no hay filtro temporal |
| Q07 geo | `ST_DWithin(customer_geo, seller_geo, radio)` | `idx_customer_geo`, `idx_seller_geo` | GiST | Usa bounding boxes antes del calculo exacto | Calculos espaciales siguen siendo CPU-intensivos |
| Q08 promociones | rango temporal + categoria array | `idx_promotion_period_gist`, `idx_promotion_target_categories` | GiST + GIN | Combina vigencia temporal y aplicabilidad | Dos indices pueden requerir bitmap-and |
| Q09 segmentacion | agregacion cliente con delivered | `idx_u4_order_delivered_customer` | B-tree parcial | Reduce historico a ordenes entregadas | No sirve para estados no entregados |

## Indices a implementar en Etapa 2

La base ya tiene indices relevantes en `postgresql/schema/04_indexes.sql`. Para la Unidad 4 se agregan indices complementarios orientados a medicion:

1. `idx_u4_order_purchase_brin` — BRIN sobre fecha de orden.
2. `idx_u4_order_status_purchase` — B-tree compuesto sobre estado y fecha.
3. `idx_u4_product_name_lower_trgm` — GIN trigram de expresion.
4. `idx_u4_order_item_seller_shipping` — B-tree compuesto para seller/SLA.
5. `idx_u4_order_delivered_customer` — B-tree parcial para segmentacion de clientes entregados.

Estos indices permiten cubrir al menos tres tipos diferentes: BRIN, B-tree compuesto, GIN de expresion y parcial.
