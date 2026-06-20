# Benchmark híbrido Ecommify — Unidad 6

Entorno aislado para generar carga concurrente sobre los dos motores de Ecommify.

## Arquitectura de prueba

```text
JMeter ──HTTP──> benchmark-api ──SQL──> PostgreSQL 16 Alpine
                              └─CRUD──> MongoDB 7
```

Los dos contenedores de datos son independientes de Unidad 4. La API no pretende representar toda la aplicación: es un adaptador mínimo para medir flujos reproducibles de catálogo, órdenes, eventos, checkout y dashboard híbrido.

JMeter 5.6.3 se ejecuta en un contenedor separado y usa HTTP, que es el nivel correcto para simular usuarios concurrentes. El plan no requiere plugins ni drivers adicionales.

## Script consolidado

El punto de entrada recomendado es `run_tests.sh`:

```bash
./run_tests.sh smoke 2 15 2 demo
./run_tests.sh concurrency 120 5 10
./run_tests.sh scalability 120 3
./run_tests.sh all 120 5 3 10
./run_tests.sh consolidate
./run_tests.sh stop
```

`all` ejecuta concurrencia, escalabilidad y consolidación. Las corridas cuyo JTL ya existe se omiten. Al terminar, los contenedores se detienen sin eliminar sus datos. Para mantenerlos activos:

```bash
KEEP_RUNNING=1 ./run_tests.sh smoke 2 15 2 demo
```

## Datos de la escala S

- PostgreSQL: 5.000 productos, 5.000 clientes y 10.000 órdenes con ítems y pagos.
- MongoDB: 5.000 productos de catálogo y 100.000 eventos representados mediante 10.000 buckets.
- Semilla PostgreSQL fija; documentos MongoDB generados determinísticamente.

## Ejecutar una prueba rápida

```bash
cd unidad_6/benchmark
./run_benchmark.sh 2 15 2 smoke
```

Parámetros posicionales:

1. usuarios concurrentes;
2. duración en segundos;
3. rampa en segundos;
4. identificador opcional de la corrida.

Prueba base sugerida:

```bash
./run_benchmark.sh 10 120 10 u6_s_u10_r1
```

Repetir cinco veces por nivel de concurrencia: 1, 10, 25, 50 y 100 usuarios.

Para ejecutar automáticamente la matriz completa y restaurar el baseline antes de cada corrida:

```bash
./run_matrix.sh 120 5 10
```

Los parámetros son duración, número de repeticiones y rampa. Al finalizar se generan el CSV consolidado, el resumen Markdown y las gráficas SVG.

La serie de escalabilidad mantiene 10 usuarios y compara S, M y L:

```bash
./run_scalability.sh 120 3
```

## Salidas

Cada corrida crea:

- `resultados/<run>.jtl`: evidencia cruda por petición.
- `resultados/<run>-report/index.html`: informe gráfico generado por JMeter.

La validación inicial está resumida en `resultados/resumen_smoke_20260620.md`.

Los endpoints medidos son:

| Etiqueta | Endpoint | Motor |
|---|---|---|
| T05 | `GET /catalog` | MongoDB |
| T02 | `GET /orders/:id` | PostgreSQL |
| T06 | `POST /events` | MongoDB |
| T01 | `POST /checkout` | PostgreSQL y proyección MongoDB |
| T09 | `GET /hybrid/dashboard` | PostgreSQL y MongoDB en paralelo |

## Operación

Ver estado:

```bash
docker compose ps
curl http://localhost:3006/health
```

Detener sin borrar los datos:

```bash
docker compose down
```

Reiniciar completamente la escala S —esto elimina exclusivamente los volúmenes del benchmark—:

```bash
docker compose down -v
```

## Límites de interpretación

- La escala S valida el método, no representa producción.
- El dashboard agrega toda la colección y permite observar degradación intencionalmente.
- MongoDB corre como nodo único; no demuestra AP ni comportamiento de replica set.
- El checkout usa outbox: si falla la proyección MongoDB, la orden queda confirmada en PostgreSQL y el evento pendiente puede reconciliarse.
