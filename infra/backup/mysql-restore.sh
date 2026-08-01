#!/usr/bin/env bash
set -Eeuo pipefail

: "${MYSQL_HOST:?MYSQL_HOST is required}"
: "${MYSQL_DATABASE:?MYSQL_DATABASE is required}"
: "${MYSQL_USER:?MYSQL_USER is required}"
: "${MYSQL_PASSWORD:?MYSQL_PASSWORD is required}"
backup_file="${1:?Usage: mysql-restore.sh /backups/file.sql.gz}"

test -f "$backup_file"
test -f "${backup_file}.sha256"
(cd "$(dirname "$backup_file")" && sha256sum -c "$(basename "$backup_file").sha256")
gzip -t "$backup_file"

if [[ "${CONFIRM_RESTORE:-}" != "$MYSQL_DATABASE" ]]; then
  echo "Refusing restore. Set CONFIRM_RESTORE=${MYSQL_DATABASE}" >&2
  exit 2
fi

export MYSQL_PWD="$MYSQL_PASSWORD"
gzip -dc "$backup_file" | mysql \
  --host="$MYSQL_HOST" \
  --port="${MYSQL_PORT:-3306}" \
  --user="$MYSQL_USER" \
  --default-character-set=utf8mb4 \
  "$MYSQL_DATABASE"
echo "restore_completed database=${MYSQL_DATABASE} file=${backup_file}"
