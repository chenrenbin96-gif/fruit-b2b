#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then echo "请使用root执行" >&2; exit 1; fi
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get upgrade -y
apt-get install -y ca-certificates curl wget vim unzip nginx docker.io git python3 python3-pip jq openssl ffmpeg default-mysql-client
if ! apt-get install -y docker-compose-v2; then
  apt-get install -y docker-compose
fi

if ! command -v node >/dev/null || [[ $(node -p 'Number(process.versions.node.split(".")[0])') -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

systemctl enable --now docker
# The project uses its own Nginx container. Keep host Nginx installed but stopped
# so port 80 has a single owner.
systemctl disable --now nginx || true

# Never enable the firewall before allowing SSH.
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

mkdir -p /opt/fruit-order /opt/fruit-order/uploads /opt/fruit-order/backups
chmod 750 /opt/fruit-order/uploads /opt/fruit-order/backups

echo "=== versions ==="
docker --version
(docker compose version || docker-compose --version)
node --version
npm --version
python3 --version
ufw status verbose
