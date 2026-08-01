import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { DataSource } from 'typeorm';

import type { AuthPrincipal } from '../auth/types/auth-principal';
import { CUSTOMER_EXCEL_COLUMNS, CUSTOMER_STATISTICS_COLUMNS } from './customer-excel.columns';
import type { CustomerExportQueryDto, SaveCustomerCenterDto } from './dto/customer-center.dto';
import { CustomerCenterService } from './customer-center.service';

type ExportRow = Record<string, unknown>;

@Injectable()
export class CustomerExcelService {
  constructor(
    private readonly db: DataSource,
    private readonly customers: CustomerCenterService,
  ) {}

  async export(
    principal: AuthPrincipal,
    query: CustomerExportQueryDto,
    ip: string,
  ): Promise<{ buffer: Buffer; count: number }> {
    const selectedIds=query.ids ?? query['ids[]'];
    if (query.export_type === 'SELECTED' && !selectedIds?.length) {
      throw new BadRequestException('请选择需要导出的客户');
    }
    const rows = await this.customers.exportRows(principal, query) as ExportRow[];
    const columns = query.include_statistics
      ? [...CUSTOMER_EXCEL_COLUMNS, ...CUSTOMER_STATISTICS_COLUMNS]
      : [...CUSTOMER_EXCEL_COLUMNS];
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '水果B2B订货系统';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('客户档案', {
      views: [{ state: 'frozen', ySplit: 1 }],
      properties: { defaultRowHeight: 20 },
    });
    sheet.columns = columns.map((column) => ({ ...column }));
    sheet.autoFilter = { from: 'A1', to: sheet.getCell(1, columns.length).address };
    sheet.getRow(1).height = 28;
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF15803D' } } };
    });
    for (const row of rows) sheet.addRow(this.toExcelRow(row, query.include_statistics === true));
    this.formatData(sheet, rows.length, columns.length);
    const bytes = await workbook.xlsx.writeBuffer();
    await this.db.query(
      `INSERT INTO customer_operation_logs
        (tenant_id,admin_id,operation_type,export_count,filter_json,ip)
       VALUES(?,?,'customer_export',?,?,?)`,
      [principal.tenantId, principal.userId, rows.length, JSON.stringify(this.auditFilter(query)), ip],
    );
    return { buffer: Buffer.from(bytes), count: rows.length };
  }

  async import(principal: AuthPrincipal, file?: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('请选择客户Excel文件');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Excel中没有可导入的工作表');
    const headers = sheet.getRow(1).values as unknown[];
    const actual = CUSTOMER_EXCEL_COLUMNS.map((_, index) => String(headers[index + 1] ?? '').trim());
    const expected = CUSTOMER_EXCEL_COLUMNS.map((column) => column.header);
    if (actual.some((header, index) => header !== expected[index])) {
      throw new BadRequestException('导入字段与客户标准模板不一致，请重新下载模板');
    }
    const lookups = await this.lookups(principal.tenantId);
    let created = 0;
    let updated = 0;
    const errors: Array<{ row: number; message: string }> = [];
    for (let rowNo = 2; rowNo <= sheet.rowCount; rowNo += 1) {
      const values = sheet.getRow(rowNo).values as unknown[];
      if (values.slice(1).every((value) => value === null || value === undefined || String(value).trim() === '')) continue;
      try {
        const record = Object.fromEntries(CUSTOMER_EXCEL_COLUMNS.map((column, index) => [column.key, this.cell(values[index + 1])]));
        const id = record.customer_id || null;
        const dto = this.toSaveDto(record, lookups);
        await this.customers.save(principal, id, dto);
        if (id) updated += 1; else created += 1;
      } catch (error) {
        errors.push({ row: rowNo, message: error instanceof Error ? error.message : '导入失败' });
      }
    }
    if (errors.length > 0) throw new BadRequestException({ message: '部分客户导入失败', created, updated, errors: errors.slice(0, 100) });
    return { created, updated, total: created + updated };
  }

  async template(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('客户档案');
    sheet.columns = CUSTOMER_EXCEL_COLUMNS.map((column) => ({ ...column }));
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    const bytes = await workbook.xlsx.writeBuffer();
    return Buffer.from(bytes);
  }

  private toExcelRow(row: ExportRow, includeStatistics: boolean): Record<string, unknown> {
    const paymentMethods = [
      row.cod_enabled ? '货到付款' : '',
      row.online_payment_enabled ? '在线支付' : '',
      row.balance_payment_enabled ? '余额支付' : '',
      row.credit_payment_enabled ? '账期支付' : '',
    ].filter(Boolean).join('、');
    const result: Record<string, unknown> = {
      customer_id: String(row.id ?? ''), customer_no: row.customer_no ?? '', account_name: row.account_name ?? '',
      customer_name: row.customer_name ?? '', customer_type: row.customer_type ?? '', contact_name: row.contact_name ?? '',
      phone: row.phone ?? '', region_name: row.region_name ?? '', default_route: row.default_route ?? '', address: row.address ?? '',
      detail_address: row.detail_address ?? '', salesperson_name: row.salesperson_name ?? '', credit_days: Number(row.credit_days ?? 0),
      credit_limit: Number(row.credit_limit ?? 0), discount_rate: Number(row.discount_rate ?? 1),
      min_order_amount: Number(row.configured_min_order_amount ?? row.min_order_amount ?? 0), payment_methods: paymentMethods,
      order_review_mode: this.reviewText(row.order_review_mode), tags: row.tags ?? '', group_name: row.group_name ?? '',
      unified_social_credit_code: row.unified_social_credit_code ?? '', certification_status: this.certificationText(row.certification_status),
      business_license: row.business_license ?? '', status: this.statusText(row.status), created_at: row.created_at instanceof Date ? row.created_at : row.created_at ?? '',
      registration_channel: row.registration_channel ?? '', sales_remark: row.sales_remark ?? '',
    };
    if (includeStatistics) Object.assign(result, {
      total_order_amount: Number(row.total_order_amount ?? 0), total_purchase_amount: Number(row.total_purchase_amount ?? 0),
      after_sale_count: Number(row.after_sale_count ?? 0), last_order_time: row.last_order_time ?? '',
    });
    return result;
  }

  private formatData(sheet: ExcelJS.Worksheet, rowCount: number, columnCount: number) {
    if (rowCount === 0) return;
    for (let rowNo = 2; rowNo <= rowCount + 1; rowNo += 1) {
      const row = sheet.getRow(rowNo);
      row.alignment = { vertical: 'middle' };
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
      });
    }
    const moneyKeys = ['credit_limit', 'min_order_amount', ...(columnCount > CUSTOMER_EXCEL_COLUMNS.length ? ['total_order_amount', 'total_purchase_amount'] : [])];
    for (const key of moneyKeys) {
      const column = sheet.getColumn(key);
      if (column.number <= columnCount) column.numFmt = '#,##0.00';
    }
    sheet.getColumn('discount_rate').numFmt = '0.00%';
    sheet.getColumn('created_at').numFmt = 'yyyy-mm-dd hh:mm:ss';
    if (columnCount > CUSTOMER_EXCEL_COLUMNS.length) sheet.getColumn('last_order_time').numFmt = 'yyyy-mm-dd hh:mm:ss';
  }

  private auditFilter(query: CustomerExportQueryDto) {
    return {
      export_type: query.export_type ?? 'FILTERED', keyword: query.keyword ?? null,
      customer_type_id: query.customer_type_id ?? null, delivery_region_id: query.delivery_region_id ?? null,
      salesperson_id: query.salesperson_id ?? null, status: query.status ?? null, date_from: query.date_from ?? null,
      date_to: query.date_to ?? null, customer_tag_id: query.customer_tag_id ?? null, ids: query.ids ?? query['ids[]'] ?? [],
      include_statistics: query.include_statistics === true,
    };
  }

  private async lookups(tenantId: string) {
    const [types, regions, users, groups, tags] = await Promise.all([
      this.db.query('SELECT id,name FROM customer_types WHERE tenant_id=?', [tenantId]),
      this.db.query('SELECT id,region_name name FROM delivery_regions WHERE tenant_id=? AND deleted_at IS NULL', [tenantId]),
      this.db.query('SELECT id,name FROM users WHERE tenant_id=? AND deleted_at IS NULL', [tenantId]),
      this.db.query('SELECT id,group_name name FROM customer_groups WHERE tenant_id=?', [tenantId]),
      this.db.query('SELECT id,tag_name name FROM customer_tags WHERE tenant_id=?', [tenantId]),
    ]);
    const map = (rows: Array<{ id: string; name: string }>) => new Map(rows.map((row) => [String(row.name), String(row.id)]));
    return { types: map(types), regions: map(regions), users: map(users), groups: map(groups), tags: map(tags) };
  }

  private toSaveDto(record: Record<string, string>, lookups: Awaited<ReturnType<CustomerExcelService['lookups']>>): SaveCustomerCenterDto {
    for (const field of ['customer_name', 'contact_name', 'phone', 'address']) {
      if (!record[field]) throw new BadRequestException(`${CUSTOMER_EXCEL_COLUMNS.find((column) => column.key === field)?.header ?? field}不能为空`);
    }
    const payments = record.payment_methods ?? '';
    const tags = (record.tags ?? '').split(/[、,，]/).map((item) => item.trim()).filter(Boolean);
    return {
      customer_no: record.customer_no || undefined, account_name: record.account_name || undefined,
      customer_name: record.customer_name!, contact_name: record.contact_name!, phone: record.phone!,
      address: [record.address, record.detail_address].filter(Boolean).join(' '),
      customer_type_id: lookups.types.get(record.customer_type ?? ''), delivery_region_id: lookups.regions.get(record.region_name ?? ''),
      salesperson_id: lookups.users.get(record.salesperson_name ?? ''), group_id: lookups.groups.get(record.group_name ?? ''),
      tag_ids: tags.map((tag) => lookups.tags.get(tag)).filter((id): id is string => Boolean(id)),
      credit_days: this.number(record.credit_days ?? ''), credit_limit: this.number(record.credit_limit ?? ''),
      discount_rate: this.number(record.discount_rate ?? '') || 1, min_order_amount: this.number(record.min_order_amount ?? ''),
      cod_enabled: payments.includes('货到付款'), online_payment_enabled: payments.includes('在线支付'),
      balance_payment_enabled: payments.includes('余额支付'), credit_payment_enabled: payments.includes('账期支付'),
      order_review_mode: this.reviewValue(record.order_review_mode ?? ''), unified_social_credit_code: record.unified_social_credit_code || undefined,
      certification_status: this.certificationValue(record.certification_status ?? ''), status: this.statusValue(record.status ?? ''),
    };
  }

  private cell(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object' && value && 'text' in value) return String((value as { text: unknown }).text ?? '').trim();
    return String(value ?? '').trim();
  }
  private number(value: string): number { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
  private statusText(value: unknown) { return ({ ACTIVE: '正常', PENDING: '待审核', DISABLED: '禁用' } as Record<string, string>)[String(value)] ?? String(value ?? ''); }
  private statusValue(value: string): 'ACTIVE' | 'PENDING' | 'DISABLED' { return ({ 正常: 'ACTIVE', 待审核: 'PENDING', 禁用: 'DISABLED' } as const)[value as '正常'] ?? (['ACTIVE','PENDING','DISABLED'].includes(value) ? value as 'ACTIVE' : 'ACTIVE'); }
  private certificationText(value: unknown) { return ({ UNVERIFIED: '未认证', PENDING: '审核中', VERIFIED: '已认证', REJECTED: '已驳回' } as Record<string, string>)[String(value)] ?? String(value ?? ''); }
  private certificationValue(value: string): 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' { return ({ 未认证: 'UNVERIFIED', 审核中: 'PENDING', 已认证: 'VERIFIED', 已驳回: 'REJECTED' } as const)[value as '未认证'] ?? 'UNVERIFIED'; }
  private reviewText(value: unknown) { return ({ SYSTEM: '跟随系统', ENABLED: '开启', DISABLED: '关闭' } as Record<string, string>)[String(value)] ?? String(value ?? ''); }
  private reviewValue(value: string): 'SYSTEM' | 'ENABLED' | 'DISABLED' { return ({ 跟随系统: 'SYSTEM', 开启: 'ENABLED', 关闭: 'DISABLED' } as const)[value as '跟随系统'] ?? 'SYSTEM'; }
}
