import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type Redis from 'ioredis';
import PDFDocument from 'pdfkit';
import { DataSource } from 'typeorm';

import { REDIS_CLIENT } from '../../infrastructure/redis/redis.constants';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import type { BiExportQueryDto, ReportQueryDto } from './dto/report.dto';

type Row = Record<string, unknown>;
type BiResult = {
  type: string;
  date_range: { from: string; to: string };
  summary: Row;
  trend: Row[];
  rankings: Record<string, Row[]>;
  items: Row[];
  pagination: { page: number; page_size: number; total: number; total_pages: number };
  generated_at: string;
};

@Injectable()
export class BiService {
  constructor(private readonly db: DataSource, @Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async dashboard(principal: AuthPrincipal) {
    const key = `bi:dashboard:${principal.tenantId}:${principal.roleCode}:${principal.userId ?? '0'}`;
    return this.cached(key, 30, async () => {
      const tenant = principal.tenantId;
      const salesScope = principal.roleCode === 'SALES' ? ' AND c.salesperson_id=?' : '';
      const salesParams = principal.roleCode === 'SALES' ? [tenant, principal.userId] : [tenant];
      const [salesRows, statusRows, supplyRows, fulfillmentRows, deliveryRows, inventoryRows, todayRows, salesTrend, purchaseTrend, customerTrend, inventoryTrend] = await Promise.all([
        this.db.query(`SELECT
          ROUND(SUM(CASE WHEN DATE(o.created_at)=CURRENT_DATE() AND o.status<>'CANCELLED' THEN COALESCE(o.final_amount,o.estimated_amount) ELSE 0 END),2) today_sales,
          ROUND(SUM(CASE WHEN DATE(o.created_at)=CURRENT_DATE()-INTERVAL 1 DAY AND o.status<>'CANCELLED' THEN COALESCE(o.final_amount,o.estimated_amount) ELSE 0 END),2) yesterday_sales,
          ROUND(SUM(CASE WHEN o.created_at>=DATE_FORMAT(CURRENT_DATE(),'%Y-%m-01') AND o.status<>'CANCELLED' THEN COALESCE(o.final_amount,o.estimated_amount) ELSE 0 END),2) month_sales,
          ROUND(SUM(CASE WHEN o.created_at>=MAKEDATE(YEAR(CURRENT_DATE()),1) AND o.status<>'CANCELLED' THEN COALESCE(o.final_amount,o.estimated_amount) ELSE 0 END),2) year_sales,
          SUM(DATE(o.created_at)=CURRENT_DATE()) today_orders
          FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.tenant_id=?${salesScope}`, salesParams),
        this.db.query(`SELECT o.status,COUNT(*) count FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.tenant_id=?${salesScope} GROUP BY o.status`, salesParams),
        this.db.query(`SELECT
          SUM(status IN ('PENDING_PURCHASE','PURCHASING')) pending_purchase,
          SUM(status IN ('ARRIVED','PARTIALLY_RECEIVED','RECEIVED')) pending_inbound
          FROM purchase_orders WHERE tenant_id=?`, [tenant]),
        this.db.query(`SELECT SUM(status IN ('WAITING','PICKING')) pending_picking FROM picking_tasks WHERE tenant_id=?`, [tenant]),
        this.db.query(`SELECT SUM(status='WAITING') pending_delivery,SUM(status='DELIVERING') delivering FROM deliveries WHERE tenant_id=?`, [tenant]),
        this.db.query(`SELECT COUNT(*) warning_count,SUM(i.available_quantity<=s.stock_warning) low_stock_count
          FROM inventory i JOIN skus s ON s.id=i.sku_id WHERE i.tenant_id=? AND i.available_quantity<=s.stock_warning`, [tenant]),
        this.db.query(`SELECT
          (SELECT COUNT(*) FROM customers WHERE tenant_id=? AND DATE(created_at)=CURRENT_DATE()) new_customers,
          (SELECT COUNT(*) FROM products WHERE tenant_id=? AND DATE(created_at)=CURRENT_DATE()) new_products,
          (SELECT COALESCE(SUM(total_amount),0) FROM purchase_orders WHERE tenant_id=? AND status<>'CANCELLED' AND DATE(created_at)=CURRENT_DATE()) purchase_amount,
          (SELECT COUNT(*) FROM after_sales_orders WHERE tenant_id=? AND status IN ('PENDING','APPROVED','PROCESSING')) pending_after_sales,
          (SELECT COUNT(*) FROM receivables WHERE tenant_id=? AND status<>'PAID') pending_payment`, [tenant, tenant, tenant, tenant, tenant]),
        this.salesTrends(tenant, principal, this.date(-29), this.date(0)),
        this.db.query(`SELECT DATE(created_at) report_date,ROUND(SUM(total_amount),2) value FROM purchase_orders WHERE tenant_id=? AND status<>'CANCELLED' AND created_at>=DATE_SUB(CURRENT_DATE(),INTERVAL 29 DAY) GROUP BY DATE(created_at) ORDER BY report_date`,[tenant]),
        this.db.query(`SELECT DATE(created_at) report_date,COUNT(*) value FROM customers WHERE tenant_id=? AND created_at>=DATE_SUB(CURRENT_DATE(),INTERVAL 29 DAY) GROUP BY DATE(created_at) ORDER BY report_date`,[tenant]),
        this.db.query(`SELECT DATE(created_at) report_date,ROUND(SUM(change_quantity),3) value FROM inventory_logs WHERE tenant_id=? AND created_at>=DATE_SUB(CURRENT_DATE(),INTERVAL 29 DAY) GROUP BY DATE(created_at) ORDER BY report_date`,[tenant]),
      ]);
      const profitRows = await this.db.query(`SELECT ROUND(SUM(COALESCE(oi.final_amount,oi.estimated_amount)),2) sales,
        ROUND(SUM(COALESCE(oi.actual_quantity,oi.actual_weight,oi.planned_quantity,oi.planned_weight,0)*s.cost_price),2) cost
        FROM orders o JOIN customers c ON c.id=o.customer_id JOIN order_items oi ON oi.order_id=o.id JOIN skus s ON s.id=oi.sku_id
        WHERE o.tenant_id=? AND o.status<>'CANCELLED' AND DATE(o.created_at)=CURRENT_DATE()${salesScope}`, salesParams);
      const sales = salesRows[0] ?? {}, supply = supplyRows[0] ?? {}, fulfillment = fulfillmentRows[0] ?? {}, delivery = deliveryRows[0] ?? {}, inventory = inventoryRows[0] ?? {}, today = todayRows[0] ?? {}, profit = profitRows[0] ?? {};
      const status = Object.fromEntries(statusRows.map((x: Row) => [String(x.status), Number(x.count)]));
      const salesAmount = Number(profit.sales ?? 0), profitAmount = salesAmount - Number(profit.cost ?? 0);
      const result = { metrics: {
        today_sales:Number(sales.today_sales??0), yesterday_sales:Number(sales.yesterday_sales??0), month_sales:Number(sales.month_sales??0), year_sales:Number(sales.year_sales??0), today_orders:Number(sales.today_orders??0),
        pending_payment:Number(today.pending_payment??0), pending_review:Number(status.WAITING_REVIEW??0), pending_purchase:Number(supply.pending_purchase??0), pending_inbound:Number(supply.pending_inbound??0), pending_picking:Number(fulfillment.pending_picking??0), pending_delivery:Number(delivery.pending_delivery??0), delivering:Number(delivery.delivering??0), pending_after_sales:Number(today.pending_after_sales??0),
        inventory_warning:Number(inventory.warning_count??0), low_stock:Number(inventory.low_stock_count??0), new_customers:Number(today.new_customers??0), new_products:Number(today.new_products??0), today_purchase_amount:Number(today.purchase_amount??0), today_profit:profitAmount, today_margin:salesAmount?profitAmount/salesAmount*100:0,
      }, trends:{sales:salesTrend,orders:salesTrend.map((x:Row)=>({...x,value:Number(x.order_count??0)})),profit:salesTrend.map((x:Row)=>({...x,value:Number(x.sales_amount??0)})),customers:customerTrend,purchases:purchaseTrend,inventory:inventoryTrend}, generated_at:new Date().toISOString(), refresh_seconds:30 };
      return this.scopeDashboard(principal,result);
    });
  }

  async report(principal: AuthPrincipal, type: string, q: ReportQueryDto): Promise<BiResult> {
    this.assertAccess(principal, type);
    const from=q.date_from??this.date(-29), to=q.date_to??this.date(0);
    const cacheKey=`bi:report:${principal.tenantId}:${principal.roleCode}:${principal.userId}:${type}:${JSON.stringify({...q,from,to})}`;
    return this.cached(cacheKey, 60, async()=>{
      if(type==='inventory') return this.inventory(principal,q,from,to);
      if(type==='delivery') return this.delivery(principal,q,from,to);
      if(type==='finance') return this.finance(principal,q,from,to);
      if(type==='salespersons') return this.salespersons(principal,q,from,to);
      if(type==='customers') return this.customers(principal,q,from,to);
      if(type==='products') return this.products(principal,q,from,to);
      return this.purchases(principal,q,from,to);
    });
  }

  async screen(principal: AuthPrincipal) {
    const [dashboard, products, customers, delivery] = await Promise.all([
      this.dashboard(principal), this.report(principal,'products',{page:1,page_size:10,top:10}), this.report(principal,'customers',{page:1,page_size:10,top:10}), this.report(principal,'delivery',{page:1,page_size:10,top:10}),
    ]);
    return { ...dashboard, products:products.rankings.sales, customers:customers.rankings.sales, deliveries:delivery.summary };
  }

  async export(principal: AuthPrincipal,type:string,q:BiExportQueryDto){
    const pageSize=q.scope==='page'?q.page_size:100;
    const data=await this.report(principal,type,{...q,page:q.scope==='page'?q.page:1,page_size:pageSize});
    const rows=data.items.length?data.items:[data.summary];
    if(q.format==='csv') return {buffer:Buffer.from(this.csv(rows),'utf8'),contentType:'text/csv; charset=utf-8',extension:'csv'};
    if(q.format==='pdf') return {buffer:await this.pdf(type,data),contentType:'application/pdf',extension:'pdf'};
    const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('BI Report');const keys=Object.keys(rows[0]??{});
    sheet.columns=keys.map(key=>({header:key,key,width:22}));rows.forEach(row=>sheet.addRow(row));sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:'A1',to:`${this.column(keys.length)}1`};
    sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF166534'}};
    return {buffer:Buffer.from(await book.xlsx.writeBuffer()),contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',extension:'xlsx'};
  }

  private async inventory(p:AuthPrincipal,q:ReportQueryDto,from:string,to:string):Promise<BiResult>{
    const params:any[]=[p.tenantId];let filter='';if(q.keyword){filter+=' AND (p.name LIKE ? OR s.sku_name LIKE ?)';params.push(`%${q.keyword}%`,`%${q.keyword}%`);}if(q.category_id){filter+=' AND p.category_id=?';params.push(q.category_id);}if(q.purchase_manager_id){filter+=' AND COALESCE(s.purchase_manager_id,p.purchase_manager_id)=?';params.push(q.purchase_manager_id);}
    const rows=await this.db.query(`SELECT p.id product_id,p.name label,s.id sku_id,s.sku_name,c.name category_name,p.brand,COALESCE(s.purchase_manager_name,p.purchase_manager_name,'未分配') purchase_manager_name,i.stock_unit,
      ROUND(i.stock_quantity,3) stock_quantity,ROUND(i.locked_quantity,3) locked_quantity,ROUND(i.available_quantity,3) available_quantity,ROUND(i.cost_price,4) cost_price,ROUND(i.stock_quantity*i.cost_price,2) stock_value,s.stock_warning,
      CASE WHEN i.available_quantity<=0 THEN 'OUT' WHEN i.available_quantity<=s.stock_warning THEN 'LOW' WHEN i.available_quantity>s.stock_warning*5 THEN 'OVER' ELSE 'NORMAL' END stock_status
      FROM inventory i JOIN skus s ON s.id=i.sku_id JOIN products p ON p.id=s.product_id JOIN categories c ON c.id=p.category_id WHERE i.tenant_id=?${filter} ORDER BY stock_value DESC`,params) as Row[];
    const trend=await this.db.query(`SELECT DATE(created_at) report_date,ROUND(SUM(change_quantity),3) value FROM inventory_logs WHERE tenant_id=? AND DATE(created_at) BETWEEN ? AND ? GROUP BY DATE(created_at) ORDER BY report_date`,[p.tenantId,from,to]);
    const value=rows.reduce((n,x)=>n+Number(x.stock_value),0), quantity=rows.reduce((n,x)=>n+Number(x.stock_quantity),0), low=rows.filter(x=>x.stock_status==='LOW'||x.stock_status==='OUT');
    return this.result('inventory',from,to,q,{stock_value:value,stock_cost:value,stock_quantity:quantity,turnover_rate:0,turnover_days:0,warning_count:low.length,near_out_count:rows.filter(x=>x.stock_status==='LOW').length,expiring_count:0},trend,{slow:[...rows].sort((a,b)=>Number(a.available_quantity)-Number(b.available_quantity)).slice(0,50),fast:rows.slice(0,50),low:low.slice(0,50),over:rows.filter(x=>x.stock_status==='OVER').slice(0,50)},rows);
  }

  private async delivery(p:AuthPrincipal,q:ReportQueryDto,from:string,to:string):Promise<BiResult>{
    const params:any[]=[p.tenantId,from,to];let filter='';if(p.roleCode==='DELIVERY'){filter+=' AND d.delivery_person_id=?';params.push(p.userId);}if(q.keyword){filter+=' AND (d.customer_name LIKE ? OR u.name LIKE ? OR d.delivery_no LIKE ?)';params.push(`%${q.keyword}%`,`%${q.keyword}%`,`%${q.keyword}%`);}
    const rows=await this.db.query(`SELECT d.id,d.delivery_no,d.customer_name,COALESCE(u.name,'未分配') label,d.status,d.address,ROUND(COALESCE(o.shipping_fee,0),2) delivery_cost,
      CASE WHEN d.started_at IS NOT NULL AND d.delivered_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE,d.started_at,d.delivered_at) ELSE NULL END duration_minutes,d.created_at
      FROM deliveries d LEFT JOIN users u ON u.id=d.delivery_person_id JOIN orders o ON o.id=d.order_id WHERE d.tenant_id=? AND DATE(d.created_at) BETWEEN ? AND ?${filter} ORDER BY d.created_at DESC`,params) as Row[];
    const delivered=rows.filter(x=>x.status==='DELIVERED'),failed=rows.filter(x=>x.status==='FAILED');const avg=delivered.reduce((n,x)=>n+Number(x.duration_minutes??0),0)/(delivered.length||1);
    const trend=await this.groupTrend('deliveries',p.tenantId,from,to);
    return this.result('delivery',from,to,q,{delivery_count:rows.length,completion_rate:rows.length?delivered.length/rows.length*100:0,average_minutes:avg,on_time_rate:0,delivery_cost:rows.reduce((n,x)=>n+Number(x.delivery_cost),0),exception_count:failed.length,failed_count:failed.length},trend,{drivers:this.group(rows,'label','delivery_cost'),routes:this.group(rows,'address','delivery_cost'),exceptions:failed.slice(0,50)},rows);
  }

  private async finance(p:AuthPrincipal,q:ReportQueryDto,from:string,to:string):Promise<BiResult>{
    const salesScope=p.roleCode==='SALES'?' AND c.salesperson_id=?':'';const params=p.roleCode==='SALES'?[p.tenantId,from,to,p.userId]:[p.tenantId,from,to];
    const rows=await this.db.query(`SELECT c.id customer_id,c.customer_name label,c.balance_due,c.credit_limit,COUNT(DISTINCT o.id) order_count,ROUND(SUM(COALESCE(o.final_amount,o.estimated_amount)),2) sales_amount,ROUND(SUM(COALESCE(r.remaining_amount,0)),2) receivable_amount
      FROM customers c LEFT JOIN orders o ON o.customer_id=c.id AND o.status<>'CANCELLED' AND DATE(o.created_at) BETWEEN ? AND ? LEFT JOIN receivables r ON r.order_id=o.id WHERE c.tenant_id=?${salesScope} GROUP BY c.id,c.customer_name,c.balance_due,c.credit_limit ORDER BY receivable_amount DESC`,[from,to,...(p.roleCode==='SALES'?[p.tenantId,p.userId]:[p.tenantId])]) as Row[];
    const [money]=await this.db.query(`SELECT
      (SELECT COALESCE(SUM(amount),0) FROM payments WHERE tenant_id=? AND DATE(payment_time)=CURRENT_DATE()) today_income,
      (SELECT COALESCE(SUM(amount),0) FROM payments WHERE tenant_id=? AND payment_time>=DATE_FORMAT(CURRENT_DATE(),'%Y-%m-01')) month_income,
      (SELECT COALESCE(SUM(remaining_amount),0) FROM receivables WHERE tenant_id=?) receivables,
      (SELECT COALESCE(SUM(total_amount-received_amount),0) FROM purchase_orders WHERE tenant_id=? AND status<>'CANCELLED') payables,
      (SELECT COALESCE(SUM(amount),0) FROM after_sale_refunds WHERE tenant_id=? AND status='COMPLETED' AND DATE(completed_at) BETWEEN ? AND ?) refund_amount`,[p.tenantId,p.tenantId,p.tenantId,p.tenantId,p.tenantId,from,to]);
    const profit=await this.profit(p,from,to);const refund=Number(money.refund_amount??0),sales=Number(profit.sales_amount);
    const trend=await this.db.query(`SELECT DATE(payment_time) report_date,ROUND(SUM(amount),2) value FROM payments WHERE tenant_id=? AND DATE(payment_time) BETWEEN ? AND ? GROUP BY DATE(payment_time) ORDER BY report_date`,[p.tenantId,from,to]);
    return this.result('finance',from,to,q,{today_income:Number(money.today_income),month_income:Number(money.month_income),today_profit:Number(profit.today_profit),month_profit:Number(profit.profit_amount),margin_rate:Number(profit.margin_rate),receivables:Number(money.receivables),payables:Number(money.payables),refund_amount:refund,refund_rate:sales?refund/sales*100:0,unpaid_orders:rows.filter(x=>Number(x.receivable_amount)>0).length},trend,{debts:rows.slice(0,50)},rows);
  }

  private async salespersons(p:AuthPrincipal,q:ReportQueryDto,from:string,to:string):Promise<BiResult>{
    const only=p.roleCode==='SALES'?' AND u.id=?':'';const params:any[]=[p.tenantId,from,to];if(only)params.push(p.userId);
    const rows=await this.db.query(`SELECT u.id,u.name label,COUNT(DISTINCT c.id) customer_count,COUNT(DISTINCT o.id) order_count,ROUND(COALESCE(SUM(COALESCE(o.final_amount,o.estimated_amount)),0),2) sales_amount,
      ROUND(COALESCE(SUM(COALESCE(o.final_amount,o.estimated_amount)),0)-COALESCE(SUM(COALESCE(oi.actual_quantity,oi.actual_weight,oi.planned_quantity,oi.planned_weight,0)*s.cost_price),0),2) profit_amount,
      COUNT(DISTINCT CASE WHEN c.created_at BETWEEN ? AND DATE_ADD(?,INTERVAL 1 DAY) THEN c.id END) new_customers
      FROM users u JOIN roles r ON r.id=u.role_id LEFT JOIN customers c ON COALESCE(c.salesperson_id,c.sales_owner_id)=u.id LEFT JOIN orders o ON o.customer_id=c.id AND o.status<>'CANCELLED' AND DATE(o.created_at) BETWEEN ? AND ? LEFT JOIN order_items oi ON oi.order_id=o.id LEFT JOIN skus s ON s.id=oi.sku_id
      WHERE u.tenant_id=? AND r.role_code IN ('SALES','ADMIN')${only} GROUP BY u.id,u.name ORDER BY sales_amount DESC`,[from,to,from,to,p.tenantId,...(only?[p.userId]:[])]) as Row[];
    rows.forEach(x=>{const sales=Number(x.sales_amount),profit=Number(x.profit_amount);x.margin_rate=sales?profit/sales*100:0;x.collection_amount=0;x.collection_rate=0;x.repurchase_rate=0;x.return_rate=0;});
    return this.result('salespersons',from,to,q,{sales_amount:rows.reduce((n,x)=>n+Number(x.sales_amount),0),profit_amount:rows.reduce((n,x)=>n+Number(x.profit_amount),0),salesperson_count:rows.length},[],{sales:rows.slice(0,q.top),profit:[...rows].sort((a,b)=>Number(b.profit_amount)-Number(a.profit_amount)).slice(0,q.top)},rows);
  }

  private async customers(p:AuthPrincipal,q:ReportQueryDto,from:string,to:string):Promise<BiResult>{
    const params:any[]=[from,to,p.tenantId];let filter='';if(p.roleCode==='SALES'){filter+=' AND COALESCE(c.salesperson_id,c.sales_owner_id)=?';params.push(p.userId);}if(q.keyword){filter+=' AND c.customer_name LIKE ?';params.push(`%${q.keyword}%`);}if(q.delivery_region_id){filter+=' AND c.delivery_region_id=?';params.push(q.delivery_region_id);}if(q.customer_type_id){filter+=' AND c.customer_type_id=?';params.push(q.customer_type_id);}
    const rows=await this.db.query(`SELECT c.id,c.customer_name label,c.business_type,c.balance_due,COALESCE(u.name,'未分配') salesperson_name,COUNT(DISTINCT o.id) purchase_count,ROUND(COALESCE(SUM(COALESCE(o.final_amount,o.estimated_amount)),0),2) sales_amount,
      ROUND(COALESCE(AVG(COALESCE(o.final_amount,o.estimated_amount)),0),2) average_order_amount,MAX(o.created_at) last_purchase_time,COUNT(DISTINCT aso.id) after_sale_count
      FROM customers c LEFT JOIN users u ON u.id=COALESCE(c.salesperson_id,c.sales_owner_id) LEFT JOIN orders o ON o.customer_id=c.id AND o.status<>'CANCELLED' AND DATE(o.created_at) BETWEEN ? AND ? LEFT JOIN after_sales_orders aso ON aso.customer_id=c.id
      WHERE c.tenant_id=?${filter} GROUP BY c.id,c.customer_name,c.business_type,c.balance_due,u.name ORDER BY sales_amount DESC`,params) as Row[];
    rows.forEach(x=>{x.repurchase_rate=Number(x.purchase_count)>1?100:0;x.activity=Number(x.purchase_count)>0?'ACTIVE':'INACTIVE';x.lifecycle_value=x.sales_amount;});
    const trend=await this.db.query(`SELECT DATE(created_at) report_date,COUNT(*) value FROM customers WHERE tenant_id=? AND DATE(created_at) BETWEEN ? AND ? GROUP BY DATE(created_at) ORDER BY report_date`,[p.tenantId,from,to]);
    return this.result('customers',from,to,q,{customer_count:rows.length,sales_amount:rows.reduce((n,x)=>n+Number(x.sales_amount),0),debt_amount:rows.reduce((n,x)=>n+Number(x.balance_due),0),repeat_customers:rows.filter(x=>Number(x.purchase_count)>1).length},trend,{sales:rows.slice(0,q.top),profit:rows.slice(0,q.top),debts:[...rows].sort((a,b)=>Number(b.balance_due)-Number(a.balance_due)).slice(0,q.top)},rows);
  }

  private async products(p:AuthPrincipal,q:ReportQueryDto,from:string,to:string):Promise<BiResult>{
    const params:any[]=[p.tenantId,from,to];let filter='';if(q.keyword){filter+=' AND (p.name LIKE ? OR s.sku_name LIKE ?)';params.push(`%${q.keyword}%`,`%${q.keyword}%`);}if(q.category_id){filter+=' AND p.category_id=?';params.push(q.category_id);}if(q.brand){filter+=' AND p.brand=?';params.push(q.brand);}if(q.purchase_manager_id){filter+=' AND COALESCE(s.purchase_manager_id,p.purchase_manager_id)=?';params.push(q.purchase_manager_id);}
    const rows=await this.db.query(`SELECT p.id,p.name label,s.sku_name,c.name category_name,p.brand,COALESCE(s.purchase_manager_name,p.purchase_manager_name,'未分配') purchase_manager_name,COUNT(DISTINCT o.id) order_count,
      ROUND(SUM(COALESCE(oi.actual_quantity,oi.actual_weight,oi.planned_quantity,oi.planned_weight,0)),3) sales_quantity,ROUND(SUM(COALESCE(oi.final_amount,oi.estimated_amount)),2) sales_amount,
      ROUND(SUM(COALESCE(oi.actual_quantity,oi.actual_weight,oi.planned_quantity,oi.planned_weight,0)*s.cost_price),2) cost_amount,ROUND(MAX(COALESCE(i.stock_quantity,0)),3) stock_quantity
      FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN skus s ON s.id=oi.sku_id JOIN products p ON p.id=s.product_id JOIN categories c ON c.id=p.category_id LEFT JOIN inventory i ON i.sku_id=s.id
      WHERE o.tenant_id=? AND o.status<>'CANCELLED' AND DATE(o.created_at) BETWEEN ? AND ?${filter} GROUP BY p.id,p.name,s.id,s.sku_name,c.name,p.brand,s.purchase_manager_name,p.purchase_manager_name ORDER BY sales_amount DESC`,params) as Row[];
    rows.forEach(x=>{x.profit_amount=Number(x.sales_amount)-Number(x.cost_amount);x.margin_rate=Number(x.sales_amount)?Number(x.profit_amount)/Number(x.sales_amount)*100:0;});
    const trend=await this.salesTrends(p.tenantId,p,from,to);
    return this.result('products',from,to,q,{sales_amount:rows.reduce((n,x)=>n+Number(x.sales_amount),0),sales_quantity:rows.reduce((n,x)=>n+Number(x.sales_quantity),0),profit_amount:rows.reduce((n,x)=>n+Number(x.profit_amount),0),product_count:rows.length},trend,{sales:rows.slice(0,q.top),profit:[...rows].sort((a,b)=>Number(b.profit_amount)-Number(a.profit_amount)).slice(0,q.top),inventory:[...rows].sort((a,b)=>Number(b.stock_quantity)-Number(a.stock_quantity)).slice(0,q.top),returns:[],purchases:[]},rows);
  }

  private async purchases(p:AuthPrincipal,q:ReportQueryDto,from:string,to:string):Promise<BiResult>{
    const params:any[]=[p.tenantId,from,to];let filter='';if(p.roleCode==='PURCHASER'){filter+=' AND COALESCE(po.purchaser_id,s.purchase_manager_id,p.purchase_manager_id)=?';params.push(p.userId);}if(q.purchase_manager_id){filter+=' AND COALESCE(po.purchaser_id,s.purchase_manager_id,p.purchase_manager_id)=?';params.push(q.purchase_manager_id);}if(q.supplier_id){filter+=' AND po.supplier_id=?';params.push(q.supplier_id);}
    const rows=await this.db.query(`SELECT p.name label,s.sku_name,sup.supplier_name,COALESCE(u.name,s.purchase_manager_name,p.purchase_manager_name,'未分配') purchase_manager_name,COUNT(DISTINCT po.id) purchase_count,
      ROUND(SUM(poi.ordered_quantity),3) purchase_quantity,ROUND(SUM(poi.amount),2) purchase_amount,ROUND(AVG(poi.purchase_price),4) average_price,ROUND(SUM(poi.received_quantity*poi.purchase_price),2) received_amount
      FROM purchase_order_items poi JOIN purchase_orders po ON po.id=poi.purchase_order_id JOIN skus s ON s.id=poi.sku_id JOIN products p ON p.id=s.product_id JOIN suppliers sup ON sup.id=po.supplier_id LEFT JOIN users u ON u.id=COALESCE(po.purchaser_id,s.purchase_manager_id,p.purchase_manager_id)
      WHERE po.tenant_id=? AND DATE(COALESCE(po.purchase_date,po.created_at)) BETWEEN ? AND ? AND po.status<>'CANCELLED'${filter} GROUP BY p.id,p.name,s.id,s.sku_name,sup.supplier_name,u.name,s.purchase_manager_name,p.purchase_manager_name ORDER BY purchase_amount DESC`,params) as Row[];
    const trend=await this.db.query(`SELECT DATE(COALESCE(purchase_date,created_at)) report_date,ROUND(SUM(total_amount),2) value FROM purchase_orders WHERE tenant_id=? AND status<>'CANCELLED' AND DATE(COALESCE(purchase_date,created_at)) BETWEEN ? AND ? GROUP BY DATE(COALESCE(purchase_date,created_at)) ORDER BY report_date`,[p.tenantId,from,to]);
    return this.result('purchases',from,to,q,{purchase_amount:rows.reduce((n,x)=>n+Number(x.purchase_amount),0),purchase_quantity:rows.reduce((n,x)=>n+Number(x.purchase_quantity),0),purchase_cost:rows.reduce((n,x)=>n+Number(x.received_amount),0),average_price:rows.length?rows.reduce((n,x)=>n+Number(x.average_price),0)/rows.length:0,supplier_count:new Set(rows.map(x=>x.supplier_name)).size,return_amount:0,exception_count:0,on_time_rate:0},trend,{suppliers:this.group(rows,'supplier_name','purchase_amount'),purchasers:this.group(rows,'purchase_manager_name','purchase_amount'),products:rows.slice(0,q.top)},rows);
  }

  private result(type:string,from:string,to:string,q:ReportQueryDto,summary:Row,trend:Row[],rankings:Record<string,Row[]>,rows:Row[]):BiResult{const start=(q.page-1)*q.page_size;return{type,date_range:{from,to},summary,trend,rankings,items:rows.slice(start,start+q.page_size),pagination:{page:q.page,page_size:q.page_size,total:rows.length,total_pages:Math.ceil(rows.length/q.page_size)},generated_at:new Date().toISOString()};}
  private async salesTrends(tenant:string,p:AuthPrincipal,from:string,to:string){const scope=p.roleCode==='SALES'?' AND c.salesperson_id=?':'';return this.db.query(`SELECT DATE(o.created_at) report_date,ROUND(SUM(COALESCE(o.final_amount,o.estimated_amount)),2) sales_amount,COUNT(*) order_count FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.tenant_id=? AND o.status<>'CANCELLED' AND DATE(o.created_at) BETWEEN ? AND ?${scope} GROUP BY DATE(o.created_at) ORDER BY report_date`,[tenant,from,to,...(scope?[p.userId]:[])]);}
  private async groupTrend(table:string,tenant:string,from:string,to:string){return this.db.query(`SELECT DATE(created_at) report_date,COUNT(*) value FROM ${table} WHERE tenant_id=? AND DATE(created_at) BETWEEN ? AND ? GROUP BY DATE(created_at) ORDER BY report_date`,[tenant,from,to]);}
  private async profit(p:AuthPrincipal,from:string,to:string){const [row]=await this.db.query(`SELECT ROUND(SUM(COALESCE(oi.final_amount,oi.estimated_amount)),2) sales_amount,ROUND(SUM(COALESCE(oi.actual_quantity,oi.actual_weight,oi.planned_quantity,oi.planned_weight,0)*s.cost_price),2) cost_amount FROM orders o JOIN order_items oi ON oi.order_id=o.id JOIN skus s ON s.id=oi.sku_id WHERE o.tenant_id=? AND o.status<>'CANCELLED' AND DATE(o.created_at) BETWEEN ? AND ?`,[p.tenantId,from,to]);const sales=Number(row?.sales_amount??0),cost=Number(row?.cost_amount??0);return{sales_amount:sales,cost_amount:cost,profit_amount:sales-cost,today_profit:sales-cost,margin_rate:sales?(sales-cost)/sales*100:0};}
  private group(rows:Row[],key:string,valueKey:string){const m=new Map<string,number>();rows.forEach(x=>m.set(String(x[key]??'未分配'),(m.get(String(x[key]??'未分配'))??0)+Number(x[valueKey]??0)));return[...m].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value).slice(0,50);}
  private assertAccess(p:AuthPrincipal,type:string){const map:Record<string,string[]>={PURCHASER:['purchases','products'],WAREHOUSE:['inventory'],DELIVERY:['delivery'],SALES:['salespersons','customers','products','finance'],FINANCE:['finance','customers','products','purchases','salespersons','inventory','delivery'],OPERATIONS:['products','customers','inventory']};const allowed=map[p.roleCode];if(p.roleCode!=='ADMIN'&&allowed&&!allowed.includes(type))throw new ForbiddenException({code:'BI_SCOPE_FORBIDDEN',message:'当前角色无权查看该业务域数据'});}
  private scopeDashboard(p:AuthPrincipal,value:{metrics:Record<string,number>;trends:Record<string,Row[]>;generated_at:string;refresh_seconds:number}){const scopes:Record<string,{metrics:string[];trends:string[]}>={SALES:{metrics:['today_sales','yesterday_sales','month_sales','year_sales','today_orders','pending_payment','pending_review','new_customers','today_profit','today_margin'],trends:['sales','orders','profit','customers']},PURCHASER:{metrics:['pending_purchase','pending_inbound','today_purchase_amount'],trends:['purchases']},WAREHOUSE:{metrics:['pending_inbound','pending_picking','inventory_warning','low_stock'],trends:['inventory']},DELIVERY:{metrics:['pending_delivery','delivering'],trends:[]}};const scope=scopes[p.roleCode];if(!scope)return value;return{...value,metrics:Object.fromEntries(Object.entries(value.metrics).filter(([k])=>scope.metrics.includes(k))),trends:Object.fromEntries(Object.entries(value.trends).filter(([k])=>scope.trends.includes(k)))};}
  private async cached<T>(key:string,ttl:number,fn:()=>Promise<T>):Promise<T>{try{const hit=await this.redis.get(key);if(hit)return JSON.parse(hit) as T;}catch{}const value=await fn();try{await this.redis.set(key,JSON.stringify(value),'EX',ttl);}catch{}return value;}
  private csv(rows:Row[]){const keys=Object.keys(rows[0]??{}),escape=(v:unknown)=>`"${String(v??'').replace(/"/g,'""')}"`;return '\uFEFF'+[keys.map(escape).join(','),...rows.map(row=>keys.map(k=>escape(row[k])).join(','))].join('\n');}
  private pdf(type:string,data:BiResult){return new Promise<Buffer>((resolve,reject)=>{const chunks:Buffer[]=[];const doc=new PDFDocument({margin:36,size:'A4'});doc.on('data',(x:Buffer)=>chunks.push(x));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);doc.fontSize(20).text(`Fruit B2B BI Report - ${type}`);doc.fontSize(10).text(`Range: ${data.date_range.from} - ${data.date_range.to}`).moveDown();Object.entries(data.summary).forEach(([k,v])=>doc.text(`${k}: ${String(v)}`));doc.moveDown();data.items.slice(0,30).forEach((row,i)=>doc.text(`${i+1}. ${Object.values(row).slice(0,6).join(' | ')}`));doc.end();});}
  private column(n:number){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s||'A';}
  private date(offset:number){const d=new Date(Date.now()+offset*86400000);return d.toISOString().slice(0,10);}
}
