import { hash } from 'bcryptjs';
import type { EntityManager } from 'typeorm';

import dataSource from './data-source';
import {
  CustomerAccountEntity,
  CustomerEntity,
  CustomerLevelEntity,
} from '../../modules/customers/entities/customer.entities';
import {
  DeliveryRegionEntity,
  StoreEntity,
  SystemSettingEntity,
  TenantEntity,
  WarehouseEntity,
} from '../../modules/system/entities/system.entities';
import {
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  UserEntity,
} from '../../modules/users/entities/user.entities';
import { ShippingRuleEntity } from '../../modules/shipping/entities/shipping.entities';
import { AfterSaleReasonEntity } from '../../modules/after-sales/entities/after-sale.entities';

const permissionDefinitions = [
  ['dashboard.read', '查看数据看板', 'dashboard'],
  ['dashboard.business.read', '查看经营看板', 'dashboard'],
  ['system.security.read', '查看角色权限', 'system'],
  ['system.settings.read', '查看系统设置', 'system'],
  ['system.settings.write', '修改系统设置', 'system'],
  ['customer.read', '查看客户', 'customer'],
  ['customer.write', '管理客户', 'customer'],
  ['customer.center.read', '查看客户档案与分析', 'customer'],
  ['customer.center.manage', '管理客户档案', 'customer'],
  ['customer.config.manage', '管理客户类型集团和标签', 'customer'],
  ['customer.agreement.manage', '管理客户协议价格', 'customer'],
  ['customer.credit.manage', '调整客户信用额度和账期', 'customer'],
  ['customer.self', '查看自身客户资料', 'customer'],
  ['product.read', '查看分类商品与SKU', 'product'],
  ['product.write', '管理分类商品与SKU', 'product'],
  ['product.media.read', '查看商品图片和视频素材', 'product'],
  ['product.media.manage', '管理商品图片和视频素材', 'product'],
  ['product.display.write', '管理商品展示信息', 'product'],
  ['product.sku.write', '管理商品SKU', 'product'],
  ['product.procurement.write', '维护商品采购信息', 'product'],
  ['product.manage', '商品批量与删除管理', 'product'],
  ['price.read', '查看价格规则', 'price'],
  ['price.write', '管理价格规则', 'price'],
  ['order.read', '查看订单', 'order'],
  ['order.review', '仓库审核订单', 'order'],
  ['order.pick', '处理备货', 'order'],
  ['order.weigh', '录入称重', 'order'],
  ['order.fulfill', '完成订单履约', 'order'],
  ['warehouse.task.read', '查看仓库任务', 'warehouse'],
  ['warehouse.task.pick', '执行仓库拣货', 'warehouse'],
  ['warehouse.package.manage', '管理打包任务', 'warehouse'],
  ['warehouse.outbound', '确认仓库出库', 'warehouse'],
  ['inventory.read', '查看库存', 'inventory'],
  ['inventory.adjust', '调整库存', 'inventory'],
  ['inventory.loss', '登记损耗', 'inventory'],
  ['inventory.outbound', '确认出库', 'inventory'],
  ['inventory.receive', '采购入库', 'inventory'],
  ['supplier.manage', '供应商管理', 'supplier'],
  ['purchase.read', '查看采购订单', 'purchase'],
  ['purchase.write', '管理采购订单', 'purchase'],
  ['purchase.receive', '确认采购部分或全部收货', 'purchase'],
  ['purchase.return.manage', '管理采购退货', 'purchase'],
  ['supplier.product.manage', '维护供应商商品和报价', 'purchase'],
  ['purchase.price.read', '查看采购价格与历史趋势', 'purchase'],
  ['purchase.plan.manage', '生成采购计划和采购单', 'purchase'],
  ['purchase.analysis.read', '查看采购分析看板', 'purchase'],
  ['cost.read', '查看SKU成本及毛利测算', 'operations'],
  ['profit.read', '查看经营毛利分析', 'operations'],
  ['inventory.alert.read', '查看库存预警', 'operations'],
  ['purchase.suggestion.read', '查看采购建议', 'operations'],
  ['finance.statement.export', '查看并导出客户月度对账单', 'finance'],
  ['finance.report.read', '查看经营财务报表', 'finance'],
  ['finance.read', '查看客户账期、应收和收款记录', 'finance'],
  ['finance.credit.manage', '维护客户信用额度和账期', 'finance'],
  ['finance.payment.create', '登记线下收款并核销应收', 'finance'],
  ['home.operation.manage', '管理首页运营配置', 'operations'],
  ['shipping.read', '查看配送区域与运费', 'shipping'],
  ['delivery.task.read', '查看配送任务', 'delivery'],
  ['delivery.task.update', '更新配送状态', 'delivery'],
  ['delivery.read', '查看配送任务', 'delivery'],
  ['delivery.update', '分配配送员及更新配送状态', 'delivery'],
  ['shipping.manage', '管理配送区域与运费规则', 'shipping'],
  ['after.sale.read', '查看售后申请', 'after_sale'],
  ['after.sale.manage', '审核售后申请', 'after_sale'],
  ['after.sale.reason.manage', '管理售后原因', 'after_sale'],
  ['after.sale.refund.manage', '完成售后退款', 'after_sale'],
] as const;

