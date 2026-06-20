# Informe técnico integral — Ecommify

> Base editable. Reemplazar todos los textos entre corchetes antes de entregar.

## Portada

- Universidad de La Sabana.
- Maestría en Arquitectura de Software.
- Curso: Diseño y optimización de bases de datos.
- Proyecto: Ecommify.
- Integrantes: [VALIDAR NOMBRES].
- Profesor: Miguel Alfonso Varela Fonseca.
- Fecha: [FECHA DE ENTREGA].

## 1. Resumen ejecutivo

Ecommify es un marketplace multivendedor que utiliza una arquitectura híbrida: PostgreSQL conserva el núcleo transaccional y MongoDB soporta proyecciones y datos flexibles. La evaluación ejecutó 31 corridas distintas de 120 segundos. En escala S, el mayor throughput mediano fue 626,68 operaciones por segundo con 10 usuarios. El punto de saturación se ubicó entre 10 y 25 usuarios. Con crecimiento 10x, p95 pasó de 71 a 568 ms, principalmente por el dashboard que agregaba toda la colección analítica.

Recomendaciones principales: preagregar eventos, publicar proyecciones desde un outbox asíncrono, incorporar caché de catálogo, medir el lag entre motores y separar cargas operativas de analítica.

## 2. Introducción y contexto

### Problema de negocio

[DESCRIBIR marketplace, vendedores, catálogo, pagos, entregas, reseñas y analítica. Explicar la tensión entre integridad transaccional y disponibilidad de lectura.]

### Objetivos

- Diseñar una persistencia segura para órdenes, pagos e inventario.
- Servir catálogo y sesiones con baja latencia.
- soportar eventos de comportamiento de alto volumen.
- evaluar rendimiento, escalabilidad y decisiones CAP con evidencia.

### Alcance y metodología

[RESUMIR diseño, implementación, optimización de Unidad 4 y pruebas JMeter de Unidad 6.]

## 3. Arquitectura y diseño

### Arquitectura híbrida

Insertar `docs/diagrams/arquitectura_hibrida.png` y explicar:

- PostgreSQL como fuente de verdad.
- MongoDB como proyección de catálogo y almacenamiento de reseñas, sesiones y eventos.
- sincronización mediante outbox/CDC.
- revalidación de precio e inventario durante checkout.

### Matriz de asignación

| Módulo | Motor | Razón principal |
|---|---|---|
| Órdenes, ítems y pagos | PostgreSQL | ACID, FK, restricciones y auditoría. |
| Producto maestro y promociones | PostgreSQL | Integridad y validación temporal. |
| Catálogo de lectura | MongoDB | Documento denormalizado para frontend. |
| Reseñas | MongoDB | Contenido flexible y polimórfico. |
| Eventos | MongoDB | Escritura append-only y bucket pattern. |
| Sesiones | MongoDB | Datos efímeros con TTL. |

### CAP por módulo

| Módulo | Prioridad | Trade-off |
|---|---|---|
| Órdenes, pagos e inventario | CP | Sacrificar disponibilidad antes que confirmar estados divergentes. |
| Catálogo | AP | Servir datos temporalmente obsoletos y validar al comprar. |
| Reseñas y eventos | AP | Aceptar retraso y reconciliar posteriormente. |
| Sesiones | AP | Priorizar continuidad sobre consistencia estricta. |

## 4. Implementación técnica

### PostgreSQL

Resumir, sin copiar todo el entregable anterior:

- esquema normalizado y restricciones;
- `JSONB`, arreglos, `HSTORE`, tipos compuestos y `TSTZRANGE`;
- PostGIS y `pg_trgm`;
- particionamiento temporal;
- índices B-tree, GIN, GiST y BRIN;
- vistas materializadas y RBAC.

### MongoDB

- `product_catalog`: Extended Reference y Computed Pattern;
- `reviews`: Polymorphic Pattern;
- `analytics_events`: Bucket Pattern;
- `user_sessions`: índice TTL;
- validadores e índices por patrones de acceso.

### Decisiones no obvias

1. Mantener producto canónico en PostgreSQL aunque MongoDB sirva el catálogo.
2. Confirmar checkout únicamente contra PostgreSQL.
3. Publicar cambios posteriores mediante outbox idempotente.
4. Preagregar analítica en vez de ejecutar agregaciones globales en línea.

## 5. Evaluación de rendimiento y escalabilidad

### Metodología

