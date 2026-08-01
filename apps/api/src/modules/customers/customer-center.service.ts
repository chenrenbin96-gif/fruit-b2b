import { randomInt } from 'node:crypto';
import { hash } from 'bcryptjs';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import type { AuthPrincipal } from '../auth/types/auth-principal';
import { CustomerAccountEntity, CustomerEntity, CustomerLevelEntity } from './entities/customer.entities';
import { AdjustCustomerCreditDto, CustomerCenterQueryDto, SaveCustomerAgreementDto, SaveCustomerCenterDto, SaveCustomerGroupDto, SaveCustomerTagDto, SaveCustomerTypeDto } from './dto/customer-center.dto';
import { SkuEntity } from '../products/entities/product.entities';

@Injectable()
export class CustomerCenterService {
  constructor(private readonly db: DataSource) {}

  async list(principal: AuthPrincipal, query: CustomerCenterQueryDto) {
    const params: unknown[] = [principal.tenantId];
    const filters = ['c.tenant_id=?', 'c.deleted_at IS NULL'];
    if (principal.roleCode === 'SALES') { filters.push('COALESCE(c.salesperson_id,c.sales_owner_id)=?'); params.push(principal.userId); }
    if (query.keyword) { filters.push('(c.customer_name LIKE ? OR c.customer_no LIKE ? OR c.contact_name LIKE ? OR c.phone LIKE ? OR ca.account_name LIKE ?)'); for (let i=0;i<5;i++) params.push(`%${query.keyword}%`); }
    if (query.customer_type_id) { filters.push('c.customer_type_id=?'); params.push(query.customer_type_id); }
    if (query.delivery_region_id) { filters.push('c.delivery_region_id=?'); params.push(query.delivery_region_id); }
    if (query.salesperson_id) { filters.push('COALESCE(c.salesperson_id,c.sales_owner_id)=?'); params.push(query.salesperson_id); }
    if (query.status) { filters.push('c.status=?'); params.push(query.status); }
    if (query.date_from) { filters.push('c.created_at>=?'); params.push(query.date_from); }
    if (query.date_to) { filters.push('c.created_at<DATE_ADD(?,INTERVAL 1 DAY)'); params.push(query.date_to); }
    return this.db.query(`SELECT c.id,c.customer_no,c.customer_name,c.contact_name,c.phone,c.address,
      ca.account_name,dr.region_name, c.default_route,ct.name customer_type,u.name salesperson_name,
      c.credit_days,c.credit_limit,c.balance_due,c.created_at,c.registration_channel,c.status,
      cg.group_name,GROUP_CONCAT(DISTINCT tags.tag_name ORDER BY tags.sort) tags
      FROM customers c LEFT JOIN customer_accounts ca ON ca.customer_id=c.id AND ca.is_primary=1 AND ca.deleted_at IS NULL
      LEFT JOIN delivery_regions dr ON dr.id=c.delivery_region_id LEFT JOIN customer_types ct ON ct.id=c.customer_type_id
      LEFT JOIN users u ON u.id=COALESCE(c.salesperson_id,c.sales_owner_id) LEFT JOIN customer_groups cg ON cg.id=c.group_id
      LEFT JOIN customer_tag_relation ctr ON ctr.customer_id=c.id LEFT JOIN customer_tags tags ON tags.id=ctr.tag_id
      WHERE ${filters.join(' AND ')} GROUP BY c.id,ca.account_name,dr.region_name,ct.name,u.name,cg.group_name ORDER BY c.id DESC`, params);
  }

  async detail(principal: AuthPrincipal, id: string) {
    await this.assertScope(principal, id);
    const [rows, tags] = await Promise.all([
      this.db.query(`SELECT c.*,ca.account_name,cl.name level_name,ct.name customer_type,cg.group_name,
        dr.region_name,u.name salesperson_name FROM customers c
        LEFT JOIN customer_accounts ca ON ca.customer_id=c.id AND ca.is_primary=1 AND ca.deleted_at IS NULL
        LEFT JOIN customer_levels cl ON cl.id=c.level_id LEFT JOIN customer_types ct ON ct.id=c.customer_type_id
        LEFT JOIN customer_groups cg ON cg.id=c.group_id LEFT JOIN delivery_regions dr ON dr.id=c.delivery_region_id
        LEFT JOIN users u ON u.id=COALESCE(c.salesperson_id,c.sales_owner_id)
        WHERE c.tenant_id=? AND c.id=? AND c.deleted_at IS NULL`, [principal.tenantId,id]),
      this.db.query(`SELECT t.* FROM customer_tags t JOIN customer_tag_relation r ON r.tag_id=t.id WHERE r.tenant_id=? AND r.customer_id=? ORDER BY t.sort`, [principal.tenantId,id]),
    ]);
    if (!rows[0]) throw new NotFoundException('客户不存在');
    return { ...rows[0], tags };
  }

