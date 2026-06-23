# Ejecucion de Pruebas de Rendimiento - Unidad 6

## Objetivo

Ejecutar una prueba de rendimiento suficientemente representativa para analizar el comportamiento del sistema Ecommify usando PostgreSQL, MongoDB, API hibrida y JMeter.

Las pruebas permiten medir:

- Usuarios concurrentes.
- Throughput o solicitudes por segundo.
- Latencia p50, p95 y p99.
- Porcentaje de errores.
- Comportamiento al aumentar la cantidad de datos.

## 1. Entrar a la carpeta de benchmark

Desde la raiz del proyecto:

```bash
cd unidad4/Ecommify_Database_Design/unidad_6/benchmark
```

## 2. Ejecutar prueba smoke

```bash
./run_tests.sh smoke 2 15 2 smoke_demo
```

### Significado

| Parametro | Valor | Descripcion |
|---|---:|---|
| `smoke` | - | Prueba rapida de validacion |
| `2` | usuarios | 2 usuarios concurrentes |
| `15` | segundos | Duracion de la prueba |
| `2` | segundos | Rampa de inicio |
| `smoke_demo` | nombre | Nombre de la corrida |

Esta prueba valida que PostgreSQL, MongoDB, la API y JMeter esten funcionando correctamente. No se considera una prueba formal de rendimiento.

## 3. Ejecutar prueba de concurrencia

```bash
./run_tests.sh concurrency 60 2 10
```

### Significado

| Parametro | Valor | Descripcion |
|---|---:|---|
| `concurrency` | - | Prueba de usuarios concurrentes |
| `60` | segundos | Duracion de cada corrida |
| `2` | repeticiones | Cada nivel de usuarios se ejecuta 2 veces |
| `10` | segundos | Rampa de inicio |

### Usuarios probados

| Nivel | Usuarios concurrentes |
|---:|---:|
| 1 | 1 usuario |
| 2 | 10 usuarios |
| 3 | 25 usuarios |
| 4 | 50 usuarios |
| 5 | 100 usuarios |

Total de corridas:

```text
5 niveles x 2 repeticiones = 10 corridas
```

## 4. Ejecutar prueba de escalabilidad

```bash
./run_tests.sh scalability 60 2
```

### Significado

| Parametro | Valor | Descripcion |
|---|---:|---|
| `scalability` | - | Prueba de crecimiento de datos |
| `60` | segundos | Duracion de cada corrida |
| `2` | repeticiones | Cada escala se ejecuta 2 veces |

Esta prueba mantiene fija la concurrencia en 10 usuarios y cambia el tamano del dataset.

### Escalas

| Escala | Descripcion |
|---|---|
| S | Dataset inicial/base |
| M | Dataset mediano |
| L | Dataset grande |

La escala S se carga inicialmente con los scripts `postgres/init.sql` y `mongo/init.js`.

Las escalas M y L se cargan usando:

- `scale_dataset.sh`
- `postgres/scale.sql`
- `mongo/scale.js`

## 5. Consolidar resultados

```bash
./run_tests.sh consolidate
```

Este comando procesa los archivos `.jtl` generados por JMeter y crea archivos consolidados con metricas y graficas.

## 6. Secuencia completa recomendada

```bash
cd unidad4/Ecommify_Database_Design/unidad_6/benchmark
./run_tests.sh smoke 2 15 2 smoke_demo
./run_tests.sh concurrency 60 2 10
./run_tests.sh scalability 60 2
./run_tests.sh consolidate
```

## 7. Archivos de resultados

Los resultados quedan en:

```bash
resultados/
```

Archivos principales:

| Archivo | Descripcion |
|---|---|
| `resumen_matriz_formal.md` | Resumen de la prueba de concurrencia |
| `resumen_escalabilidad.md` | Resumen de la prueba de escalabilidad |
| `consolidado_metricas.csv` | Metricas consolidadas de concurrencia |
| `consolidado_escalabilidad.csv` | Metricas consolidadas de escalabilidad |
| `grafica_throughput.svg` | Grafica de throughput por concurrencia |
| `grafica_p95.svg` | Grafica de latencia p95 por concurrencia |
| `grafica_escalabilidad_throughput.svg` | Grafica de throughput por escala |
| `grafica_escalabilidad_p95.svg` | Grafica de latencia p95 por escala |

## 8. Prueba formal para entrega

Si se quiere ejecutar la prueba formal completa usada para el informe:

```bash
./run_tests.sh concurrency 120 5 10
./run_tests.sh scalability 120 3
./run_tests.sh consolidate
```

### Concurrencia formal

| Parametro | Valor |
|---|---:|
| Duracion | 120 segundos |
| Repeticiones | 5 por nivel |
| Rampa | 10 segundos |
| Usuarios | 1, 10, 25, 50 y 100 |

Total:

```text
5 niveles x 5 repeticiones = 25 corridas
```

### Escalabilidad formal

| Parametro | Valor |
|---|---:|
| Duracion | 120 segundos |
| Usuarios fijos | 10 |
| Repeticiones | 3 por escala |
| Escalas | S, M y L |

## 9. Interpretacion de metricas

| Metrica | Significado |
|---|---|
| Throughput | Solicitudes procesadas por segundo |
| p50 | El 50 % de las respuestas fueron iguales o menores a ese tiempo |
| p95 | El 95 % de las respuestas fueron iguales o menores a ese tiempo |
| p99 | El 99 % de las respuestas fueron iguales o menores a ese tiempo |
| Error % | Porcentaje de solicitudes fallidas |

Para el analisis se debe observar principalmente:

- Si el throughput aumenta al subir usuarios.
- Si la latencia p95 crece demasiado.
- Si aparecen errores.
- En que punto el sistema deja de escalar.

