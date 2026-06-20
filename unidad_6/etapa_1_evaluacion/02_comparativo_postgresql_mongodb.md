# 2. Análisis comparativo PostgreSQL vs. MongoDB

## 2.1 Comparación contextual

La pregunta útil no es cuál motor es universalmente mejor, sino cuál ofrece menores riesgos y mejor desempeño para cada carga de Ecommify.

| Aspecto | PostgreSQL | MongoDB | Ganador para Ecommify | Evidencia |
|---|---|---|---|---|
| Órdenes, ítems y pagos | Transacciones ACID, FK y restricciones | Transacciones posibles, pero el modelo pierde naturalidad relacional | **PostgreSQL** | Diseño implementado con PK/FK y pagos auditables. |
| Consultas multi-tabla | Joins, CTE, optimizador y vistas materializadas | `$lookup` disponible, pero contradice el objetivo de documentos autocontenidos | **PostgreSQL** | Q03 y Q09 mejoraron con vistas en U4. |
| Integridad | Restricciones declarativas y tipos | Validadores por documento; referencias entre colecciones no se fuerzan | **PostgreSQL** | DDL implementado en `postgresql/schema/`. |
| Catálogo de lectura | Flexible con JSONB, pero requiere joins para enriquecer | Documento denormalizado listo para frontend | **MongoDB** | T05 obtuvo p95 de 25 ms con 10 usuarios en S; requiere caché al crecer concurrencia. |
| Flexibilidad de esquema | JSONB ofrece flexibilidad controlada | Esquema documental y patrón polimórfico | **MongoDB** para reseñas/eventos; **PostgreSQL** para producto maestro | Validadores MongoDB ya implementados. |
| Escritura masiva de eventos | Puede particionar, pero agrega presión al OLTP | Bucket pattern reduce documentos e inserciones dispersas | **MongoDB** | T06 obtuvo p95 de 14 ms con 10 usuarios en S y 0 % de errores. |
| Consistencia fuerte | Natural en nodo primario y réplicas síncronas configuradas | Depende de read/write concern y topología | **PostgreSQL** para núcleo financiero | T01 confirmó orden, pago y outbox en transacción; 31 corridas finalizaron sin errores. |
| Alta disponibilidad de lectura | Réplicas y failover requieren configuración explícita | Replica sets y read preference facilitan lecturas distribuidas | **MongoDB** para proyecciones AP | El entorno local de nodo único no demuestra AP; requiere topología de prueba. |
| Escalamiento horizontal | Posible con partición externa o soluciones distribuidas | Sharding nativo orientado a documentos | **MongoDB** para eventos/catálogo a gran escala | Diseñar shard key; no afirmar ganancia sin clúster. |
| Búsqueda | `pg_trgm` cubre búsqueda difusa básica | Índice de texto básico; Atlas Search amplía capacidades | **Empate condicionado** | Comparar necesidades reales; búsqueda avanzada puede requerir motor dedicado. |

## 2.2 Ganador por carga, no por marca

- **PostgreSQL:** ganador para órdenes, pagos, inventario, auditoría financiera, relaciones críticas y reportería de negocio estructurada.
- **MongoDB:** ganador contextual para catálogo denormalizado, sesiones, reseñas polimórficas y eventos de comportamiento. La medición confirmó baja latencia en S, pero también la necesidad de preagregar la analítica al crecer el volumen.
- **Arquitectura híbrida:** ganadora cuando el costo de sincronización y operación de dos motores es menor que forzar cargas incompatibles en uno solo.

## 2.3 Evaluación cualitativa

### Casos que superaron expectativas

PostgreSQL resolvió flexibilidad de producto sin sacrificar relaciones mediante `JSONB`, arreglos, `HSTORE` y tipos compuestos. Esto redujo la cantidad de entidades que necesitaban migrar a MongoDB. Las vistas materializadas y el partition pruning demostraron mejoras medibles aun con datos pequeños.

MongoDB simplificó el modelo de catálogo de lectura, sesiones con TTL y eventos agrupados por bucket. T05 y T06 operaron con p95 de 25 y 14 ms respectivamente bajo 10 usuarios en S. Sin embargo, el dashboard que agregó toda la colección se convirtió en el cuello de botella y alcanzó p95 de 517 ms con 100 usuarios.

### ¿Se eligió una tecnología incorrecta?

No hay evidencia actual para mover órdenes o pagos fuera de PostgreSQL. La colección `reviews` sí merece revisión: si el negocio exige que solo una orden entregada pueda publicar una reseña y requiere auditoría fuerte, podría convenir guardar el estado canónico en PostgreSQL y publicar una proyección en MongoDB.

### Viabilidad 100 % relacional

Es técnicamente viable usando PostgreSQL con JSONB, particionamiento y tablas efímeras, y reduciría complejidad operativa. Sin embargo, mezcla eventos y sesiones de alta rotación con el OLTP financiero, aumenta contención y obliga a modelar proyecciones de lectura manualmente.

### Viabilidad 100 % NoSQL

Es técnicamente posible, pero no recomendable para el núcleo actual: obliga a trasladar integridad referencial, validación de pagos y consistencia de órdenes a la aplicación. Ese costo y riesgo no están justificados por evidencia de rendimiento.