async function seed(manager: EntityManager): Promise<void> {
  const tenantCode = process.env.BOOTSTRAP_TENANT_CODE ?? 'DEFAULT';
  const tenantName =
    process.env.BOOTSTRAP_TENANT_NAME ?? '鲜链云水果批发';
  const adminPassword =
    process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'ChangeMe_123456';

  if (
    process.env.NODE_ENV === 'production' &&
    adminPassword === 'ChangeMe_123456'
  ) {
    throw new Error(
      'BOOTSTRAP_ADMIN_PASSWORD must be changed before production seed',
    );
  }

  const tenantRepository = manager.getRepository(TenantEntity);
  let tenant = await tenantRepository.findOneBy({ tenantCode });
  tenant ??= tenantRepository.create({
    tenantCode,
    tenantName,
    status: 'ACTIVE',
  });
  tenant.tenantName = tenantName;
  tenant.status = 'ACTIVE';
  tenant = await tenantRepository.save(tenant);

  const storeRepository = manager.getRepository(StoreEntity);
  let store = await storeRepository.findOneBy({
    tenantId: tenant.id,
    storeCode: 'HQ',
  });
  store ??= storeRepository.create({
    tenantId: tenant.id,
    storeCode: 'HQ',
    storeName: '总部门店',
    status: 'ACTIVE',
  });
  store = await storeRepository.save(store);

  const warehouseRepository = manager.getRepository(WarehouseEntity);
  const warehouseCode =
    process.env.BOOTSTRAP_WAREHOUSE_CODE ?? 'WH_DEFAULT';
  let warehouse = await warehouseRepository.findOneBy({
    tenantId: tenant.id,
    warehouseCode,
  });
  warehouse ??= warehouseRepository.create({
    tenantId: tenant.id,
    storeId: store.id,
    warehouseCode,
    warehouseName:
      process.env.BOOTSTRAP_WAREHOUSE_NAME ?? '默认仓库',
    status: 'ACTIVE',
  });
  warehouse.storeId = store.id;
  warehouse.status = 'ACTIVE';
  warehouse = await warehouseRepository.save(warehouse);

  const regionRepository = manager.getRepository(DeliveryRegionEntity);
  let region = await regionRepository.findOneBy({
    tenantId: tenant.id,
    regionCode: 'DEFAULT',
  });
  region ??= regionRepository.create({
    tenantId: tenant.id,
    regionCode: 'DEFAULT',
    regionName: '默认配送区域',
    isDefault: true,
    sort: 0,
    status: 'ACTIVE',
  });
  region.isDefault = true;
  region.addressKeywords = '城区,市区';
  region.minOrderAmount = '500.00';
  region.status = 'ACTIVE';
  region = await regionRepository.save(region);

  const shippingRuleRepository =
    manager.getRepository(ShippingRuleEntity);
  let shippingRule = await shippingRuleRepository.findOneBy({
    tenantId: tenant.id,
    deliveryRegionId: region.id,
  });
  if (!shippingRule) {
    shippingRule = shippingRuleRepository.create({
      tenantId: tenant.id,
      deliveryRegionId: region.id,
      name: '默认区域按重量运费',
      calculationType: 'WEIGHT',
      pricePerWeight: '1.0000',
      weightUnit: '斤',
      status: 'ACTIVE',
    });
  }
  shippingRule.name = '默认区域按重量运费';
  shippingRule.calculationType = 'WEIGHT';
  shippingRule.fixedFee = null;
  shippingRule.pricePerWeight = '1.0000';
  shippingRule.weightUnit = '斤';
  shippingRule.status = 'ACTIVE';
  await shippingRuleRepository.save(shippingRule);

  const permissionRepository = manager.getRepository(PermissionEntity);
  const permissions = new Map<string, PermissionEntity>();
  for (const [permissionCode, permissionName, moduleCode] of permissionDefinitions) {
    let permission = await permissionRepository.findOneBy({ permissionCode });
    permission ??= permissionRepository.create({
      permissionCode,
      permissionName,
      moduleCode,
      status: 'ACTIVE',
    });
    permission.permissionName = permissionName;
    permission.moduleCode = moduleCode;
    permission.status = 'ACTIVE';
    permission = await permissionRepository.save(permission);
    permissions.set(permissionCode, permission);
  }

  const roleRepository = manager.getRepository(RoleEntity);
  const roleDefinitions = [
    {
      code: 'ADMIN',
      name: '管理员',
      description: '租户内全部权限',
      permissions: permissionDefinitions.map(([code]) => code),
    },
    {
      code: 'SALES',
      name: '业务员',
      description: '管理本人负责客户与销售跟进',
      permissions: [
        'dashboard.read', 'customer.center.read', 'customer.center.manage',
        'customer.agreement.manage', 'order.read', 'finance.read',
      ],
    },
    {
      code: 'WAREHOUSE',
      name: '仓库人员',
      description: '订单审核、备货、称重和库存作业',
      permissions: [
        'dashboard.read',
        'order.read',
        'order.review',
        'order.pick',
        'order.weigh',
        'order.fulfill',
        'warehouse.task.read',
        'warehouse.task.pick',
        'warehouse.package.manage',
        'warehouse.outbound',
        'product.read',
        'inventory.read',
        'inventory.adjust',
        'inventory.loss',
        'inventory.outbound',
        'inventory.receive',
        'purchase.read',
        'purchase.receive',
        'shipping.read',
        'after.sale.read',
      ],
    },
    {
      code: 'PURCHASER',
      name: '采购人员',
      description: '选择供应商并创建、提交采购订单',
      permissions: [
        'dashboard.read',
        'supplier.manage',
        'purchase.read',
        'purchase.write',
        'purchase.receive',
        'purchase.return.manage',
        'supplier.product.manage',
        'purchase.price.read',
        'purchase.plan.manage',
        'purchase.analysis.read',
        'product.read',
        'product.write',
        'product.display.write',
        'product.sku.write',
        'product.procurement.write',
        'product.media.read',
        'product.media.manage',
        'inventory.read',
        'inventory.receive',
        'inventory.alert.read',
        'purchase.suggestion.read',
      ],
    },
    {
      code: 'FINANCE',
      name: '财务',
      description: '成本、毛利与客户账务管理',
      permissions: [
        'dashboard.read',
        'dashboard.business.read',
        'finance.read',
        'finance.credit.manage',
        'finance.payment.create',
        'cost.read',
        'profit.read',
        'finance.statement.export',
        'finance.report.read',
        'purchase.read',
        'purchase.price.read',
        'purchase.analysis.read',
        'product.read',
        'price.read',
        'order.read',
        'warehouse.task.read',
        'after.sale.read',
        'customer.center.read',
        'after.sale.refund.manage',
      ],
    },
    {
      code: 'OPERATIONS',
      name: '运营',
      description: '商品与首页运营管理',
      permissions: [
        'dashboard.read',
        'dashboard.business.read',
        'product.read',
        'product.media.read',
        'product.media.manage',
        'product.display.write',
        'home.operation.manage',
        'price.read',
        'inventory.alert.read',
        'order.read',
        'warehouse.task.read',
        'after.sale.read',
        'customer.center.read',
        'customer.config.manage',
      ],
    },
    {
      code: 'DELIVERY',
      name: '配送人员',
      description: '查看并更新本人配送任务',
      permissions: [
        'dashboard.read',
        'delivery.task.read',
        'delivery.task.update',
        'delivery.read',
        'delivery.update',
      ],
    },
  ] as const;

  const rolePermissionRepository = manager.getRepository(
    RolePermissionEntity,
  );
  const roles = new Map<string, RoleEntity>();
  for (const definition of roleDefinitions) {
    let role = await roleRepository.findOneBy({
      tenantId: tenant.id,
      roleCode: definition.code,
    });
    role ??= roleRepository.create({
      tenantId: tenant.id,
      roleCode: definition.code,
      roleName: definition.name,
      description: definition.description,
      isSystem: true,
      status: 'ACTIVE',
    });
    role.roleName = definition.name;
    role.description = definition.description;
    role.isSystem = true;
    role.status = 'ACTIVE';
    role = await roleRepository.save(role);
    roles.set(definition.code, role);

    for (const permissionCode of definition.permissions) {
      const permission = permissions.get(permissionCode);
      if (!permission) {
        throw new Error(`Seed permission not found: ${permissionCode}`);
      }
      const existing = await rolePermissionRepository.findOneBy({
        tenantId: tenant.id,
        roleId: role.id,
        permissionId: permission.id,
      });
      if (!existing) {
        await rolePermissionRepository.save(
          rolePermissionRepository.create({
            tenantId: tenant.id,
            roleId: role.id,
            permissionId: permission.id,
          }),
        );
      }
    }
  }

  const adminRole = roles.get('ADMIN');
  if (!adminRole) {
    throw new Error('ADMIN role was not created');
  }

  const userRepository = manager.getRepository(UserEntity);
  const adminUsername =
    process.env.BOOTSTRAP_ADMIN_USERNAME ?? 'admin';
  let admin = await userRepository.findOneBy({
    tenantId: tenant.id,
    username: adminUsername,
  });
  if (!admin) {
    admin = userRepository.create({
      tenantId: tenant.id,
      username: adminUsername,
      passwordHash: await hash(adminPassword, 12),
      name: process.env.BOOTSTRAP_ADMIN_NAME ?? '系统管理员',
      roleId: adminRole.id,
      storeId: store.id,
      warehouseId: warehouse.id,
      status: 'ACTIVE',
    });
    admin = await userRepository.save(admin);
  }

  const customerLevelRepository =
    manager.getRepository(CustomerLevelEntity);
  let normalLevel = await customerLevelRepository.findOneBy({
    tenantId: tenant.id,
    levelCode: 'NORMAL',
  });
  normalLevel ??= customerLevelRepository.create({
    tenantId: tenant.id,
    levelCode: 'NORMAL',
    name: '普通客户',
    description: '默认客户等级',
    sort: 0,
    status: 'ACTIVE',
  });
  normalLevel = await customerLevelRepository.save(normalLevel);

  const customerRepository = manager.getRepository(CustomerEntity);
  let devCustomer = await customerRepository.findOneBy({
    tenantId: tenant.id,
    customerNo: 'DEV001',
  });
  if (!devCustomer) {
    devCustomer = customerRepository.create({
      tenantId: tenant.id,
      customerNo: 'DEV001',
      customerName: 'DEV001测试水果店',
      contactName: '测试客户',
      phone: '13800138000',
      address: '开发环境测试地址',
      businessType: 'FRUIT_RETAIL',
      levelId: normalLevel.id,
      deliveryRegionId: region.id,
      settlementType: 'CASH',
      creditDays: 0,
      creditLimit: '0.00',
      creditEnabled: false,
      balanceDue: '0.00',
      salesOwnerId: null,
      salesRemark: '开发联调测试客户，请勿用于生产环境',
      status: 'ACTIVE',
    });
    devCustomer = await customerRepository.save(devCustomer);
  }

  const customerAccountRepository = manager.getRepository(CustomerAccountEntity);
  const phoneOwner = await customerAccountRepository.findOneBy({
    tenantId: tenant.id,
    phone: '13800138000',
  });
  if (phoneOwner && phoneOwner.customerId !== devCustomer.id) {
    throw new Error('Test phone 13800138000 is already bound to another customer');
  }
  let devAccount =
    phoneOwner ??
    (await customerAccountRepository.findOneBy({
      tenantId: tenant.id,
      customerId: devCustomer.id,
      isPrimary: true,
    }));
  devAccount ??= customerAccountRepository.create({
    tenantId: tenant.id,
    customerId: devCustomer.id,
    wxOpenid: null,
    wxUnionid: null,
    isPrimary: true,
  });
  devAccount.accountName = 'DEV001';
  devAccount.phone = '13800138000';
  devAccount.passwordHash = await hash('123456', 12);
  devAccount.status = 'ACTIVE';
  await customerAccountRepository.save(devAccount);

  const settingRepository = manager.getRepository(SystemSettingEntity);
  const settings = [
    {
      key: 'order.warehouse_review_timeout_hours',
      type: 'INTEGER',
      value: '24',
      description: '仓库审核超时小时数',
    },
    {
      key: 'order.first_order_min_amount',
      type: 'DECIMAL',
      value: '500.00',
      description: '租户默认首单起送金额',
    },
  ];
  for (const item of settings) {
    let setting = await settingRepository.findOneBy({
      tenantId: tenant.id,
      settingKey: item.key,
    });
    setting ??= settingRepository.create({
      tenantId: tenant.id,
      settingKey: item.key,
      valueType: item.type,
      settingValue: item.value,
      description: item.description,
      updatedBy: admin.id,
    });
    setting.updatedBy = admin.id;
    await settingRepository.save(setting);
  }

  const afterSaleReasonRepository = manager.getRepository(AfterSaleReasonEntity);
  const afterSaleReasons = ['缺重量', '质量问题', '腐烂变质', '破损', '商品与描述不符', '规格错误', '少发漏发', '其他'];
  for (const [index, name] of afterSaleReasons.entries()) {
    let reason = await afterSaleReasonRepository.findOneBy({ tenantId: tenant.id, name });
    reason ??= afterSaleReasonRepository.create({ tenantId: tenant.id, name, sort: (index + 1) * 10, status: 'ACTIVE' });
    reason.sort = (index + 1) * 10;
    reason.status = 'ACTIVE';
    await afterSaleReasonRepository.save(reason);
  }
}

async function main(): Promise<void> {
  await dataSource.initialize();
  try {
    await dataSource.transaction(seed);
    console.info('Foundation seed completed successfully');
  } finally {
    await dataSource.destroy();
  }
}

void main();
