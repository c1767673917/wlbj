/**
 * 集成测试环境验证
 * 验证集成测试环境是否正确配置
 */

const { getTestDbPool, queryTestDb } = require('./setup');
const { TEST_CONFIG } = require('./config');
const { DatabaseHelper } = require('./helpers');

describe('集成测试环境验证', () => {
  let dbHelper;

  beforeAll(() => {
    dbHelper = new DatabaseHelper(getTestDbPool());
  });

  describe('数据库连接', () => {
    it('应该能够连接到测试数据库', async () => {
      const result = await queryTestDb('SELECT 1 as test');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].test).toBe(1);
    });

    it('应该能够查询数据库版本', async () => {
      const result = await queryTestDb('SELECT version()');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].version).toContain('PostgreSQL');
    });
  });

  describe('数据库表结构', () => {
    it('应该存在users表', async () => {
      const result = await queryTestDb(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      `);
      expect(result.rows).toHaveLength(1);
    });

    it('应该存在orders表', async () => {
      const result = await queryTestDb(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'orders'
      `);
      expect(result.rows).toHaveLength(1);
    });

    it('应该存在quotes表', async () => {
      const result = await queryTestDb(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'quotes'
      `);
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('测试数据', () => {
    it('应该包含测试用户数据', async () => {
      const userCount = await dbHelper.countRecords('users');
      expect(userCount).toBeGreaterThan(0);
    });

    it('应该包含测试订单数据', async () => {
      const orderCount = await dbHelper.countRecords('orders');
      expect(orderCount).toBeGreaterThan(0);
    });

    it('应该包含测试报价数据', async () => {
      const quoteCount = await dbHelper.countRecords('quotes');
      expect(quoteCount).toBeGreaterThan(0);
    });

    it('应该能够查询特定测试用户', async () => {
      const user = await dbHelper.getUser('test-user-1');
      expect(user).toBeDefined();
      expect(user.email).toBe('user1@test.com');
      expect(user.role).toBe('user');
    });

    it('应该能够查询特定测试订单', async () => {
      const order = await dbHelper.getOrder('test-order-1');
      expect(order).toBeDefined();
      expect(order.user_id).toBe('test-user-1');
      expect(order.status).toBe('active');
    });
  });

  describe('配置验证', () => {
    it('应该加载正确的测试配置', () => {
      expect(TEST_CONFIG).toBeDefined();
      expect(TEST_CONFIG.database).toBeDefined();
      expect(TEST_CONFIG.server).toBeDefined();
      expect(TEST_CONFIG.testUsers).toBeDefined();
    });

    it('应该设置正确的环境变量', () => {
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.TEST_DB_NAME).toBeDefined();
    });

    it('应该配置正确的测试用户', () => {
      expect(TEST_CONFIG.testUsers.user1).toBeDefined();
      expect(TEST_CONFIG.testUsers.admin).toBeDefined();
      expect(TEST_CONFIG.testUsers.admin.role).toBe('admin');
    });
  });

  describe('数据清理功能', () => {
    it('应该能够清理测试数据', async () => {
      // 插入一条测试记录
      await queryTestDb(`
        INSERT INTO users (id, email, password_hash, name, role, is_active, created_at, updated_at)
        VALUES ('temp-user', 'temp@test.com', 'hash', 'Temp User', 'user', true, NOW(), NOW())
      `);

      // 验证记录存在
      let user = await dbHelper.getUser('temp-user');
      expect(user).toBeDefined();

      // 清理数据
      await dbHelper.cleanAllTestData();

      // 验证记录被清理
      user = await dbHelper.getUser('temp-user');
      expect(user).toBeUndefined();
    });

    it('应该能够统计表记录数', async () => {
      const userCount = await dbHelper.countRecords('users');
      expect(typeof userCount).toBe('number');
      expect(userCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('辅助工具验证', () => {
    it('DatabaseHelper应该正常工作', () => {
      expect(dbHelper).toBeDefined();
      expect(typeof dbHelper.query).toBe('function');
      expect(typeof dbHelper.getUser).toBe('function');
      expect(typeof dbHelper.getOrder).toBe('function');
    });

    it('应该能够执行自定义查询', async () => {
      const result = await dbHelper.query('SELECT COUNT(*) as total FROM users');
      expect(result.rows).toHaveLength(1);
      expect(typeof result.rows[0].total).toBe('string');
    });
  });
});
