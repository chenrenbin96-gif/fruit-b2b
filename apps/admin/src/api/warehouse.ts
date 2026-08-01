import { apiClient } from './client';

type Envelope<T> = { data: T };

export type WarehouseStage =
  | 'WAITING_REVIEW'
  | 'WAITING_PICKING'
  | 'PICKING'
  | 'WAITING_WEIGHING'
  | 'WAITING_OUTBOUND'
  | 'DELIVERING'
  | 'COMPLETED';

export type WarehouseTask = {
  order_id: string;
  order_no: string;
  customer_name: string;
  item_count: number;
  order_amount: string;
  order_status: string;
  stage: WarehouseStage;
  picking_status: 'WAITING' | 'PICKING' | 'DONE' | 'CANCELLED' | null;
  package: {
    id: string;
    package_no: string;
    status: 'WAITING' | 'PACKING' | 'DONE';
    outbound_at: string | null;
  } | null;
  delivery_status: 'WAITING' | 'DELIVERING' | 'DELIVERED' | 'FAILED' | null;
  created_at: string;
  picking_task?: {
    id: string;
    picker_id: string | null;
    status: 'WAITING' | 'PICKING' | 'DONE' | 'CANCELLED';
    items: Array<{
      id: string;
      order_item_id: string;
      sku_id: string;
      product_name: string;
      sku_name: string;
      sale_type: 'PIECE' | 'WEIGHT';
      unit: string;
      planned_quantity: string;
      picked_quantity: string | null;
      status: string;
    }>;
  } | null;
};

export const warehouseApi = {
  async tasks(stage?: WarehouseStage): Promise<WarehouseTask[]> {
    return (
      await apiClient.get<Envelope<{ items: WarehouseTask[] }>>(
        '/admin/warehouse/tasks',
        { params: { stage, page_size: 100 } },
      )
    ).data.data.items;
  },
  async detail(orderId: string): Promise<WarehouseTask> {
    return (
      await apiClient.get<Envelope<WarehouseTask>>(
        `/admin/warehouse/tasks/${orderId}`,
      )
    ).data.data;
  },
  async startPicking(orderId: string) {
    await apiClient.post(`/admin/warehouse/tasks/${orderId}/picking/start`);
  },
  async completePicking(
    orderId: string,
    items: Array<{ task_item_id: string; picked_quantity: number }>,
  ) {
    await apiClient.post(
      `/admin/warehouse/tasks/${orderId}/picking/complete`,
      { items },
    );
  },
  async packageAction(
    orderId: string,
    action: 'start' | 'complete' | 'outbound',
  ) {
    const suffix = action === 'outbound' ? 'outbound' : `package/${action}`;
    await apiClient.post(`/admin/warehouse/tasks/${orderId}/${suffix}`);
  },
};
