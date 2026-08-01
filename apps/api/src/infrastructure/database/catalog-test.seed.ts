import 'reflect-metadata';

import Redis from 'ioredis';
import { IsNull } from 'typeorm';

import { CustomerEntity } from '../../modules/customers/entities/customer.entities';
import {
  InventoryEntity,
} from '../../modules/inventory/entities/inventory.entities';
import {
  CustomerPriceEntity,
  QuantityPriceEntity,
} from '../../modules/products/entities/price.entities';
import {
  HomeBannerEntity,
  HomeCategoryEntity,
  HomeProductEntity,
} from '../../modules/products/entities/home-operation.entities';
import {
  CategoryEntity,
  ProductEntity,
  SaleType,
  SkuEntity,
} from '../../modules/products/entities/product.entities';
import {
  TenantEntity,
  WarehouseEntity,
} from '../../modules/system/entities/system.entities';
import dataSource from './data-source';

const TEST_IMAGE_URL =
  'https://dummyimage.com/400x400/edf4e8/285d3f.png&text=Fruit+B2B';

type SkuSeed = {
  name: string;
  specification: string;
  saleType: SaleType;
  unit: string;
  pieceUnit?: string;
  standardWeight?: number;
  grossWeightUnitPrice?: number;
  netWeightUnitPrice?: number;
  basePrice: number;
  costPrice: number;
  stock: number;
  stockWarning: number;
  deliveryWeightPerPiece?: number;
};

type ProductSeed = {
  code: string;
  name: string;
  category: string;
  origin: string;
  brand: string;
  skus: SkuSeed[];
};

const piece = (
  name: string,
  unit: string,
  basePrice: number,
  stock: number,
  deliveryWeightPerPiece: number,
  specification = name,
): SkuSeed => ({
  name,
  specification,
  saleType: 'PIECE',
  unit,
  basePrice,
  costPrice: Number((basePrice * 0.75).toFixed(4)),
  stock,
  stockWarning: Math.max(5, Math.ceil(stock * 0.1)),
  deliveryWeightPerPiece,
});

const weight = (
  name: string,
  unit: string,
  grossWeightUnitPrice: number,
  stock: number,
  specification = name,
): SkuSeed => ({
  name,
  specification: `${specification}（10${unit}标准装）`,
  saleType: 'WEIGHT',
  unit,
  pieceUnit: '件',
  standardWeight: 10,
  grossWeightUnitPrice,
  netWeightUnitPrice: Number((grossWeightUnitPrice * 1.05).toFixed(4)),
  basePrice: Number((grossWeightUnitPrice * 10).toFixed(4)),
  costPrice: Number((grossWeightUnitPrice * 10 * 0.75).toFixed(4)),
  stock,
  stockWarning: Math.max(10, Math.ceil(stock * 0.1)),
});

const categoryDefinitions: Array<{
  name: string;
  children: string[];
}> = [
  {
    name: '水果',
    children: [
      '榴莲',
      '苹果',
      '葡萄',
      '西瓜',
      '芒果',
      '香蕉',
      '柑橘',
      '桃李',
      '火龙果',
      '蓝莓',
    ],
  },
  {
    name: '蔬菜',
    children: ['叶菜', '根茎', '茄果', '菌菇', '豆类'],
  },
  { name: '肉禽蛋', children: [] },
  { name: '水产', children: [] },
  { name: '粮油调味', children: [] },
  { name: '冻品', children: [] },
  { name: '酒水饮料', children: [] },
  {
    name: '包装耗材',
    children: ['水果箱', '泡沫箱', '保鲜袋', '胶带'],
  },
];

