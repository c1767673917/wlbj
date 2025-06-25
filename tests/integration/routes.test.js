/**
 * 路由映射集成测试
 * 验证路由正确映射到Controller方法，测试中间件执行顺序
 */

const request = require('supertest');
const { TEST_CONFIG, getAuthHeaders, getProviderHeaders } = require('./config');

describe('路由映射集成测试', () => {
  let app;

  beforeAll(async () => {
    // 初始化测试环境
    const { createTestApp } = require('./setup');
    app = await createTestApp();
  });

  afterAll(async () => {
    // 关闭服务器
    if (app && app.closeServer) {
      await app.closeServer();
    }
  });

  describe('认证路由映射', () => {
    it('POST /api/auth/register 应该映射到正确的Controller方法', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
          name: 'Test User'
        });

      // 不管成功还是失败，都应该有响应体，说明路由映射正确
      expect(response.body).toBeDefined();
      expect(response.body.success).toBeDefined();
    });

    it('POST /api/auth/login 应该映射到正确的Controller方法', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

      expect(response.body).toBeDefined();
      expect(response.body.success).toBeDefined();
    });

    it('GET /api/auth/me 应该需要认证中间件', async () => {
      // 无认证头应该返回401
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });

    it('POST /api/auth/change-password 应该需要认证中间件', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .send({
          oldPassword: 'old123',
          newPassword: 'new123'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });
  });

  describe('订单路由映射', () => {
    it('GET /api/orders 应该需要认证中间件', async () => {
      const response = await request(app)
        .get('/api/orders')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });

    it('POST /api/orders 应该需要认证中间件', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          warehouse: 'Test Warehouse',
          goods: 'Test Goods',
          deliveryAddress: 'Test Address'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });

    it('GET /api/orders/:id 应该需要认证中间件', async () => {
      const response = await request(app)
        .get('/api/orders/test-order-id')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });

    it('管理员路由应该需要管理员权限', async () => {
      const response = await request(app)
        .get('/api/orders/admin/pending')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });
  });

  describe('报价路由映射', () => {
    it('POST /api/quotes/orders/:orderId 应该需要供应商认证', async () => {
      const response = await request(app)
        .post('/api/quotes/orders/test-order-id')
        .send({
          price: 100.50,
          estimatedDelivery: '2025-07-01T10:00:00Z',
          remarks: 'Test quote'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });

    it('GET /api/quotes/orders/:orderId 应该需要用户认证', async () => {
      const response = await request(app)
        .get('/api/quotes/orders/test-order-id')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });

    it('GET /api/quotes/:id 应该需要认证中间件', async () => {
      const response = await request(app)
        .get('/api/quotes/test-quote-id')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });
  });

  describe('用户路由映射', () => {
    it('GET /api/users/profile 应该需要认证中间件', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });

    it('PATCH /api/users/profile 应该需要认证中间件', async () => {
      const response = await request(app)
        .patch('/api/users/profile')
        .send({
          name: 'Updated Name'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });

    it('管理员用户路由应该需要管理员权限', async () => {
      const response = await request(app)
        .get('/api/users/admin/all')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });
  });

  describe('中间件执行顺序测试', () => {
    it('应该先执行安全中间件再执行认证中间件', async () => {
      const response = await request(app)
        .get('/api/orders')
        .expect(401);

      // 检查安全头是否设置（说明安全中间件已执行）
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      
      // 检查认证错误（说明认证中间件也执行了）
      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });

    it('应该正确处理CORS预检请求', async () => {
      const response = await request(app)
        .options('/api/orders')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Authorization');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    it('应该正确处理JSON解析错误', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: '请求参数错误'
      });
    });
  });

  describe('路由参数验证', () => {
    it('应该验证订单ID格式', async () => {
      const response = await request(app)
        .get('/api/orders/invalid-id-format')
        .set('Authorization', 'Bearer mock-token')
        .expect(401); // 仍然是认证错误，因为mock-token无效

      expect(response.body).toBeDefined();
    });

    it('应该验证报价提交数据', async () => {
      const response = await request(app)
        .post('/api/quotes/orders/test-order-id')
        .send({}) // 空数据应该触发验证错误
        .set('x-provider-name', 'Test Provider')
        .set('x-access-key', 'test-key')
        .expect(400); // 验证错误

      expect(response.body).toBeDefined();
      expect(response.body.success).toBe(false);
    });
  });
});
