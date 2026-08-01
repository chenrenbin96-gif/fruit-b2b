import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compare } from 'bcryptjs';
import { Repository } from 'typeorm';

import {
  CustomerAccountEntity,
  CustomerEntity,
} from '../customers/entities/customer.entities';
import { TenantEntity } from '../system/entities/system.entities';
import { UserEntity } from '../users/entities/user.entities';
import type {
  AuthPrincipal,
  TokenPayload,
} from './types/auth-principal';

@Injectable()
export class IdentityService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenants: Repository<TenantEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(CustomerAccountEntity)
    private readonly customerAccounts: Repository<CustomerAccountEntity>,
  ) {}

  async authenticateEmployee(
    tenantCode: string,
    username: string,
    password: string,
  ): Promise<Omit<AuthPrincipal, 'sessionId'>> {
    const tenant = await this.requireActiveTenant(tenantCode);
    const user = await this.users.findOne({
      where: {
        tenantId: tenant.id,
        username,
      },
      relations: {
        role: {
          rolePermissions: {
            permission: true,
          },
        },
      },
    });

    const passwordMatches =
      user?.status === 'ACTIVE' &&
      user.role.status === 'ACTIVE' &&
      (await compare(password, user.passwordHash));

    if (!user || !passwordMatches) {
      throw new UnauthorizedException({
        code: 'INVALID_LOGIN_CREDENTIALS',
        message: '租户、账号或密码错误',
      });
    }

    user.lastLoginAt = new Date();
    await this.users.save(user);

    return this.employeePrincipal(tenant, user);
  }

  async findCustomerAccount(
    tenantCode: string,
    phone: string,
  ): Promise<{
    tenant: TenantEntity;
    account: CustomerAccountEntity;
  }> {
    const tenant = await this.requireActiveTenant(tenantCode);
    const account = await this.customerAccounts.findOne({
      where: {
        tenantId: tenant.id,
        phone,
      },
      relations: {
        customer: true,
      },
    });

    if (
      !account ||
      account.status !== 'ACTIVE' ||
      account.customer.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_LOGIN_CREDENTIALS',
        message: '客户账号不存在或不可用',
      });
    }

    return { tenant, account };
  }

  async completeCustomerLogin(
    tenant: TenantEntity,
    account: CustomerAccountEntity,
  ): Promise<Omit<AuthPrincipal, 'sessionId'>> {
    account.lastLoginAt = new Date();
    await this.customerAccounts.save(account);
    return this.customerPrincipal(tenant, account);
  }

  async authenticateCustomerPassword(
    tenantCode: string,
    accountOrPhone: string,
    password: string,
  ): Promise<Omit<AuthPrincipal, 'sessionId'>> {
    const tenant = await this.requireActiveTenant(tenantCode);
    const account = await this.customerAccounts.findOne({
      where: [
        { tenantId: tenant.id, accountName: accountOrPhone },
        { tenantId: tenant.id, phone: accountOrPhone },
      ],
      relations: { customer: true },
    });
    const passwordMatches =
      account?.status === 'ACTIVE' &&
      account.customer.status === 'ACTIVE' &&
      Boolean(account.passwordHash) &&
      (await compare(password, account.passwordHash!));
    if (!account || !passwordMatches) {
      throw new UnauthorizedException({
        code: 'INVALID_LOGIN_CREDENTIALS',
        message: '客户账号、手机号或密码错误',
      });
    }
    return this.completeCustomerLogin(tenant, account);
  }

  async resolveFromToken(payload: TokenPayload): Promise<AuthPrincipal> {
    const tenant = await this.tenants.findOneBy({
      id: payload.tenant_id,
      status: 'ACTIVE',
    });
    if (!tenant) {
      throw this.revoked();
    }

    if (payload.principal_type === 'EMPLOYEE' && payload.user_id) {
      const user = await this.users.findOne({
        where: {
          id: payload.user_id,
          tenantId: payload.tenant_id,
          status: 'ACTIVE',
        },
        relations: {
          role: {
            rolePermissions: {
              permission: true,
            },
          },
        },
      });
      if (!user || user.role.status !== 'ACTIVE') {
        throw this.revoked();
      }
      return {
        ...this.employeePrincipal(tenant, user),
        sessionId: payload.session_id,
      };
    }

    if (
      payload.principal_type === 'CUSTOMER_ACCOUNT' &&
      payload.customer_account_id
    ) {
      const account = await this.customerAccounts.findOne({
        where: {
          id: payload.customer_account_id,
          tenantId: payload.tenant_id,
          status: 'ACTIVE',
        },
        relations: { customer: true },
      });
      if (!account || account.customer.status !== 'ACTIVE') {
        throw this.revoked();
      }
      return {
        ...this.customerPrincipal(tenant, account),
        sessionId: payload.session_id,
      };
    }

    throw this.revoked();
  }

  private async requireActiveTenant(code: string): Promise<TenantEntity> {
    const tenant = await this.tenants.findOneBy({
      tenantCode: code,
      status: 'ACTIVE',
    });
    if (!tenant || (tenant.expireAt && tenant.expireAt <= new Date())) {
      throw new UnauthorizedException({
        code: 'INVALID_LOGIN_CREDENTIALS',
        message: '租户、账号或密码错误',
      });
    }
    return tenant;
  }

  private employeePrincipal(
    tenant: TenantEntity,
    user: UserEntity,
  ): Omit<AuthPrincipal, 'sessionId'> {
    const permissions =
      user.role.roleCode === 'ADMIN'
        ? ['*']
        : user.role.rolePermissions
            .filter((item) => item.permission.status === 'ACTIVE')
            .map((item) => item.permission.permissionCode);

    return {
      subjectId: user.id,
      tenantId: tenant.id,
      tenantCode: tenant.tenantCode,
      principalType: 'EMPLOYEE',
      userId: user.id,
      customerAccountId: null,
      customerId: null,
      displayName: user.name,
      roleCode: user.role.roleCode,
      permissions,
    };
  }

  private customerPrincipal(
    tenant: TenantEntity,
    account: CustomerAccountEntity,
  ): Omit<AuthPrincipal, 'sessionId'> {
    return {
      subjectId: account.id,
      tenantId: tenant.id,
      tenantCode: tenant.tenantCode,
      principalType: 'CUSTOMER_ACCOUNT',
      userId: null,
      customerAccountId: account.id,
      customerId: account.customerId,
      displayName: account.accountName,
      roleCode: 'CUSTOMER',
      permissions: ['customer.self'],
    };
  }

  private revoked(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'SESSION_REVOKED',
      message: '账号或登录会话已失效',
    });
  }
}
