export type CustomerExcelColumn = {
  header: string;
  key: string;
  width: number;
};

/** Customer import and export must both use this ordered schema. */
export const CUSTOMER_EXCEL_COLUMNS: readonly CustomerExcelColumn[] = [
  { header: '客户ID', key: 'customer_id', width: 14 },
  { header: '客户编码', key: 'customer_no', width: 20 },
  { header: '客户账号', key: 'account_name', width: 18 },
  { header: '客户名称', key: 'customer_name', width: 24 },
  { header: '客户类型', key: 'customer_type', width: 16 },
  { header: '联系人', key: 'contact_name', width: 14 },
  { header: '联系电话', key: 'phone', width: 16 },
  { header: '区域', key: 'region_name', width: 16 },
  { header: '默认线路', key: 'default_route', width: 18 },
  { header: '收货地址', key: 'address', width: 32 },
  { header: '详细地址', key: 'detail_address', width: 32 },
  { header: '业务员', key: 'salesperson_name', width: 14 },
  { header: '账期', key: 'credit_days', width: 12 },
  { header: '授信额度', key: 'credit_limit', width: 16 },
  { header: '客户折扣', key: 'discount_rate', width: 14 },
  { header: '客户起订价', key: 'min_order_amount', width: 16 },
  { header: '支付方式', key: 'payment_methods', width: 24 },
  { header: '订单审核状态', key: 'order_review_mode', width: 16 },
  { header: '客户标签', key: 'tags', width: 24 },
  { header: '所属集团', key: 'group_name', width: 18 },
  { header: '统一社会信用代码', key: 'unified_social_credit_code', width: 22 },
  { header: '企业认证状态', key: 'certification_status', width: 16 },
  { header: '营业执照', key: 'business_license', width: 28 },
  { header: '状态', key: 'status', width: 12 },
  { header: '创建时间', key: 'created_at', width: 22 },
  { header: '注册渠道', key: 'registration_channel', width: 16 },
  { header: '备注', key: 'sales_remark', width: 30 },
] as const;

export const CUSTOMER_STATISTICS_COLUMNS: readonly CustomerExcelColumn[] = [
  { header: '累计订单金额', key: 'total_order_amount', width: 18 },
  { header: '累计采购金额', key: 'total_purchase_amount', width: 18 },
  { header: '售后次数', key: 'after_sale_count', width: 14 },
  { header: '最后下单时间', key: 'last_order_time', width: 22 },
] as const;
