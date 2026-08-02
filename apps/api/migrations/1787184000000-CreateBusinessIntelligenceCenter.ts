import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBusinessIntelligenceCenter1787184000000 implements MigrationInterface {
  name = 'CreateBusinessIntelligenceCenter1787184000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE bi_daily_reports (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      tenant_id BIGINT UNSIGNED NOT NULL,
      report_date DATE NOT NULL,
      sales_amount DECIMAL(16,2) NOT NULL DEFAULT 0,
      order_count INT UNSIGNED NOT NULL DEFAULT 0,
      customer_count INT UNSIGNED NOT NULL DEFAULT 0,
      purchase_amount DECIMAL(16,2) NOT NULL DEFAULT 0,
      profit_amount DECIMAL(16,2) NOT NULL DEFAULT 0,
      refund_amount DECIMAL(16,2) NOT NULL DEFAULT 0,
      generated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uk_bi_daily_tenant_date (tenant_id,report_date),
      KEY idx_bi_daily_date_tenant (report_date,tenant_id),
      CONSTRAINT fk_bi_daily_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await q.query(`CREATE TABLE bi_monthly_reports LIKE bi_daily_reports`);
    await q.query(`ALTER TABLE bi_monthly_reports
      CHANGE report_date report_month DATE NOT NULL,
      DROP INDEX uk_bi_daily_tenant_date,
      DROP INDEX idx_bi_daily_date_tenant,
      ADD UNIQUE KEY uk_bi_monthly_tenant_month (tenant_id,report_month),
      ADD KEY idx_bi_monthly_month_tenant (report_month,tenant_id)`);
    await q.query(`CREATE TABLE bi_yearly_reports LIKE bi_daily_reports`);
    await q.query(`ALTER TABLE bi_yearly_reports
      CHANGE report_date report_year SMALLINT UNSIGNED NOT NULL,
      DROP INDEX uk_bi_daily_tenant_date,
      DROP INDEX idx_bi_daily_date_tenant,
      ADD UNIQUE KEY uk_bi_yearly_tenant_year (tenant_id,report_year),
      ADD KEY idx_bi_yearly_year_tenant (report_year,tenant_id)`);
    await q.query(`CREATE OR REPLACE VIEW v_bi_order_daily AS
      SELECT tenant_id,DATE(created_at) report_date,
        COUNT(*) order_count,COUNT(DISTINCT customer_id) customer_count,
        ROUND(SUM(CASE WHEN status<>'CANCELLED' THEN COALESCE(final_amount,estimated_amount) ELSE 0 END),2) sales_amount
      FROM orders GROUP BY tenant_id,DATE(created_at)`);
    await q.query(`ALTER TABLE deliveries ADD KEY idx_deliveries_tenant_status_created (tenant_id,status,created_at)`);
    await q.query(`ALTER TABLE payments ADD KEY idx_payments_tenant_time (tenant_id,payment_time)`);
    await q.query(`ALTER TABLE after_sales_orders ADD KEY idx_after_sales_tenant_status_created (tenant_id,status,created_at)`);
    await q.query(`INSERT INTO permissions(permission_name,permission_code,module_code,description,status) VALUES
      ('查看BI分析','bi.report.read','bi','查看按角色隔离的经营分析','ACTIVE'),
      ('导出BI报表','bi.report.export','bi','导出Excel、CSV和PDF','ACTIVE'),
      ('查看经营大屏','bi.screen.read','bi','查看经营数据大屏','ACTIVE')
      ON DUPLICATE KEY UPDATE permission_name=VALUES(permission_name),description=VALUES(description),status='ACTIVE'`);
    await q.query(`INSERT IGNORE INTO role_permissions(tenant_id,role_id,permission_id)
      SELECT r.tenant_id,r.id,p.id FROM roles r JOIN permissions p
      WHERE (r.role_code IN ('ADMIN','SALES','PURCHASER','WAREHOUSE','DELIVERY','FINANCE','OPERATIONS') AND p.permission_code='bi.report.read')
         OR (r.role_code IN ('ADMIN','FINANCE') AND p.permission_code='bi.report.export')
         OR (r.role_code='ADMIN' AND p.permission_code='bi.screen.read')`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE rp FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE p.permission_code IN ('bi.report.read','bi.report.export','bi.screen.read')`);
    await q.query(`DELETE FROM permissions WHERE permission_code IN ('bi.report.read','bi.report.export','bi.screen.read')`);
    await q.query(`ALTER TABLE after_sales_orders DROP INDEX idx_after_sales_tenant_status_created`);
    await q.query(`ALTER TABLE payments DROP INDEX idx_payments_tenant_time`);
    await q.query(`ALTER TABLE deliveries DROP INDEX idx_deliveries_tenant_status_created`);
    await q.query(`DROP VIEW IF EXISTS v_bi_order_daily`);
    await q.query(`DROP TABLE IF EXISTS bi_yearly_reports`);
    await q.query(`DROP TABLE IF EXISTS bi_monthly_reports`);
    await q.query(`DROP TABLE IF EXISTS bi_daily_reports`);
  }
}
