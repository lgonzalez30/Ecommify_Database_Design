# Base de presentación ejecutiva

## Diapositiva 1 — Portada

- Ecommify: arquitectura híbrida y evaluación crítica.
- Equipo, curso y fecha.

## Diapositiva 2 — Problema y objetivos

- Marketplace multivendedor.
- Integridad financiera + catálogo de lectura intensiva + eventos masivos.
- Objetivo: balancear consistencia, disponibilidad y escalabilidad.

## Diapositiva 3 — Arquitectura implementada

- Insertar `arquitectura_hibrida.png`.
- PostgreSQL: fuente de verdad.
- MongoDB: proyecciones y datos flexibles.

## Diapositiva 4 — Decisiones principales

- Órdenes/pagos → PostgreSQL.
- Catálogo/eventos/sesiones → MongoDB.
- Checkout revalida estado canónico.
- Outbox desacopla sincronización.

## Diapositiva 5 — Implementación destacada

- PostgreSQL: JSONB, PostGIS, particiones e índices especializados.
- MongoDB: Extended Reference, Bucket, Polymorphic y TTL.

## Diapositiva 6 — Metodología de pruebas

- JMeter en Docker.
- 31 corridas distintas.
- 1–100 usuarios; datasets 1x, 5x y 10x.
- p50, p95, p99, throughput y errores.

## Diapositiva 7 — Resultados de concurrencia

- Insertar gráficas de throughput y p95.
- Máximo: 626,68 ops/s con 10 usuarios.
- Saturación: entre 10 y 25 usuarios.
- 0 % de errores.

## Diapositiva 8 — Resultados de escalabilidad

- Insertar gráficas por volumen.
- p95: 71 ms → 568 ms al crecer 10x.
- Throughput: 621,83 → 91,94 ops/s.

## Diapositiva 9 — Comparación tecnológica

- PostgreSQL gana en transacciones, integridad y consultas relacionales.
- MongoDB gana en proyecciones, sesiones y flexibilidad.
- Dashboard híbrido requiere preagregación.

## Diapositiva 10 — CAP y fallas

- CP: pagos, órdenes e inventario.
- AP: catálogo, eventos, reseñas y sesiones.
- Precio y stock siempre se revalidan al comprar.

## Diapositiva 11 — Recomendaciones

- Preagregación analítica.
- Caché de catálogo.
- CDC y outbox asíncrono.
- Observabilidad y SLO de lag.
- Separación de entornos y backups.

## Diapositiva 12 — Conclusiones

- La selección híbrida se mantiene.
- Medir cambió el diseño: el dashboard es el cuello real.
- Próximo paso: arquitectura productiva observable y desacoplada.

