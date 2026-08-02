import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { DataSource } from 'typeorm';
import type { ReportQueryDto } from './dto/report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly db:DataSource){}
  async report(tenantId:string,type:string,q:ReportQueryDto){
    const from=q.date_from??new Date(Date.now()-29*86400000).toISOString().slice(0,10);
    const to=q.date_to??new Date().toISOString().slice(0,10);
    if(type==='purchases')return this.purchaseReport(tenantId,q,from,to);
    const params=[tenantId,from,to];
    const [summaryRows,trend,products,customers]=await Promise.all([
      this.db.query(`SELECT COUNT(*) order_count,COUNT(DISTINCT o.customer_id) customer_count,
        COALESCE(SUM(CASE WHEN o.status<>'CANCELLED' THEN COALESCE(o.final_amount,o.estimated_amount) ELSE 0 END),0) order_amount,
        COALESCE(SUM(CASE WHEN o.status='CANCELLED' THEN 1 ELSE 0 END),0) cancelled_count,
        COALESCE((SELECT SUM(ar.amount) FROM after_sale_refunds ar JOIN after_sales_orders aso ON aso.id=ar.after_sale_id WHERE ar.tenant_id=? AND ar.status='COMPLETED' AND DATE(ar.completed_at) BETWEEN ? AND ?),0) refund_amount
        FROM orders o WHERE o.tenant_id=? AND DATE(o.created_at) BETWEEN ? AND ?`,[...params,...params]),
      this.db.query(`SELECT DATE(o.created_at) report_date,COUNT(*) order_count,COUNT(DISTINCT o.customer_id) customer_count,
        ROUND(SUM(CASE WHEN o.status<>'CANCELLED' THEN COALESCE(o.final_amount,o.estimated_amount) ELSE 0 END),2) sales_amount
        FROM orders o WHERE o.tenant_id=? AND DATE(o.created_at) BETWEEN ? AND ? GROUP BY DATE(o.created_at) ORDER BY report_date`,params),
      this.db.query(`SELECT p.id,p.name label,c.name category_name,COUNT(DISTINCT o.id) order_count,
        ROUND(SUM(COALESCE(oi.final_amount,oi.estimated_amount)),2) sales_amount,
        ROUND(SUM(COALESCE(oi.actual_quantity,oi.actual_weight,oi.planned_quantity,oi.planned_weight,0)*s.cost_price),2) cost_amount
        FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN skus s ON s.id=oi.sku_id JOIN products p ON p.id=s.product_id JOIN categories c ON c.id=p.category_id
        WHERE o.tenant_id=? AND o.status<>'CANCELLED' AND DATE(o.created_at) BETWEEN ? AND ?
        GROUP BY p.id,p.name,c.name ORDER BY sales_amount DESC LIMIT 100`,params),
      this.db.query(`SELECT c.id,c.customer_name label,COUNT(o.id) order_count,ROUND(SUM(COALESCE(o.final_amount,o.estimated_amount)),2) sales_amount
        FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.tenant_id=? AND o.status<>'CANCELLED' AND DATE(o.created_at) BETWEEN ? AND ?
        GROUP BY c.id,c.customer_name ORDER BY sales_amount DESC LIMIT 100`,params),
    ]);
    const s=summaryRows[0]??{}; const sales=Number(s.order_amount??0),refund=Number(s.refund_amount??0);
    const enriched=products.map((row:any)=>({...row,profit_amount:(Number(row.sales_amount)-Number(row.cost_amount)).toFixed(2),margin_rate:Number(row.sales_amount)?(((Number(row.sales_amount)-Number(row.cost_amount))/Number(row.sales_amount))*100).toFixed(2):'0.00'}));
    const source=type==='customers'?customers:enriched;
    const filtered=q.keyword?source.filter((x:any)=>String(x.label).includes(q.keyword!)):source;
    const start=(q.page-1)*q.page_size;
    return {type,date_range:{from,to},summary:{order_count:Number(s.order_count??0),return_count:Number(s.cancelled_count??0),customer_count:Number(s.customer_count??0),return_customer_count:0,order_amount:sales,refund_amount:refund,actual_amount:sales-refund,cost_amount:enriched.reduce((n:number,x:any)=>n+Number(x.cost_amount),0),profit_amount:enriched.reduce((n:number,x:any)=>n+Number(x.profit_amount),0)},trend,rankings:{sales:enriched.slice(0,10),customers:customers.slice(0,10),refunds:[]},items:filtered.slice(start,start+q.page_size),pagination:{page:q.page,page_size:q.page_size,total:filtered.length,total_pages:Math.ceil(filtered.length/q.page_size)}};
  }
  private async purchaseReport(tenantId:string,q:ReportQueryDto,from:string,to:string){
    const conditions=['po.tenant_id=?','DATE(COALESCE(po.purchase_date,po.created_at)) BETWEEN ? AND ?'];const params:any[]=[tenantId,from,to];
    if(q.supplier_id){conditions.push('po.supplier_id=?');params.push(q.supplier_id);} if(q.purchase_manager_id){conditions.push('COALESCE(po.purchaser_id,s.purchase_manager_id,p.purchase_manager_id)=?');params.push(q.purchase_manager_id);}
    const rows=await this.db.query(`SELECT p.name label,s.sku_name,sup.supplier_name,COALESCE(u.name,s.purchase_manager_name,p.purchase_manager_name,'未分配') purchase_manager_name,
      COUNT(DISTINCT po.id) purchase_count,ROUND(SUM(poi.ordered_quantity),3) purchase_quantity,ROUND(SUM(poi.amount),2) purchase_amount,ROUND(SUM(poi.received_quantity*poi.purchase_price),2) received_amount
      FROM purchase_order_items poi JOIN purchase_orders po ON po.id=poi.purchase_order_id JOIN skus s ON s.id=poi.sku_id JOIN products p ON p.id=s.product_id JOIN suppliers sup ON sup.id=po.supplier_id LEFT JOIN users u ON u.id=COALESCE(po.purchaser_id,s.purchase_manager_id,p.purchase_manager_id)
      WHERE ${conditions.join(' AND ')} GROUP BY p.id,p.name,s.id,s.sku_name,sup.supplier_name,u.name,s.purchase_manager_name,p.purchase_manager_name ORDER BY purchase_amount DESC`,params) as any[];
    const start=(q.page-1)*q.page_size;const amount=rows.reduce((n,x)=>n+Number(x.purchase_amount),0);
    return {type:'purchases',date_range:{from,to},summary:{purchase_amount:amount,purchase_quantity:rows.reduce((n,x)=>n+Number(x.purchase_quantity),0),return_amount:0,supplier_count:new Set(rows.map(x=>x.supplier_name)).size},trend:[],rankings:{products:rows.slice(0,10),suppliers:this.group(rows,'supplier_name'),purchasers:this.group(rows,'purchase_manager_name')},items:rows.slice(start,start+q.page_size),pagination:{page:q.page,page_size:q.page_size,total:rows.length,total_pages:Math.ceil(rows.length/q.page_size)}};
  }
  private group(rows:any[],key:string){const map=new Map<string,number>();for(const row of rows)map.set(row[key],(map.get(row[key])??0)+Number(row.purchase_amount));return [...map].map(([label,value])=>({label,value:value.toFixed(2)})).sort((a,b)=>Number(b.value)-Number(a.value)).slice(0,10);}
  async export(tenantId:string,type:string,q:ReportQueryDto){const data=await this.report(tenantId,type,{...q,page:1,page_size:100});const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('报表');const rows=data.items as Record<string,unknown>[];const keys=Object.keys(rows[0]??data.summary);sheet.columns=keys.map(key=>({header:key,key,width:20}));for(const row of rows.length?rows:[data.summary])sheet.addRow(row);sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF16A34A'}};return Buffer.from(await book.xlsx.writeBuffer());}
}
