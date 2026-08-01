#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/fruit-order
source deploy/production-toolkit/lib.sh
load_env
REPORT_DIR=/opt/fruit-order/artifacts
REPORT="$REPORT_DIR/stage9a-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$REPORT_DIR"
exec > >(tee -a "$REPORT") 2>&1

pass=0; fail=0
check() { local name=$1; shift; if "$@"; then echo "PASS | $name"; pass=$((pass+1)); else echo "FAIL | $name"; fail=$((fail+1)); fi; }
mysql_value() { MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=TCP -h 127.0.0.1 -P "${MYSQL_PORT:-13306}" -uroot "$MYSQL_DATABASE" -Nse "$1"; }

echo "【水果订货系统阶段9-A自动验收】"
date -Is
compose ps
for service in mysql redis api admin nginx backup; do check "容器 $service healthy" wait_healthy "$service" 5; done
check "首页HTTP 200" bash -c "[[ \$(curl -sS -o /tmp/fruit-home.html -w '%{http_code}' http://127.0.0.1/) == 200 ]]"
check "首页不是空白页" bash -c "[[ -s /tmp/fruit-home.html ]] && grep -qi '<div id=\"app\"' /tmp/fruit-home.html"
check "API live" bash -c "curl -fsS http://127.0.0.1/api/v1/health/live | jq -e '.data.status == \"ok\" or .status == \"ok\"' >/dev/null"
check "API ready(MySQL/Redis)" bash -c "curl -fsS http://127.0.0.1/api/v1/health/ready | jq -e '.data.status == \"ok\" or .status == \"ok\"' >/dev/null"

for table in users products purchase_carts orders after_sales_orders after_sale_items after_sale_media after_sale_reasons after_sale_refunds; do
  check "数据库表 $table" bash -c "[[ \$(MYSQL_PWD='$MYSQL_ROOT_PASSWORD' mysql --protocol=TCP -h 127.0.0.1 -P '${MYSQL_PORT:-13306}' -uroot '$MYSQL_DATABASE' -Nse \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$MYSQL_DATABASE' AND table_name='$table'\") == 1 ]]"