- JMeter 5.6.3 en modo no GUI.
- Cinco repeticiones para 1, 10, 25, 50 y 100 usuarios.
- Tres repeticiones por escala S, M y L.
- 120 segundos por corrida y rampa de 10 segundos.
- Restauración del estado antes de cada prueba.

### Concurrencia

| Usuarios | Throughput | p95 | Errores |
|---:|---:|---:|---:|
| 1 | 400,39 ops/s | 7 ms | 0 % |
| 10 | 626,68 ops/s | 71 ms | 0 % |
| 25 | 560,70 ops/s | 190 ms | 0 % |
| 50 | 565,91 ops/s | 252 ms | 0 % |
| 100 | 540,56 ops/s | 396 ms | 0 % |

Insertar `unidad_6/benchmark/resultados/grafica_throughput.svg` y `grafica_p95.svg`.

### Crecimiento de datos

| Escala | Órdenes | Eventos | Throughput | p95 |
|---|---:|---:|---:|---:|
| S — 1x | 10.000 | 100.000 | 621,83 ops/s | 71 ms |
| M — 5x | 50.000 | 500.000 | 164,73 ops/s | 309 ms |
| L — 10x | 100.000 | 1.000.000 | 91,94 ops/s | 568 ms |

### Cuellos de botella

- dashboard híbrido con agregación completa;
- competencia de catálogo, eventos y analítica por el mismo MongoDB;
- sincronización MongoDB dentro del camino del checkout;
- consulta geoespacial identificada en Unidad 4.

## 6. Análisis arquitectónico crítico

### ¿Fue correcta la selección?

[ARGUMENTAR que PostgreSQL fue correcto para el núcleo financiero y MongoDB para proyecciones/datos flexibles. Reconocer que el dashboard requiere una capa analítica preagregada.]

### Consistencia eventual

- Definir SLO de lag: [PROPONER VALOR].
- Registrar `source_updated_at`.
- Rechazar eventos fuera de orden.
- Revalidar precio, promoción y stock al comprar.
- Reconciliar outbox y generar alertas por eventos pendientes.

### Lecciones aprendidas

[AGREGAR reflexiones propias del equipo: costo operativo de dos motores, importancia de medir p95, diferencia entre escala funcional y productiva.]

## 7. Recomendaciones estratégicas

### Plan de escalamiento 10x

1. Preagregación diaria/horaria de eventos.
2. Réplicas de lectura y separación OLTP/analítica.
3. Caché de catálogo y búsquedas frecuentes.
4. CDC para reducir el lag de la proyección.
5. Autoscaling basado en p95, CPU, conexiones y replication lag.

### Migración de free tier a producción

- separar desarrollo, staging y producción;
- utilizar alta disponibilidad, backups y recuperación point-in-time;
- dimensionar por CPU, memoria, almacenamiento, IOPS, transferencia y retención;
- ejecutar pruebas de failover y restauración;
- activar alertas y límites presupuestales;
- validar precios en la región seleccionada antes de entregar.

### Tecnologías complementarias

| Necesidad | Alternativa | Justificación |
|---|---|---|
| Caché | Redis | Catálogo, categorías y consultas repetidas con TTL e invalidación. |
| Búsqueda | MongoDB Search u OpenSearch | Texto, filtros y relevancia sin cargar el OLTP. |
| Observabilidad | OpenTelemetry + backend elegido | Correlacionar trazas, métricas y logs. |
| Streaming/CDC | Debezium + Kafka compatible | Propagar cambios y desacoplar proyecciones. |
| Migraciones | Flyway o Liquibase | Cambios versionados y verificables en CI/CD. |

### CI/CD de esquema

1. Migraciones inmutables versionadas.
2. Validación estática y pruebas sobre una base efímera.
3. Compatibilidad backward/forward mediante estrategia expand-contract.
4. Despliegue en staging, respaldo y aprobación.
5. Migración productiva con observación y rollback documentado.

## 8. Conclusiones

[RESUMIR cumplimiento de objetivos, evidencia principal, decisión híbrida y cambios propuestos. Añadir reflexión propia del equipo.]

## 9. Referencias y anexos

- Referenciar documentación oficial de PostgreSQL, MongoDB, JMeter y OpenTelemetry.
- Anexo A: scripts de pruebas.
- Anexo B: CSV consolidados.
- Anexo C: planes `EXPLAIN ANALYZE` de Unidad 4.
- Anexo D: diagramas y modelos.

