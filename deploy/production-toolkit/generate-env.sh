#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/fruit-order
[[ ! -e .env ]] || { echo ".env已存在，未覆盖"; exit 0; }

random_hex() { openssl rand -hex "$1"; }
db_password=$(random_hex 18)
root_password=$(random_hex 18)
redis_password=$(random_hex 18)
access_secret=$(random_hex 48)
refresh_secret=$(random_hex 48)
admin_password="Admin_$(random_hex 12)!"

sed \
  -e "s/CHANGE_ME_ALPHANUMERIC_DATABASE_PASSWORD/$db_password/g" \
  -e "s/CHANGE_ME_ALPHANUMERIC_ROOT_PASSWORD/$root_password/g" \
  -e "s/CHANGE_ME_ALPHANUMERIC_REDIS_PASSWORD/$redis_password/g" \
  -e "s/CHANGE_ME_WITH_AT_LEAST_64_RANDOM_CHARACTERS_ACCESS/$access_secret/g" \
  -e "s/CHANGE_ME_WITH_A_DIFFERENT_64_RANDOM_CHARACTERS_REFRESH/$refresh_secret/g" \
  -e "s/CHANGE_ME_STRONG_ADMIN_PASSWORD/$admin_password/g" \
  deploy/production-toolkit/.env.server.example > .env

# IP-only acceptance defaults. Replace with a real SMS gateway before launch.
sed -i 's/^CUSTOMER_SMS_PROVIDER=http$/CUSTOMER_SMS_PROVIDER=console/' .env
sed -i 's/^ALLOW_INSECURE_DEV_SMS=false$/ALLOW_INSECURE_DEV_SMS=true/' .env
chmod 600 .env
{
  echo "管理员租户: DEFAULT"
  echo "管理员账号: admin"
  echo "管理员密码: $admin_password"
  echo "警告: 当前为IP验收短信配置，上线前必须接入正式短信服务并启用HTTPS。"
} > /root/fruit-order-initial-credentials.txt
chmod 600 /root/fruit-order-initial-credentials.txt
echo "已生成.env；初始账号保存在/root/fruit-order-initial-credentials.txt"