const productDefinitions: ProductSeed[] = [
  {
    code: 'DEV7C-FRUIT-001',
    name: '泰国金枕榴莲',
    category: '水果/榴莲',
    origin: '泰国',
    brand: '金枕',
    skus: [
      weight('金枕榴莲5-6斤', '斤', 26.8, 500, '单果约5-6斤'),
      piece('金枕榴莲整箱', '箱', 498, 50, 36, 'A级整箱约36斤'),
    ],
  },
  {
    code: 'DEV7C-FRUIT-002',
    name: '阳光玫瑰葡萄',
    category: '水果/葡萄',
    origin: '云南',
    brand: '云果优选',
    skus: [
      piece('精品5斤箱', '箱', 88, 100, 5, '精品果 5斤/箱'),
      weight('散装称重', '斤', 18.8, 300, '散装按实际重量'),
    ],
  },
  {
    code: 'DEV7C-FRUIT-003',
    name: '云南蓝莓',
    category: '水果/蓝莓',
    origin: '云南',
    brand: '高原蓝',
    skus: [piece('125g盒装', '盒', 12.9, 3, 0.25, '125g/盒')],
  },
  {
    code: 'DEV7C-FRUIT-004',
    name: '海南芒果',
    category: '水果/芒果',
    origin: '海南',
    brand: '热带鲜',
    skus: [
      piece('10斤箱', '箱', 69, 80, 10, '10斤/箱'),
      weight('散装大果', '斤', 7.2, 260, '单果400g以上'),
    ],
  },
  {
    code: 'DEV7C-FRUIT-005',
    name: '山东红富士苹果',
    category: '水果/苹果',
    origin: '山东烟台',
    brand: '烟台果园',
    skus: [
      piece('20斤箱', '箱', 89, 100, 20, '80mm 20斤/箱'),
      weight('散装80果', '斤', 5.2, 450, '80mm散装'),
    ],
  },
  {
    code: 'DEV7C-FRUIT-006',
    name: '西瓜',
    category: '水果/西瓜',
    origin: '宁夏',
    brand: '硒砂源',
    skus: [
      weight('普通西瓜', '斤', 3.5, 1000, '单果8-12斤'),
      piece('麒麟瓜整箱', '箱', 108, 60, 36, '3-4个/箱'),
    ],
  },
  {
    code: 'DEV7C-FRUIT-007',
    name: '广西香蕉',
    category: '水果/香蕉',
    origin: '广西',
    brand: '桂蕉',
    skus: [
      piece('18斤箱', '箱', 65, 90, 18, '18斤/箱'),
      weight('散装香蕉', '斤', 3.9, 600),
    ],
  },
  {
    code: 'DEV7C-FRUIT-008',
    name: '赣南脐橙',
    category: '水果/柑橘',
    origin: '江西赣州',
    brand: '赣南优选',
    skus: [
      piece('20斤箱', '箱', 98, 120, 20, '75-80mm'),
      weight('散装中果', '斤', 5.8, 500),
    ],
  },
  {
    code: 'DEV7C-FRUIT-009',
    name: '水蜜桃',
    category: '水果/桃李',
    origin: '江苏无锡',
    brand: '太湖鲜',
    skus: [
      piece('12粒礼盒', '盒', 79, 65, 8, '12粒装'),
      weight('散装大果', '斤', 9.8, 240),
    ],
  },
  {
    code: 'DEV7C-FRUIT-010',
    name: '越南红心火龙果',
    category: '水果/火龙果',
    origin: '越南',
    brand: '红钻',
    skus: [
      piece('10斤箱', '箱', 72, 75, 10),
      weight('散装大果', '斤', 7.8, 320),
    ],
  },
  {
    code: 'DEV7C-FRUIT-011',
    name: '进口车厘子',
    category: '水果/桃李',
    origin: '智利',
    brand: 'Andes Fresh',
    skus: [piece('2.5kg原箱', '箱', 268, 0, 5, 'JJ级 2.5kg/箱')],
  },
  {
    code: 'DEV7C-FRUIT-012',
    name: '新疆阿克苏苹果',
    category: '水果/苹果',
    origin: '新疆阿克苏',
    brand: '冰糖心',
    skus: [
      piece('18斤箱', '箱', 105, 70, 18),
      weight('散装冰糖心', '斤', 6.5, 360),
    ],
  },
  {
    code: 'DEV7C-FRUIT-013',
    name: '巨峰葡萄',
    category: '水果/葡萄',
    origin: '辽宁',
    brand: '辽果',
    skus: [
      piece('8斤筐', '筐', 96, 55, 8),
      weight('散装称重', '斤', 12.8, 280),
    ],
  },
  {
    code: 'DEV7C-FRUIT-014',
    name: '广西砂糖橘',
    category: '水果/柑橘',
    origin: '广西',
    brand: '桂味',
    skus: [
      piece('20斤筐', '筐', 86, 110, 20),
      weight('散装称重', '斤', 4.8, 700),
    ],
  },
  {
    code: 'DEV7C-FRUIT-015',
    name: '福建琯溪蜜柚',
    category: '水果/柑橘',
    origin: '福建平和',
    brand: '琯溪',
    skus: [
      piece('4粒箱', '箱', 48, 85, 14, '4粒/箱'),
      weight('散装蜜柚', '斤', 3.8, 420),
    ],
  },
  {
    code: 'DEV7C-FRUIT-016',
    name: '广东荔枝',
    category: '水果/桃李',
    origin: '广东茂名',
    brand: '岭南鲜',
    skus: [
      piece('10斤泡沫箱', '箱', 128, 50, 10),
      weight('散装桂味', '斤', 13.8, 250),
    ],
  },
  {
    code: 'DEV7C-FRUIT-017',
    name: '海南金煌芒',
    category: '水果/芒果',
    origin: '海南三亚',
    brand: '金煌',
    skus: [
      piece('15斤箱', '箱', 99, 68, 15),
      weight('散装精选', '斤', 7.5, 330),
    ],
  },
  {
    code: 'DEV7C-FRUIT-018',
    name: '皇冠梨',
    category: '水果/苹果',
    origin: '河北赵县',
    brand: '赵州果园',
    skus: [
      piece('18斤箱', '箱', 82, 95, 18),
      weight('散装皇冠梨', '斤', 4.9, 410),
    ],
  },
  {
    code: 'DEV7C-FRUIT-019',
    name: '四川安岳柠檬',
    category: '水果/柑橘',
    origin: '四川安岳',
    brand: '柠香',
    skus: [
      piece('10斤箱', '箱', 58, 88, 10),
      weight('散装一级果', '斤', 6.2, 290),
    ],
  },
  {
    code: 'DEV7C-FRUIT-020',
    name: '陕西猕猴桃',
    category: '水果/桃李',
    origin: '陕西眉县',
    brand: '秦岭鲜',
    skus: [
      piece('24粒箱', '箱', 76, 76, 9, '24粒装'),
      weight('散装徐香', '斤', 7.9, 310),
    ],
  },
  {
    code: 'DEV7C-VEG-001',
    name: '上海青',
    category: '蔬菜/叶菜',
    origin: '上海',
    brand: '菜篮子',
    skus: [piece('5斤装', '件', 15, 120, 5)],
  },
  {
    code: 'DEV7C-VEG-002',
    name: '西红柿',
    category: '蔬菜/茄果',
    origin: '山东寿光',
    brand: '寿光鲜蔬',
    skus: [piece('10斤箱', '箱', 55, 90, 10)],
  },
  {
    code: 'DEV7C-VEG-003',
    name: '土豆',
    category: '蔬菜/根茎',
    origin: '内蒙古',
    brand: '草原薯',
    skus: [piece('20斤袋', '袋', 38, 140, 20)],
  },
  {
    code: 'DEV7C-VEG-004',
    name: '香菇',
    category: '蔬菜/菌菇',
    origin: '湖北随州',
    brand: '菇香源',
    skus: [piece('500g盒', '盒', 9.9, 160, 1)],
  },
  {
    code: 'DEV7C-VEG-005',
    name: '四季豆',
    category: '蔬菜/豆类',
    origin: '云南',
    brand: '云菜',
    skus: [
      piece('10斤箱', '箱', 62, 70, 10),
      weight('散装称重', '斤', 6.8, 260),
    ],
  },
  {
    code: 'DEV7C-VEG-006',
    name: '大白菜',
    category: '蔬菜/叶菜',
    origin: '河北',
    brand: '冀菜',
    skus: [
      piece('30斤袋', '袋', 35, 100, 30),
      weight('散装称重', '斤', 1.5, 800),
    ],
  },
  {
    code: 'DEV7C-VEG-007',
    name: '胡萝卜',
    category: '蔬菜/根茎',
    origin: '山东',
    brand: '田园鲜',
    skus: [
      piece('20斤袋', '袋', 42, 115, 20),
      weight('散装称重', '斤', 2.4, 520),
    ],
  },
  {
    code: 'DEV7C-PACK-001',
    name: '水果纸箱',
    category: '包装耗材/水果箱',
    origin: '广东',
    brand: '鲜果包装',
    skus: [
      piece('5号箱', '个', 2.5, 800, 0.8),
      piece('10号箱', '个', 4.5, 600, 1.2),
    ],
  },
  {
    code: 'DEV7C-PACK-002',
    name: '泡沫箱',
    category: '包装耗材/泡沫箱',
    origin: '广东',
    brand: '冷链包装',
    skus: [piece('中号', '个', 6, 350, 1.5)],
  },
  {
    code: 'DEV7C-PACK-003',
    name: '食品保鲜袋',
    category: '包装耗材/保鲜袋',
    origin: '浙江',
    brand: '鲜封',
    skus: [
      piece('小号100只', '包', 8.8, 260, 1),
      piece('大号100只', '包', 13.8, 220, 1.5),
    ],
  },
  {
    code: 'DEV7C-PACK-004',
    name: '封箱胶带',
    category: '包装耗材/胶带',
    origin: '江苏',
    brand: '固封',
    skus: [
      piece('透明45mm', '卷', 4.2, 500, 0.4),
      piece('印字45mm', '卷', 5.8, 420, 0.4),
    ],
  },
  {
    code: 'DEV7C-MEAT-001',
    name: '鲜鸡蛋',
    category: '肉禽蛋',
    origin: '江苏',
    brand: '农场直供',
    skus: [
      piece('30枚托装', '托', 22, 160, 4),
      piece('360枚整箱', '箱', 238, 35, 48),
    ],
  },
  {
    code: 'DEV7C-AQUA-001',
    name: '鲜活罗非鱼',
    category: '水产',
    origin: '广东',
    brand: '南海鲜',
    skus: [
      weight('散装称重', '斤', 8.8, 400),
      piece('20斤周转箱', '箱', 168, 45, 20),
    ],
  },
  {
    code: 'DEV7C-GRAIN-001',
    name: '东北珍珠米',
    category: '粮油调味',
    origin: '黑龙江',
    brand: '北大仓',
    skus: [
      piece('10kg袋', '袋', 59, 130, 20),
      piece('25kg袋', '袋', 138, 80, 50),
    ],
  },
  {
    code: 'DEV7C-FROZEN-001',
    name: '冷冻鸡中翅',
    category: '冻品',
    origin: '山东',
    brand: '冷鲜达',
    skus: [
      piece('10kg箱', '箱', 268, 55, 20),
      weight('散装称重', '斤', 14.5, 300),
    ],
  },
  {
    code: 'DEV7C-DRINK-001',
    name: 'NFC橙汁',
    category: '酒水饮料',
    origin: '湖北',
    brand: '鲜榨坊',
    skus: [
      piece('1L×6瓶', '箱', 89, 95, 14),
      piece('300ml×12瓶', '箱', 72, 110, 16),
    ],
  },
];

