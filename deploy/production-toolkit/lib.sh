#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT=${PROJECT_ROOT:-/opt/fruit-order}
TOOLKIT_DIR="$PROJECT_ROOT/deploy/production-toolkit"
COMPOSE_FILE="$TOOLKIT_DIR/docker-compose.yml"

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose --env-file "$PROJECT_ROOT/.env" -f "$COMPOSE_FILE" "$@"
  else
    docker-compose --env-file "$PROJECT_ROOT/.env" -f "$COMPOSE_FILE" "$@"
  fi
}

require_file() { [[ -f "$1" ]] || { echo "缺少文件: $1" >&2; exit 1; }; }
wait_healthy() {
  local service=$1 max=${2:-60} cid status
  cid=$(compose ps -q "$service")
  [[ -n "$cid" ]] || { echo "$service 容器不存在" >&2; return 1; }
  for ((i=1;i<=max;i++)); do
    status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid")
    [[ "$status" == healthy || "$status" == running ]] && return 0
    [[ "$status" == unhealthy || "$status" == exited ]] && { docker logs --tail=100 "$cid"; return 1; }
    sleep 2
  done
  echo "$service 健康检查超时" >&2; docker logs --tail=100 "$cid"; return 1
}

load_env() {
  require_file "$PROJECT_ROOT/.env"
  set -a
  # shellcheck disable=SC1090
  source "$PROJECT_ROOT/.env"
  set +a
}
