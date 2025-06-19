/**
 * Jest测试环境设置
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.DB_PATH = ':memory:';

// 全局测试工具
global.testUtils = {
  // 创建测试用户
  createTestUser: () => ({
    id: 1,
    username: 'testuser',
    password: 'hashedpassword',
    role: 'user',
    created_at: new Date().toISOString(),
  }),

  // 创建测试订单
  createTestOrder: () => ({
    id: 'test-order-001',
    user_id: 1,
    provider_id: 1,
    status: 'pending',
    created_at: new Date().toISOString(),
  }),

  // 创建测试供应商
  createTestProvider: () => ({
    id: 1,
    name: 'Test Provider',
    api_url: 'https://test-api.example.com',
    status: 'active',
  }),
};

// 测试数据库清理
afterEach(async () => {
  // 清理测试数据
  if (global.testDb) {
    // 清理逻辑将在具体测试中实现
  }
});

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
