# 3. Decisiones CAP y escenarios de falla

## 3.1 Precisión conceptual

CAP aplica cuando existe una partición de red en un sistema distribuido. En condiciones normales pueden coexistir consistencia y disponibilidad; durante una partición debe elegirse qué propiedad sacrificar. La etiqueta CP/AP describe la política deseada del módulo, no una propiedad automática del nombre del motor. Un contenedor local de nodo único no demuestra tolerancia a particiones.

## 3.2 Política por módulo

| Módulo | Sistema | Prioridad durante partición | Trade-off aceptado | Mitigación |
|---|---|---|---|---|
| Órdenes y pagos | PostgreSQL | **CP** | Rechazar o pausar checkout antes que confirmar estados divergentes | Transacción ACID, idempotency key, reintentos acotados y outbox |
| Inventario | PostgreSQL | **CP** | Menor disponibilidad para evitar sobreventa | Bloqueo de fila/versión, reserva temporal y compensación |
| Producto maestro y promociones | PostgreSQL | **CP** | Administración no disponible temporalmente | Operación solo sobre primario y cola de cambios |
| Catálogo de lectura | MongoDB | **AP** | Servir datos temporalmente desactualizados | Mostrar disponibilidad indicativa y revalidar precio/stock en checkout |
| Reseñas | MongoDB | **AP** | Demora en moderación, agregados o visibilidad | Idempotencia, cola de moderación y reconciliación |
| Eventos analíticos | MongoDB | **AP** | Duplicados o pérdida limitada durante reintentos | Event ID, buffer cliente y deduplicación por lote |
| Sesiones | MongoDB | **AP** | Carrito o sesión temporalmente desactualizados | Token recuperable, merge de carrito y TTL |

## 3.3 Escenario A: pérdida de conectividad con PostgreSQL

- Se deshabilitan checkout, pagos y cambios de inventario; no se confirma una orden sin commit.
- El catálogo puede continuar disponible desde MongoDB, con precios y stock marcados como sujetos a confirmación.
- Eventos y sesiones continúan si MongoDB está disponible.
- Al recuperarse PostgreSQL se procesan reintentos idempotentes y se reconcilia el outbox.

Garantías mantenidas: consistencia del núcleo financiero y disponibilidad parcial de navegación. Garantía sacrificada: disponibilidad de compra.

## 3.4 Escenario B: pérdida de conectividad con MongoDB

- Checkout puede operar consultando producto, precio y stock canónicos en PostgreSQL.
- Catálogo, reseñas y personalización pueden degradarse a una experiencia básica o caché con vencimiento corto.
- Los eventos se almacenan temporalmente en un buffer durable y se reenvían.

Garantías mantenidas: consistencia transaccional. Garantía sacrificada: disponibilidad completa de funciones no críticas y frescura analítica.

## 3.5 Escenario C: retraso de replicación o sincronización

El `product_catalog` puede mostrar un precio anterior durante la ventana entre el cambio en PostgreSQL y su aplicación en MongoDB. La estrategia propuesta de Unidad 4 usa sincronización cada seis horas como fallback académico; por tanto, su ventana máxima teórica es cercana a seis horas más la duración y reintentos del proceso. En producción esa ventana es demasiado amplia para precio y stock.

Mitigaciones recomendadas:

1. Revalidar precio, promoción, disponibilidad e inventario en PostgreSQL al iniciar checkout.
2. Mostrar en catálogo solo información no contractual; la confirmación ocurre al pagar.
3. Migrar a CDC para reducir la ventana a segundos o minutos.
4. Registrar `source_updated_at` y rechazar eventos fuera de orden.
5. Medir lag extremo a extremo y alertar cuando supere el SLO acordado.

## 3.6 Pruebas de falla requeridas

| Prueba | Acción | Resultado esperado | Evidencia |
|---|---|---|---|
| F01 | Cortar acceso a PostgreSQL durante checkout | No hay orden parcial ni pago confirmado | Logs, conteos antes/después, rollback |
| F02 | Cortar acceso a MongoDB durante navegación | Checkout permanece correcto; catálogo se degrada explícitamente | Respuestas y tasa de error |
| F03 | Retrasar el sincronizador de catálogo | Checkout corrige precio obsoleto | Timestamps y comparación de valores |
| F04 | Repetir el mismo evento | Una sola operación efectiva | Idempotency key y conteos |
| F05 | Entregar cambios fuera de orden | Prevalece el `source_updated_at` más reciente | Documento final y logs |

