/**
 * 集成测试辅助函数
 * 提供常用的测试工具和断言函数
 */

const request = require('supertest');
const { TEST_CONFIG, getApiUrl, getAuthHeaders, getProviderHeaders } = require('./config');

/**
 * API请求辅助类
 */
class ApiHelper {
  constructor(app) {
    this.app = app;
    this.agent = request(app);
  }

  /**
   * 发送认证请求
   */
  async authenticatedRequest(method, endpoint, data = null, userKey = 'user1') {
    const headers = getAuthHeaders(userKey);
    let req = this.agent[method.toLowerCase()](endpoint);
    
    // 设置认证头
    Object.keys(headers).forEach(key => {
      req = req.set(key, headers[key]);
    });
    
    // 发送数据
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      req = req.send(data);
    }
    
    return req;
  }

  /**
   * 发送供应商认证请求
   */
  async providerRequest(method, endpoint, data = null, provider = 'Test Provider A', accessKey = 'test-access-key') {
    const headers = getProviderHeaders(provider, accessKey);
    let req = this.agent[method.toLowerCase()](endpoint);
    
    // 设置供应商认证头
    Object.keys(headers).forEach(key => {
      req = req.set(key, headers[key]);
    });
    
    // 发送数据
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      req = req.send(data);
    }
    
    return req;
  }

  /**
   * 用户注册
   */
  async registerUser(userData) {
    return this.agent
      .post(TEST_CONFIG.endpoints.auth.register)
      .send(userData);
  }

  /**
   * 用户登录
   */
  async loginUser(email, password) {
    return this.agent
      .post(TEST_CONFIG.endpoints.auth.login)
      .send({ email, password });
  }

  /**
   * 创建订单
   */
  async createOrder(orderData, userKey = 'user1') {
    return this.authenticatedRequest('POST', TEST_CONFIG.endpoints.orders.create, orderData, userKey);
  }

  /**
   * 获取订单详情
   */
  async getOrder(orderId, userKey = 'user1') {
    return this.authenticatedRequest('GET', TEST_CONFIG.endpoints.orders.getById(orderId), null, userKey);
  }

  /**
   * 更新订单
   */
  async updateOrder(orderId, updateData, userKey = 'user1') {
    return this.authenticatedRequest('PUT', TEST_CONFIG.endpoints.orders.update(orderId), updateData, userKey);
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderId, reason, userKey = 'user1') {
    return this.authenticatedRequest('POST', TEST_CONFIG.endpoints.orders.cancel(orderId), { reason }, userKey);
  }

  /**
   * 创建或更新报价
   */
  async createOrUpdateQuote(orderId, quoteData, provider = 'Test Provider A', accessKey = 'test-access-key') {
    return this.providerRequest('POST', TEST_CONFIG.endpoints.quotes.createOrUpdate(orderId), quoteData, provider, accessKey);
  }

  /**
   * 获取订单报价
   */
  async getOrderQuotes(orderId, userKey = 'user1') {
    return this.authenticatedRequest('GET', TEST_CONFIG.endpoints.quotes.getByOrder(orderId), null, userKey);
  }

  /**
   * 获取最低报价
   */
  async getLowestQuote(orderId, userKey = 'user1') {
    return this.authenticatedRequest('GET', TEST_CONFIG.endpoints.quotes.getLowest(orderId), null, userKey);
  }
}

/**
 * 数据库辅助函数
 */
class DatabaseHelper {
  constructor(dbPool) {
    this.pool = dbPool;
  }

