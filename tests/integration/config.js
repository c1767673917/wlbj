/**
 * 集成测试配置
 * 定义测试环境的配置参数和常量
 */

// 测试环境配置
const TEST_CONFIG = {
  // 服务器配置
  server: {
    host: process.env.TEST_SERVER_HOST || 'localhost',
    port: process.env.TEST_SERVER_PORT || 3001,
    baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3001'
  },
  
  // 数据库配置
  database: {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: process.env.TEST_DB_PORT || 5432,
    database: process.env.TEST_DB_NAME || 'wlbj_test',
    user: process.env.TEST_DB_USER || 'postgres',
    password: process.env.TEST_DB_PASSWORD || 'password'
  },
  
  // JWT配置
  jwt: {
    secret: process.env.TEST_JWT_SECRET || 'test-jwt-secret-key',
    expiresIn: '1h'
  },
  
  // 测试超时配置
  timeouts: {
    default: 10000,      // 10秒
    database: 5000,      // 5秒
    api: 8000,          // 8秒
    integration: 15000   // 15秒
  },
  
  // 测试用户配置
  testUsers: {
    user1: {
      id: 'test-user-1',
      email: 'user1@test.com',
      password: 'TestPassword123!',
      name: 'Test User 1',
      role: 'user'
    },
    user2: {
      id: 'test-user-2',
      email: 'user2@test.com',
      password: 'TestPassword123!',
      name: 'Test User 2',
      role: 'user'
    },
    admin: {
      id: 'test-admin-1',
      email: 'admin@test.com',
      password: 'AdminPassword123!',
      name: 'Test Admin',
      role: 'admin'
    }
  },
  
  // 测试订单配置
  testOrders: {
    order1: {
      id: 'test-order-1',
      warehouse: 'Test Warehouse 1',
      goods: 'Test Goods Description 1',
      deliveryAddress: 'Test Delivery Address 1'
    },
    order2: {
      id: 'test-order-2',
      warehouse: 'Test Warehouse 2',
      goods: 'Test Goods Description 2',
      deliveryAddress: 'Test Delivery Address 2'
    }
  },
  
  // 测试报价配置
  testQuotes: {
    quote1: {
      id: 'test-quote-1',
      provider: 'Test Provider A',
      price: 100.50,
      estimatedDelivery: '2025-07-01T10:00:00.000Z',
      remarks: 'Test quote remarks 1'
    },
    quote2: {
      id: 'test-quote-2',
      provider: 'Test Provider B',
      price: 120.00,
      estimatedDelivery: '2025-07-02T10:00:00.000Z',
      remarks: 'Test quote remarks 2'
    }
  },
  
  // API端点配置
  endpoints: {
    auth: {
      register: '/api/auth/register',
      login: '/api/auth/login',
      me: '/api/auth/me',
      changePassword: '/api/auth/change-password'
    },
    orders: {
      base: '/api/orders',
      create: '/api/orders',
      getById: (id) => `/api/orders/${id}`,
      update: (id) => `/api/orders/${id}`,
      cancel: (id) => `/api/orders/${id}/cancel`,
      selectProvider: (id) => `/api/orders/${id}/select-provider`,
      stats: '/api/orders/stats'
    },
    quotes: {
      base: '/api/quotes',
      createOrUpdate: (orderId) => `/api/quotes/orders/${orderId}`,
      getByOrder: (orderId) => `/api/quotes/orders/${orderId}`,
      getLowest: (orderId) => `/api/quotes/orders/${orderId}/lowest`,
      getByPriceRange: (orderId) => `/api/quotes/orders/${orderId}/price-range`,
      delete: (orderId, provider) => `/api/quotes/orders/${orderId}/providers/${provider}`,
      getByProvider: (provider) => `/api/quotes/providers/${provider}`,
      batch: '/api/quotes/batch'
    },
    users: {
      base: '/api/users',
      getById: (id) => `/api/users/${id}`,
      update: (id) => `/api/users/${id}`,
      toggleStatus: (id) => `/api/users/${id}/toggle-status`,
      export: '/api/users/export'
    }
  },
  
  // 测试数据清理配置
  cleanup: {
    // 是否在每个测试后清理数据
    afterEach: true,
    // 是否在所有测试后清理数据
    afterAll: true,
    // 需要清理的表
    tables: ['quotes', 'orders', 'users']
  },
  
  // 模拟服务配置
  mocks: {
    // 是否启用邮件服务模拟
    emailService: true,
    // 是否启用通知服务模拟
    notificationService: true,
    // 是否启用外部API模拟
    externalApis: true
  }
};

// 环境变量覆盖
if (process.env.NODE_ENV === 'test') {
  // 确保使用测试数据库
  TEST_CONFIG.database.database = process.env.TEST_DB_NAME || 'wlbj_test';
  
  // 使用测试JWT密钥
  TEST_CONFIG.jwt.secret = process.env.TEST_JWT_SECRET || 'test-jwt-secret-key';
  
  // 缩短超时时间以加快测试
  TEST_CONFIG.timeouts.default = 5000;
  TEST_CONFIG.timeouts.api = 3000;
}

/**
 * 获取完整的API URL
 */
function getApiUrl(endpoint) {
  return `${TEST_CONFIG.server.baseUrl}${endpoint}`;
}

/**
 * 获取测试用户的JWT token
 */
function getTestUserToken(userKey = 'user1') {
  const jwt = require('jsonwebtoken');
  const user = TEST_CONFIG.testUsers[userKey];
  
  if (!user) {
    throw new Error(`Test user '${userKey}' not found`);
  }
  
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    },
    TEST_CONFIG.jwt.secret,
    { expiresIn: TEST_CONFIG.jwt.expiresIn }
  );
}

/**
 * 获取测试用户的认证头
 */
function getAuthHeaders(userKey = 'user1') {
  const token = getTestUserToken(userKey);
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

/**
 * 获取供应商认证头
 */
function getProviderHeaders(provider = 'Test Provider A', accessKey = 'test-access-key') {
  return {
    'x-provider-name': provider,
    'x-access-key': accessKey,
    'Content-Type': 'application/json'
  };
}

/**
 * 生成随机测试数据
 */
function generateTestData() {
  const timestamp = Date.now();
  
  return {
    user: {
      email: `test${timestamp}@example.com`,
      password: 'TestPassword123!',
      name: `Test User ${timestamp}`
    },
    order: {
      warehouse: `Test Warehouse ${timestamp}`,
      goods: `Test Goods ${timestamp}`,
      deliveryAddress: `Test Address ${timestamp}`
    },
    quote: {
      provider: `Test Provider ${timestamp}`,
      price: Math.round((Math.random() * 1000 + 50) * 100) / 100,
      estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      remarks: `Test remarks ${timestamp}`
    }
  };
}

module.exports = {
  TEST_CONFIG,
  getApiUrl,
  getTestUserToken,
  getAuthHeaders,
  getProviderHeaders,
  generateTestData
};
