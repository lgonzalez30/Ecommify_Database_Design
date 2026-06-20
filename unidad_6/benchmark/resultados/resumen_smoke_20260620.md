# Resultado de validación — `smoke_20260620`

## Propósito

Validar que PostgreSQL, MongoDB, la API híbrida y JMeter operan conjuntamente antes de ejecutar la matriz formal de carga. Esta corrida **no es un benchmark concluyente**.

## Configuración

| Parámetro | Valor |
|---|---:|
| Usuarios concurrentes | 2 |
| Rampa | 2 s |
| Duración | 15 s |
| Escala | S |
| Operaciones totales | 7.536 |
| Errores | 0 |
| Throughput global | 503,95 solicitudes/s |
| Latencia media global | 3,70 ms |
| p95 global | 12 ms |
| p99 global | 21,63 ms |

## Desglose por flujo

| Flujo | Muestras | Media | p95 | Máximo | Throughput | Errores |
|---|---:|---:|---:|---:|---:|---:|
| T05 — catálogo MongoDB | 1.508 | 1,79 ms | 6 ms | 34 ms | 100,93/s | 0 |
| T02 — detalle orden PostgreSQL | 1.508 | 1,08 ms | 3 ms | 23 ms | 101,13/s | 0 |
| T06 — evento MongoDB | 1.507 | 1,32 ms | 4 ms | 48 ms | 101,19/s | 0 |
| T01 — checkout híbrido | 1.507 | 4,38 ms | 11 ms | 86 ms | 101,13/s | 0 |
| T09 — dashboard híbrido | 1.506 | 9,91 ms | 19 ms | 99 ms | 101,35/s | 0 |

## Interpretación

Los cinco flujos respondieron sin errores y ejercitaron ambos motores. El dashboard híbrido fue la operación más costosa, como era esperable porque agrega información de PostgreSQL y MongoDB. La siguiente etapa debe repetir corridas de 120 segundos con 1, 10, 25, 50 y 100 usuarios; únicamente esa serie permitirá identificar degradación y punto de quiebre.

