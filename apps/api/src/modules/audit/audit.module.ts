import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { OperationLogEntity } from './entities/operation-log.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OperationLogEntity])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService, TypeOrmModule],
})
export class AuditModule {}
