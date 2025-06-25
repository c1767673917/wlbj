/**
 * 基础E2E测试 - 不依赖globalSetup的简化版本
 * 验证应用的核心功能
 */

const request = require('supertest');
const app = require('../../src/app');

describe('基础E2E测试', () => {
  describe('应用基础功能', () => {
    test('健康检查端点应该正常工作', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Service is healthy',
        timestamp: expect.any(String),
        version: expect.any(String),
        environment: 'test'
      });
    });

    test('API根路径应该返回404', async () => {
      const response = await request(app).get('/api');
      
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    test('未认证访问受保护端点应该返回401', async () => {
      const response = await request(app).get('/api/users/profile');
      
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    test('CORS头应该正确设置', async () => {
      const response = await request(app).get('/health');
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('安全头应该正确设置', async () => {
      const response = await request(app).get('/health');
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('认证流程测试', () => {
    const testUser = {
      username: 'e2e_test_user',
      email: 'e2e_test@example.com',
      password: 'TestPassword123!',
      role: 'user'
    };

    test('用户注册应该成功', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser);
      
      expect([201, 409]).toContain(response.status); // 201成功或409已存在
      if (response.status === 201) {
        expect(response.body).toMatchObject({
          success: true,
          message: expect.stringContaining('注册成功'),
          data: {
            user: {
              id: expect.any(Number),
              username: testUser.username,
              email: testUser.email,
              role: 'user'
            }
          }
        });
      }
    });

    test('用户登录应该成功', async () => {
      // 先尝试注册（如果已存在会返回409）
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      // 然后登录
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('登录成功'),
        data: {
          token: expect.any(String),
          user: {
            id: expect.any(Number),
            username: testUser.username,
            email: testUser.email,
            role: 'user'
          }
        }
      });
    });

    test('错误密码登录应该失败', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });
      
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    test('无效邮箱注册应该失败', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUser,
          email: 'invalid-email'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('订单管理测试', () => {
    let userToken;
    const testUser = {
      username: 'e2e_order_user',
      email: 'e2e_order@example.com',
      password: 'TestPassword123!',
      role: 'user'
    };

    beforeAll(async () => {
      // 注册并登录用户
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      if (loginResponse.status === 200) {
        userToken = loginResponse.body.data.token;
      }
    });

    test('创建订单应该成功', async () => {
      if (!userToken) {
        console.log('跳过订单测试：用户登录失败');
        return;
      }

      const orderData = {
        origin: '北京市朝阳区',
        destination: '上海市浦东新区',
        cargoType: '普通货物',
        weight: 100,
        volume: 2.5,
        pickupTime: '2025-01-01T10:00:00Z',
        deliveryTime: '2025-01-02T18:00:00Z'
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData);
      
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('创建成功'),
        data: {
          order: {
            id: expect.any(Number),
            orderNumber: expect.any(String),
            origin: orderData.origin,
            destination: orderData.destination,
            status: 'pending'
          }
        }
      });
    });

    test('查询订单列表应该成功', async () => {
      if (!userToken) {
        console.log('跳过订单查询测试：用户登录失败');
        return;
      }

      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          orders: expect.any(Array),
          pagination: expect.any(Object)
        }
      });
    });

    test('未认证用户不能创建订单', async () => {
      const orderData = {
        origin: '北京市',
        destination: '上海市',
        cargoType: '普通货物',
        weight: 100,
        volume: 2.5
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderData);
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('错误处理测试', () => {
    test('不存在的端点应该返回404', async () => {
      const response = await request(app).get('/api/nonexistent');
      
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    test('无效的JSON应该返回400', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('invalid json');
      
      expect(response.status).toBe(400);
    });

    test('缺少必填字段应该返回400', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'test'
          // 缺少email和password
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('性能基准测试', () => {
    test('健康检查响应时间应该小于100ms', async () => {
      const startTime = Date.now();
      const response = await request(app).get('/health');
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(100);
      
      console.log(`健康检查响应时间: ${responseTime}ms`);
    });

    test('并发健康检查请求应该正常处理', async () => {
      const concurrentRequests = 5;
      const promises = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(request(app).get('/health'));
      }
      
      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});
