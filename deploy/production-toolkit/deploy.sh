#!/usr/bin/env bash
set -Eeuo pipefail

SERVER_IP=${SERVER_IP:-120.26.67.207}
SSH_USER=${SSH_USER:-root}
SSH_PORT=${SSH_PORT:-22}
KEY_FILE=${KEY_FILE:-$HOME/Downloads/chen.pem}
ENV_FILE=${ENV_FILE:-}
SKIP_INSTALL=${SKIP_INSTALL:-0}
RUN_MUTATING_TESTS=${RUN_MUTATING_TESTS:-1}
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)

usage() {
  cat <<'USAGE'
用法:
  KEY_FILE=~/Downloads/chen.pem ENV_FILE=./production.env bash deploy/production-toolkit/deploy.sh

可选环境变量:
  SERVER_IP=120.26.67.207 SSH_USER=root SSH_PORT=22
  SKIP_INSTALL=1          跳过apt初始化
  RUN_MUTATING_TESTS=0    跳过隔离式业务回归测试

未提供ENV_FILE时，服务器生成IP验收配置并将初始管理员凭据保存到：
  /root/fruit-order-initial-credentials.txt
USAGE
}
[[ ${1:-} != --help ]] || { usage; exit 0; }
[[ -f "$KEY_FILE" ]] || { echo "SSH密钥不存在: $KEY_FILE" >&2; exit 1; }
[[ -z "$ENV_FILE" || -f "$ENV_FILE" ]] || { echo "环境文件不存在: $ENV_FILE" >&2; exit 1; }
for file in package.json package-lock.json docker-compose.yml apps/api/Dockerfile apps/admin/Dockerfile deploy/production-toolkit/server-deploy.sh; do
  [[ -e "$PROJECT_ROOT/$file" ]] || { echo "项目不完整，缺少: $file" >&2; exit 1; }
done

DEPLOY_TMP=$(mktemp -d /private/tmp/fruit-order-deploy.XXXXXX)
cleanup() { find "$DEPLOY_TMP" -type f -exec chmod u+w {} + 2>/dev/null || true; rm -rf -- "$DEPLOY_TMP"; }
trap cleanup EXIT
install -m 600 "$KEY_FILE" "$DEPLOY_TMP/key.pem"
ARCHIVE="$DEPLOY_TMP/fruit-order-release.tgz"

echo "创建不含Git、node_modules、本地密钥和运行数据的发布包"
tar -C "$PROJECT_ROOT" -czf "$ARCHIVE" \
  --exclude='.git' --exclude='node_modules' --exclude='**/node_modules' \
  --exclude='**/dist' --exclude='.env' --exclude='*/.env' \
  --exclude='.env.local' --exclude='*/.env.local' \
  --exclude='.env.development' --exclude='*/.env.development' \
  --exclude='.env.production' --exclude='*/.env.production' \
  --exclude='*.pem' \
  --exclude='uploads/*' --exclude='backups/*' --exclude='artifacts/*' .

SSH=(ssh -p "$SSH_PORT" -i "$DEPLOY_TMP/key.pem" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
SCP=(scp -P "$SSH_PORT" -i "$DEPLOY_TMP/key.pem" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
echo "验证SSH身份"
"${SSH[@]}" "$SSH_USER@$SERVER_IP" 'printf "SSH_OK\n"; uname -a; id'
"${SCP[@]}" "$ARCHIVE" "$SSH_USER@$SERVER_IP:/tmp/fruit-order-release.tgz"
if [[ -n "$ENV_FILE" ]]; then
  "${SCP[@]}" "$ENV_FILE" "$SSH_USER@$SERVER_IP:/tmp/fruit-order.env"
fi

echo "服务器端采用可恢复目录切换，不执行git clone"
"${SSH[@]}" "$SSH_USER@$SERVER_IP" "SKIP_INSTALL='$SKIP_INSTALL' RUN_MUTATING_TESTS='$RUN_MUTATING_TESTS' bash -s" <<'REMOTE'
set -Eeuo pipefail
stamp=$(date +%Y%m%d-%H%M%S)
staging="/opt/fruit-order.staging.$stamp"
backup_root=/opt/fruit-order-backups
mkdir -p "$staging" "$backup_root"
tar -xzf /tmp/fruit-order-release.tgz -C "$staging"
test -f "$staging/package.json"
test -f "$staging/deploy/production-toolkit/server-deploy.sh"
if [[ -d /opt/fruit-order ]]; then
  mv /opt/fruit-order "$backup_root/fruit-order.$stamp"
fi
mv "$staging" /opt/fruit-order
if [[ -f /tmp/fruit-order.env ]]; then
  install -m 600 /tmp/fruit-order.env /opt/fruit-order/.env
  unlink /tmp/fruit-order.env
fi
find /opt/fruit-order/deploy/production-toolkit -name '*.sh' -exec chmod 750 {} +
if [[ "$SKIP_INSTALL" != 1 ]]; then
  bash /opt/fruit-order/deploy/production-toolkit/install.sh
fi
cd /opt/fruit-order
RUN_MUTATING_TESTS="$RUN_MUTATING_TESTS" bash deploy/production-toolkit/server-deploy.sh
unlink /tmp/fruit-order-release.tgz
REMOTE

echo "公网验收"
curl -fsS "http://$SERVER_IP/api/v1/health/live"
curl -fsS "http://$SERVER_IP/api/v1/health/ready"
curl -fsS -o /dev/null "http://$SERVER_IP/"
echo "部署及自动验收完成：http://$SERVER_IP/"
