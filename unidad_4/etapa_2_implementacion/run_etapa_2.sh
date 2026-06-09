#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RESULTS_DIR="$SCRIPT_DIR/resultados"

mkdir -p "$RESULTS_DIR"

cd "$REPO_ROOT"

echo "== Unidad 4 Etapa 2: ejecucion de pruebas PostgreSQL =="
echo "Repo: $REPO_ROOT"
echo "Resultados: $RESULTS_DIR"

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker no esta corriendo. Abre Docker Desktop y vuelve a ejecutar este script." >&2
  exit 1
fi

echo "== Levantando PostgreSQL =="
docker compose -f docker-compose.u4.yml up -d postgres_u4

echo "== Esperando healthcheck de ecommify_postgres_u4 =="
for i in {1..30}; do
  status="$(docker inspect -f '{{.State.Health.Status}}' ecommify_postgres_u4 2>/dev/null || true)"
  if [[ "$status" == "healthy" ]]; then
    echo "PostgreSQL healthy."
    break
  fi
  if [[ "$i" == "30" ]]; then
    echo "ERROR: PostgreSQL no llego a estado healthy. Estado actual: ${status:-desconocido}" >&2
    docker logs ecommify_postgres_u4 >&2 || true
    exit 1
  fi
  sleep 2
done

echo "== Esperando inicializacion completa del esquema =="
for i in {1..60}; do
  if docker exec ecommify_postgres_u4 psql -U postgres -d ecommify -tAc "SELECT to_regclass('public.\"order\"') IS NOT NULL" 2>/dev/null | grep -q "t"; then
    echo "Esquema PostgreSQL disponible."
    break
  fi
  if [[ "$i" == "60" ]]; then
    echo "ERROR: El esquema no estuvo disponible despues de esperar la inicializacion." >&2
    docker logs ecommify_postgres_u4 >&2 || true
    exit 1
  fi
  sleep 2
done

timestamp="$(date '+%Y-%m-%d_%H-%M-%S')"
baseline_file="$RESULTS_DIR/baseline_explain_${timestamp}.txt"
indexes_file="$RESULTS_DIR/indices_u4_${timestamp}.txt"
optimized_file="$RESULTS_DIR/optimized_explain_${timestamp}.txt"
partition_file="$RESULTS_DIR/partition_validation_${timestamp}.txt"
summary_file="$RESULTS_DIR/resumen_metricas_${timestamp}.md"
seed_file="$RESULTS_DIR/seed_synthetic_${timestamp}.txt"

echo "== Generando datos sinteticos (~150k ordenes) =="
docker exec -i ecommify_postgres_u4 psql -v ON_ERROR_STOP=1 -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/00_seed_synthetic_data.sql \
  | tee "$seed_file"

echo "== Ejecutando baseline =="
docker exec -i ecommify_postgres_u4 psql -v ON_ERROR_STOP=1 -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/01_baseline_explain_analyze.sql \
  | tee "$baseline_file"

echo "== Creando indices U4 =="
docker exec -i ecommify_postgres_u4 psql -v ON_ERROR_STOP=1 -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/02_indices_optimizacion_u4.sql \
  | tee "$indexes_file"

echo "== Ejecutando consultas optimizadas =="
docker exec -i ecommify_postgres_u4 psql -v ON_ERROR_STOP=1 -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/03_consultas_optimizadas.sql \
  | tee "$optimized_file"

echo "== Validando particionamiento =="
docker exec -i ecommify_postgres_u4 psql -v ON_ERROR_STOP=1 -U postgres -d ecommify \
  < unidad_4/etapa_2_implementacion/sql/04_validacion_particionamiento.sql \
  | tee "$partition_file"

cat > "$summary_file" <<EOF
# Resumen automatico Unidad 4 Etapa 2

Fecha de ejecucion: $timestamp

## Archivos generados

- Baseline: \`$(basename "$baseline_file")\`
- Indices: \`$(basename "$indexes_file")\`
- Optimizado: \`$(basename "$optimized_file")\`
- Particionamiento: \`$(basename "$partition_file")\`

## Planning/Execution Time detectados

### Baseline

\`\`\`text
$(grep -E 'QUERY PLAN|Planning Time|Execution Time|Buffers:' "$baseline_file" | head -n 120)
\`\`\`

### Optimizado

\`\`\`text
$(grep -E 'QUERY PLAN|Planning Time|Execution Time|Buffers:' "$optimized_file" | head -n 120)
\`\`\`

## Siguiente paso

Copiar los tiempos y buffers principales a \`plantilla_metricas.md\` y calcular:

\`\`\`text
Mejora tiempo % = ((execution_antes - execution_despues) / execution_antes) * 100
Mejora buffers % = ((buffers_antes - buffers_despues) / buffers_antes) * 100
\`\`\`
EOF

echo "== Listo =="
echo "Resumen: $summary_file"
