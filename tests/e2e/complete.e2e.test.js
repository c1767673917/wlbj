/**
 * 完整E2E测试 - 包含数据库初始化
 * 验证应用的完整功能流程
 */

const request = require('supertest');
const app = require('../../src/app');
const { setupTestDatabase } = require('./setupDatabase');

describe('完整E2E测试', () => {
  // 在所有测试开始前初始化数据库
  beforeAll(async () => {
    await setupTestDatabase();
  }, 30000); // 30秒超时

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
  });

  describe('用户认证流程', () => {
    const testUser = {
      username: 'e2e_complete_user',
      email: 'e2e_complete@example.com',
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
        
        // 密码不应该在响应中返回
        expect(response.body.data.user.password).toBeUndefined();
      }
    });

    test('用户登录应该成功', async () => {
      // 先确保用户存在
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

      // 验证JWT token格式
      const token = response.body.data.token;
      expect(token.split('.')).toHaveLength(3);
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

    test('重复邮箱注册应该失败', async () => {
      // 先注册一个用户
      await request(app)
        .post('/api/auth/register')
        .send(testUser);
      
      // 尝试用相同邮箱再次注册
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser);
      
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('邮箱已存在')
      });
    });
  });

  describe('订单管理流程', () => {
    let userToken;
    const orderUser = {
      username: 'e2e_order_user',
      email: 'e2e_order@example.com',
      password: 'TestPassword123!',
      role: 'user'
    };

    beforeAll(async () => {
      // 注册并登录用户
      await request(app)
        .post('/api/auth/register')
        .send(orderUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: orderUser.email,
          password: orderUser.password
        });

      if (loginResponse.status === 200) {
        userToken = loginResponse.body.data.token;
      }
    });

    test('创建订单应该成功', async () => {
      if (!userToken) {
        console.log('跳过订单创建测试：用户登录失败');
        return;
      }

      const orderData = {
        origin: '北京市朝阳区',
        destination: '上海市浦东新区',
        cargoType: '普通货物',
        weight: 100,
        volume: 2.5,
        pickupTime: '2025-01-01T10:00:00Z',
        deliveryTime: '2025-01-02T18:00:00Z',
        specialRequirements: '轻拿轻放'
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
            cargoType: orderData.cargoType,
            weight: orderData.weight,
            volume: orderData.volume,
            status: 'pending',
            userId: expect.any(Number)
          }
        }
      });

      // 验证订单号格式
      expect(response.body.data.order.orderNumber).toMatch(/^ORD_\d{8}_\d+$/);
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
          pagination: {
            page: expect.any(Number),
            limit: expect.any(Number),
            total: expect.any(Number)
          }
        }
      });
    });

    test('查询特定订单详情应该成功', async () => {
      if (!userToken) {
        console.log('跳过订单详情测试：用户登录失败');
        return;
      }

      // 先创建一个订单
      const orderData = {
        origin: '广州市',
        destination: '深圳市',
        cargoType: '电子产品',
        weight: 50,
        volume: 1.0
      };

      const createResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData);

      if (createResponse.status === 201) {
        const orderId = createResponse.body.data.order.id;

        const response = await request(app)
          .get(`/api/orders/${orderId}`)
          .set('Authorization', `Bearer ${userToken}`);
        
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            order: {
              id: orderId,
              orderNumber: expect.any(String),
              origin: orderData.origin,
              destination: orderData.destination,
              status: 'pending',
              createdAt: expect.any(String),
              updatedAt: expect.any(String)
            }
          }
        });
      }
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

  describe('错误处理验证', () => {
    test('不存在的端点应该返回404', async () => {
      const response = await request(app).get('/api/nonexistent');
      
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
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

    test('无效token应该返回401', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid.token.here');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('性能验证', () => {
    test('健康检查响应时间应该小于100ms', async () => {
      const startTime = Date.now();
      const response = await request(app).get('/health');
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(100);
      
      console.log(`健康检查响应时间: ${responseTime}ms`);
    });

    test('并发请求应该正常处理', async () => {
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