  async save(principal: AuthPrincipal, id: string | null, dto: SaveCustomerCenterDto) {
    if (principal.roleCode === 'SALES' && dto.salesperson_id && dto.salesperson_id !== principal.userId) throw new ForbiddenException('业务员只能创建或维护自己的客户');
    return this.db.transaction(async manager => {
      const level = dto.level_id ? await manager.findOneBy(CustomerLevelEntity,{id:dto.level_id,tenantId:principal.tenantId}) : await manager.findOne(CustomerLevelEntity,{where:{tenantId:principal.tenantId,status:'ACTIVE'},order:{sort:'ASC'}});
      if (!level) throw new BadRequestException('客户等级不存在');
      let row = id ? await manager.findOneBy(CustomerEntity,{id,tenantId:principal.tenantId}) : null;
      if (id && !row) throw new NotFoundException('客户不存在');
      if (row && principal.roleCode === 'SALES' && (row.salespersonId ?? row.salesOwnerId) !== principal.userId) throw new ForbiddenException('不能维护其他业务员的客户');
      row ??= manager.create(CustomerEntity,{tenantId:principal.tenantId,customerNo:dto.customer_no?.trim() || this.no(),balanceDue:'0.00'});
      Object.assign(row,{
        customerName:dto.customer_name.trim(),contactName:dto.contact_name.trim(),phone:dto.phone.trim(),address:dto.address.trim(),
        businessType:dto.business_type ?? 'ENTERPRISE',levelId:level.id,customerTypeId:dto.customer_type_id ?? null,groupId:dto.group_id ?? null,
        deliveryRegionId:dto.delivery_region_id ?? null,defaultRoute:dto.default_route ?? null,salespersonId:dto.salesperson_id ?? principal.userId ?? null,
        unifiedSocialCreditCode:dto.unified_social_credit_code ?? null,certificationStatus:dto.certification_status ?? 'UNVERIFIED',registrationChannel:'ADMIN',
        latitude:dto.latitude?.toFixed(7) ?? null,longitude:dto.longitude?.toFixed(7) ?? null,deliveryTime:dto.delivery_time ?? null,receivingCycle:dto.receiving_cycle ?? null,
        codEnabled:dto.cod_enabled ?? true,onlinePaymentEnabled:dto.online_payment_enabled ?? false,balancePaymentEnabled:dto.balance_payment_enabled ?? false,
        creditPaymentEnabled:dto.credit_payment_enabled ?? false,orderReviewMode:dto.order_review_mode ?? 'SYSTEM',minOrderAmount:dto.min_order_amount?.toFixed(2) ?? null,
        discountRate:(dto.discount_rate ?? 1).toFixed(4),creditLimit:(dto.credit_limit ?? Number(row.creditLimit ?? 0)).toFixed(2),creditDays:dto.credit_days ?? row.creditDays ?? 0,
        settlementType:dto.settlement_type ?? row.settlementType ?? 'CASH',debtLimit:dto.debt_limit?.toFixed(2) ?? null,printTemplates:dto.print_templates ?? null,
        creditEnabled:dto.credit_payment_enabled ?? row.creditEnabled ?? false,status:dto.status ?? 'ACTIVE',
      });
      row=await manager.save(row);
      let account=await manager.findOneBy(CustomerAccountEntity,{tenantId:principal.tenantId,customerId:row.id,isPrimary:true});
      account ??= manager.create(CustomerAccountEntity,{tenantId:principal.tenantId,customerId:row.id,isPrimary:true,wxOpenid:null,wxUnionid:null,status:'ACTIVE'});
      account.accountName=dto.account_name?.trim() || dto.contact_name.trim(); account.phone=dto.phone.trim();
      if(dto.password) account.passwordHash=await hash(dto.password,10);
      await manager.save(account);
      if (dto.min_order_amount !== undefined) {
        await manager.query(
          `INSERT INTO customer_settings(tenant_id,customer_id,first_order_min_amount,enabled)
           VALUES(?,?,?,1)
           ON DUPLICATE KEY UPDATE first_order_min_amount=VALUES(first_order_min_amount),enabled=1`,
          [principal.tenantId,row.id,dto.min_order_amount.toFixed(2)],
        );
      }
      await manager.delete('customer_tag_relation',{tenant_id:principal.tenantId,customer_id:row.id});
      for(const tagId of dto.tag_ids ?? []) await manager.query('INSERT IGNORE INTO customer_tag_relation(tenant_id,customer_id,tag_id) VALUES(?,?,?)',[principal.tenantId,row.id,tagId]);
      return row.id;
    }).then(customerId=>this.detail(principal,customerId));
  }

