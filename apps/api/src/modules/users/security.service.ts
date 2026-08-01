import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { AuthPrincipal } from '../auth/types/auth-principal';
import {
  PermissionEntity,
  RoleEntity,
} from './entities/user.entities';

@Injectable()
export class SecurityService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roles: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissions: Repository<PermissionEntity>,
  ) {}

  async listRoles(principal: AuthPrincipal) {
    const roles = await this.roles.find({
      where: { tenantId: principal.tenantId },
      relations: { rolePermissions: { permission: true } },
      order: { roleCode: 'ASC' },
    });

    return roles.map((role) => ({
      id: role.id,
      role_code: role.roleCode,
      role_name: role.roleName,
      is_system: role.isSystem,
      status: role.status,
      permissions: role.rolePermissions.map(
        (item) => item.permission.permissionCode,
      ),
    }));
  }

  async listPermissions() {
    const permissions = await this.permissions.find({
      order: { moduleCode: 'ASC', permissionCode: 'ASC' },
    });
    return permissions.map((permission) => ({
      id: permission.id,
      permission_code: permission.permissionCode,
      permission_name: permission.permissionName,
      module_code: permission.moduleCode,
      status: permission.status,
    }));
  }
}
