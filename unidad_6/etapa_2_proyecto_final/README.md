# Unidad 6 - Etapa 2: Proyecto final

Esta carpeta contiene los insumos y archivos editables para el cierre del proyecto final de Unidad 6. El equipo debe revisar redaccion, capturas, conclusiones, formato institucional y exportaciones finales antes de entregar.

## Insumos

| Archivo | Uso |
|---|---|
| `01_base_informe_tecnico.md` | Estructura y contenido inicial del informe técnico integral. |
| `02_base_presentacion.md` | Contenido sugerido para una presentación ejecutiva de 12 diapositivas. |
| `03_guion_video.md` | Guion cronometrado para grabar el video de 12 a 15 minutos. |
| `04_checklist_repositorio.md` | Tareas para convertir el repositorio actual en el entregable final. |

## Uso de las bases

Los archivos Markdown son la base de contenido para que el equipo prepare manualmente el informe, la presentacion y el video final. Los documentos Office finales no se regeneran desde el repositorio; deben elaborarse y ajustarse manualmente a partir de estas bases.

## Evidencia de pruebas

La evidencia tecnica se encuentra en:

| Ruta | Contenido |
|---|---|
| `../benchmark/guia_ejecucion_pruebas.md` | Guia para ejecutar smoke, concurrencia, escalabilidad y consolidacion. |
| `../benchmark/resultados/` | CSV consolidados, resumenes Markdown, graficas SVG y reportes JMeter disponibles localmente. |
| `../etapa_1_evaluacion/06_resultados_pruebas.md` | Resultados explicados: throughput, p95, p99, errores y cuellos de botella. |

## Secuencia recomendada para demostracion

Desde `unidad_6/benchmark`:

```bash
./run_tests.sh smoke 2 15 2 video_demo
```

Esta prueba valida PostgreSQL, MongoDB, la API hibrida y JMeter con 2 usuarios concurrentes durante 15 segundos y rampa de 2 segundos.

Para una prueba corta pero analizable:

```bash
./run_tests.sh concurrency 60 2 10
./run_tests.sh scalability 60 2
./run_tests.sh consolidate
```

Para repetir la prueba formal:

```bash
./run_tests.sh concurrency 120 5 10
./run_tests.sh scalability 120 3
./run_tests.sh consolidate
```

## Evidencia que debe conservarse para entrega

- 25 corridas de concurrencia.
- 6 corridas adicionales de volumen M/L, reutilizando la escala S de la matriz de concurrencia.
- CSV consolidados y gráficas SVG de `unidad_6/benchmark/resultados/`.
- Resultados `EXPLAIN (ANALYZE, BUFFERS)` de Unidad 4.
- Diagramas existentes en `docs/diagrams/`.
- Capturas del reporte HTML de JMeter o de la ejecucion en terminal para el video.

## Pendientes del equipo

- Agregar portada y formato institucional.
- Revisar nombres, roles y aportes de los integrantes.
- Incorporar capturas de la demostración.
- Validar costos con el proveedor y región elegidos.
- Exportar informe y presentación a PDF.
- Grabar y editar el video con el guion suministrado.