  async dashboard(principal: AuthPrincipal,id:string){ await this.assertScope(principal,id); const [summary,trend,products]=await Promise.all([
    this.db.query(`SELECT COUNT(DISTINCT o.id) order_count,COALESCE(SUM(o.final_amount),0) purchase_amount,MAX(o.created_at) last_purchase_time,
      COALESCE(AVG(o.final_amount),0) average_order_amount,COUNT(DISTINCT aso.id) after_sale_count,
      MAX(c.balance_due) balance_due,MAX(c.credit_limit) credit_limit FROM customers c LEFT JOIN orders o ON o.customer_id=c.id AND o.status='COMPLETED'
      LEFT JOIN after_sales_orders aso ON aso.customer_id=c.id WHERE c.tenant_id=? AND c.id=?`,[principal.tenantId,id]),
    this.db.query(`SELECT DATE(created_at) date,SUM(final_amount) amount,COUNT(*) orders FROM orders WHERE tenant_id=? AND customer_id=? AND status='COMPLETED' AND created_at>=DATE_SUB(CURRENT_DATE(),INTERVAL 30 DAY) GROUP BY DATE(created_at) ORDER BY date`,[principal.tenantId,id]),
    this.db.query(`SELECT oi.sku_id,MAX(oi.product_name) product_name,MAX(oi.sku_name) sku_name,SUM(COALESCE(oi.actual_quantity,oi.actual_weight,oi.planned_quantity,oi.planned_weight,0)) quantity,SUM(COALESCE(oi.final_amount,oi.estimated_amount)) amount FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.tenant_id=? AND o.customer_id=? AND o.status='COMPLETED' GROUP BY oi.sku_id ORDER BY amount DESC LIMIT 10`,[principal.tenantId,id])]);
    return {summary:summary[0],purchase_frequency:summary[0]?.order_count?Number(summary[0].order_count)/30:0,trend,product_ranking:products}; }

  async orders(principal:AuthPrincipal,id:string){await this.assertScope(principal,id);return this.db.query(`SELECT o.id,o.order_no,o.created_at order_date,COUNT(oi.id) product_count,COALESCE(o.final_product_amount,o.estimated_product_amount) order_amount,o.discount_amount,o.shipping_fee,COALESCE(r.status,'UNBILLED') payment_status,o.status FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id LEFT JOIN receivables r ON r.order_id=o.id WHERE o.tenant_id=? AND o.customer_id=? GROUP BY o.id,r.status ORDER BY o.id DESC`,[principal.tenantId,id]);}
  async history(principal:AuthPrincipal,id:string){await this.assertScope(principal,id);return this.db.query(`SELECT oi.sku_id,MAX(oi.product_name) product_name,MAX(oi.sku_name) sku_name,COUNT(DISTINCT o.id) purchase_count,SUM(COALESCE(oi.actual_quantity,oi.actual_weight,oi.planned_quantity,oi.planned_weight,0)) total_quantity,MAX(o.created_at) last_purchase_time,SUBSTRING_INDEX(GROUP_CONCAT(oi.unit_price ORDER BY o.created_at DESC),',',1) last_price FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.tenant_id=? AND o.customer_id=? AND o.status<>'CANCELLED' GROUP BY oi.sku_id ORDER BY last_purchase_time DESC`,[principal.tenantId,id]);}
  async credit(principal:AuthPrincipal,id:string){await this.assertScope(principal,id);const rows=await this.db.query(`SELECT c.id,c.customer_name,c.credit_limit,c.balance_due,(c.credit_limit-c.balance_due) available_credit,c.credit_days,c.credit_enabled,COALESCE(SUM(CASE WHEN r.due_date<CURRENT_DATE() AND r.remaining_amount>0 THEN r.remaining_amount ELSE 0 END),0) overdue_amount FROM customers c LEFT JOIN receivables r ON r.customer_id=c.id WHERE c.tenant_id=? AND c.id=? GROUP BY c.id`,[principal.tenantId,id]);return rows[0];}
  async adjustCredit(p:AuthPrincipal,id:string,dto:AdjustCustomerCreditDto){const before=await this.credit(p,id);await this.db.transaction(async m=>{await m.update(CustomerEntity,{id,tenantId:p.tenantId},{creditLimit:dto.credit_limit.toFixed(2),creditDays:dto.credit_days,creditEnabled:dto.credit_enabled});await m.query(`INSERT INTO customer_credit_logs(tenant_id,customer_id,before_limit,after_limit,before_credit_days,after_credit_days,reason,operator_id) VALUES(?,?,?,?,?,?,?,?)`,[p.tenantId,id,before.credit_limit,dto.credit_limit.toFixed(2),before.credit_days,dto.credit_days,dto.reason,p.userId]);});return this.credit(p,id);}

