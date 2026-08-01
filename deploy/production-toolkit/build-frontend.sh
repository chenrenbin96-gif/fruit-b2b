#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/fruit-order
source deploy/production-toolkit/lib.sh
load_env
compose build --pull admin
compose up -d admin
wait_healthy admin
echo "Admin生产构建与启动完成"
