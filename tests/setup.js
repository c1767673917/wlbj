/**
 * Jest测试环境设置
 * 配置测试环境和全局设置
 */

const path = require('path');
const fs = require('fs');

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:'; // 使用内存数据库进行测试
process.env.LOG_LEVEL = 'error'; // 减少测试时的日志输出
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.WECHAT_WEBHOOK_URL = 'http://test-webhook.com/webhook';
process.env.ADMIN_DEFAULT_PASSWORD = 'TestAdmin123!';
process.env.PORT = '3000';

// 设置测试超时时间
jest.setTimeout(30000);

// 全局测试工具函数
global.testUtils = {
  /**
   * 创建测试用的模拟数据
   */
  createMockUser: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    isActive: true,
    created_at: new Date().toISOString(),
    ...overrides
  }),

  createMockOrder: (overrides = {}) => ({
    id: 'ORD-20250625-001',
    warehouse: 'Test Warehouse',
    goods: 'Test Goods',
    deliveryAddress: 'Test Address',
    userId: 'test-user-id',
    status: 'active',
    createdAt: new Date().toISOString(),
    ...overrides
  }),

  createMockQuote: (overrides = {}) => ({
    id: 'quote-id-1',
    orderId: 'ORD-20250625-001',
    provider: 'Test Provider',
    price: 100.00,
    estimatedDelivery: new Date(Date.now() + 86400000).toISOString(),
    remarks: 'Test remarks',
    createdAt: new Date().toISOString(),
    ...overrides
  }),

  /**
   * 创建模拟的Repository
   */
  createMockRepository: () => ({
    create: jest.fn(),
    findById: jest.fn(),
    findMany: jest.fn(),
    updateById: jest.fn(),
    deleteById: jest.fn(),
    count: jest.fn(),
    transactionWithRetry: jest.fn(),
    findByUserId: jest.fn(),
    countByUserId: jest.fn(),
    findByOrderId: jest.fn(),
    findByOrderIdAndProvider: jest.fn(),
    upsertQuote: jest.fn(),
    getOrderStats: jest.fn(),
    getQuoteStats: jest.fn(),
    getProviderStats: jest.fn(),
    findByProvider: jest.fn(),
    validateAccess: jest.fn(),
    findActiveProviders: jest.fn(),
    checkUserAccess: jest.fn(),
    findByEmail: jest.fn(),
    findByOrderAndProvider: jest.fn(),
    selectProvider: jest.fn(),
    createUser: jest.fn(),
    validateUser: jest.fn(),
    updatePassword: jest.fn()
  }),

  /**
   * 创建模拟的Service依赖
   */
  createMockDependencies: () => ({
    orderRepo: global.testUtils.createMockRepository(),
    quoteRepo: global.testUtils.createMockRepository(),
    userRepo: global.testUtils.createMockRepository(),
    providerRepo: global.testUtils.createMockRepository(),
    orderIdService: {
      generateOrderId: jest.fn().mockResolvedValue('ORD-20250625-001'),
      validateOrderId: jest.fn().mockReturnValue(true),
      parseOrderId: jest.fn().mockReturnValue({
        date: '20250625',
        sequence: '001'
      })
    }
  }),

  /**
   * 重置所有模拟函数
   */
  resetAllMocks: () => {
    jest.clearAllMocks();
  },

  /**
   * 等待异步操作完成
   */
  waitFor: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms))
};

// 在每个测试前重置模拟
beforeEach(() => {
  global.testUtils.resetAllMocks();
});

// 在所有测试完成后清理
afterAll(() => {
  // 清理测试文件
  const testDbPath = path.join(__dirname, '../test.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});
