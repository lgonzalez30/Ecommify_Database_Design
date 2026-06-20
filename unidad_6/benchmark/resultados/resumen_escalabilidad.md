# Resultados de escalabilidad por volumen

Concurrencia fija: 10 usuarios. Cada valor corresponde a la mediana de tres corridas de 120 segundos.

| Escala | Órdenes | Productos | Eventos representados | Throughput | p50 | p95 | p99 | Errores |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| S | 10.000 | 5.000 | 100.000 | 621.83 ops/s | 4.00 ms | 71.00 ms | 112.00 ms | 0.0000 % |
| M | 50.000 | 20.000 | 500.000 | 164.73 ops/s | 4.00 ms | 309.00 ms | 403.00 ms | 0.0000 % |
| L | 100.000 | 40.000 | 1.000.000 | 91.94 ops/s | 5.00 ms | 568.00 ms | 703.00 ms | 0.0000 % |

![Throughput por volumen](grafica_escalabilidad_throughput.svg)

![Latencia p95 por volumen](grafica_escalabilidad_p95.svg)
