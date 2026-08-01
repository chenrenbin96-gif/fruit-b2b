import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWarehouseDeliveryOperations1786492800000
  implements MigrationInterface
{
  name = 'CreateWarehouseDeliveryOperations1786492800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE picking_tasks (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        order_id BIGINT UNSIGNED NOT NULL,
        warehouse_id BIGINT UNSIGNED NOT NULL,
        picker_id BIGINT UNSIGNED NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
        started_at DATETIME(3) NULL,
        completed_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
          ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_picking_tasks_order (order_id),
        KEY idx_picking_tasks_tenant_status (tenant_id, warehouse_id, status),
        CONSTRAINT fk_picking_tasks_tenant FOREIGN KEY (tenant_id)
          REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_picking_tasks_order FOREIGN KEY (order_id)
          REFERENCES orders (id) ON DELETE CASCADE,
        CONSTRAINT fk_picking_tasks_warehouse FOREIGN KEY (warehouse_id)
          REFERENCES warehouses (id) ON DELETE RESTRICT,
        CONSTRAINT fk_picking_tasks_picker FOREIGN KEY (picker_id)
          REFERENCES users (id) ON DELETE SET NULL,
        CONSTRAINT chk_picking_tasks_status CHECK (
          status IN ('WAITING', 'PICKING', 'DONE', 'CANCELLED')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE picking_task_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        task_id BIGINT UNSIGNED NOT NULL,
        order_item_id BIGINT UNSIGNED NOT NULL,
        sku_id BIGINT UNSIGNED NOT NULL,
        planned_quantity DECIMAL(18,3) NOT NULL,
        picked_quantity DECIMAL(18,3) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
          ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_picking_task_items_order_item (order_item_id),
        KEY idx_picking_task_items_task (task_id, status),
        CONSTRAINT fk_picking_task_items_tenant FOREIGN KEY (tenant_id)
          REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_picking_task_items_task FOREIGN KEY (task_id)
          REFERENCES picking_tasks (id) ON DELETE CASCADE,
        CONSTRAINT fk_picking_task_items_order_item FOREIGN KEY (order_item_id)
          REFERENCES order_items (id) ON DELETE CASCADE,
        CONSTRAINT fk_picking_task_items_sku FOREIGN KEY (sku_id)
          REFERENCES skus (id) ON DELETE RESTRICT,
        CONSTRAINT chk_picking_task_items_status CHECK (
          status IN ('WAITING', 'DONE', 'SHORT')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE shipping_packages (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        order_id BIGINT UNSIGNED NOT NULL,
        package_no VARCHAR(40) NOT NULL,
        packer_id BIGINT UNSIGNED NULL,
        outbound_by BIGINT UNSIGNED NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
        started_at DATETIME(3) NULL,
        completed_at DATETIME(3) NULL,
        outbound_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
          ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_shipping_packages_order (order_id),
        UNIQUE KEY uk_shipping_packages_no (tenant_id, package_no),
        KEY idx_shipping_packages_status (tenant_id, status, outbound_at),
        CONSTRAINT fk_shipping_packages_tenant FOREIGN KEY (tenant_id)
          REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_shipping_packages_order FOREIGN KEY (order_id)
          REFERENCES orders (id) ON DELETE CASCADE,
        CONSTRAINT fk_shipping_packages_packer FOREIGN KEY (packer_id)
          REFERENCES users (id) ON DELETE SET NULL,
        CONSTRAINT fk_shipping_packages_outbound_by FOREIGN KEY (outbound_by)
          REFERENCES users (id) ON DELETE SET NULL,
        CONSTRAINT chk_shipping_packages_status CHECK (
          status IN ('WAITING', 'PACKING', 'DONE')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE delivery_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        delivery_id BIGINT UNSIGNED NOT NULL,
        order_id BIGINT UNSIGNED NOT NULL,
        delivery_person_id BIGINT UNSIGNED NULL,
        status VARCHAR(20) NOT NULL,
        reason_code VARCHAR(30) NULL,
        reason VARCHAR(500) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY idx_delivery_logs_delivery_time (delivery_id, created_at),
        KEY idx_delivery_logs_order_time (order_id, created_at),
        CONSTRAINT fk_delivery_logs_tenant FOREIGN KEY (tenant_id)
          REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_delivery_logs_delivery FOREIGN KEY (delivery_id)
          REFERENCES deliveries (id) ON DELETE CASCADE,
        CONSTRAINT fk_delivery_logs_order FOREIGN KEY (order_id)
          REFERENCES orders (id) ON DELETE CASCADE,
        CONSTRAINT fk_delivery_logs_person FOREIGN KEY (delivery_person_id)
          REFERENCES users (id) ON DELETE SET NULL,
        CONSTRAINT chk_delivery_logs_status CHECK (
          status IN ('WAITING', 'DELIVERING', 'DELIVERED', 'FAILED')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      ALTER TABLE deliveries DROP CHECK chk_deliveries_status
    `);
    await queryRunner.query(`
      UPDATE deliveries SET status = 'WAITING' WHERE status = 'PENDING'
    `);
    await queryRunner.query(`
      UPDATE deliveries SET status = 'DELIVERING' WHERE status = 'IN_TRANSIT'
    `);
    await queryRunner.query(`
      ALTER TABLE deliveries ADD CONSTRAINT chk_deliveries_status CHECK (
        status IN ('WAITING', 'DELIVERING', 'DELIVERED', 'FAILED')
      )
    `);
    await queryRunner.query(`
      INSERT INTO picking_tasks
        (tenant_id, order_id, warehouse_id, status, started_at, completed_at)
      SELECT tenant_id, id, warehouse_id,
        CASE
          WHEN status = 'APPROVED' THEN 'WAITING'
          WHEN status IN ('PICKING', 'WEIGHING') THEN 'PICKING'
          ELSE 'DONE'
        END,
        IF(status = 'APPROVED', NULL, updated_at),
        IF(status IN ('WAITING_DELIVERY', 'DELIVERING', 'COMPLETED'), updated_at, NULL)
      FROM orders
      WHERE status IN (
        'APPROVED', 'PICKING', 'WEIGHING',
        'WAITING_DELIVERY', 'DELIVERING', 'COMPLETED'
      )
    `);
    await queryRunner.query(`
      INSERT INTO picking_task_items
        (tenant_id, task_id, order_item_id, sku_id, planned_quantity,
         picked_quantity, status)
      SELECT oi.tenant_id, pt.id, oi.id, oi.sku_id, oi.planned_quantity,
        IF(pt.status = 'DONE', oi.planned_quantity, NULL),
        IF(pt.status = 'DONE', 'DONE', 'WAITING')
      FROM order_items oi
      JOIN picking_tasks pt ON pt.order_id = oi.order_id
    `);
    await queryRunner.query(`
      INSERT INTO shipping_packages
        (tenant_id, order_id, package_no, status, completed_at, outbound_at)
      SELECT tenant_id, id, CONCAT('PK', order_no),
        IF(status = 'WAITING_DELIVERY', 'WAITING', 'DONE'),
        IF(status = 'WAITING_DELIVERY', NULL, updated_at),
        IF(status IN ('DELIVERING', 'COMPLETED'), updated_at, NULL)
      FROM orders
      WHERE status IN ('WAITING_DELIVERY', 'DELIVERING', 'COMPLETED')
    `);
    await queryRunner.query(`
      INSERT INTO delivery_logs
        (tenant_id, delivery_id, order_id, delivery_person_id, status, created_at)
      SELECT tenant_id, id, order_id, delivery_person_id, status, created_at
      FROM deliveries
    `);
    await queryRunner.query(`
      INSERT INTO permissions
        (permission_name, permission_code, module_code, description, status)
      VALUES
        ('查看仓库任务', 'warehouse.task.read', 'warehouse', '查看拣货和打包任务', 'ACTIVE'),
        ('执行仓库拣货', 'warehouse.task.pick', 'warehouse', '领取并完成拣货任务', 'ACTIVE'),
        ('管理打包任务', 'warehouse.package.manage', 'warehouse', '开始并完成打包', 'ACTIVE'),
        ('确认仓库出库', 'warehouse.outbound', 'warehouse', '确认包裹出库并进入配送', 'ACTIVE')
      ON DUPLICATE KEY UPDATE
        permission_name = VALUES(permission_name),
        description = VALUES(description),
        status = 'ACTIVE'
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (tenant_id, role_id, permission_id)
      SELECT r.tenant_id, r.id, p.id
      FROM roles r
      JOIN permissions p
      WHERE
        r.role_code = 'ADMIN'
        OR (
          r.role_code = 'WAREHOUSE'
          AND p.permission_code IN (
            'warehouse.task.read', 'warehouse.task.pick',
            'warehouse.package.manage', 'warehouse.outbound'
          )
        )
        OR (
          r.role_code = 'OPERATIONS'
          AND p.permission_code = 'warehouse.task.read'
        )
        OR (
          r.role_code = 'FINANCE'
          AND p.permission_code = 'warehouse.task.read'
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE deliveries DROP CHECK chk_deliveries_status',
    );
    await queryRunner.query(`
      UPDATE deliveries SET status = 'PENDING' WHERE status = 'WAITING'
    `);
    await queryRunner.query(`
      UPDATE deliveries SET status = 'IN_TRANSIT' WHERE status = 'DELIVERING'
    `);
    await queryRunner.query(`UPDATE deliveries SET status = 'PENDING' WHERE status = 'FAILED'`);
    await queryRunner.query(`
      ALTER TABLE deliveries ADD CONSTRAINT chk_deliveries_status CHECK (
        status IN ('PENDING', 'IN_TRANSIT', 'DELIVERED')
      )
    `);
    await queryRunner.query('DROP TABLE delivery_logs');
    await queryRunner.query('DROP TABLE shipping_packages');
    await queryRunner.query('DROP TABLE picking_task_items');
    await queryRunner.query('DROP TABLE picking_tasks');
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.permission_code IN (
        'warehouse.task.read', 'warehouse.task.pick',
        'warehouse.package.manage', 'warehouse.outbound'
      )
    `);
    await queryRunner.query(`
      DELETE FROM permissions WHERE permission_code IN (
        'warehouse.task.read', 'warehouse.task.pick',
        'warehouse.package.manage', 'warehouse.outbound'
      )
    `);
  }
}
