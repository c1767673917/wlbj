/**
 * E2E测试 - 错误处理和边界测试
 * 测试各种错误情况和边界条件的处理
 */

describe('错误处理和边界测试', () => {
  let client;
  let userClient, adminClient;
  let testUser, testAdmin;

  beforeAll(async () => {
    client = new APIClient();
    userClient = new APIClient();
    adminClient = new APIClient();

    // 创建测试用户
    testUser = utils.generateTestUser('user');
    testAdmin = utils.generateTestUser('admin');

    // 注册用户
    await client.register(testUser);
    await client.register(testAdmin);

    // 登录获取token
    const userLogin = await client.login({
      email: testUser.email,
      password: testUser.password
    });
    userClient.setToken(userLogin.body.data.token);

    const adminLogin = await client.login({
      email: testAdmin.email,
      password: testAdmin.password
    });
    adminClient.setToken(adminLogin.body.data.token);
  });

  describe('HTTP错误处理', () => {
    test('404错误应该返回统一格式', async () => {
      const response = await client.get('/api/nonexistent-endpoint');
      
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String),
        error: expect.any(String)
      });
    });

    test('405错误（方法不允许）应该正确处理', async () => {
      const response = await client.delete('/health'); // health端点不支持DELETE
      
      expect(response.status).toBe(405);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('方法不允许')
      });
    });

    test('500错误应该返回通用错误信息', async () => {
      // 尝试触发服务器错误（如果有相应的测试端点）
      const response = await client.get('/api/test/server-error');
      
      if (response.status === 500) {
        expect(response.body).toMatchObject({
          success: false,
          message: expect.any(String)
        });
        
        // 确保不暴露敏感信息
        expect(response.body.message).not.toContain('stack');
        expect(response.body.message).not.toContain('password');
        expect(response.body.message).not.toContain('secret');
      }
    });
  });

  describe('认证和授权错误', () => {
    test('无效token应该返回401错误', async () => {
      const invalidClient = new APIClient().setToken('invalid.jwt.token');
      const response = await invalidClient.get('/api/users/profile');
      
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('token')
      });
    });

    test('过期token应该返回401错误', async () => {
      // 使用明显过期的token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNjA5NDU5MjAwLCJleHAiOjE2MDk0NjI4MDB9.invalid';
      const expiredClient = new APIClient().setToken(expiredToken);
      
      const response = await expiredClient.get('/api/users/profile');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('权限不足应该返回403错误', async () => {
      const response = await userClient.get('/api/orders/pending'); // 需要管理员权限
      
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('权限')
      });
    });

    test('缺少Authorization头应该返回401错误', async () => {
      const response = await client.get('/api/users/profile');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('输入验证错误', () => {
    test('无效邮箱格式应该返回400错误', async () => {
      const invalidUser = {
        username: 'testuser',
        email: 'invalid-email-format',
        password: 'ValidPass123!',
        role: 'user'
      };
      
      const response = await client.register(invalidUser);
      
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('邮箱')
      });
    });

    test('弱密码应该返回400错误', async () => {
      const weakPasswordUser = {
        username: 'testuser',
        email: 'test@example.com',
        password: '123', // 弱密码
        role: 'user'
      };
      
      const response = await client.register(weakPasswordUser);
      
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('密码')
      });
    });

    test('缺少必填字段应该返回400错误', async () => {
      const incompleteOrder = {
        origin: '北京市',
        // 缺少destination等必填字段
      };
      
      const response = await userClient.createOrder(incompleteOrder);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('无效数据类型应该返回400错误', async () => {
      const invalidOrder = {
        origin: '北京市',
        destination: '上海市',
        weight: 'invalid_number', // 应该是数字
        volume: 2.5,
        cargoType: '普通货物'
      };
      
      const response = await userClient.createOrder(invalidOrder);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('超长字符串应该返回400错误', async () => {
      const longStringOrder = {
        origin: '北京市',
        destination: '上海市',
        weight: 100,
        volume: 2.5,
        cargoType: 'A'.repeat(1000), // 超长字符串
        specialRequirements: 'B'.repeat(2000)
      };
      
      const response = await userClient.createOrder(longStringOrder);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('资源不存在错误', () => {
    test('查询不存在的订单应该返回404错误', async () => {
      const response = await userClient.getOrder(99999);
      
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('订单')
      });
    });

    test('查询不存在的报价应该返回404错误', async () => {
      const response = await userClient.get('/api/quotes/99999');
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('查询不存在的用户应该返回404错误', async () => {
      const response = await adminClient.get('/api/users/99999');
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('业务逻辑错误', () => {
    test('重复注册相同邮箱应该返回409错误', async () => {
      const userData = utils.generateTestUser('user');
      
      // 第一次注册
      await client.register(userData);
      
      // 第二次注册相同邮箱
      const response = await client.register(userData);
      
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('邮箱已存在')
      });
    });

    test('对不存在的订单创建报价应该返回404错误', async () => {
      const quoteData = {
        orderId: 99999,
        price: 1500.00,
        estimatedDays: 3,
        description: '测试报价'
      };
      
      // 需要先创建供应商用户
      const provider = utils.generateTestUser('provider');
      await client.register(provider);
      const providerLogin = await client.login({
        email: provider.email,
        password: provider.password
      });
      const providerClient = new APIClient().setToken(providerLogin.body.data.token);
      
      const response = await providerClient.createQuote(quoteData);
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('用户访问其他用户的订单应该返回403错误', async () => {
      // 创建另一个用户和订单
      const otherUser = utils.generateTestUser('user');
      await client.register(otherUser);
      
      const otherLogin = await client.login({
        email: otherUser.email,
        password: otherUser.password
      });
      const otherClient = new APIClient().setToken(otherLogin.body.data.token);
      
      const orderData = utils.generateTestOrder();
      const orderResponse = await otherClient.createOrder(orderData);
      
      if (orderResponse.status === 201) {
        const otherOrderId = orderResponse.body.data.order.id;
        
        // 尝试用第一个用户访问第二个用户的订单
        const response = await userClient.getOrder(otherOrderId);
        
        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('边界值测试', () => {
    test('最大重量限制测试', async () => {
      const heavyOrder = {
        origin: '北京市',
        destination: '上海市',
        weight: 100000, // 假设最大重量限制
        volume: 2.5,
        cargoType: '重型货物'
      };
      
      const response = await userClient.createOrder(heavyOrder);
      
      // 根据业务规则，可能返回400（超出限制）或201（允许）
      expect([201, 400]).toContain(response.status);
      if (response.status === 400) {
        expect(response.body.message).toMatch(/重量|限制/);
      }
    });

    test('最小价格限制测试', async () => {
      // 先创建订单
      const orderData = utils.generateTestOrder();
      const orderResponse = await userClient.createOrder(orderData);
      
      if (orderResponse.status === 201) {
        const orderId = orderResponse.body.data.order.id;
        
        // 创建供应商
        const provider = utils.generateTestUser('provider');
        await client.register(provider);
        const providerLogin = await client.login({
          email: provider.email,
          password: provider.password
        });
        const providerClient = new APIClient().setToken(providerLogin.body.data.token);
        
        const lowPriceQuote = {
          orderId: orderId,
          price: 0.01, // 极低价格
          estimatedDays: 3,
          description: '测试最低价格'
        };
        
        const response = await providerClient.createQuote(lowPriceQuote);
        
        // 根据业务规则，可能返回400（价格过低）或201（允许）
        expect([201, 400]).toContain(response.status);
        if (response.status === 400) {
          expect(response.body.message).toMatch(/价格|最低/);
        }
      }
    });

    test('空字符串处理测试', async () => {
      const emptyStringOrder = {
        origin: '',
        destination: '',
        weight: 100,
        volume: 2.5,
        cargoType: ''
      };
      
      const response = await userClient.createOrder(emptyStringOrder);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('特殊字符处理测试', async () => {
      const specialCharOrder = {
        origin: '北京市<script>alert("xss")</script>',
        destination: '上海市\'; DROP TABLE orders; --',
        weight: 100,
        volume: 2.5,
        cargoType: '普通货物',
        specialRequirements: '<img src="x" onerror="alert(1)">'
      };
      
      const response = await userClient.createOrder(specialCharOrder);
      
      // 应该正确处理特殊字符，不应该导致错误
      if (response.status === 201) {
        // 验证特殊字符被正确转义或过滤
        const order = response.body.data.order;
        expect(order.origin).not.toContain('<script>');
        expect(order.destination).not.toContain('DROP TABLE');
        expect(order.specialRequirements).not.toContain('<img');
      }
    });
  });

  describe('并发和竞态条件测试', () => {
    test('并发创建订单应该正确处理', async () => {
      const promises = [];
      
      // 同时创建多个订单
      for (let i = 0; i < 5; i++) {
        const orderData = utils.generateTestOrder();
        promises.push(userClient.createOrder(orderData));
      }
      
      const responses = await Promise.all(promises);
      
      // 所有请求都应该成功或失败，不应该有未处理的错误
      responses.forEach(response => {
        expect([201, 400, 500]).toContain(response.status);
        expect(response.body).toHaveProperty('success');
      });
    });

    test('并发登录应该正确处理', async () => {
      const promises = [];
      
      // 同时进行多次登录
      for (let i = 0; i < 3; i++) {
        promises.push(client.login({
          email: testUser.email,
          password: testUser.password
        }));
      }
      
      const responses = await Promise.all(promises);
      
      // 所有登录都应该成功
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.token).toBeDefined();
      });
    });
  });

  describe('网络和超时错误', () => {
    test('请求超时应该正确处理', async () => {
      // 这个测试需要模拟网络超时，实际实现可能需要特殊的测试端点
      const response = await client.get('/api/test/timeout');
      
      if (response.status === 408 || response.status === 504) {
        expect(response.body).toMatchObject({
          success: false,
          message: expect.stringContaining('超时')
        });
      }
    }, 15000); // 增加测试超时时间

    test('大请求体应该正确处理', async () => {
      const largeData = {
        origin: '北京市',
        destination: '上海市',
        weight: 100,
        volume: 2.5,
        cargoType: '普通货物',
        specialRequirements: 'A'.repeat(10000) // 大量数据
      };
      
      const response = await userClient.createOrder(largeData);
      
      // 根据服务器配置，可能返回413（请求体过大）或正常处理
      expect([201, 400, 413]).toContain(response.status);
      if (response.status === 413) {
        expect(response.body.message).toMatch(/大小|限制/);
      }
    });
  });
});
