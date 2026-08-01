#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/fruit-order
source deploy/production-toolkit/lib.sh
load_env
compose up -d mysql redis
wait_healthy mysql
wait_healthy redis
compose build --pull api
compose up -d api
wait_healthy api
echo "API生产构建与启动完成"
