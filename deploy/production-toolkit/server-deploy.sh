#!/usr/bin/env bash
set -Eeuo pipefail
if [[ ${EUID} -ne 0 ]]; then echo "请使用root执行" >&2; exit 1; fi
cd /opt/fruit-order
source deploy/production-toolkit/lib.sh
require_file package.json
require_file package-lock.json
require_file apps/api/Dockerfile
require_file apps/admin/Dockerfile
[[ -f .env ]] || bash deploy/production-toolkit/generate-env.sh
load_env

if grep -Eq '=(CHANGE_ME|REPLACE_)' .env; then
  # SMS and S3 placeholders are allowed only while their providers are disabled.
  bad=$(grep -E '=(CHANGE_ME|REPLACE_)' .env | grep -Ev '^(SMS_|STORAGE_)' || true)
  [[ -z "$bad" ]] || { echo "存在未替换生产配置:" >&2; echo "$bad" >&2; exit 1; }
fi
[[ ${JWT_ACCESS_SECRET:-} != "${JWT_REFRESH_SECRET:-}" ]] || { echo "JWT密钥不能相同" >&2; exit 1; }
if [[ ${CUSTOMER_SMS_PROVIDER:-} == http ]]; then
  [[ ${SMS_HTTP_ENDPOINT:-} == https://* && ${SMS_HTTP_ENDPOINT:-} != *CHANGE_ME* ]] || { echo "正式短信网关必须使用已配置的HTTPS地址" >&2; exit 1; }
  [[ -n ${SMS_HTTP_TOKEN:-} && ${SMS_HTTP_TOKEN:-} != *CHANGE_ME* ]] || { echo "未配置正式短信Token" >&2; exit 1; }
elif [[ ${CUSTOMER_SMS_PROVIDER:-} == console ]]; then
  [[ ${ALLOW_INSECURE_DEV_SMS:-false} == true ]] || { echo "console短信仅能在明确启用验收开关时使用" >&2; exit 1; }
  echo "警告：当前为IP验收短信模式，不可直接对客上线。"
else
  echo "CUSTOMER_SMS_PROVIDER只允许http或console" >&2; exit 1
fi
if [[ ${STORAGE_PROVIDER:-LOCAL} == S3 ]]; then
  for key in STORAGE_BUCKET STORAGE_ACCESS_KEY STORAGE_SECRET_KEY STORAGE_PUBLIC_URL; do
    value=${!key:-}
    [[ -n "$value" && "$value" != *CHANGE_ME* ]] || { echo "S3模式缺少$key" >&2; exit 1; }
  done
fi

mkdir -p uploads backups artifacts
chmod 750 uploads backups
compose config --quiet
compose up -d mysql redis
wait_healthy mysql
wait_healthy redis

echo "安装迁移和验收所需Node依赖"
npm ci

echo "执行Migration up"
npm run db:migrate
npx typeorm-ts-node-commonjs -d apps/api/src/infrastructure/database/data-source.ts migration:show

mysql_exec() {
  MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=TCP -h 127.0.0.1 -P "${MYSQL_PORT:-13306}" -uroot "$MYSQL_DATABASE" -Nse "$1"
}

for table in after_sales_orders after_sale_items after_sale_media after_sale_reasons after_sale_refunds; do
  [[ $(mysql_exec "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$MYSQL_DATABASE' AND table_name='$table'") == 1 ]] || { echo "迁移缺少表: $table" >&2; exit 1; }
done

# Safe only when the new after-sales tables are empty. Never drops real after-sales data.
after_sale_rows=$(mysql_exec "SELECT (SELECT COUNT(*) FROM after_sales_orders)+(SELECT COUNT(*) FROM after_sale_items)+(SELECT COUNT(*) FROM after_sale_media)+(SELECT COUNT(*) FROM after_sale_refunds)")
if [[ "$after_sale_rows" == 0 ]]; then
  echo "执行阶段9-A Migration down/up回滚验证"
  npm run migration:revert --workspace @fruit-b2b/api
  npm run db:migrate
else
  echo "售后表已有数据，跳过破坏性的down/up验证；数据行数=$after_sale_rows"
fi

echo "执行两次幂等Seed"
npm run db:seed
reason_count_1=$(mysql_exec "SELECT COUNT(*) FROM after_sale_reasons WHERE tenant_id=(SELECT id FROM tenants WHERE tenant_code='${BOOTSTRAP_TENANT_CODE:-DEFAULT}' LIMIT 1)")
npm run db:seed
reason_count_2=$(mysql_exec "SELECT COUNT(*) FROM after_sale_reasons WHERE tenant_id=(SELECT id FROM tenants WHERE tenant_code='${BOOTSTRAP_TENANT_CODE:-DEFAULT}' LIMIT 1)")
[[ "$reason_count_1" == "$reason_count_2" && "$reason_count_2" -eq 8 ]] || { echo "Seed幂等失败: $reason_count_1 -> $reason_count_2" >&2; exit 1; }

echo "构建并启动全部生产容器"
compose build --pull api admin backup
compose up -d
for service in mysql redis api admin nginx backup; do wait_healthy "$service" 90; done

cat >/etc/systemd/system/fruit-order.service <<'UNIT'
[Unit]
Description=Fruit Order B2B Docker Compose
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/fruit-order
ExecStart=/usr/bin/bash /opt/fruit-order/deploy/production-toolkit/compose-start.sh
ExecStop=/usr/bin/bash /opt/fruit-order/deploy/production-toolkit/compose-stop.sh
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable fruit-order.service

bash deploy/production-toolkit/check.sh
echo "部署完成。初始凭据: /root/fruit-order-initial-credentials.txt"
