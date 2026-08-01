import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'operation_logs' })
@Index(['tenantId', 'moduleCode', 'createdAt'])
export class OperationLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'operator_type', type: 'varchar', length: 30 })
  operatorType!: 'EMPLOYEE' | 'CUSTOMER_ACCOUNT' | 'SYSTEM';
  @Column({ name: 'operator_id', type: 'bigint', unsigned: true, nullable: true })
  operatorId!: string | null;
  @Column({ name: 'operator_name', type: 'varchar', length: 100 })
  operatorName!: string;
  @Column({ name: 'module_code', type: 'varchar', length: 50 })
  moduleCode!: string;
  @Column({ name: 'action_code', type: 'varchar', length: 80 })
  actionCode!: string;
  @Column({ name: 'target_type', type: 'varchar', length: 80 })
  targetType!: string;
  @Column({ name: 'target_id', type: 'varchar', length: 64, nullable: true })
  targetId!: string | null;
  @Column({ name: 'before_data', type: 'json', nullable: true })
  beforeData!: Record<string, unknown> | null;
  @Column({ name: 'after_data', type: 'json', nullable: true })
  afterData!: Record<string, unknown> | null;
  @Column({ name: 'request_id', type: 'varchar', length: 64, nullable: true })
  requestId!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
