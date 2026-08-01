#!/bin/sh
set -eu

command -v openssl >/dev/null 2>&1 || {
  echo "openssl is required" >&2
  exit 1
}

echo "JWT_ACCESS_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
echo "MYSQL_PASSWORD=$(openssl rand -base64 36 | tr -d '\n')"
echo "MYSQL_ROOT_PASSWORD=$(openssl rand -base64 36 | tr -d '\n')"
echo "REDIS_PASSWORD=$(openssl rand -base64 36 | tr -d '\n')"