type SeedStats = {
  categories: { created: number; reused: number };
  products: { created: number; updated: number };
  skus: { created: number; updated: number };
  inventory: { created: number; updated: number };
  customerPrices: { created: number; updated: number };
  quantityPrices: { created: number; updated: number };
  homeBanners: { created: number; updated: number };
  homeCategories: { created: number; updated: number };
  homeProducts: { created: number; updated: number };
};

const initialStats = (): SeedStats => ({
  categories: { created: 0, reused: 0 },
  products: { created: 0, updated: 0 },
  skus: { created: 0, updated: 0 },
  inventory: { created: 0, updated: 0 },
  customerPrices: { created: 0, updated: 0 },
  quantityPrices: { created: 0, updated: 0 },
  homeBanners: { created: 0, updated: 0 },
  homeCategories: { created: 0, updated: 0 },
  homeProducts: { created: 0, updated: 0 },
});

const money = (value: number): string => value.toFixed(4);
const quantity = (value: number): string => value.toFixed(3);

async function seedCatalog(): Promise<SeedStats> {
  const stats = initialStats();
  const tenantCode = process.env.BOOTSTRAP_TENANT_CODE ?? 'DEFAULT';
  const warehouseCode =
    process.env.BOOTSTRAP_WAREHOUSE_CODE ?? 'WH_DEFAULT';

  return dataSource.transaction(async (manager) => {
    const tenants = manager.getRepository(TenantEntity);
    const warehouses = manager.getRepository(WarehouseEntity);
    const customers = manager.getRepository(CustomerEntity);
    const categories = manager.getRepository(CategoryEntity);
    const products = manager.getRepository(ProductEntity);
    const skus = manager.getRepository(SkuEntity);
    const inventories = manager.getRepository(InventoryEntity);
    const customerPrices = manager.getRepository(CustomerPriceEntity);
    const quantityPrices = manager.getRepository(QuantityPriceEntity);
    const homeBanners = manager.getRepository(HomeBannerEntity);
    const homeCategories = manager.getRepository(HomeCategoryEntity);
    const homeProducts = manager.getRepository(HomeProductEntity);

    const tenant = await tenants.findOneBy({ tenantCode });
    if (!tenant) {
      throw new Error(
        `Tenant ${tenantCode} does not exist. Run the foundation seed first.`,
      );
    }
    const warehouse = await warehouses.findOneBy({
      tenantId: tenant.id,
      warehouseCode,
    });
    if (!warehouse) {
      throw new Error(
        `Warehouse ${warehouseCode} does not exist. Run the foundation seed first.`,
      );
    }
    const devCustomer = await customers.findOneBy({
      tenantId: tenant.id,
      customerNo: 'DEV001',
      status: 'ACTIVE',
    });
    if (!devCustomer) {
      throw new Error(
        'Active customer DEV001 does not exist. Create the Stage 7-C test account before running this seed.',
      );
    }

    const categoryIds = new Map<string, string>();
    for (const [rootIndex, definition] of categoryDefinitions.entries()) {
      let root = await categories.findOne({
        where: {
          tenantId: tenant.id,
          parentId: IsNull(),
          name: definition.name,
        },
        withDeleted: true,
      });
      if (!root) {
        root = categories.create({
          tenantId: tenant.id,
          parentId: null,
          name: definition.name,
          image: TEST_IMAGE_URL,
          sort: (rootIndex + 1) * 10,
          status: 'ACTIVE',
        });
        stats.categories.created += 1;
      } else {
        stats.categories.reused += 1;
      }
      root.deletedAt = null;
      root = await categories.save(root);
      categoryIds.set(definition.name, root.id);

      for (const [childIndex, childName] of definition.children.entries()) {
        let child = await categories.findOne({
          where: {
            tenantId: tenant.id,
            parentId: root.id,
            name: childName,
          },
          withDeleted: true,
        });
        if (!child) {
          child = categories.create({
            tenantId: tenant.id,
            parentId: root.id,
            name: childName,
            image: TEST_IMAGE_URL,
            sort: (childIndex + 1) * 10,
            status: 'ACTIVE',
          });
          stats.categories.created += 1;
        } else {
          stats.categories.reused += 1;
        }
        child.deletedAt = null;
        child = await categories.save(child);
        categoryIds.set(`${definition.name}/${childName}`, child.id);
      }
    }

    const skuByKey = new Map<string, SkuEntity>();
    for (const definition of productDefinitions) {
      const categoryId = categoryIds.get(definition.category);
      if (!categoryId) {
        throw new Error(
          `Seed category is not defined for ${definition.code}: ${definition.category}`,
        );
      }
      let product = await products.findOne({
        where: {
          tenantId: tenant.id,
          productCode: definition.code,
        },
        withDeleted: true,
      });
      if (!product) {
        product = products.create({
          tenantId: tenant.id,
          productCode: definition.code,
          categoryId,
          name: definition.name,
          mainImage: TEST_IMAGE_URL,
          origin: definition.origin,
          brand: definition.brand,
          description: '阶段7-C水果B2B商品中心联调测试数据',
          status: 'ON_SALE',
        });
        stats.products.created += 1;
      } else {
        stats.products.updated += 1;
      }
      Object.assign(product, {
        categoryId,
        name: definition.name,
        mainImage: TEST_IMAGE_URL,
        origin: definition.origin,
        brand: definition.brand,
        description: '阶段7-C水果B2B商品中心联调测试数据',
        status: 'ON_SALE' as const,
        deletedAt: null,
      });
      product = await products.save(product);

      for (const [skuIndex, definitionSku] of definition.skus.entries()) {
        const skuCode = `${definition.code}-S${String(skuIndex + 1).padStart(2, '0')}`;
        let sku = await skus.findOne({
          where: { tenantId: tenant.id, skuCode },
          withDeleted: true,
        });
        if (!sku) {
          sku = skus.create({
            tenantId: tenant.id,
            productId: product.id,
            skuCode,
          });
          stats.skus.created += 1;
        } else {
          stats.skus.updated += 1;
        }
        Object.assign(sku, {
          productId: product.id,
          skuName: definitionSku.name,
          specification: definitionSku.specification,
          saleType: definitionSku.saleType,
          pieceUnit:
            definitionSku.saleType === 'PIECE'
              ? definitionSku.unit
              : definitionSku.pieceUnit,
          weightUnit:
            definitionSku.saleType === 'WEIGHT' ? definitionSku.unit : null,
          stockUnit: definitionSku.unit,
          priceUnit:
            definitionSku.saleType === 'PIECE'
              ? definitionSku.unit
              : definitionSku.pieceUnit,
          standardWeight:
            definitionSku.saleType === 'WEIGHT'
              ? quantity(definitionSku.standardWeight ?? 10)
              : null,
          weightPriceType:
            definitionSku.saleType === 'WEIGHT' ? 'ACTUAL_WEIGHT' : null,
          grossWeightUnitPrice:
            definitionSku.saleType === 'WEIGHT'
              ? money(definitionSku.grossWeightUnitPrice ?? 0)
              : null,
          netWeightUnitPrice:
            definitionSku.saleType === 'WEIGHT'
              ? money(definitionSku.netWeightUnitPrice ?? 0)
              : null,
          deliveryWeightPerPiece:
            definitionSku.saleType === 'PIECE'
              ? quantity(definitionSku.deliveryWeightPerPiece ?? 1)
              : null,
          deliveryWeightUnit:
            definitionSku.saleType === 'PIECE' ? '斤' : null,
          costPrice: money(definitionSku.costPrice),
          basePrice: money(definitionSku.basePrice),
          stockWarning: quantity(definitionSku.stockWarning),
          status: 'ACTIVE' as const,
          deletedAt: null,
        });
        sku = await skus.save(sku);
        skuByKey.set(`${definition.code}:${definitionSku.name}`, sku);

        let inventory = await inventories.findOneBy({
          tenantId: tenant.id,
          warehouseId: warehouse.id,
          skuId: sku.id,
        });
        if (!inventory) {
          inventory = inventories.create({
            tenantId: tenant.id,
            warehouseId: warehouse.id,
            skuId: sku.id,
            lockedQuantity: '0.000',
            version: 0,
          });
          stats.inventory.created += 1;
        } else {
          stats.inventory.updated += 1;
        }
        const safeStock = Math.max(
          definitionSku.stock,
          Number(inventory.lockedQuantity),
        );
        Object.assign(inventory, {
          stockUnit: definitionSku.unit,
          stockQuantity: quantity(safeStock),
          costPrice: money(definitionSku.costPrice),
        });
        await inventories.save(inventory);
      }
    }

    const upsertCustomerPrice = async (
      sku: SkuEntity,
      price: number,
    ): Promise<void> => {
      let record = await customerPrices.findOneBy({
        tenantId: tenant.id,
        customerId: devCustomer.id,
        skuId: sku.id,
      });
      if (!record) {
        record = customerPrices.create({
          tenantId: tenant.id,
          customerId: devCustomer.id,
          skuId: sku.id,
        });
        stats.customerPrices.created += 1;
      } else {
        stats.customerPrices.updated += 1;
      }
      record.price = money(price);
      record.status = 'ACTIVE';
      await customerPrices.save(record);
    };

    const upsertQuantityPrice = async (
      sku: SkuEntity,
      min: number,
      max: number | null,
      price: number,
    ): Promise<void> => {
      let record = await quantityPrices.findOneBy({
        tenantId: tenant.id,
        skuId: sku.id,
        minQuantity: quantity(min),
      });
      if (!record) {
        record = quantityPrices.create({
          tenantId: tenant.id,
          skuId: sku.id,
          minQuantity: quantity(min),
        });
        stats.quantityPrices.created += 1;
      } else {
        stats.quantityPrices.updated += 1;
      }
      record.maxQuantity = max === null ? null : quantity(max);
      record.price = money(price);
      record.status = 'ACTIVE';
      await quantityPrices.save(record);
    };

    const durianBox = skuByKey.get(
      'DEV7C-FRUIT-001:金枕榴莲整箱',
    );
    const grapeBox = skuByKey.get(
      'DEV7C-FRUIT-002:精品5斤箱',
    );
    const watermelon = skuByKey.get(
      'DEV7C-FRUIT-006:普通西瓜',
    );
    if (!durianBox || !grapeBox || !watermelon) {
      throw new Error('Price test SKU mapping is incomplete');
    }

    await upsertCustomerPrice(durianBox, 468);
    await upsertQuantityPrice(grapeBox, 1, 4, 88);
    await upsertQuantityPrice(grapeBox, 5, 9, 82);
    await upsertQuantityPrice(grapeBox, 10, null, 75);
    await upsertQuantityPrice(watermelon, 100, null, 3);

    const bannerDefinitions = [
      {
        title: '产地鲜果今日直达',
        subtitle: '新鲜产地货 · 批发客户专属价格',
        imageUrl:
          'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=1200&q=80',
        bannerType: 'MARKET' as const,
        linkType: 'CATEGORY' as const,
        linkId: categoryIds.get('水果/榴莲')!,
        sort: 10,
      },
      {
        title: '热带水果批发季',
        subtitle: '榴莲、芒果、火龙果集中到货',
        imageUrl:
          'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=1200&q=80',
        bannerType: 'ACTIVITY' as const,
        linkType: 'PRODUCT' as const,
        linkId: (
          await products.findOneByOrFail({
            tenantId: tenant.id,
            productCode: 'DEV7C-FRUIT-001',
          })
        ).id,
        sort: 20,
      },
      {
        title: '本周新品鲜果',
        subtitle: '蓝莓、葡萄、车厘子新品采购',
        imageUrl:
          'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=1200&q=80',
        bannerType: 'NEW_ARRIVAL' as const,
        linkType: 'CATEGORY' as const,
        linkId: categoryIds.get('水果/蓝莓')!,
        sort: 30,
      },
    ];
    for (const definition of bannerDefinitions) {
      let banner = await homeBanners.findOneBy({
        tenantId: tenant.id,
        title: definition.title,
      });
      if (!banner) {
        banner = homeBanners.create({ tenantId: tenant.id });
        stats.homeBanners.created += 1;
      } else {
        stats.homeBanners.updated += 1;
      }
      Object.assign(banner, {
        ...definition,
        linkValue: definition.linkId,
        status: 'ACTIVE' as const,
        startTime: null,
        endTime: null,
      });
      await homeBanners.save(banner);
    }

    const homeCategoryNames = [
      '榴莲',
      '苹果',
      '葡萄',
      '西瓜',
      '芒果',
      '香蕉',
      '柑橘',
      '桃李',
      '火龙果',
      '蓝莓',
    ];
    for (const [index, name] of homeCategoryNames.entries()) {
      const categoryId = categoryIds.get(`水果/${name}`);
      if (!categoryId) throw new Error(`Home category not found: ${name}`);
      let item = await homeCategories.findOneBy({
        tenantId: tenant.id,
        categoryId,
      });
      if (!item) {
        item = homeCategories.create({
          tenantId: tenant.id,
          categoryId,
        });
        stats.homeCategories.created += 1;
      } else {
        stats.homeCategories.updated += 1;
      }
      Object.assign(item, {
        title: name,
        imageUrl: TEST_IMAGE_URL,
        sort: (index + 1) * 10,
        status: 'ACTIVE' as const,
      });
      await homeCategories.save(item);
    }

    const positionDefinitions = [
      {
        position: 'HOT' as const,
        codes: productDefinitions.slice(0, 8).map((item) => item.code),
      },
      {
        position: 'NEW' as const,
        codes: productDefinitions.slice(8, 16).map((item) => item.code),
      },
      {
        position: 'RECOMMEND' as const,
        codes: productDefinitions.slice(16, 24).map((item) => item.code),
      },
    ];
    for (const group of positionDefinitions) {
      for (const [index, productCode] of group.codes.entries()) {
        const product = await products.findOneByOrFail({
          tenantId: tenant.id,
          productCode,
        });
        let item = await homeProducts.findOneBy({
          tenantId: tenant.id,
          productId: product.id,
          position: group.position,
        });
        if (!item) {
          item = homeProducts.create({
            tenantId: tenant.id,
            productId: product.id,
            position: group.position,
          });
          stats.homeProducts.created += 1;
        } else {
          stats.homeProducts.updated += 1;
        }
        Object.assign(item, {
          sort: (index + 1) * 10,
          status: 'ACTIVE' as const,
        });
        await homeProducts.save(item);
      }
    }

    return stats;
  });
}

