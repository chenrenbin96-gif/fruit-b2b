import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { IdParamDto } from '../products/dto/product.dto';
import {
  CompletePickingDto,
  WarehouseTaskListQueryDto,
} from './dto/warehouse-task.dto';
import { WarehouseTasksService } from './warehouse-tasks.service';

@Controller('admin/warehouse/tasks')
@RequirePrincipalTypes('EMPLOYEE')
export class WarehouseTasksController {
  constructor(private readonly tasks: WarehouseTasksService) {}

  @Get()
  @RequirePermissions('warehouse.task.read')
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: WarehouseTaskListQueryDto,
  ) {
    return this.tasks.list(principal, query);
  }

  @Get(':id')
  @RequirePermissions('warehouse.task.read')
  detail(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.tasks.detail(principal, params.id);
  }

  @Post(':id/picking/start')
  @RequirePermissions('warehouse.task.pick')
  start(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.tasks.startPicking(principal, params.id);
  }

  @Post(':id/picking/complete')
  @RequirePermissions('warehouse.task.pick')
  complete(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: CompletePickingDto,
  ) {
    return this.tasks.completePicking(principal, params.id, dto.items);
  }

  @Post(':id/package/start')
  @RequirePermissions('warehouse.package.manage')
  startPackage(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.tasks.updatePackage(principal, params.id, 'START');
  }

  @Post(':id/package/complete')
  @RequirePermissions('warehouse.package.manage')
  completePackage(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.tasks.updatePackage(principal, params.id, 'COMPLETE');
  }

  @Post(':id/outbound')
  @RequirePermissions('warehouse.outbound')
  outbound(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.tasks.updatePackage(principal, params.id, 'OUTBOUND');
  }
}
