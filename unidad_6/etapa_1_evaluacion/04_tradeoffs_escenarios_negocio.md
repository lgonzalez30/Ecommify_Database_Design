# 4. Trade-offs en escenarios críticos de negocio

## 4.1 Black Friday

**Prioridad:** disponibilidad para navegación y consistencia para checkout.

Configuración recomendada:

- Catálogo servido desde MongoDB y caché, con lecturas escalables y tolerancia a datos brevemente desactualizados.
- Eventos analíticos en modo AP con buffer y deduplicación.
- Órdenes, pagos e inventario en PostgreSQL con consistencia estricta.
- Revalidación de precio, promoción y stock al confirmar la compra.
- Circuit breaker: si PostgreSQL no puede confirmar, el sistema no promete la venta.

Trade-off: se tolera menor frescura en navegación para sostener tráfico, pero no sobreventa ni cobros inconsistentes. La mitigación es separar “mostrar” de “confirmar”.

## 4.2 Checkout y procesamiento de pagos

**Prioridad:** consistencia sobre disponibilidad.

Configuración recomendada:

- Transacción única para orden, ítems, reserva de inventario y estado inicial del pago cuando el proveedor lo permita.
- Clave de idempotencia por intento de compra.
- Patrón outbox para publicar cambios a MongoDB solo después del commit.
- Timeouts y reintentos con backoff; un timeout produce estado pendiente, nunca una confirmación supuesta.

Trade-off: ante una partición se rechaza o difiere la compra. Es preferible perder temporalmente una venta a duplicar un cobro o vender inventario inexistente.

## 4.3 Auditoría financiera y cierre contable

**Prioridad:** consistencia, trazabilidad y reproducibilidad.

Configuración recomendada:

- Reportes financieros generados desde PostgreSQL o una réplica con lag validado en cero para el corte.
- Snapshot transaccional con hora de corte documentada.
- Conciliación entre órdenes, pagos y proveedor externo.
- Eventos de MongoDB se usan como contexto, no como libro financiero.

Trade-off: el informe puede demorarse mientras se completa la réplica o conciliación. No se acepta un total rápido pero inconsistente.

## 4.4 Resumen de decisión

| Escenario | Consistencia | Disponibilidad | Decisión |
|---|---|---|---|
| Navegación en Black Friday | Eventual aceptable | Muy alta | AP para catálogo y eventos |
| Checkout/pago | Estricta | Puede degradarse | CP para órdenes, inventario y pagos |
| Auditoría financiera | Estricta y trazable | Demora aceptable | CP y snapshot validado |

