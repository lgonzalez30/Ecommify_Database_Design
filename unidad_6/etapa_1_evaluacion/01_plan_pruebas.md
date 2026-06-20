# 1. Plan de pruebas de rendimiento y escalabilidad

## 1.1 Objetivo

Evaluar con evidencia reproducible si la arquitectura híbrida de Ecommify satisface sus cargas transaccionales, de lectura y analíticas. Las pruebas medirán latencia, throughput, tasa de error y degradación al aumentar concurrencia o volumen.

## 1.2 Hipótesis

- PostgreSQL tendrá mejor comportamiento en checkout, pagos y consultas multi-tabla por sus transacciones ACID, claves foráneas e índices relacionales.
- MongoDB tendrá mejor comportamiento en lecturas denormalizadas del catálogo, sesiones y escritura de eventos por evitar joins y utilizar documentos autocontenidos.
- El principal cuello de botella PostgreSQL será la consulta geoespacial de vendedores cercanos, identificada en Unidad 4.
- El principal riesgo MongoDB será el crecimiento de documentos del patrón Bucket y el costo de índices múltiples durante escrituras intensivas.

Estas afirmaciones son hipótesis; no se presentan como resultados antes de medirlas.

## 1.3 Entorno controlado

Registrar antes de cada corrida:

| Variable | Valor requerido |
|---|---|
| Fecha y hora | ISO 8601 |
| Equipo | CPU, RAM y sistema operativo |
| Contenedores | imagen y versión exacta |
| PostgreSQL | versión, tamaño de buffers y conexiones máximas |
| MongoDB | versión, topología y write/read concern |
| Dataset | semilla, escala y conteos por entidad |
| Estado de caché | corrida fría o caliente |
| Duración | calentamiento y medición |

Los dos motores deben ejecutarse en el mismo equipo, sin otros procesos intensivos. Cada escenario se repite al menos cinco veces; se reportan mediana y percentil 95, no solamente el promedio.

## 1.4 Variables de prueba

### Concurrencia

Niveles: **1, 10, 25, 50 y 100 usuarios virtuales**. Cada nivel tendrá 30 segundos de calentamiento y 120 segundos de medición.

### Escala de datos

Tres tamaños con distribución equivalente:

| Escala | Órdenes | Productos | Eventos analíticos | Propósito |
|---|---:|---:|---:|---|
| S | 10.000 | 5.000 | 100.000 | Validación funcional y baseline. |
| M | 50.000 | 20.000 | 500.000 | Evaluar crecimiento 5x. |
| L | 100.000 | 40.000 | 1.000.000 | Evaluar crecimiento 10x sin agotar el almacenamiento local. |

La generación debe ser determinista mediante una semilla documentada. Se conservará la integridad referencial en PostgreSQL y la misma distribución de categorías, estados y fechas en las proyecciones MongoDB.

## 1.5 Suite de cargas

| ID | Flujo | Motor principal | Tipo | Métricas |
|---|---|---|---|---|
| T01 | Crear orden, ítems y pago en una transacción | PostgreSQL | Escritura OLTP | TPS, p50, p95, errores, rollbacks |
| T02 | Consultar detalle completo de una orden | PostgreSQL | Lectura con joins | QPS, p50, p95, buffers |
| T03 | Reporte mensual por categoría | PostgreSQL | Analítica/MV | QPS, p95, filas leídas |
| T04 | Vendedores cercanos al cliente | PostgreSQL/PostGIS | Geoespacial | p95, buffers, CPU |
| T05 | Buscar y filtrar catálogo | MongoDB | Lectura denormalizada | QPS, p50, p95, documentos examinados |
| T06 | Insertar eventos por sesión | MongoDB | Escritura append-only | docs/s, p95, errores |
| T07 | Leer y actualizar sesión/carrito | MongoDB | Lectura/escritura | ops/s, p95, conflictos |
| T08 | Agregación de eventos por tipo y hora | MongoDB | Analítica | p95, docs examinados, memoria |
| T09 | Dashboard híbrido de ventas y comportamiento | Ambos | Multi-fuente | tiempo total, lag y errores parciales |

## 1.6 Métricas y criterios

- **Throughput:** operaciones exitosas por segundo.
- **Latencia:** p50, p95 y p99 en milisegundos.
- **Error rate:** operaciones fallidas / operaciones totales × 100.
- **Degradación:** `(p95_nivel - p95_baseline) / p95_baseline × 100`.
- **Punto de quiebre:** primer nivel donde p95 supera el objetivo, error rate supera 1 % o el throughput deja de crecer al aumentar usuarios.
- **Eficiencia de consulta:** filas/documentos examinados frente a devueltos, plan de ejecución y uso de índices.

Objetivos iniciales: p95 menor a 100 ms para operaciones OLTP simples, menor a 300 ms para catálogo y menor a 2 s para dashboards. Deben validarse con los requisitos del equipo antes de declararlos SLO definitivos.

## 1.7 Procedimiento reproducible

1. Levantar los servicios definidos en `docker-compose.yml`.
2. Verificar salud de ambos motores y registrar versiones.
3. Cargar un dataset de escala S, ejecutar `ANALYZE` en PostgreSQL y validar índices en MongoDB.
4. Ejecutar una corrida de calentamiento no contabilizada.
5. Ejecutar cinco corridas por combinación de carga, escala y concurrencia.
6. Guardar resultados crudos y completar `resultados/plantilla_metricas.csv`.
7. Repetir para escalas M y L sin cambiar configuración durante una serie.
8. Obtener planes con `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` y `explain("executionStats")` para las consultas representativas.
9. Graficar throughput y p95 contra usuarios; p95 contra tamaño del dataset; error rate contra usuarios.
10. Documentar cuellos de botella, punto de quiebre y recomendación concreta.

## 1.8 Evidencia previa de Unidad 4

La ejecución del 8 de junio de 2026 aporta un antecedente, no un benchmark final. Sobre datos mock, la vista materializada de ventas redujo Q03 de 3,076 ms a 0,693 ms; el filtrado temprano redujo Q06 de 1,105 ms a 0,527 ms; la consulta geoespacial Q07 bajó de 187,922 ms a 116,412 ms; y la segmentación mediante vista materializada bajó de 0,493 ms a 0,208 ms. El volumen reducido impide extrapolar estos tiempos a producción.
