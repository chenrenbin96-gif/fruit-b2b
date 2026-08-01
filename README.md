# 鲜链云｜水果批发 B2B 订货系统

当前已完成至阶段 5-E：基础数据与安全底座、商品中心、采购单与订单、
仓库称重、最终金额、优惠券、按重量运费、一单一配送单，以及客户信用、
应收账单、线下收款登记与客户对账。在线支付接口尚未开发。

## 工程组成

- `apps/api`：NestJS API 和 Worker 基础工程
- `apps/admin`：Vue 3、Vite、TypeScript、Element Plus 管理后台
- `apps/miniapp`：uni-app、Vue 3、TypeScript 微信小程序
- `packages/contracts`：跨端 API 基础契约
- `packages/shared-utils`：无框架共享工具
- `infra`：Nginx 和部署配置
- `app`：已确认的阶段 1 可点击原型，继续由 Sites 项目保留

## 本地准备

```bash
cp .env.example .env
npm install
```

请先替换 `.env` 中的本地密码和 JWT 密钥。

## 首次启动

先启动 MySQL 和 Redis，再执行迁移与初始化数据：

```bash
docker compose up -d mysql redis
npm run db:migrate
npm run db:seed
docker compose up -d --build api admin nginx
```

- Admin 入口：`http://localhost:8080`
- API 健康检查：`http://localhost:8080/api/v1/health/live`
- MySQL：`localhost:13306`
- Redis：`localhost:16379`

停止服务：

```bash
docker compose down
```

仅在确认不再需要本地数据时，才使用 `docker compose down -v` 删除数据卷。

## 分别启动

先启动基础服务：

```bash
docker compose up -d mysql redis
```

然后在不同终端运行：

```bash
npm run dev:api
npm run dev:admin
npm run dev:miniapp
```

小程序编译产物位于 `apps/miniapp/dist/dev/mp-weixin`，使用微信开发者工具打开。
首次运行前需要将 `apps/miniapp/src/manifest.json` 中的占位 App ID 替换为实际值。

## 构建与检查

```bash
npm run typecheck
npm run build:api
npm run build:admin
npm run build:miniapp
```

根目录原型仍可使用：

```bash
npm run dev
npm run build
```

## 数据库迁移与初始化

基础表 Migration 位于 `apps/api/migrations`。ORM 始终保持
`synchronize: false`，所有环境均通过 Migration 管理结构。

常用命令：

```bash
npm run db:migrate
npm run db:seed
npm run migration:create --workspace @fruit-b2b/api -- migrations/Name
npm run migration:revert --workspace @fruit-b2b/api
```

Seed 可重复执行，不会重复创建基础数据。生产环境执行 Seed 前，必须通过
环境变量设置非默认的 `BOOTSTRAP_ADMIN_PASSWORD`。

## 认证接口

- 员工登录：`POST /api/v1/auth/employee/login`
- 客户验证码：`POST /api/v1/auth/customer/verification-code`
- 客户登录：`POST /api/v1/auth/customer/login`
- 刷新令牌：`POST /api/v1/auth/token/refresh`
- 当前身份：`GET /api/v1/auth/me`
- 退出登录：`POST /api/v1/auth/logout`

客户验证码当前使用开发环境控制台适配器。生产环境必须接入短信供应商，
未配置时接口会安全拒绝，不会返回调试验证码。

## 商品中心检查

启动本地 API 后可执行商品中心集成测试：

```bash
npm run test:catalog:integration --workspace @fruit-b2b/api
```

测试使用一次性管理员、客户、分类、商品和价格数据，结束后自动清理。

## 采购单与订单核心链路

阶段 5-C 已提供客户采购单、订单提交、库存预占、客户取消和仓库审核。
采购单与订单提交使用数据库事务和悲观行锁，库存可售量由
`stock_quantity - locked_quantity` 实时生成。

启动本地开发 API 后执行完整链路集成测试：

```bash
npm run test:orders:integration --workspace @fruit-b2b/api
```

测试会覆盖采购单增删改清空、按件与称重商品下单、客户专属价格、
首单起送价、库存锁定与释放，以及仓库审核权限。测试数据结束后自动清理。

## 水果履约核心链路

阶段 5-D 已提供仓库开始拣货、称重商品实际重量录入、按件订单直接完成
履约、优惠券预占及最终复核、最终运费计算、配送单生成与配送状态流转。
预计商品金额与最终商品金额独立保存，不覆盖下单历史金额。

启动本地开发 API 后执行完整履约集成测试：

```bash
npm run test:fulfillment:integration --workspace @fruit-b2b/api
```

测试覆盖按件与称重订单、称重改价、优惠券失效与核销、按件配送重量、
运费计算、配送状态、库存实扣和角色权限。

## 财务、账单与账期

阶段 5-E 在配送签收事务内生成应收账单，并同步客户欠款。收款登记按照
最早到期账单自动分配核销，`payment_allocations` 保留完整对账关系。
客户提交订单时，若已启用信用额度，会校验“当前欠款 + 本次预计金额”。

执行财务完整链路集成测试：

```bash
npm run test:finance:integration --workspace @fruit-b2b/api
```

本阶段的现金、银行转账、微信和支付宝仅表示后台登记的线下收款方式，
未接入任何在线支付渠道。

## 稳定性、安全与运营基础

阶段 6-A 已增加关键业务操作审计、MySQL 自动备份及隔离恢复验证、
MySQL/Redis 就绪探针、结构化异常日志、登录失败限流、JWT 算法/签发方/
受众校验、生产 CORS 校验和 Nginx 安全响应头。

启动包含每日备份调度器的服务：

```bash
docker compose --profile operations up -d
```

备份、恢复和验证流程见 `infra/backup/README.md`。生产上线前必须替换所有
示例密钥、配置短信服务、启用 TLS，并将备份同步到加密的异地存储。
