# Guion del video final — 12 a 15 minutos

No es un video generado. Es una guía para que el equipo grabe y edite su propia presentación.

## Distribución sugerida

| Tiempo | Sección | Responsable |
|---|---|---|
| 0:00–0:45 | Presentación del equipo y propósito | [NOMBRE] |
| 0:45–2:00 | Problema, objetivos y alcance | [NOMBRE] |
| 2:00–4:00 | Arquitectura híbrida | [NOMBRE] |
| 4:00–6:00 | Implementación y decisiones técnicas | [NOMBRE] |
| 6:00–8:30 | Demostración en vivo | [NOMBRE] |
| 8:30–10:30 | Resultados y comparación | [NOMBRE] |
| 10:30–12:00 | CAP y escenarios de falla | [NOMBRE] |
| 12:00–13:30 | Recomendaciones y lecciones | [NOMBRE] |
| 13:30–14:30 | Conclusiones | [NOMBRE] |

## Texto base

### 0:00–0:45 — Apertura

“Somos [NOMBRES] y presentamos Ecommify, un marketplace multivendedor diseñado con una arquitectura híbrida PostgreSQL–MongoDB. El objetivo final fue comprobar, con implementación y pruebas, si esta selección realmente equilibra consistencia, disponibilidad y escalabilidad.”

### 0:45–2:00 — Contexto

“El sistema combina cargas con necesidades diferentes. Órdenes, pagos e inventario no toleran inconsistencias. El catálogo, las sesiones y los eventos requieren flexibilidad y alta disponibilidad. Por esto evitamos imponer un único motor a todo el sistema.”

### 2:00–4:00 — Arquitectura

Mostrar el diagrama. Explicar PostgreSQL como fuente de verdad y MongoDB como proyección/almacenamiento flexible. Resaltar que catálogo puede estar temporalmente desactualizado, pero checkout siempre valida precio y stock en PostgreSQL.

### 4:00–6:00 — Implementación

Mostrar brevemente el repositorio:

- esquema e índices PostgreSQL;
- particionamiento y vistas materializadas;
- colecciones, validadores e índices MongoDB;
- entorno Docker de pruebas;
- patrón outbox.

### 6:00–8:30 — Demostración

Ejecutar:

```bash
cd unidad_6/benchmark
./run_tests.sh smoke 10 30 5 demo_video
```

Mostrar `docker compose ps`, respuesta de `/health`, ejecución JMeter y reporte HTML. No esperar una matriz completa durante el video.

### 8:30–10:30 — Resultados

“Ejecutamos 31 corridas distintas. En escala S, el máximo throughput mediano fue 626,68 operaciones por segundo con 10 usuarios. Al subir a 25 usuarios, throughput cayó y p95 aumentó de 71 a 190 milisegundos; allí ubicamos el inicio de saturación. Con crecimiento 10x, p95 llegó a 568 milisegundos.”

Mostrar las cuatro gráficas y señalar el dashboard como cuello de botella.

### 10:30–12:00 — CAP

“Durante una partición, pagos, órdenes e inventario operan como CP: preferimos no confirmar antes que aceptar estados divergentes. Catálogo, reseñas, sesiones y eventos operan como AP: pueden continuar con consistencia eventual. La mitigación es revalidar en checkout, usar idempotencia y reconciliar el outbox.”

### 12:00–13:30 — Recomendaciones

- Preagregar eventos por hora/día.
- Procesar el outbox asíncronamente.
- Incorporar caché.
- Medir replication lag.
- Instrumentar trazas, métricas y logs.
- Separar desarrollo, staging y producción.

### 13:30–14:30 — Cierre

“Concluimos que la arquitectura híbrida fue correcta, pero no suficiente por sí sola. La medición mostró que el principal riesgo no era una consulta individual, sino la agregación entre motores. La siguiente evolución debe desacoplar analítica, controlar el lag y operar con observabilidad.”

## Lista de grabación

- Validar que la demo dure menos de tres minutos.
- Ocultar contraseñas y datos sensibles.
- Grabar pantalla a resolución legible.
- Ensayar nombres de archivos y comandos.
- Mostrar gráficas, no archivos JTL crudos.
- Mantener el video entre 12 y 15 minutos.
