import { apiClient } from './client';

type Envelope<T> = { data: T };
type AuditLog = {
  id: string;
  operator_name: string;
  module_code: string;
  action_code: string;
  target_type: string;
  target_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
};

export async function getAuditLogs(moduleCode?: string): Promise<AuditLog[]> {
  return (
    await apiClient.get<Envelope<{ items: AuditLog[] }>>(
      '/admin/operation-logs',
      { params: { module_code: moduleCode || undefined, page_size: 100 } },
    )
  ).data.data.items;
}