done
for column in 'after_sales_orders:refund_amount' 'after_sale_items:requested_weight' 'after_sale_items:approved_weight'; do
  table=${column%%:*}; field=${column##*:}
  check "字段 $table.$field" bash -c "[[ \$(MYSQL_PWD='$MYSQL_ROOT_PASSWORD' mysql --protocol=TCP -h 127.0.0.1 -P '${MYSQL_PORT:-13306}' -uroot '$MYSQL_DATABASE' -Nse \"SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='$MYSQL_DATABASE' AND table_name='$table' AND column_name='$field'\") == 1 ]]"
done
check "默认售后原因8个" bash -c "[[ \$(MYSQL_PWD='$MYSQL_ROOT_PASSWORD' mysql --protocol=TCP -h 127.0.0.1 -P '${MYSQL_PORT:-13306}' -uroot '$MYSQL_DATABASE' -Nse \"SELECT COUNT(*) FROM after_sale_reasons WHERE tenant_id=(SELECT id FROM tenants WHERE tenant_code='${BOOTSTRAP_TENANT_CODE:-DEFAULT}' LIMIT 1)\") == 8 ]]"
check "售后默认原因内容" bash -c "[[ \$(mysql_value \"SELECT COUNT(DISTINCT name) FROM after_sale_reasons WHERE name IN ('缺重量','质量问题','腐烂变质','破损','商品与描述不符','规格错误','少发漏发','其他')\") == 8 ]]"
check "售后外键" bash -c "[[ \$(mysql_value \"SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema='$MYSQL_DATABASE' AND table_name IN ('after_sales_orders','after_sale_items','after_sale_media','after_sale_refunds')\") -ge 10 ]]"

permission_count() {
  local role=$1 permission=$2
  mysql_value "SELECT COUNT(*) FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id WHERE r.tenant_id=(SELECT id FROM tenants WHERE tenant_code='${BOOTSTRAP_TENANT_CODE:-DEFAULT}' LIMIT 1) AND r.role_code='$role' AND p.permission_code='$permission'"
}
check "ADMIN售后管理权限" bash -c "[[ $(permission_count ADMIN after.sale.manage) == 1 && $(permission_count ADMIN after.sale.refund.manage) == 1 ]]"
check "FINANCE可查看并完成退款" bash -c "[[ $(permission_count FINANCE after.sale.read) == 1 && $(permission_count FINANCE after.sale.refund.manage) == 1 ]]"
check "FINANCE不可审核售后" bash -c "[[ $(permission_count FINANCE after.sale.manage) == 0 ]]"
check "WAREHOUSE售后只读" bash -c "[[ $(permission_count WAREHOUSE after.sale.read) == 1 && $(permission_count WAREHOUSE after.sale.manage) == 0 ]]"
check "OPERATIONS售后只读" bash -c "[[ $(permission_count OPERATIONS after.sale.read) == 1 && $(permission_count OPERATIONS after.sale.manage) == 0 ]]"
check "PURCHASER无售后权限" bash -c "[[ $(permission_count PURCHASER after.sale.read) == 0 && $(permission_count PURCHASER after.sale.manage) == 0 ]]"

login_body=$(jq -nc --arg tenant "${BOOTSTRAP_TENANT_CODE:-DEFAULT}" --arg user "${BOOTSTRAP_ADMIN_USERNAME:-admin}" --arg pass "$BOOTSTRAP_ADMIN_PASSWORD" '{tenant_code:$tenant,username:$user,password:$pass}')
login_response=$(curl -fsS -H 'content-type: application/json' -d "$login_body" http://127.0.0.1/api/v1/auth/employee/login || true)
admin_token=$(jq -r '.data.access_token // empty' <<<"$login_response")
check "管理员登录与Token" test -n "$admin_token"
if [[ -n "$admin_token" ]]; then
  check "Admin售后列表" bash -c "[[ \$(curl -sS -o /tmp/after-sales.json -w '%{http_code}' -H 'Authorization: Bearer $admin_token' http://127.0.0.1/api/v1/admin/after-sales) == 200 ]]"
  check "Admin售后原因" bash -c "[[ \$(curl -sS -o /tmp/after-sale-reasons.json -w '%{http_code}' -H 'Authorization: Bearer $admin_token' http://127.0.0.1/api/v1/admin/after-sale-reasons) == 200 ]]"
fi
check "未登录禁止后台售后" bash -c "[[ \$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1/api/v1/admin/after-sales) == 401 ]]"
check "售后上传目录可写" bash -c "mkdir -p uploads/after-sales && test -w uploads/after-sales"
media_probe="uploads/after-sales/acceptance-$(date +%s).txt"
printf 'after-sales-media-ok\n' > "$media_probe"
media_url="http://127.0.0.1/uploads/after-sales/${media_probe##*/}"
check "Nginx售后媒体访问" bash -c "[[ \$(curl -sS -o /tmp/after-sale-media.txt -w '%{http_code}' '$media_url') == 200 ]] && grep -q after-sales-media-ok /tmp/after-sale-media.txt"
unlink "$media_probe"
check "防火墙已启用" bash -c "ufw status | grep -q 'Status: active'"
check "Docker开机启动" systemctl is-enabled --quiet docker
check "业务编排开机启动" systemctl is-enabled --quiet fruit-order.service

if [[ ${RUN_MUTATING_TESTS:-0} == 1 ]]; then
  export TEST_API_BASE_URL=http://127.0.0.1/api/v1
  echo "执行隔离式商品、购物车、订单、履约、采购与一致性回归"
  check "商品中心集成测试" npm run test:catalog:integration --workspace @fruit-b2b/api
  check "购物车和订单集成测试" npm run test:orders:integration --workspace @fruit-b2b/api
  check "采购入库集成测试" npm run test:procurement:integration --workspace @fruit-b2b/api
  check "数据一致性审计" npm run test:data-consistency --workspace @fruit-b2b/api
else
  echo "SKIP | 改写型业务回归（设置 RUN_MUTATING_TESTS=1 后执行）"
fi

echo "PASS=$pass FAIL=$fail REPORT=$REPORT"
[[ $fail -eq 0 ]]
