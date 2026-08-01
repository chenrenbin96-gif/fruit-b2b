import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UpgradeCustomerCenter1786924800000 implements MigrationInterface {
  name = 'UpgradeCustomerCenter1786924800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE customer_types (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL, name VARCHAR(80) NOT NULL,
        default_discount DECIMAL(6,4) NOT NULL DEFAULT 1,
        default_credit_days INT UNSIGNED NOT NULL DEFAULT 0,
        default_delivery_region_id BIGINT UNSIGNED NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY(id), UNIQUE KEY uk_customer_types_tenant_name(tenant_id,name),
        KEY idx_customer_types_tenant_status(tenant_id,status),
        CONSTRAINT fk_customer_types_tenant FOREIGN KEY(tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_customer_types_region FOREIGN KEY(default_delivery_region_id) REFERENCES delivery_regions(id) ON DELETE SET NULL,
        CONSTRAINT chk_customer_types_discount CHECK(default_discount > 0 AND default_discount <= 1),
        CONSTRAINT chk_customer_types_status CHECK(status IN ('ACTIVE','DISABLED'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE customer_groups (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL, group_name VARCHAR(120) NOT NULL,
        contact_name VARCHAR(50) NOT NULL, phone VARCHAR(30) NOT NULL,
        address VARCHAR(255) NOT NULL, unified_settlement TINYINT(1) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY(id), UNIQUE KEY uk_customer_groups_tenant_name(tenant_id,group_name),
        CONSTRAINT fk_customer_groups_tenant FOREIGN KEY(tenant_id) REFERENCES tenants(id),
        CONSTRAINT chk_customer_groups_status CHECK(status IN ('ACTIVE','DISABLED'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE customer_tags (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL, tag_name VARCHAR(60) NOT NULL,
        color VARCHAR(20) NOT NULL DEFAULT '#409EFF', sort INT NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY(id), UNIQUE KEY uk_customer_tags_tenant_name(tenant_id,tag_name),
        KEY idx_customer_tags_tenant_sort(tenant_id,status,sort),
        CONSTRAINT fk_customer_tags_tenant FOREIGN KEY(tenant_id) REFERENCES tenants(id),
        CONSTRAINT chk_customer_tags_status CHECK(status IN ('ACTIVE','DISABLED'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE customer_tag_relation (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL, customer_id BIGINT UNSIGNED NOT NULL,
        tag_id BIGINT UNSIGNED NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY(id), UNIQUE KEY uk_customer_tag_relation(tenant_id,customer_id,tag_id),
        CONSTRAINT fk_customer_tag_relation_tenant FOREIGN KEY(tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_customer_tag_relation_customer FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        CONSTRAINT fk_customer_tag_relation_tag FOREIGN KEY(tag_id) REFERENCES customer_tags(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE customer_agreements (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL, customer_id BIGINT UNSIGNED NOT NULL,
        product_id BIGINT UNSIGNED NOT NULL, sku_id BIGINT UNSIGNED NOT NULL,
        agreement_price DECIMAL(14,4) NOT NULL, start_time DATETIME(3) NOT NULL,
        end_time DATETIME(3) NULL, status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY(id), UNIQUE KEY uk_customer_agreements_customer_sku(tenant_id,customer_id,sku_id),
        KEY idx_customer_agreements_valid(tenant_id,sku_id,status,start_time,end_time),
        CONSTRAINT fk_customer_agreements_tenant FOREIGN KEY(tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_customer_agreements_customer FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        CONSTRAINT fk_customer_agreements_product FOREIGN KEY(product_id) REFERENCES products(id),
        CONSTRAINT fk_customer_agreements_sku FOREIGN KEY(sku_id) REFERENCES skus(id),
        CONSTRAINT chk_customer_agreements_price CHECK(agreement_price >= 0),
        CONSTRAINT chk_customer_agreements_status CHECK(status IN ('ACTIVE','DISABLED'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE customer_credit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL, customer_id BIGINT UNSIGNED NOT NULL,
        before_limit DECIMAL(14,2) NOT NULL, after_limit DECIMAL(14,2) NOT NULL,
        before_credit_days INT UNSIGNED NOT NULL, after_credit_days INT UNSIGNED NOT NULL,
        reason VARCHAR(500) NOT NULL, operator_id BIGINT UNSIGNED NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id),
        KEY idx_customer_credit_logs_customer_date(tenant_id,customer_id,created_at),
        CONSTRAINT fk_customer_credit_logs_tenant FOREIGN KEY(tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_customer_credit_logs_customer FOREIGN KEY(customer_id) REFERENCES customers(id),
        CONSTRAINT fk_customer_credit_logs_operator FOREIGN KEY(operator_id) REFERENCES users(id)
      )
    `);
    await queryRunner.query(`
      ALTER TABLE customers
        DROP CHECK chk_customers_status,
        ADD COLUMN customer_type_id BIGINT UNSIGNED NULL AFTER business_type,
        ADD COLUMN group_id BIGINT UNSIGNED NULL AFTER customer_type_id,
        ADD COLUMN default_route VARCHAR(100) NULL AFTER delivery_region_id,
        ADD COLUMN salesperson_id BIGINT UNSIGNED NULL AFTER sales_owner_id,
        ADD COLUMN unified_social_credit_code VARCHAR(40) NULL AFTER salesperson_id,
        ADD COLUMN certification_status VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED' AFTER unified_social_credit_code,
        ADD COLUMN registration_channel VARCHAR(30) NOT NULL DEFAULT 'ADMIN' AFTER certification_status,
        ADD COLUMN latitude DECIMAL(10,7) NULL AFTER address,
        ADD COLUMN longitude DECIMAL(10,7) NULL AFTER latitude,
        ADD COLUMN delivery_time VARCHAR(100) NULL AFTER longitude,
        ADD COLUMN receiving_cycle VARCHAR(100) NULL AFTER delivery_time,
        ADD COLUMN cod_enabled TINYINT(1) NOT NULL DEFAULT 1,
        ADD COLUMN online_payment_enabled TINYINT(1) NOT NULL DEFAULT 0,
        ADD COLUMN balance_payment_enabled TINYINT(1) NOT NULL DEFAULT 0,
        ADD COLUMN credit_payment_enabled TINYINT(1) NOT NULL DEFAULT 0,
        ADD COLUMN order_review_mode VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
        ADD COLUMN min_order_amount DECIMAL(14,2) NULL,
        ADD COLUMN discount_rate DECIMAL(6,4) NOT NULL DEFAULT 1,
        ADD COLUMN debt_limit DECIMAL(14,2) NULL,
        ADD COLUMN print_templates JSON NULL,
        ADD KEY idx_customers_type_group(customer_type_id,group_id),
        ADD KEY idx_customers_salesperson(salesperson_id),
        ADD CONSTRAINT fk_customers_type FOREIGN KEY(customer_type_id) REFERENCES customer_types(id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_customers_group FOREIGN KEY(group_id) REFERENCES customer_groups(id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_customers_salesperson FOREIGN KEY(salesperson_id) REFERENCES users(id) ON DELETE SET NULL,
        ADD CONSTRAINT chk_customers_certification CHECK(certification_status IN ('UNVERIFIED','PENDING','VERIFIED','REJECTED')),
        ADD CONSTRAINT chk_customers_review_mode CHECK(order_review_mode IN ('SYSTEM','ENABLED','DISABLED')),
        ADD CONSTRAINT chk_customers_discount CHECK(discount_rate > 0 AND discount_rate <= 1)
    `);
    await queryRunner.query(`ALTER TABLE customers ADD CONSTRAINT chk_customers_status CHECK(status IN ('ACTIVE','PENDING','DISABLED'))`);
    await queryRunner.query(`ALTER TABLE customer_accounts ADD COLUMN password_hash VARCHAR(255) NULL AFTER phone`);

    await queryRunner.query(`
      INSERT INTO customer_types(tenant_id,name,default_discount,default_credit_days,status)
      SELECT t.id,d.name,1,d.days,'ACTIVE' FROM tenants t JOIN (
        SELECT '批发商' name,30 days UNION ALL SELECT '水果店',7 UNION ALL
        SELECT '商超',30 UNION ALL SELECT '餐饮客户',15 UNION ALL SELECT '企业客户',30
      ) d ON 1=1 ON DUPLICATE KEY UPDATE status='ACTIVE'
    `);
    await queryRunner.query(`
      INSERT INTO customer_tags(tenant_id,tag_name,color,sort,status)
      SELECT t.id,d.name,d.color,d.sort,'ACTIVE' FROM tenants t JOIN (
        SELECT '重点客户' name,'#E6A23C' color,10 sort UNION ALL
        SELECT '月采购10万+','#F56C6C',20 UNION ALL SELECT '新客户','#409EFF',30 UNION ALL
        SELECT '高频采购','#67C23A',40 UNION ALL SELECT 'VIP客户','#9B59B6',50 UNION ALL
        SELECT '欠款客户','#909399',60
      ) d ON 1=1 ON DUPLICATE KEY UPDATE color=VALUES(color),sort=VALUES(sort),status='ACTIVE'
    `);
    await queryRunner.query(`
      INSERT INTO permissions(permission_name,permission_code,module_code,description,status) VALUES
        ('客户中心查看','customer.center.read','customer','查看客户档案与分析','ACTIVE'),
        ('客户档案管理','customer.center.manage','customer','新增编辑复制客户档案','ACTIVE'),
        ('客户基础配置','customer.config.manage','customer','管理客户类型集团和标签','ACTIVE'),
        ('客户协议价管理','customer.agreement.manage','customer','管理客户协议价格','ACTIVE'),
        ('客户信用调整','customer.credit.manage','customer','调整客户信用额度和账期','ACTIVE')
      ON DUPLICATE KEY UPDATE permission_name=VALUES(permission_name),description=VALUES(description),status='ACTIVE'
    `);
    await queryRunner.query(`
      INSERT INTO roles(tenant_id,role_name,role_code,description,is_system,status)
      SELECT id,'业务员','SALES','管理本人负责客户与销售跟进',1,'ACTIVE' FROM tenants
      ON DUPLICATE KEY UPDATE role_name=VALUES(role_name),description=VALUES(description),status='ACTIVE'
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions(tenant_id,role_id,permission_id)
      SELECT r.tenant_id,r.id,p.id FROM roles r JOIN permissions p WHERE
        r.role_code='ADMIN' OR
        (r.role_code='OPERATIONS' AND p.permission_code IN ('customer.center.read','customer.config.manage')) OR
        (r.role_code='SALES' AND p.permission_code IN ('customer.center.read','customer.center.manage','customer.agreement.manage')) OR
        (r.role_code='FINANCE' AND p.permission_code='customer.center.read')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE rp FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE p.permission_code IN ('customer.center.read','customer.center.manage','customer.config.manage','customer.agreement.manage','customer.credit.manage')`);
    await queryRunner.query(`DELETE FROM permissions WHERE permission_code IN ('customer.center.read','customer.center.manage','customer.config.manage','customer.agreement.manage','customer.credit.manage')`);
    await queryRunner.query(`DELETE r FROM roles r LEFT JOIN users u ON u.role_id=r.id WHERE r.role_code='SALES' AND u.id IS NULL`);
    await queryRunner.query(`ALTER TABLE customer_accounts DROP COLUMN password_hash`);
    await queryRunner.query(`ALTER TABLE customers DROP CHECK chk_customers_status`);
    await queryRunner.query(`ALTER TABLE customers DROP CHECK chk_customers_discount, DROP CHECK chk_customers_review_mode, DROP CHECK chk_customers_certification, DROP FOREIGN KEY fk_customers_salesperson, DROP FOREIGN KEY fk_customers_group, DROP FOREIGN KEY fk_customers_type, DROP INDEX idx_customers_salesperson, DROP INDEX idx_customers_type_group, DROP COLUMN print_templates, DROP COLUMN debt_limit, DROP COLUMN discount_rate, DROP COLUMN min_order_amount, DROP COLUMN order_review_mode, DROP COLUMN credit_payment_enabled, DROP COLUMN balance_payment_enabled, DROP COLUMN online_payment_enabled, DROP COLUMN cod_enabled, DROP COLUMN receiving_cycle, DROP COLUMN delivery_time, DROP COLUMN longitude, DROP COLUMN latitude, DROP COLUMN registration_channel, DROP COLUMN certification_status, DROP COLUMN unified_social_credit_code, DROP COLUMN salesperson_id, DROP COLUMN default_route, DROP COLUMN group_id, DROP COLUMN customer_type_id`);
    await queryRunner.query('DROP TABLE customer_credit_logs');
    await queryRunner.query('DROP TABLE customer_agreements');
    await queryRunner.query('DROP TABLE customer_tag_relation');
    await queryRunner.query('DROP TABLE customer_tags');
    await queryRunner.query('DROP TABLE customer_groups');
    await queryRunner.query('DROP TABLE customer_types');
    await queryRunner.query(`ALTER TABLE customers ADD CONSTRAINT chk_customers_status CHECK(status IN ('ACTIVE','DISABLED'))`);
  }
}
