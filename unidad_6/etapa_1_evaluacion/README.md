# Unidad 6 — Etapa 1: Evaluación de la implementación

Este directorio contiene el primer entregable, de carácter **formativo**, de la Unidad 6 para el caso Ecommify. El documento principal es `05_entregable_formativo.md`.

## Alcance exigido por la guía

1. Pruebas de rendimiento y escalabilidad.
2. Análisis comparativo PostgreSQL vs. MongoDB.
3. Decisiones arquitectónicas basadas en el teorema CAP.
4. Trade-offs de consistencia, disponibilidad y tolerancia a particiones.

## Archivos

| Archivo | Propósito |
|---|---|
| `01_plan_pruebas.md` | Metodología reproducible de carga, escalabilidad y consultas complejas. |
| `02_comparativo_postgresql_mongodb.md` | Matriz cuantitativa y cualitativa por carga de trabajo. |
| `03_cap_y_escenarios_falla.md` | Posición CP/AP, fallas, replication lag y mitigaciones. |
| `04_tradeoffs_escenarios_negocio.md` | Black Friday, checkout/pagos y auditoría financiera. |
| `05_entregable_formativo.md` | Documento integrado final de la etapa formativa. |
| `06_resultados_pruebas.md` | Resultados cuantitativos, gráficas y cuellos de botella. |
| `resultados/plantilla_metricas.csv` | Formato único para registrar cada corrida. |

## Entregables Office

La carpeta `entregables/` contiene los archivos editables para la entrega formativa:

| Archivo | Requisito cubierto |
|---|---|
| `01_Pruebas_Rendimiento_y_Escalabilidad.docx` | Suite, ejecución, métricas, degradación, cuellos de botella y recomendaciones. |
| `02_Analisis_Comparativo_PostgreSQL_vs_MongoDB.docx` | Comparación cuantitativa/cualitativa y viabilidad 100 % SQL/NoSQL. |
| `03_Analisis_Arquitectonico_CAP.pptx` | CAP por módulo, particiones, replication lag y garantías. |
| `04_Tradeoffs_y_Escenarios_Operacionales.docx` | Black Friday, checkout, auditoría y playbooks operacionales. |

Para regenerarlos:

```bash
cd ../office_generator
npm install
node generate_stage1.js
```

## Estado de la evidencia

- **Disponible:** 25 corridas de concurrencia, 9 corridas de escalabilidad por volumen y resultados PostgreSQL de Unidad 4.
- **Resultado:** 31 corridas distintas de 120 segundos, todas con 0 % de errores. La comparación S/M/L reutiliza tres corridas S de la matriz de concurrencia.
- **Regla:** las comparaciones se limitan a los flujos medidos; no se declara un ganador universal.

## Reproducibilidad

El entorno ejecutable está disponible en `../benchmark/`. Incluye PostgreSQL, MongoDB, una API mínima de integración, JMeter, restauración entre corridas y consolidación automática de métricas y gráficas.
