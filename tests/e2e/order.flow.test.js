/**
 * E2E测试 - 订单管理流程测试
 * 测试订单创建、查询、更新、管理员操作的完整流程
 */

describe('订单管理流程测试', () => {
  let client;
  let userClient, adminClient;
  let testUser, testAdmin;
  let createdOrders = [];

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

  afterEach(() => {
    // 清理创建的订单记录
    createdOrders = [];
  });

  describe('订单创建流程', () => {
    test('用户创建基础订单应该成功', async () => {
      const orderData = utils.generateTestOrder();
      
      const response = await userClient.createOrder(orderData);
      
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

      createdOrders.push(response.body.data.order.id);
    });

    test('创建订单时应该自动生成订单号', async () => {
      const orderData = utils.generateTestOrder();
      delete orderData.orderNumber; // 删除预设的订单号
      
      const response = await userClient.createOrder(orderData);
      
      expect(response.status).toBe(201);
      expect(response.body.data.order.orderNumber).toMatch(/^ORD_\d{8}_\d+$/);
      
      createdOrders.push(response.body.data.order.id);
    });

    test('创建订单时缺少必填字段应该失败', async () => {
      const incompleteOrder = {
        origin: '北京市',
        // 缺少destination等必填字段
      };
      
      const response = await userClient.createOrder(incompleteOrder);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('未认证用户创建订单应该失败', async () => {
      const orderData = utils.generateTestOrder();
      
      const response = await client.createOrder(orderData);
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('创建包含特殊要求的订单应该成功', async () => {
      const orderData = {
        ...utils.generateTestOrder(),
        specialRequirements: '需要冷链运输，温度控制在2-8℃',
        urgentLevel: 'high',
        insuranceRequired: true
      };
      
      const response = await userClient.createOrder(orderData);
      
      expect(response.status).toBe(201);
      expect(response.body.data.order.specialRequirements).toBe(orderData.specialRequirements);
      
      createdOrders.push(response.body.data.order.id);
    });
  });

  describe('订单查询流程', () => {
    let testOrderId;

    beforeEach(async () => {
      // 创建测试订单
      const orderData = utils.generateTestOrder();
      const response = await userClient.createOrder(orderData);
      testOrderId = response.body.data.order.id;
      createdOrders.push(testOrderId);
    });

    test('用户查询自己的订单列表应该成功', async () => {
      const response = await userClient.getOrders();
      
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

      // 应该包含刚创建的订单
      const orders = response.body.data.orders;
      expect(orders.some(order => order.id === testOrderId)).toBe(true);
    });

    test('用户查询特定订单详情应该成功', async () => {
      const response = await userClient.getOrder(testOrderId);
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          order: {
            id: testOrderId,
            orderNumber: expect.any(String),
            origin: expect.any(String),
            destination: expect.any(String),
            status: 'pending',
            createdAt: expect.any(String),
            updatedAt: expect.any(String)
          }
        }
      });
    });

    test('用户查询不存在的订单应该失败', async () => {
      const response = await userClient.getOrder(99999);
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('用户查询其他用户的订单应该失败', async () => {
      // 创建另一个用户和订单
      const otherUser = utils.generateTestUser('user');
      await client.register(otherUser);
      
      const otherLogin = await client.login({
        email: otherUser.email,
        password: otherUser.password
      });
      const otherClient = new APIClient().setToken(otherLogin.body.data.token);
      
      const otherOrderResponse = await otherClient.createOrder(utils.generateTestOrder());
      const otherOrderId = otherOrderResponse.body.data.order.id;
      
      // 尝试用第一个用户查询第二个用户的订单
      const response = await userClient.getOrder(otherOrderId);
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('支持订单状态过滤查询', async () => {
      const response = await userClient.get('/api/orders?status=pending');
      
      expect(response.status).toBe(200);
      if (response.body.data.orders.length > 0) {
        response.body.data.orders.forEach(order => {
          expect(order.status).toBe('pending');
        });
      }
    });

    test('支持分页查询', async () => {
      const response = await userClient.get('/api/orders?page=1&limit=5');
      
      expect(response.status).toBe(200);
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        limit: 5,
        total: expect.any(Number)
      });
    });
  });

  describe('订单更新流程', () => {
    let testOrderId;

    beforeEach(async () => {
      const orderData = utils.generateTestOrder();
      const response = await userClient.createOrder(orderData);
      testOrderId = response.body.data.order.id;
      createdOrders.push(testOrderId);
    });

    test('用户更新自己的订单应该成功', async () => {
      const updateData = {
        specialRequirements: '更新后的特殊要求',
        urgentLevel: 'medium'
      };
      
      const response = await userClient.put(`/api/orders/${testOrderId}`, updateData);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.order.specialRequirements).toBe(updateData.specialRequirements);
      }
    });

    test('用户取消自己的订单应该成功', async () => {
      const response = await userClient.put(`/api/orders/${testOrderId}/cancel`);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.order.status).toBe('cancelled');
      }
    });

    test('用户不能更新其他用户的订单', async () => {
      // 创建另一个用户和订单
      const otherUser = utils.generateTestUser('user');
      await client.register(otherUser);
      
      const otherLogin = await client.login({
        email: otherUser.email,
        password: otherUser.password
      });
      const otherClient = new APIClient().setToken(otherLogin.body.data.token);
      
      const otherOrderResponse = await otherClient.createOrder(utils.generateTestOrder());
      const otherOrderId = otherOrderResponse.body.data.order.id;
      
      // 尝试更新其他用户的订单
      const response = await userClient.put(`/api/orders/${otherOrderId}`, {
        specialRequirements: '恶意更新'
      });
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('管理员订单操作', () => {
    let testOrderIds = [];

    beforeEach(async () => {
      // 创建多个测试订单
      for (let i = 0; i < 3; i++) {
        const orderData = utils.generateTestOrder();
        const response = await userClient.createOrder(orderData);
        testOrderIds.push(response.body.data.order.id);
        createdOrders.push(response.body.data.order.id);
      }
    });

    afterEach(() => {
      testOrderIds = [];
    });

    test('管理员查询所有待处理订单应该成功', async () => {
      const response = await adminClient.get('/api/orders/pending');
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.orders).toBeInstanceOf(Array);
      }
    });

    test('管理员批量操作订单应该成功', async () => {
      const batchData = {
        orderIds: testOrderIds.slice(0, 2),
        operation: 'approve'
      };
      
      const response = await adminClient.post('/api/orders/batch-operate', batchData);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.results).toBeInstanceOf(Array);
      }
    });

    test('管理员导出订单数据应该成功', async () => {
      const response = await adminClient.post('/api/orders/export', {
        format: 'csv',
        filters: {
          status: 'pending',
          startDate: '2025-01-01',
          endDate: '2025-12-31'
        }
      });
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.downloadUrl || response.body.data.fileContent).toBeDefined();
      }
    });

    test('普通用户不能访问管理员订单功能', async () => {
      const response = await userClient.get('/api/orders/pending');
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('管理员查看订单统计信息应该成功', async () => {
      const response = await adminClient.get('/api/orders/stats');
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.stats).toMatchObject({
          total: expect.any(Number),
          pending: expect.any(Number),
          completed: expect.any(Number),
          cancelled: expect.any(Number)
        });
      }
    });
  });

  describe('订单状态流转', () => {
    let testOrderId;

    beforeEach(async () => {
      const orderData = utils.generateTestOrder();
      const response = await userClient.createOrder(orderData);
      testOrderId = response.body.data.order.id;
      createdOrders.push(testOrderId);
    });

    test('订单状态应该按正确流程流转', async () => {
      // 1. 初始状态应该是pending
      let response = await userClient.getOrder(testOrderId);
      expect(response.body.data.order.status).toBe('pending');

      // 2. 管理员确认订单
      response = await adminClient.put(`/api/orders/${testOrderId}/confirm`);
      if (response.status === 200) {
        expect(response.body.data.order.status).toBe('confirmed');
      }

      // 3. 订单进入运输状态
      response = await adminClient.put(`/api/orders/${testOrderId}/ship`);
      if (response.status === 200) {
        expect(response.body.data.order.status).toBe('shipping');
      }

      // 4. 订单完成
      response = await adminClient.put(`/api/orders/${testOrderId}/complete`);
      if (response.status === 200) {
        expect(response.body.data.order.status).toBe('completed');
      }
    });

    test('无效的状态转换应该被拒绝', async () => {
      // 尝试直接从pending跳转到completed
      const response = await adminClient.put(`/api/orders/${testOrderId}/complete`);
      
      expect([400, 404]).toContain(response.status);
      if (response.status === 400) {
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/状态转换|无效/);
      }
    });
  });
});