async function invalidateCatalogCache(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn(
      'REDIS_URL is not configured; category cache was not invalidated.',
    );
    return;
  }
  const tenantCode = process.env.BOOTSTRAP_TENANT_CODE ?? 'DEFAULT';
  const tenant = await dataSource
    .getRepository(TenantEntity)
    .findOneBy({ tenantCode });
  if (!tenant) return;

  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  try {
    await redis.connect();
    const keyPrefix =
      process.env.REDIS_KEY_PREFIX ?? 'fruit-b2b:';
    for (const pattern of [
      `*catalog:category-tree:${tenant.id}:*`,
      `*home:config:${tenant.id}:*`,
    ]) {
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length) await redis.del(...keys);
      } while (cursor !== '0');
    }
    await redis.incr(`${keyPrefix}home:config-version:${tenant.id}`);
  } catch (error) {
    console.warn(
      `Category cache invalidation skipped: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    redis.disconnect();
  }
}

async function main(): Promise<void> {
  await dataSource.initialize();
  try {
    const stats = await seedCatalog();
    await invalidateCatalogCache();
    const seededSkuCount = productDefinitions.reduce(
      (sum, product) => sum + product.skus.length,
      0,
    );
    console.info(
      JSON.stringify(
        {
          message: 'Stage 7-C catalog test seed completed successfully',
          dataset: {
            categories: categoryDefinitions.reduce(
              (sum, category) => sum + 1 + category.children.length,
              0,
            ),
            products: productDefinitions.length,
            skus: seededSkuCount,
            inventory: seededSkuCount,
            customer: 'DEV001',
            home_banners: 3,
            home_categories: 10,
            home_products: 24,
          },
          changes: stats,
        },
        null,
        2,
      ),
    );
  } finally {
    await dataSource.destroy();
  }
}

void main();
