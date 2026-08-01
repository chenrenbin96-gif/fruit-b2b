import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { WarehouseEntity } from '../system/entities/system.entities';
import { SkuEntity } from '../products/entities/product.entities';
import {
  AdjustInventoryDto,
  InventoryListQueryDto,
} from './dto/inventory.dto';
import {
  InventoryEntity,
  InventoryLogEntity,
} from './entities/inventory.entities';

@Injectable()
export class InventoryService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(InventoryEntity)
    private readonly inventory: Repository<InventoryEntity>,
    @InjectRepository(InventoryLogEntity)
    private readonly logs: Repository<InventoryLogEntity>,
    @InjectRepository(SkuEntity)
    private readonly skus: Repository<SkuEntity>,
    @InjectRepository(WarehouseEntity)
    private readonly warehouses: Repository<WarehouseEntity>,
  ) {}

  async list(tenantId: string, query: InventoryListQueryDto) {
    const rows = await this.inventory.find({
      where: {
        tenantId,
        ...(query.warehouse_id ? { warehouseId: query.warehouse_id } : {}),
        ...(query.sku_id ? { skuId: query.sku_id } : {}),
      },
      relations: { sku: { product: true } },
      order: { id: 'DESC' },
    });
    return rows.map((row) => this.view(row));
  }

  async listLogs(tenantId: string, query: InventoryListQueryDto) {
    const logs = await this.logs.find({
      where: {
        tenantId,
        ...(query.warehouse_id ? { warehouseId: query.warehouse_id } : {}),
        ...(query.sku_id ? { skuId: query.sku_id } : {}),
      },
      order: { id: 'DESC' },
      take: 200,
    });
    return logs.map((log) => ({
      id: log.id,
      inventory_id: log.inventoryId,
      warehouse_id: log.warehouseId,
      sku_id: log.skuId,
      operation_type: log.operationType,
      change_quantity: log.changeQuantity,
      before_quantity: log.beforeQuantity,
      after_quantity: log.afterQuantity,
      stock_unit: log.stockUnit,
      reason: log.reason,
      operator_type: log.operatorType,
      operator_id: log.operatorId,
      created_at: log.createdAt,
    }));
  }

  async references(tenantId: string) {
    const [warehouses, skus] = await Promise.all([
      this.warehouses.find({
        where: { tenantId, status: 'ACTIVE' },
        order: { id: 'ASC' },
      }),
      this.skus.find({
        where: { tenantId, status: 'ACTIVE' },
        relations: { product: true },
        order: { id: 'DESC' },
      }),
    ]);
    return {
      warehouses: warehouses.map((item) => ({
        id: item.id,
        warehouse_code: item.warehouseCode,
        warehouse_name: item.warehouseName,
      })),
      skus: skus.map((item) => ({
        id: item.id,
        sku_code: item.skuCode,
        sku_name: item.skuName,
        product_name: item.product.name,
        sale_type: item.saleType,
        stock_unit: item.stockUnit,
      })),
    };
  }

  async adjust(
    tenantId: string,
    operatorId: string,
    dto: AdjustInventoryDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const sku = await manager.getRepository(SkuEntity).findOneBy({
        id: dto.sku_id,
        tenantId,
        status: 'ACTIVE',
      });
      const warehouse = await manager.getRepository(WarehouseEntity).findOneBy({
        id: dto.warehouse_id,
        tenantId,
        status: 'ACTIVE',
      });
      if (!sku || !warehouse) {
        throw new NotFoundException({
          code: 'INVENTORY_REFERENCE_NOT_FOUND',
          message: 'SKU或仓库不存在或已停用',
        });
      }
      if (sku.saleType === 'PIECE' && !Number.isInteger(dto.quantity)) {
        throw new BadRequestException({
          code: 'PIECE_INVENTORY_INTEGER_REQUIRED',
          message: '按件SKU的库存调整数量必须为整数',
        });
      }
      if (dto.operation_type !== 'SET' && dto.quantity <= 0) {
        throw new BadRequestException({
          code: 'INVENTORY_CHANGE_REQUIRED',
          message: '增加或减少库存的数量必须大于0',
        });
      }

      const repository = manager.getRepository(InventoryEntity);
      await manager.query(
        `INSERT INTO inventory (
          tenant_id, warehouse_id, sku_id, stock_unit,
          stock_quantity, locked_quantity, cost_price, version
        ) VALUES (?, ?, ?, ?, 0, 0, ?, 0)
        ON DUPLICATE KEY UPDATE id = id`,
        [tenantId, warehouse.id, sku.id, sku.stockUnit, sku.costPrice],
      );
      const record = await repository
        .createQueryBuilder('inventory')
        .setLock('pessimistic_write')
        .where('inventory.tenant_id = :tenantId', { tenantId })
        .andWhere('inventory.warehouse_id = :warehouseId', {
          warehouseId: warehouse.id,
        })
        .andWhere('inventory.sku_id = :skuId', { skuId: sku.id })
        .getOneOrFail();

      const before = Number(record.stockQuantity);
      let after: number;
      if (dto.operation_type === 'SET') {
        after = dto.quantity;
      } else if (dto.operation_type === 'ADJUST_IN') {
        after = before + dto.quantity;
      } else {
        after = before - dto.quantity;
      }
      if (after < Number(record.lockedQuantity)) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_AVAILABLE_STOCK',
          message: '调整后库存不能小于锁定库存',
        });
      }

      record.stockQuantity = after.toFixed(3);
      record.costPrice = sku.costPrice;
      record.version += 1;
      await repository.save(record);

      const signedChange =
        dto.operation_type === 'SET'
          ? after - before
          : dto.operation_type === 'ADJUST_IN'
            ? dto.quantity
            : -dto.quantity;
      await manager.getRepository(InventoryLogEntity).save({
        tenantId,
        inventoryId: record.id,
        warehouseId: warehouse.id,
        skuId: sku.id,
        operationType: dto.operation_type,
        changeQuantity: signedChange.toFixed(3),
        beforeQuantity: before.toFixed(3),
        afterQuantity: after.toFixed(3),
        stockUnit: sku.stockUnit,
        reason: dto.reason.trim(),
        referenceType: null,
        referenceId: null,
        operatorType: 'EMPLOYEE',
        operatorId,
      });

      const refreshed = await repository.findOne({
        where: { id: record.id },
        relations: { sku: { product: true } },
      });
      if (!refreshed) throw new Error('Inventory disappeared after update');
      return this.view(refreshed);
    });
  }

  private view(row: InventoryEntity) {
    return {
      id: row.id,
      warehouse_id: row.warehouseId,
      sku_id: row.skuId,
      product_name: row.sku.product.name,
      sku_code: row.sku.skuCode,
      sku_name: row.sku.skuName,
      sale_type: row.sku.saleType,
      stock_unit: row.stockUnit,
      stock_quantity: row.stockQuantity,
      locked_quantity: row.lockedQuantity,
      available_quantity: row.availableQuantity,
      cost_price: row.costPrice,
      stock_warning: row.sku.stockWarning,
      warning: Number(row.availableQuantity) <= Number(row.sku.stockWarning),
      version: row.version,
      updated_at: row.updatedAt,
    };
  }
}
