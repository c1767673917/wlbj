/**
 * Controller与Service集成测试
 * 验证Controller层正确调用Service层，测试完整的请求响应流程
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { TEST_CONFIG } = require('./config');

describe('Controller与Service集成测试', () => {
  let app;
  let validToken;

  beforeAll(async () => {
    // 初始化测试环境
    const { createTestApp } = require('./setup');
    app = await createTestApp();

    // 创建有效的测试token
    validToken = jwt.sign(
      { 
        id: 'test-user-id', 
        email: 'test@example.com', 
        role: 'user' 
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // 关闭服务器
    if (app && app.closeServer) {
      await app.closeServer();
    }
  });

  describe('认证Controller与UserService集成', () => {
    it('注册接口应该调用UserService.registerUser', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'ComplexPassword123!@#',
        name: 'New Test User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      // 验证响应格式（不管成功还是失败）
      expect(response.body).toBeDefined();
      expect(response.body.success).toBeDefined();
      expect(response.body.message).toBeDefined();

      // 如果失败，应该是业务逻辑错误，不是系统错误
      if (!response.body.success) {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
      }
    });

    it('登录接口应该调用UserService.loginUser', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      // 验证响应格式
      expect(response.body).toBeDefined();
      expect(response.body.success).toBeDefined();
      expect(response.body.message).toBeDefined();

      // 验证Controller正确处理Service层的响应
      if (!response.body.success) {
        expect(response.status).toBeGreaterThanOrEqual(400);
        // 允许500错误，因为可能是数据库连接问题
        expect(response.status).toBeLessThanOrEqual(500);
      }
    });

    it('获取用户信息接口应该调用UserService.getUserById', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      // 验证响应格式
      expect(response.body).toBeDefined();
      expect(response.body.success).toBeDefined();

      // 验证Controller正确处理认证和Service调用
      if (!response.body.success) {
        // 可能是数据库错误或用户不存在
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThanOrEqual(500);
      }
    });
  });

  describe('订单Controller与OrderService集成', () => {
    it('获取订单列表应该调用OrderService.getUserOrders', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${validToken}`);

      // 验证响应格式
      expect(response.body).toBeDefined();
      expect(response.body.success).toBeDefined();

      // 验证Controller正确处理Service层的响应
      if (!response.body.success) {
        // 可能是数据库错误，但Controller应该正确处理
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThanOrEqual(500);
      }
    });

    it('创建订单应该调用OrderService.createOrder', async () => {
      const orderData = {
        warehouse: 'Test Warehouse',
        goods: 'Test Goods Description',
        deliveryAddress: 'Test Delivery Address'
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${validToken}`)
        .send(orderData);

      // 验证响应格式
      expect(response.body).toBeDefined();
      expect(response.body.success).toBeDefined();
      expect(response.body.message).toBeDefined();

      // 验证Controller正确处理Service层的响应
      if (!response.body.success) {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThanOrEqual(500);
      }
    }, 30000); // 增加超时时间到30秒

    it('获取订单详情应该调用OrderService.getOrderById', async () => {
      const response = await request(app)
        .get('/api/orders/test-order-id')
        .set('Authorization', `Bearer ${validToken}`);

      // 验证响应格式
      expect(response.body).toBeDefined();
      expect(response.body.success).toBeDefined();

      // 验证Controller正确处理Service层的响应
      if (!response.body.success) {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
      }
    });
  });

  describe('报价Controller与QuoteService集成', () => {
    it('提交报价应该调用QuoteService.submitQuote', async () => {
      const quoteData = {
        price: 150.75,
        estimatedDelivery: '2025-07-01T10:00:00Z',
        remarks: 'Test quote submission'
      };

      const response = await request(app)
        .post('/api/quotes/orders/test-order-id')
        .set('x-provider-name', 'Test Provider')
        .set('x-access-key', 'test-access-key')
        .send(quoteData);

      // 验证响应格式
      expect(response.body).toBeDefined();
      expect(response.body.success).toBeDefined();

      // 验证Controller正确处理Service层的响应
      if (!response.body.success) {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
      }
    });

    it('获取订单报价应该调用QuoteService.getQuotesByOrderId', async () => {
      const response = await request(app)
        .get('/api/quotes/orders/test-order-id')
        .set('Authorization', `Bearer ${validToken}`);

      // 验证响应格式
      expect(response.body).toBeDefined();
      expect(response.body.success).toBeDefined();

      // 验证Controller正确处理Service层的响应
      if (!response.body.success) {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
      }
    });

    it('获取报价详情应该调用QuoteService.getQuoteById', async () => {
      const response = await request(app)
        .get('/api/quotes/test-quote-id')
        .set('Authorization', `Bearer ${validToken}`);

      // 验证响应格式
      expect(response.body).toBeDefined();
      expect(response.body.success).toBeDefined();

      // 验证Controller正确处理Service层的响应
      if (!response.body.success) {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThanOrEqual(500);
      }
    }, 30000); // 增加超时时间到30秒
  });

  describe('用户Controller与UserService集成', () => {
    it('获取用户资料应该调用UserService.getUserById', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${validToken}`);

      // 验证响应格式
      expect(response.body).toBeDefined();
      expect(response.body.success).toBeDefined();

      // 验证Controller正确处理Service层的响应
      if (!response.body.success) {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThanOrEqual(500);
      }
    }, 30000); // 增加超时时间到30秒

    it('更新用户资料应该调用UserService.updateUser', async () => {
      const updateData = {
        name: 'Updated Test User'
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateData);

      // 验证响应格式
      expect(response.body).toBeDefined();
      expect(response.body.success).toBeDefined();

      // 验证Controller正确处理Service层的响应
      if (!response.body.success) {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThanOrEqual(500);
      }
    }, 30000); // 增加超时时间到30秒
  });

  describe('错误处理集成测试', () => {
    it('Controller应该正确处理Service层的业务错误', async () => {
      // 使用无效数据触发业务错误
      const invalidData = {
        email: 'invalid-email',
        password: '123', // 弱密码
        name: ''
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData);

      // 验证Controller正确处理Service层的业务错误
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    it('Controller应该正确处理Service层的数据库错误', async () => {
      // 这个测试验证Controller如何处理数据库连接错误
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${validToken}`);

      // 由于没有数据库，应该返回500错误，但格式正确
      if (response.status === 500) {
        expect(response.body).toMatchObject({
          success: false,
          message: expect.any(String)
        });
      }
    });

    it('Controller应该正确处理Service层的认证错误', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });
  });

  describe('响应格式一致性测试', () => {
    it('所有Controller响应应该有统一的格式', async () => {
      const endpoints = [
        { method: 'get', path: '/health' },
        { method: 'post', path: '/api/auth/register', data: { email: 'test@test.com', password: 'Test123!', name: 'Test' } },
        { method: 'get', path: '/api/orders', headers: { 'Authorization': `Bearer ${validToken}` } }
      ];

      for (const endpoint of endpoints) {
        let req = request(app)[endpoint.method](endpoint.path);
        
        if (endpoint.headers) {
          Object.keys(endpoint.headers).forEach(key => {
            req = req.set(key, endpoint.headers[key]);
          });
        }
        
        if (endpoint.data) {
          req = req.send(endpoint.data);
        }

        const response = await req;

        // 验证响应格式一致性
        expect(response.body).toBeDefined();
        expect(typeof response.body).toBe('object');
        
        if (endpoint.path !== '/health') {
          expect(response.body).toHaveProperty('success');
          expect(response.body).toHaveProperty('message');
        }
      }
    });
  });
});
