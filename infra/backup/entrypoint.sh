#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${1:-}" != "" ]]; then
  exec "$@"
fi

schedule="${BACKUP_CRON:-0 2 * * *}"
for variable in MYSQL_HOST MYSQL_PORT MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD \
  BACKUP_DIR BACKUP_RETENTION_DAYS TZ; do
  printf 'export %s=%q\n' "$variable" "${!variable:-}" >> /etc/fruit-b2b-backup.env
done
chmod 0600 /etc/fruit-b2b-backup.env
printf '%s root /bin/bash -c "source /etc/fruit-b2b-backup.env && /opt/backup/mysql-backup.sh" >> /proc/1/fd/1 2>> /proc/1/fd/2\n' \
  "$schedule" > /etc/cron.d/fruit-b2b-backup
chmod 0600 /etc/cron.d/fruit-b2b-backup
echo "MySQL backup scheduler started: ${schedule}"
exec crond -n
