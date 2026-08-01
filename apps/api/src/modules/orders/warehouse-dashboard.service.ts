import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class WarehouseDashboardService {
  constructor(private readonly dataSource: DataSource) {}

  async summary(tenantId: string) {
    const [row] = (await this.dataSource.query(
      `SELECT
         SUM(created_at >= CURRENT_DATE()) AS today_orders,
         SUM(status = 'WAITING_REVIEW') AS waiting_review,
         SUM(status = 'APPROVED') AS waiting_picking,
         SUM(status IN ('PICKING', 'WEIGHING')) AS waiting_weighing,
         SUM(status = 'WAITING_DELIVERY') AS waiting_delivery,
         SUM(
           (status = 'WAITING_REVIEW' AND expires_at <= NOW())
           OR (status = 'CANCELLED' AND cancelled_at >= CURRENT_DATE())
         ) AS exception_orders
       FROM orders
       WHERE tenant_id = ?`,
      [tenantId],
    )) as Array<Record<string, string | number | null>>;

    return {
      today_orders: Number(row?.today_orders ?? 0),
      waiting_review: Number(row?.waiting_review ?? 0),
      waiting_picking: Number(row?.waiting_picking ?? 0),
      waiting_weighing: Number(row?.waiting_weighing ?? 0),
      waiting_delivery: Number(row?.waiting_delivery ?? 0),
      exception_orders: Number(row?.exception_orders ?? 0),
      generated_at: new Date().toISOString(),
    };
  }
}
