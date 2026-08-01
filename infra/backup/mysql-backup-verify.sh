#!/usr/bin/env bash
set -Eeuo pipefail

: "${MYSQL_HOST:?MYSQL_HOST is required}"
: "${MYSQL_USER:?MYSQL_USER is required}"
: "${MYSQL_PASSWORD:?MYSQL_PASSWORD is required}"
backup_file="${1:?Usage: mysql-backup-verify.sh /backups/file.sql.gz}"
verify_db="backup_verify_$(date +%s)_$RANDOM"

test -f "$backup_file"
test -f "${backup_file}.sha256"
(cd "$(dirname "$backup_file")" && sha256sum -c "$(basename "$backup_file").sha256")
gzip -t "$backup_file"

export MYSQL_PWD="$MYSQL_PASSWORD"
cleanup() {
  mysql --host="$MYSQL_HOST" --port="${MYSQL_PORT:-3306}" --user="$MYSQL_USER" \
    -e "DROP DATABASE IF EXISTS \`${verify_db}\`" >/dev/null
}
trap cleanup EXIT

mysql --host="$MYSQL_HOST" --port="${MYSQL_PORT:-3306}" --user="$MYSQL_USER" \
  -e "CREATE DATABASE \`${verify_db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
gzip -dc "$backup_file" | mysql \
  --host="$MYSQL_HOST" --port="${MYSQL_PORT:-3306}" --user="$MYSQL_USER" \
  "$verify_db"
table_count="$(mysql --host="$MYSQL_HOST" --port="${MYSQL_PORT:-3306}" \
  --user="$MYSQL_USER" -N -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${verify_db}'")"
if [[ "$table_count" -lt 1 ]]; then
  echo "backup verification failed: no tables restored" >&2
  exit 1
fi
echo "backup_verified file=${backup_file} restored_tables=${table_count}"
