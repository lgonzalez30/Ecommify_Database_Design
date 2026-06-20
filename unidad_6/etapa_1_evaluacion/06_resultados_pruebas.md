# 6. Resultados de las pruebas

## 6.1 Entorno

| Componente | Configuración |
|---|---|
| Equipo | Apple M1, 8 GiB RAM |
| Sistema operativo | macOS 26.2 |
| Docker | 20.10.17; Compose 2.7.0 |
| PostgreSQL | 16.14 Alpine, ARM64 |
| MongoDB | 7.0.37 |
| Generador | Apache JMeter 5.6.3 en modo no GUI |
| Duración | 120 segundos por corrida; rampa de 10 segundos |
| Repeticiones | 5 por nivel de concurrencia; 3 por tamaño de dataset |

Antes de cada corrida se eliminaron órdenes, pagos, proyecciones y eventos generados por la prueba, y se restauró el inventario. Así se evitó que una ejecución heredara crecimiento dinámico de la anterior.

## 6.2 Concurrencia sobre escala S

La escala S contenía 10.000 órdenes, 5.000 productos y 100.000 eventos representados mediante 10.000 buckets. Cada valor es la mediana de cinco corridas.

| Usuarios | Throughput | p50 | p95 | p99 | Errores |
|---:|---:|---:|---:|---:|---:|
| 1 | 400,39 ops/s | 1 ms | 7 ms | 11 ms | 0 % |
| 10 | 626,68 ops/s | 4 ms | 71 ms | 110 ms | 0 % |
| 25 | 560,70 ops/s | 16 ms | 190 ms | 268 ms | 0 % |
| 50 | 565,91 ops/s | 65 ms | 252 ms | 354 ms | 0 % |
| 100 | 540,56 ops/s | 172 ms | 396 ms | 525 ms | 0 % |

![Throughput por concurrencia](../benchmark/resultados/grafica_throughput.svg)

![Latencia p95 por concurrencia](../benchmark/resultados/grafica_p95.svg)

El throughput máximo mediano apareció con 10 usuarios. Al pasar de 10 a 25 usuarios cayó 10,53 %, mientras p95 aumentó 167,61 %. Por tanto, el punto de saturación de la mezcla probada se ubica entre 10 y 25 usuarios. El sistema mantuvo disponibilidad funcional hasta 100 usuarios, pero ya no escaló throughput y aumentó significativamente la latencia.

## 6.3 Desglose por flujo

Medianas p95 en milisegundos:

| Flujo | 1 usuario | 10 usuarios | 25 usuarios | 50 usuarios | 100 usuarios |
|---|---:|---:|---:|---:|---:|
| Catálogo MongoDB | 2 | 25 | 45 | 129 | 309 |
| Detalle de orden PostgreSQL | 1 | 5 | 10 | 16 | 27 |
| Evento MongoDB | 1 | 14 | 41 | 123 | 304 |
| Checkout híbrido | 5 | 27 | 69 | 157 | 329 |
| Dashboard híbrido | 11 | 110 | 267 | 353 | 517 |

El detalle de orden PostgreSQL fue el flujo más estable: su p95 se mantuvo en 27 ms incluso con 100 usuarios. El dashboard híbrido fue el cuello de botella: alcanzó p95 de 517 ms porque ejecuta agregaciones sobre PostgreSQL y toda la colección analítica de MongoDB. Catálogo y eventos también se degradaron al competir por el pool y los recursos del nodo MongoDB único.

Los throughput por flujo son similares porque el plan cerrado ejecuta exactamente una operación de cada tipo por iteración. Por esta razón, la comparación entre operaciones se sustenta en latencia y degradación, no en declarar ganador por su throughput individual.

## 6.4 Escalabilidad por volumen

Concurrencia fija de 10 usuarios y tres corridas por escala:

| Escala | Órdenes | Productos | Eventos representados | Throughput | p50 | p95 | p99 | Errores |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| S (1x) | 10.000 | 5.000 | 100.000 | 621,83 ops/s | 4 ms | 71 ms | 112 ms | 0 % |
| M (5x) | 50.000 | 20.000 | 500.000 | 164,73 ops/s | 4 ms | 309 ms | 403 ms | 0 % |
| L (10x) | 100.000 | 40.000 | 1.000.000 | 91,94 ops/s | 5 ms | 568 ms | 703 ms | 0 % |

![Throughput por volumen](../benchmark/resultados/grafica_escalabilidad_throughput.svg)

![Latencia p95 por volumen](../benchmark/resultados/grafica_escalabilidad_p95.svg)

Entre S y L, throughput disminuyó 85,21 % y p95 aumentó 700 %. La estabilidad de p50 —de 4 a 5 ms— indica que las operaciones indexadas simples conservaron buen comportamiento; el deterioro de p95 provino de las operaciones costosas, principalmente el dashboard que agrega todos los eventos.

## 6.5 Cuellos de botella y optimizaciones

1. **Dashboard híbrido sin preagregación.** Reemplazar el escaneo completo por buckets preagregados diarios, vistas materializadas o una colección `behavior_daily`.
2. **Pool compartido de MongoDB.** Separar recursos de lecturas de catálogo, escritura de eventos y analítica; en producción utilizar réplica de lectura o clúster dedicado.
3. **Mezcla síncrona del checkout.** Mantener PostgreSQL como commit canónico y procesar la proyección MongoDB asíncronamente desde el outbox para reducir p95.
4. **Catálogo bajo alta concurrencia.** Incorporar caché por categoría y paginación con índices cubiertos.
5. **Escala local.** Las pruebas comparten CPU, RAM y disco entre JMeter, API y bases; los valores sirven para comparar tendencias dentro del entorno, no como capacidad contractual de producción.

## 6.6 Evidencia reproducible

- Plan JMeter: `unidad_6/benchmark/jmeter/ecommify.jmx`.
- Matriz de concurrencia: `unidad_6/benchmark/run_matrix.sh`.
- Serie de volumen: `unidad_6/benchmark/run_scalability.sh`.
- Métricas consolidadas: `unidad_6/benchmark/resultados/consolidado_metricas.csv` y `consolidado_escalabilidad.csv`.
- Cada corrida conserva su archivo JTL y reporte HTML local; estas salidas pesadas están excluidas del repositorio.

