import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFinanceCore1785283200000 implements MigrationInterface {
  name = 'CreateFinanceCore1785283200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE customers
        CHANGE COLUMN payment_term_days credit_days INT UNSIGNED NOT NULL DEFAULT 0,
        ADD COLUMN credit_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER credit_limit,
        ADD CONSTRAINT chk_customers_credit_enabled CHECK (credit_enabled IN (0, 1))
    `);
    await queryRunner.query(`
      CREATE TABLE receivables (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        receivable_no VARCHAR(40) NOT NULL,
        customer_id BIGINT UNSIGNED NOT NULL,
        order_id BIGINT UNSIGNED NOT NULL,
        order_amount DECIMAL(14,2) NOT NULL,
        discount_amount DECIMAL(14,2) NOT NULL,
        shipping_fee DECIMAL(14,2) NOT NULL,
        final_amount DECIMAL(14,2) NOT NULL,
        receivable_amount DECIMAL(14,2) NOT NULL,
        paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
        remaining_amount DECIMAL(14,2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
        bill_date DATETIME(3) NOT NULL,
        due_date DATETIME(3) NOT NULL,
        settled_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_receivables_tenant_no (tenant_id, receivable_no),
        UNIQUE KEY uk_receivables_order (order_id),
        KEY idx_receivables_customer_status_due (tenant_id, customer_id, status, due_date),
        KEY idx_receivables_bill_date (tenant_id, bill_date),
        CONSTRAINT fk_receivables_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_receivables_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
        CONSTRAINT fk_receivables_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE RESTRICT,
        CONSTRAINT chk_receivables_amount CHECK (
          order_amount >= 0 AND discount_amount >= 0 AND shipping_fee >= 0
          AND final_amount >= 0 AND receivable_amount >= 0
          AND paid_amount >= 0 AND remaining_amount >= 0
          AND paid_amount + remaining_amount = receivable_amount
        ),
        CONSTRAINT chk_receivables_status CHECK (
          status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE payments (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        payment_no VARCHAR(40) NOT NULL,
        customer_id BIGINT UNSIGNED NOT NULL,
        amount DECIMAL(14,2) NOT NULL,
        payment_method VARCHAR(20) NOT NULL,
        payment_time DATETIME(3) NOT NULL,
        operator_id BIGINT UNSIGNED NOT NULL,
        remark VARCHAR(500) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_payments_tenant_no (tenant_id, payment_no),
        KEY idx_payments_customer_time (tenant_id, customer_id, payment_time),
        CONSTRAINT fk_payments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
        CONSTRAINT fk_payments_operator FOREIGN KEY (operator_id) REFERENCES users (id) ON DELETE RESTRICT,
        CONSTRAINT chk_payments_amount CHECK (amount > 0),
        CONSTRAINT chk_payments_method CHECK (
          payment_method IN ('CASH', 'BANK_TRANSFER', 'WECHAT', 'ALIPAY')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE payment_allocations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        payment_id BIGINT UNSIGNED NOT NULL,
        receivable_id BIGINT UNSIGNED NOT NULL,
        amount DECIMAL(14,2) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_payment_allocations_relation (payment_id, receivable_id),
        KEY idx_payment_allocations_receivable (receivable_id),
        CONSTRAINT fk_payment_allocations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_payment_allocations_payment FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE RESTRICT,
        CONSTRAINT fk_payment_allocations_receivable FOREIGN KEY (receivable_id) REFERENCES receivables (id) ON DELETE RESTRICT,
        CONSTRAINT chk_payment_allocations_amount CHECK (amount > 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      INSERT INTO permissions
        (permission_name, permission_code, module_code, description, status)
      VALUES
        ('财务数据查看', 'finance.read', 'finance', '查看客户账期、应收和收款记录', 'ACTIVE'),
        ('客户信用设置', 'finance.credit.manage', 'finance', '维护客户信用额度和账期', 'ACTIVE'),
        ('收款登记', 'finance.payment.create', 'finance', '登记线下收款并核销应收', 'ACTIVE')
      ON DUPLICATE KEY UPDATE permission_name = VALUES(permission_name),
        description = VALUES(description), status = 'ACTIVE'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.permission_code IN (
        'finance.read', 'finance.credit.manage', 'finance.payment.create'
      )
    `);
    await queryRunner.query(`
      DELETE FROM permissions WHERE permission_code IN (
        'finance.read', 'finance.credit.manage', 'finance.payment.create'
      )
    `);
    await queryRunner.query('DROP TABLE payment_allocations');
    await queryRunner.query('DROP TABLE payments');
    await queryRunner.query('DROP TABLE receivables');
    await queryRunner.query(`
      ALTER TABLE customers
        DROP CHECK chk_customers_credit_enabled,
        DROP COLUMN credit_enabled,
        CHANGE COLUMN credit_days payment_term_days INT UNSIGNED NOT NULL DEFAULT 0
    `);
  }
}
