import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import type { AuthPrincipal } from '../auth/types/auth-principal';
import { OperationLogEntity } from './entities/operation-log.entity';

export type AuditInput = {
  tenantId: string;
  operatorType: 'EMPLOYEE' | 'CUSTOMER_ACCOUNT' | 'SYSTEM';
  operatorId?: string | null;
  operatorName: string;
  moduleCode: string;
  actionCode: string;
  targetType: string;
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  requestId?: string | null;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(OperationLogEntity)
    private readonly logs: Repository<OperationLogEntity>,
  ) {}

  fromPrincipal(
    principal: AuthPrincipal,
    input: Omit<
      AuditInput,
      'tenantId' | 'operatorType' | 'operatorId' | 'operatorName'
    >,
  ): AuditInput {
    return {
      ...input,
      tenantId: principal.tenantId,
      operatorType: principal.principalType,
      operatorId: principal.userId ?? principal.customerAccountId,
      operatorName: principal.displayName,
    };
  }

  async record(input: AuditInput, manager?: EntityManager): Promise<void> {
    const repository = manager
      ? manager.getRepository(OperationLogEntity)
      : this.logs;
    try {
      await repository.save({
        tenantId: input.tenantId,
        operatorType: input.operatorType,
        operatorId: input.operatorId ?? null,
        operatorName: input.operatorName,
        moduleCode: input.moduleCode,
        actionCode: input.actionCode,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        beforeData: this.sanitize(input.before),
        afterData: this.sanitize(input.after),
        requestId: input.requestId ?? null,
      });
    } catch (error) {
      this.logger.error(
        {
          event: 'audit_log_write_failed',
          tenant_id: input.tenantId,
          module_code: input.moduleCode,
          action_code: input.actionCode,
          target_type: input.targetType,
          target_id: input.targetId,
        },
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async list(
    tenantId: string,
    query: {
      module_code?: string;
      operator_id?: string;
      target_type?: string;
      page: number;
      page_size: number;
    },
  ) {
    const [items, total] = await this.logs.findAndCount({
      where: {
        tenantId,
        ...(query.module_code ? { moduleCode: query.module_code } : {}),
        ...(query.operator_id ? { operatorId: query.operator_id } : {}),
        ...(query.target_type ? { targetType: query.target_type } : {}),
      },
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        operator_type: item.operatorType,
        operator_id: item.operatorId,
        operator_name: item.operatorName,
        module_code: item.moduleCode,
        action_code: item.actionCode,
        target_type: item.targetType,
        target_id: item.targetId,
        before_data: item.beforeData,
        after_data: item.afterData,
        request_id: item.requestId,
        created_at: item.createdAt,
      })),
      pagination: {
        page: query.page,
        page_size: query.page_size,
        total,
        total_pages: Math.ceil(total / query.page_size),
      },
    };
  }

  private sanitize(
    value?: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!value) return null;
    const blocked = /password|token|secret|authorization|openid|unionid/i;
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        blocked.test(key) ? '[REDACTED]' : item,
      ]),
    );
  }
}
