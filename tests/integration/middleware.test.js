/**
 * Controller与Service集成测试
 * 验证Controller层正确调用Service层，测试完整的请求响应流程
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { TEST_CONFIG, getAuthHeaders, getProviderHeaders } = require('./config');

describe('中间件功能集成测试', () => {
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

  describe('认证中间件测试', () => {
    it('应该拒绝没有Authorization头的请求', async () => {
      const response = await request(app)
        .get('/api/orders')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });

    it('应该拒绝无效的Bearer token', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: '无效的token'
      });
    });

    it('应该拒绝格式错误的Authorization头', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: '无效的token'
      });
    });

    it('应该接受有效的JWT token', async () => {
      // 创建一个有效的测试token
      const token = jwt.sign(
        { 
          id: 'test-user-id', 
          email: 'test@example.com', 
          role: 'user' 
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${token}`);

      // 应该通过认证，但可能因为其他原因失败（如数据库）
      expect(response.status).not.toBe(401);
    });

    it('应该拒绝过期的JWT token', async () => {
      // 创建一个过期的token
      const expiredToken = jwt.sign(
        {
          id: 'test-user-id',
          email: 'test@example.com',
          role: 'user'
        },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // 过期1小时
      );

      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'token已过期'
      });
    });
  });

  describe('供应商认证中间件测试', () => {
    it('应该拒绝没有供应商认证头的请求', async () => {
      const response = await request(app)
        .post('/api/quotes/orders/test-order-id')
        .send({
          price: 100.50,
          estimatedDelivery: '2025-07-01T10:00:00Z'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });

    it('应该拒绝缺少x-provider-name头的请求', async () => {
      const response = await request(app)
        .post('/api/quotes/orders/test-order-id')
        .send({
          price: 100.50,
          estimatedDelivery: '2025-07-01T10:00:00Z'
        })
        .set('x-access-key', 'test-key')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });

    it('应该拒绝缺少x-access-key头的请求', async () => {
      const response = await request(app)
        .post('/api/quotes/orders/test-order-id')
        .send({
          price: 100.50,
          estimatedDelivery: '2025-07-01T10:00:00Z'
        })
        .set('x-provider-name', 'Test Provider')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });
  });

  describe('输入验证中间件测试', () => {
    it('应该验证用户注册数据', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          // 缺少必需字段
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    it('应该验证邮箱格式', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email-format',
          password: 'ValidPassword123!',
          name: 'Test User'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    it('应该验证密码强度', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: '123', // 弱密码
          name: 'Test User'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    it('应该验证报价数据格式', async () => {
      const response = await request(app)
        .post('/api/quotes/orders/test-order-id')
        .send({
          price: 'invalid-price', // 无效价格格式
          estimatedDelivery: 'invalid-date'
        })
        .set('x-provider-name', 'Test Provider')
        .set('x-access-key', 'test-key')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });
  });

  describe('安全中间件测试', () => {
    it('应该设置安全头', async () => {
      const response = await request(app)
        .get('/health');

      // 检查各种安全头
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['referrer-policy']).toBeDefined();
    });

    it('应该处理CORS请求', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('应该处理CORS预检请求', async () => {
      const response = await request(app)
        .options('/api/orders')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Authorization, Content-Type');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    it('应该限制请求体大小', async () => {
      const largeData = 'x'.repeat(11 * 1024 * 1024); // 11MB

      const response = await request(app)
        .post('/api/auth/register')
        .send({ data: largeData })
        .expect(413);

      expect(response.body).toMatchObject({
        success: false
      });
    });
  });

  describe('错误处理中间件测试', () => {
    it('应该处理JSON解析错误', async () => {
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

    it('应该处理404错误', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: '接口不存在'
      });
    });

    it('应该返回统一的错误格式', async () => {
      const response = await request(app)
        .get('/api/orders')
        .expect(401);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
      expect(response.body.success).toBe(false);
      // timestamp字段可能不是所有错误都有，所以不强制要求
    });
  });

  describe('请求日志中间件测试', () => {
    it('应该记录请求信息', async () => {
      // 这个测试主要验证中间件不会阻止请求
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      // 实际的日志记录需要通过日志文件或日志系统验证
    });
  });
});
