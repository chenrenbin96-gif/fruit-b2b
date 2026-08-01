#!/usr/bin/env bash
set -Eeuo pipefail

: "${MYSQL_HOST:?MYSQL_HOST is required}"
: "${MYSQL_DATABASE:?MYSQL_DATABASE is required}"
: "${MYSQL_USER:?MYSQL_USER is required}"
: "${MYSQL_PASSWORD:?MYSQL_PASSWORD is required}"

backup_dir="${BACKUP_DIR:-/backups}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
base="${backup_dir}/${MYSQL_DATABASE}_${timestamp}.sql.gz"
temporary="${base}.partial"

mkdir -p "$backup_dir"
export MYSQL_PWD="$MYSQL_PASSWORD"
trap 'rm -f "$temporary"' EXIT

mysqldump \
  --host="$MYSQL_HOST" \
  --port="${MYSQL_PORT:-3306}" \
  --user="$MYSQL_USER" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --events \
  --default-character-set=utf8mb4 \
  "$MYSQL_DATABASE" | gzip -9 > "$temporary"

gzip -t "$temporary"
mv "$temporary" "$base"
sha256sum "$base" > "${base}.sha256"
find "$backup_dir" -type f \
  \( -name "${MYSQL_DATABASE}_*.sql.gz" -o -name "${MYSQL_DATABASE}_*.sql.gz.sha256" \) \
  -mtime "+${retention_days}" -delete
echo "backup_completed file=${base}"
