/**
 * E2E测试设置文件
 * 为每个测试文件提供通用的设置和工具
 */

const request = require('supertest');

// 测试配置
const TEST_CONFIG = {
  baseURL: `http://localhost:${global.__TEST_PORT__ || 3001}`,
  timeout: 10000,
  retries: 3
};

// 通用测试数据
const TEST_DATA = {
  users: {
    admin: {
      username: 'admin_test',
      email: 'admin@test.com',
      password: 'Admin123!@#',
      role: 'admin'
    },
    user: {
      username: 'user_test',
      email: 'user@test.com',
      password: 'User123!@#',
      role: 'user'
    },
    provider: {
      username: 'provider_test',
      email: 'provider@test.com',
      password: 'Provider123!@#',
      role: 'provider'
    }
  },
  orders: {
    basic: {
      origin: '北京市朝阳区',
      destination: '上海市浦东新区',
      cargoType: '普通货物',
      weight: 100,
      volume: 2.5,
      pickupTime: '2025-01-01T10:00:00Z',
      deliveryTime: '2025-01-02T18:00:00Z',
      specialRequirements: '轻拿轻放'
    }
  }
};

// 通用工具函数
const utils = {
  // 等待函数
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // 重试函数
  retry: async (fn, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) throw error;
        await utils.sleep(delay);
      }
    }
  },

  // 生成随机字符串
  randomString: (length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  // 生成唯一的测试数据
  generateTestUser: (role = 'user') => ({
    ...TEST_DATA.users[role],
    username: `${role}_${utils.randomString(6)}`,
    email: `${role}_${utils.randomString(6)}@test.com`
  }),

  generateTestOrder: () => ({
    ...TEST_DATA.orders.basic,
    orderNumber: `ORD_${utils.randomString(8)}`
  })
};

// API客户端
class APIClient {
  constructor(baseURL = TEST_CONFIG.baseURL) {
    this.baseURL = baseURL;
    this.token = null;
  }

  // 设置认证token
  setToken(token) {
    this.token = token;
    return this;
  }

  // 发送请求
  async request(method, path, data = null) {
    const url = `${this.baseURL}${path}`;
    let req = request(this.baseURL)[method.toLowerCase()](path);

    // 添加认证头
    if (this.token) {
      req = req.set('Authorization', `Bearer ${this.token}`);
    }

    // 添加数据
    if (data) {
      req = req.send(data);
    }

    return req;
  }

  // 便捷方法
  get(path) { return this.request('GET', path); }
  post(path, data) { return this.request('POST', path, data); }
  put(path, data) { return this.request('PUT', path, data); }
  delete(path) { return this.request('DELETE', path); }

  // 认证相关
  async login(credentials) {
    const response = await this.post('/api/auth/login', credentials);
    if (response.body.success && response.body.data.token) {
      this.setToken(response.body.data.token);
    }
    return response;
  }

  async register(userData) {
    return this.post('/api/auth/register', userData);
  }

  // 订单相关
  async createOrder(orderData) {
    return this.post('/api/orders', orderData);
  }

  async getOrders() {
    return this.get('/api/orders');
  }

  async getOrder(orderId) {
    return this.get(`/api/orders/${orderId}`);
  }

  // 报价相关
  async createQuote(quoteData) {
    return this.post('/api/quotes', quoteData);
  }

  async getQuotes() {
    return this.get('/api/quotes');
  }
}

// 全局设置
beforeEach(() => {
  // 每个测试前重置超时
  jest.setTimeout(TEST_CONFIG.timeout);
});

// 导出工具
global.TEST_CONFIG = TEST_CONFIG;
global.TEST_DATA = TEST_DATA;
global.utils = utils;
global.APIClient = APIClient;