  types(t:string){return this.db.query('SELECT * FROM customer_types WHERE tenant_id=? ORDER BY id DESC',[t]);}
  saveType(t:string,d:SaveCustomerTypeDto){return this.db.query(`INSERT INTO customer_types(tenant_id,name,default_discount,default_credit_days,default_delivery_region_id,status) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE default_discount=VALUES(default_discount),default_credit_days=VALUES(default_credit_days),default_delivery_region_id=VALUES(default_delivery_region_id),status=VALUES(status)`,[t,d.name,d.default_discount.toFixed(4),d.default_credit_days,d.default_delivery_region_id??null,d.status??'ACTIVE']);}
  groups(t:string){return this.db.query(`SELECT g.*,COUNT(c.id) customer_count FROM customer_groups g LEFT JOIN customers c ON c.group_id=g.id AND c.deleted_at IS NULL WHERE g.tenant_id=? GROUP BY g.id ORDER BY g.id DESC`,[t]);}
  saveGroup(t:string,d:SaveCustomerGroupDto){return this.db.query(`INSERT INTO customer_groups(tenant_id,group_name,contact_name,phone,address,unified_settlement,status) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE contact_name=VALUES(contact_name),phone=VALUES(phone),address=VALUES(address),unified_settlement=VALUES(unified_settlement),status=VALUES(status)`,[t,d.group_name,d.contact_name,d.phone,d.address,d.unified_settlement??false,d.status??'ACTIVE']);}
  tags(t:string){return this.db.query('SELECT * FROM customer_tags WHERE tenant_id=? ORDER BY sort,id',[t]);}
  saveTag(t:string,d:SaveCustomerTagDto){return this.db.query(`INSERT INTO customer_tags(tenant_id,tag_name,color,sort,status) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE color=VALUES(color),sort=VALUES(sort),status=VALUES(status)`,[t,d.tag_name,d.color,d.sort,d.status??'ACTIVE']);}
  agreements(t:string,customerId?:string){return this.db.query(`SELECT a.*,c.customer_name,p.name product_name,s.sku_name,s.sku_code FROM customer_agreements a JOIN customers c ON c.id=a.customer_id JOIN products p ON p.id=a.product_id JOIN skus s ON s.id=a.sku_id WHERE a.tenant_id=? ${customerId?'AND a.customer_id=?':''} ORDER BY a.id DESC`,customerId?[t,customerId]:[t]);}
  async saveAgreement(t:string,d:SaveCustomerAgreementDto){const sku=await this.db.manager.findOneBy(SkuEntity,{id:d.sku_id,tenantId:t});if(!sku)throw new NotFoundException('SKU不存在');await this.db.query(`INSERT INTO customer_agreements(tenant_id,customer_id,product_id,sku_id,agreement_price,start_time,end_time,status) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE agreement_price=VALUES(agreement_price),start_time=VALUES(start_time),end_time=VALUES(end_time),status=VALUES(status)`,[t,d.customer_id,sku.productId,sku.id,d.agreement_price.toFixed(4),d.start_time,d.end_time??null,d.status??'ACTIVE']);return this.agreements(t,d.customer_id);}

  private async assertScope(p:AuthPrincipal,id:string){const rows=await this.db.query('SELECT id,COALESCE(salesperson_id,sales_owner_id) salesperson_id FROM customers WHERE tenant_id=? AND id=? AND deleted_at IS NULL',[p.tenantId,id]);if(!rows[0])throw new NotFoundException('客户不存在');if(p.roleCode==='SALES'&&String(rows[0].salesperson_id)!==p.userId)throw new ForbiddenException('只能访问自己负责的客户');}
  private no(){const d=new Date().toISOString().slice(0,10).replaceAll('-','');return `CUS${d}${String(Date.now()).slice(-5)}${randomInt(0,1000).toString().padStart(3,'0')}`;}
}
