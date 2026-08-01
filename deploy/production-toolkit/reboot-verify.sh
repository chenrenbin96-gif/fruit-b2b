#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/fruit-order
source deploy/production-toolkit/lib.sh
load_env
for service in mysql redis api admin nginx backup; do wait_healthy "$service" 20; done
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=TCP -h 127.0.0.1 -P "${MYSQL_PORT:-13306}" -uroot "$MYSQL_DATABASE" -e 'SELECT COUNT(*) AS orders_after_reboot FROM orders; SELECT COUNT(*) AS after_sales_after_reboot FROM after_sales_orders;'
curl -fsS http://127.0.0.1/api/v1/health/ready
echo "重启后容器、自启动、数据库持久化验证通过"
