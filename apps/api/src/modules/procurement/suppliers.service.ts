import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

import {
  SaveSupplierDto,
  SupplierListQueryDto,
} from './dto/procurement.dto';
import { SupplierEntity } from './entities/procurement.entities';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(SupplierEntity)
    private readonly suppliers: Repository<SupplierEntity>,
  ) {}

  async list(tenantId: string, query: SupplierListQueryDto) {
    const builder = this.suppliers
      .createQueryBuilder('supplier')
      .where('supplier.tenant_id = :tenantId', { tenantId });
    if (query.status) {
      builder.andWhere('supplier.status = :status', { status: query.status });
    }
    if (query.keyword) {
      builder.andWhere(
        new Brackets((where) =>
          where
            .where('supplier.supplier_name LIKE :keyword', {
              keyword: `%${query.keyword}%`,
            })
            .orWhere('supplier.contact_name LIKE :keyword', {
              keyword: `%${query.keyword}%`,
            })
            .orWhere('supplier.phone LIKE :keyword', {
              keyword: `%${query.keyword}%`,
            }),
        ),
      );
    }
    const rows = await builder.orderBy('supplier.id', 'DESC').getMany();
    return rows.map((row) => this.view(row));
  }

  async detail(tenantId: string, id: string) {
    return this.view(await this.require(tenantId, id));
  }

  async create(tenantId: string, dto: SaveSupplierDto) {
    const row = this.suppliers.create({
      tenantId,
      supplierNo: this.generateNo(),
      supplierName: dto.supplier_name.trim(),
      contactName: dto.contact_name.trim(),
      phone: dto.phone.trim(),
      address: dto.address.trim(),
      supplyCategories: dto.supply_categories.map((item) => item.trim()),
      settlementMethod: dto.settlement_method?.trim() || null,
      creditDays: dto.credit_days ?? 0,
      remark: dto.remark?.trim() || null,
      status: dto.status ?? 'ACTIVE',
    });
    return this.view(await this.suppliers.save(row));
  }

  async update(tenantId: string, id: string, dto: SaveSupplierDto) {
    const row = await this.require(tenantId, id);
    Object.assign(row, {
      supplierName: dto.supplier_name.trim(),
      contactName: dto.contact_name.trim(),
      phone: dto.phone.trim(),
      address: dto.address.trim(),
      supplyCategories: dto.supply_categories.map((item) => item.trim()),
      settlementMethod: dto.settlement_method?.trim() || null,
      creditDays: dto.credit_days ?? row.creditDays,
      remark: dto.remark?.trim() || null,
      status: dto.status ?? row.status,
    });
    return this.view(await this.suppliers.save(row));
  }

  private async require(tenantId: string, id: string) {
    const row = await this.suppliers.findOneBy({ id, tenantId });
    if (!row) {
      throw new NotFoundException({
        code: 'SUPPLIER_NOT_FOUND',
        message: '供应商不存在',
      });
    }
    return row;
  }

  private view(row: SupplierEntity) {
    return {
      id: row.id,
      supplier_no: row.supplierNo,
      supplier_name: row.supplierName,
      contact_name: row.contactName,
      phone: row.phone,
      address: row.address,
      supply_categories: row.supplyCategories ?? [],
      settlement_method: row.settlementMethod,
      credit_days: row.creditDays,
      remark: row.remark,
      status: row.status,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }

  private generateNo(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replaceAll('-', '');
    return `SUP${date}${String(now.getTime()).slice(-5)}${randomInt(0, 1000)
      .toString()
      .padStart(3, '0')}`;
  }
}
import { randomInt } from 'node:crypto';
