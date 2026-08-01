# MySQL 备份与恢复

生产环境建议将 `/backups` 挂载到独立磁盘或对象存储同步目录，并对备份文件
实施服务端加密、最小权限访问和异地复制。

启动每日自动备份：

```bash
docker compose --profile operations up -d backup
```

默认按容器 `Asia/Shanghai` 时区每天 02:00 执行，保留 14 天。可通过
`BACKUP_CRON` 和 `BACKUP_RETENTION_DAYS` 调整。

立即执行：

```bash
docker compose --profile operations run --rm backup /opt/backup/mysql-backup.sh
```

每周至少执行一次恢复演练。选择备份文件后：

```bash
docker compose --profile operations run --rm backup \
  /opt/backup/mysql-backup-verify.sh /backups/<backup-file>.sql.gz
```

正式恢复前停止 API 写流量、保存当前数据库快照，并使用全新数据库先验证。
确认目标库名后执行：

```bash
docker compose --profile operations run --rm \
  -e CONFIRM_RESTORE=fruit_b2b backup \
  /opt/backup/mysql-restore.sh /backups/<backup-file>.sql.gz
```

恢复后必须检查 Migration 版本、核心表行数、管理员登录、订单详情、库存、
应收账单，并执行全链路回归测试。