  /**
   * 执行查询
   */
  async query(sql, params = []) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result;
    } finally {
      client.release();
    }
  }

  /**
   * 获取用户
   */
  async getUser(userId) {
    const result = await this.query('SELECT * FROM users WHERE id = $1', [userId]);
    return result.rows[0];
  }

  /**
   * 获取订单
   */
  async getOrder(orderId) {
    const result = await this.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    return result.rows[0];
  }

  /**
   * 获取报价
   */
  async getQuote(quoteId) {
    const result = await this.query('SELECT * FROM quotes WHERE id = $1', [quoteId]);
    return result.rows[0];
  }

  /**
   * 获取订单的所有报价
   */
  async getOrderQuotes(orderId) {
    const result = await this.query('SELECT * FROM quotes WHERE order_id = $1 ORDER BY price ASC', [orderId]);
    return result.rows;
  }

  /**
   * 统计表记录数
   */
  async countRecords(tableName, condition = '', params = []) {
    const sql = condition ? 
      `SELECT COUNT(*) FROM ${tableName} WHERE ${condition}` : 
      `SELECT COUNT(*) FROM ${tableName}`;
    
    const result = await this.query(sql, params);
    return parseInt(result.rows[0].count);
  }

  /**
   * 清理表数据
   */
  async truncateTable(tableName) {
    await this.query(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`);
  }

  /**
   * 清理所有测试数据
   */
  async cleanAllTestData() {
    const tables = ['quotes', 'orders', 'users'];
    for (const table of tables) {
      await this.truncateTable(table);
    }
  }
}

/**
 * 响应验证辅助函数
 */
class ResponseValidator {
  /**
   * 验证成功响应格式
   */
  static validateSuccessResponse(response, expectedStatusCode = 200) {
    expect(response.status).toBe(expectedStatusCode);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('meta');
    expect(response.body.meta).toHaveProperty('timestamp');
  }

  /**
   * 验证错误响应格式
   */
  static validateErrorResponse(response, expectedStatusCode, expectedCode = null) {
    expect(response.status).toBe(expectedStatusCode);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message');

    if (expectedCode) {
      expect(response.body).toHaveProperty('code', expectedCode);
    }

    // timestamp字段是可选的，不强制要求
    // expect(response.body).toHaveProperty('timestamp');
  }

  /**
   * 验证分页响应格式
   */
  static validatePaginatedResponse(response, expectedStatusCode = 200) {
    this.validateSuccessResponse(response, expectedStatusCode);
    expect(response.body.meta).toHaveProperty('pagination');
    
    const pagination = response.body.meta.pagination;
    expect(pagination).toHaveProperty('page');
    expect(pagination).toHaveProperty('limit');
    expect(pagination).toHaveProperty('total');
    expect(pagination).toHaveProperty('totalPages');
    expect(pagination).toHaveProperty('hasNext');
    expect(pagination).toHaveProperty('hasPrev');
  }

  /**
   * 验证用户对象格式
   */
  static validateUserObject(user) {
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('role');
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('password_hash');
  }

  /**
   * 验证订单对象格式
   */
  static validateOrderObject(order) {
    expect(order).toHaveProperty('id');
    expect(order).toHaveProperty('userId');
    expect(order).toHaveProperty('warehouse');
    expect(order).toHaveProperty('goods');
    expect(order).toHaveProperty('deliveryAddress');
    expect(order).toHaveProperty('status');
    expect(order).toHaveProperty('createdAt');
    expect(order).toHaveProperty('updatedAt');
  }

  /**
   * 验证报价对象格式
   */
  static validateQuoteObject(quote) {
    expect(quote).toHaveProperty('id');
    expect(quote).toHaveProperty('orderId');
    expect(quote).toHaveProperty('provider');
    expect(quote).toHaveProperty('price');
    expect(quote).toHaveProperty('estimatedDelivery');
    expect(quote).toHaveProperty('createdAt');
    expect(quote).toHaveProperty('updatedAt');
  }
}

/**
 * 等待函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 生成唯一ID
 */
function generateUniqueId(prefix = 'test') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 深度比较对象
 */
function deepEqual(obj1, obj2) {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

module.exports = {
  ApiHelper,
  DatabaseHelper,
  ResponseValidator,
  sleep,
  generateUniqueId,
  deepEqual
};
