# 水果订货系统生产部署工具包

本工具包针对当前Monorepo，不会执行`git clone`，也不会把工程强制拆成互不兼容的
`backend/frontend/database`目录。服务器部署目录固定为`/opt/fruit-order`。

## 文件说明

- `deploy.sh`：本地电脑执行，检查、打包、上传、远端部署和公网健康检查。
- `install.sh`：Ubuntu 22.04初始化、Node 22、Docker、Compose、UFW。
- `server-deploy.sh`：数据库迁移、回滚验证、双次Seed、镜像构建和启动。
- `start-backend.sh`：单独重建和启动API。
- `build-frontend.sh`：单独重建和启动Admin。
- `check.sh`：阶段9-A自动验收并生成报告。
- `reboot-verify.sh`：服务器重启后验证容器和数据持久化。
- `docker-compose.yml`：MySQL、Redis、API、Admin、Nginx、Backup。
- `nginx.conf`：HTTP IP部署的反向代理配置。
- `.env.server.example`：生产变量模板。

## 方案A：服务器手动执行

先将完整项目上传并解压到`/opt/fruit-order`，然后执行：

```bash
cd /opt/fruit-order
bash deploy/production-toolkit/install.sh
bash deploy/production-toolkit/generate-env.sh
# 如有正式短信服务，在这里编辑.env后再继续
vim .env
bash deploy/production-toolkit/server-deploy.sh
```

查看初始管理员账号：

```bash
cat /root/fruit-order-initial-credentials.txt
```

## 方案B：本地一键上传部署

推荐先创建正式环境变量文件：

```bash
cp deploy/production-toolkit/.env.server.example production.env
vim production.env
chmod 600 production.env
```

然后在项目根目录执行：

```bash
KEY_FILE="$HOME/Downloads/chen.pem" \
ENV_FILE="$PWD/production.env" \
bash deploy/production-toolkit/deploy.sh
```

如果只是IP验收、尚未取得短信网关和对象存储凭据，可不传`ENV_FILE`。服务器会
生成随机数据库、Redis、JWT和管理员密钥；但会临时启用控制台短信与本地媒体存储。
这种配置仅用于验收，不满足正式上线的短信和HTTPS要求。

## 验收与重启验证

```bash
cd /opt/fruit-order
RUN_MUTATING_TESTS=1 bash deploy/production-toolkit/check.sh
reboot
# 服务器恢复后重新SSH：
bash /opt/fruit-order/deploy/production-toolkit/reboot-verify.sh
```

验收报告保存在：

```text
/opt/fruit-order/artifacts/stage9a-YYYYMMDD-HHMMSS.log
```

## 服务守护

API和Admin不使用PM2。所有运行进程均位于Docker容器中，配置
`restart: unless-stopped`，并额外安装`fruit-order.service`作为systemd启动入口。
同时使用PM2会形成两个进程管理器争抢端口，故本工程不采用该方案。

## HTTPS上线要求

当前用户指定的是IP和HTTP端口。正式开放客户使用前必须完成：

1. 域名解析到服务器；
2. 申请TLS证书并切换到HTTPS Nginx模板；
3. 将`CORS_ORIGINS`改为HTTPS域名；
4. 配置微信小程序合法域名；
5. 接入正式短信服务；
6. 推荐将商品和售后媒体切换到OSS/S3；
7. 从云防火墙和UFW关闭不需要的端口。
