# Unidad 6 — Etapa 2: Proyecto final

Esta carpeta contiene **bases editables**, no entregables cerrados. El equipo debe ajustar redacción, diseño visual, capturas, costos, conclusiones personales y formato institucional antes de entregar.

## Insumos

| Archivo | Uso |
|---|---|
| `01_base_informe_tecnico.md` | Estructura y contenido inicial del informe técnico integral. |
| `02_base_presentacion.md` | Contenido sugerido para una presentación ejecutiva de 12 diapositivas. |
| `03_guion_video.md` | Guion cronometrado para grabar el video de 12 a 15 minutos. |
| `04_checklist_repositorio.md` | Tareas para convertir el repositorio actual en el entregable final. |

## Archivos Office generados

| Archivo | Formato | Características |
|---|---|---|
| `Informe_Tecnico_Integral_Ecommify.docx` | Word editable | Informe gerencial con portada, tablas, diagramas, resultados, recomendaciones y anexos. |
| `Presentacion_Ejecutiva_Ecommify_U6.pptx` | PowerPoint editable | 12 diapositivas, gráficos nativos, arquitectura, CAP y hoja de ruta. |

Para regenerarlos después de modificar el generador:

```bash
cd unidad_6/office_generator
npm install
node generate_office.js
```

## Evidencia que debe conservarse

- 25 corridas de concurrencia y 6 corridas adicionales de volumen.
- CSV consolidados y gráficas SVG de `unidad_6/benchmark/resultados/`.
- Resultados `EXPLAIN (ANALYZE, BUFFERS)` de Unidad 4.
- Diagramas existentes en `docs/diagrams/`.

## Pendientes del equipo

- Agregar portada y formato institucional.
- Revisar nombres, roles y aportes de los integrantes.
- Incorporar capturas de la demostración.
- Validar costos con el proveedor y región elegidos.
- Exportar informe y presentación a PDF.
- Grabar y editar el video con el guion suministrado.
