#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

usage() {
  cat <<'HELP'
Uso:
  ./run_tests.sh smoke [usuarios] [duracion] [rampa] [nombre]
  ./run_tests.sh concurrency [duracion] [repeticiones] [rampa]
  ./run_tests.sh scalability [duracion] [repeticiones]
  ./run_tests.sh all [duracion] [repeticiones_concurrencia] [repeticiones_escala] [rampa]
  ./run_tests.sh consolidate
  ./run_tests.sh stop

Ejemplos:
  ./run_tests.sh smoke 2 15 2 demo
  ./run_tests.sh concurrency 120 5 10
  ./run_tests.sh scalability 120 3
  ./run_tests.sh all 120 5 3 10

Variables opcionales:
  KEEP_RUNNING=1  Mantiene los contenedores activos al finalizar.
HELP
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Falta el comando requerido: $1" >&2
    exit 1
  fi
}

validate_environment() {
  require_command docker
  require_command curl
  require_command node

  if ! docker info >/dev/null 2>&1; then
    echo "Docker no está disponible. Inicie Docker Desktop y vuelva a ejecutar." >&2
    exit 1
  fi

  available_kb="$(df -Pk . | awk 'NR == 2 {print $4}')"
  if [ "${available_kb:-0}" -lt 2097152 ]; then
    echo "Advertencia: hay menos de 2 GiB disponibles. No se ejecutarán pruebas de volumen." >&2
    return 2
  fi
}

stop_services() {
  docker compose down
}

consolidate() {
  mkdir -p resultados

  if find resultados -maxdepth 1 -name 'formal_s_u*_r*.jtl' -print -quit | grep -q .; then
    node scripts/consolidate_results.js resultados
  else
    echo "No hay corridas de concurrencia para consolidar."
  fi

  if find resultados -maxdepth 1 -name 'scale_[ml]_u10_r*.jtl' -print -quit | grep -q .; then
    node scripts/consolidate_scalability.js resultados
  else
    echo "No hay corridas M/L para consolidar."
  fi
}

MODE="${1:-}"
if [ -z "$MODE" ] || [ "$MODE" = "help" ] || [ "$MODE" = "--help" ] || [ "$MODE" = "-h" ]; then
  usage
  exit 0
fi
shift

case "$MODE" in
  stop)
    require_command docker
    stop_services
    exit 0
    ;;
  consolidate)
    require_command node
    consolidate
    exit 0
    ;;
  smoke|concurrency|scalability|all)
    validate_environment || environment_status=$?
    environment_status="${environment_status:-0}"
    ;;
  *)
    echo "Modo no reconocido: $MODE" >&2
    usage
    exit 2
    ;;
esac

case "$MODE" in
  smoke)
    users="${1:-2}"
    duration="${2:-15}"
    ramp="${3:-2}"
    name="${4:-smoke_$(date +%Y%m%d_%H%M%S)}"
    bash run_benchmark.sh "$users" "$duration" "$ramp" "$name"
    ;;
  concurrency)
    duration="${1:-120}"
    repetitions="${2:-5}"
    ramp="${3:-10}"
    bash run_matrix.sh "$duration" "$repetitions" "$ramp"
    ;;
  scalability)
    if [ "$environment_status" -eq 2 ]; then
      echo "Prueba cancelada para proteger el almacenamiento local." >&2
      exit 1
    fi
    duration="${1:-120}"
    repetitions="${2:-3}"
    bash run_scalability.sh "$duration" "$repetitions"
    ;;
  all)
    if [ "$environment_status" -eq 2 ]; then
      echo "Se ejecutará concurrencia, pero se omitirá escalabilidad por falta de espacio." >&2
    fi
    duration="${1:-120}"
    concurrency_repetitions="${2:-5}"
    scalability_repetitions="${3:-3}"
    ramp="${4:-10}"

    bash run_matrix.sh "$duration" "$concurrency_repetitions" "$ramp"
    if [ "$environment_status" -ne 2 ]; then
      bash run_scalability.sh "$duration" "$scalability_repetitions"
    fi
    consolidate
    ;;
esac

if [ "${KEEP_RUNNING:-0}" = "1" ]; then
  echo "Los contenedores permanecen activos porque KEEP_RUNNING=1."
else
  stop_services
fi

echo "Proceso finalizado. Resultados disponibles en: $SCRIPT_DIR/resultados"

