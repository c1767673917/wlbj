/**
 * 订单管理流程集成测试
 * 测试订单创建、查询、更新、取消等完整流程
 */

const request = require('supertest');
const { TEST_CONFIG, getAuthHeaders, generateTestData } = require('./config');
const { ApiHelper, DatabaseHelper, ResponseValidator } = require('./helpers');

describe('订单管理流程集成测试', () => {
  let app;
  let apiHelper;
  let dbHelper;
  let responseValidator;
  let testUser1, testUser2, adminUser;
  let user1Token, user2Token, adminToken;

  beforeAll(async () => {
    // 初始化测试环境
    const { createTestApp } = require('./setup');
    app = await createTestApp();
    
    apiHelper = new ApiHelper(app);
    dbHelper = new DatabaseHelper();
    responseValidator = new ResponseValidator();
    
    // 确保数据库连接
    await dbHelper.connect();
  });

  afterAll(async () => {
    // 清理测试环境
    await dbHelper.cleanup();
    await dbHelper.disconnect();
  });

  beforeEach(async () => {
    // 每个测试前清理数据
    await dbHelper.clearTestData();
    
    // 创建测试用户
    const testData1 = generateTestData();
    const testData2 = generateTestData();
    const adminData = generateTestData();
    
    testUser1 = testData1.user;
    testUser2 = testData2.user;
    adminUser = { ...adminData.user, role: 'admin' };

    // 注册用户
    await request(app)
      .post(TEST_CONFIG.endpoints.auth.register)
      .send(testUser1)
      .expect(201);

    await request(app)
      .post(TEST_CONFIG.endpoints.auth.register)
      .send(testUser2)
      .expect(201);

    await request(app)
      .post(TEST_CONFIG.endpoints.auth.register)
      .send(adminUser)
      .expect(201);

    // 获取认证token
    const login1 = await request(app)
      .post(TEST_CONFIG.endpoints.auth.login)
      .send({ email: testUser1.email, password: testUser1.password })
      .expect(200);
    user1Token = login1.body.data.token;

    const login2 = await request(app)
      .post(TEST_CONFIG.endpoints.auth.login)
      .send({ email: testUser2.email, password: testUser2.password })
      .expect(200);
    user2Token = login2.body.data.token;

    const adminLogin = await request(app)
      .post(TEST_CONFIG.endpoints.auth.login)
      .send({ email: adminUser.email, password: adminUser.password })
      .expect(200);
    adminToken = adminLogin.body.data.token;
  });

  describe('订单创建流程', () => {
    it('应该成功创建新订单', async () => {
      const testData = generateTestData();
      const orderData = testData.order;

      const response = await request(app)
        .post(TEST_CONFIG.endpoints.orders.create)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(orderData)
        .expect(201);

      responseValidator.validateSuccessResponse(response.body);
      
      // 验证订单数据
      expect(response.body.data).toMatchObject({
        warehouse: orderData.warehouse,
        goods: orderData.goods,
        deliveryAddress: orderData.deliveryAddress,
        status: 'active'
      });
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.id).toMatch(/^ORD-\d{8}-\d{3}$/); // 订单ID格式

      // 验证数据库中的订单
      const dbOrder = await dbHelper.findOrderById(response.body.data.id);
      expect(dbOrder).toBeTruthy();
      expect(dbOrder.userId).toBe(testUser1.id);
    });

    it('应该验证必需字段', async () => {
      const response = await request(app)
        .post(TEST_CONFIG.endpoints.orders.create)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          warehouse: 'Test Warehouse'
          // 缺少 goods 和 deliveryAddress
        })
        .expect(400);

      responseValidator.validateErrorResponse(response.body);
      expect(response.body.message).toContain('缺少必需参数');
    });

    it('应该拒绝未认证的请求', async () => {
      const testData = generateTestData();
      const orderData = testData.order;

      const response = await request(app)
        .post(TEST_CONFIG.endpoints.orders.create)
        .send(orderData)
        .expect(401);

      responseValidator.validateErrorResponse(response.body);
    });
  });

  describe('订单查询流程', () => {
    let order1, order2;

    beforeEach(async () => {
      // 创建测试订单
      const testData1 = generateTestData();
      const testData2 = generateTestData();

      const response1 = await request(app)
        .post(TEST_CONFIG.endpoints.orders.create)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(testData1.order)
        .expect(201);
      order1 = response1.body.data;

      const response2 = await request(app)
        .post(TEST_CONFIG.endpoints.orders.create)
        .set('Authorization', `Bearer ${user2Token}`)
        .send(testData2.order)
        .expect(201);
      order2 = response2.body.data;
    });

    it('应该成功获取用户自己的订单列表', async () => {
      const response = await request(app)
        .get(TEST_CONFIG.endpoints.orders.base)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      
      // 用户1只能看到自己的订单
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(order1.id);
    });

    it('应该成功获取订单详情', async () => {
      const response = await request(app)
        .get(TEST_CONFIG.endpoints.orders.getById(order1.id))
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      
      expect(response.body.data).toMatchObject({
        id: order1.id,
        warehouse: order1.warehouse,
        goods: order1.goods,
        deliveryAddress: order1.deliveryAddress
      });
    });

    it('应该拒绝访问其他用户的订单', async () => {
      const response = await request(app)
        .get(TEST_CONFIG.endpoints.orders.getById(order2.id))
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(403);

      responseValidator.validateErrorResponse(response.body);
      expect(response.body.message).toContain('无权访问');
    });

    it('管理员应该能够查看所有订单', async () => {
      const response = await request(app)
        .get(TEST_CONFIG.endpoints.orders.base)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      
      // 管理员可以看到所有订单
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('应该支持订单搜索和过滤', async () => {
      const response = await request(app)
        .get(TEST_CONFIG.endpoints.orders.base)
        .query({
          search: order1.warehouse,
          status: 'active'
        })
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(order1.id);
    });

    it('应该支持分页查询', async () => {
      const response = await request(app)
        .get(TEST_CONFIG.endpoints.orders.base)
        .query({
          page: 1,
          limit: 1
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      
      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.pagination).toMatchObject({
        page: 1,
        limit: 1,
        total: expect.any(Number)
      });
    });
  });

  describe('订单更新流程', () => {
    let testOrder;

    beforeEach(async () => {
      // 创建测试订单
      const testData = generateTestData();
      const response = await request(app)
        .post(TEST_CONFIG.endpoints.orders.create)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(testData.order)
        .expect(201);
      testOrder = response.body.data;
    });

    it('应该成功更新订单信息', async () => {
      const updateData = {
        warehouse: 'Updated Warehouse',
        goods: 'Updated Goods',
        deliveryAddress: 'Updated Address'
      };

      const response = await request(app)
        .put(TEST_CONFIG.endpoints.orders.update(testOrder.id))
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateData)
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      
      expect(response.body.data).toMatchObject({
        id: testOrder.id,
        ...updateData
      });

      // 验证数据库中的更新
      const dbOrder = await dbHelper.findOrderById(testOrder.id);
      expect(dbOrder.warehouse).toBe(updateData.warehouse);
    });

    it('应该拒绝更新其他用户的订单', async () => {
      const updateData = {
        warehouse: 'Updated Warehouse'
      };

      const response = await request(app)
        .put(TEST_CONFIG.endpoints.orders.update(testOrder.id))
        .set('Authorization', `Bearer ${user2Token}`)
        .send(updateData)
        .expect(403);

      responseValidator.validateErrorResponse(response.body);
    });

    it('应该拒绝更新不存在的订单', async () => {
      const updateData = {
        warehouse: 'Updated Warehouse'
      };

      const response = await request(app)
        .put(TEST_CONFIG.endpoints.orders.update('ORD-99999999-999'))
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateData)
        .expect(404);

      responseValidator.validateErrorResponse(response.body);
    });
  });

  describe('订单取消流程', () => {
    let testOrder;

    beforeEach(async () => {
      // 创建测试订单
      const testData = generateTestData();
      const response = await request(app)
        .post(TEST_CONFIG.endpoints.orders.create)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(testData.order)
        .expect(201);
      testOrder = response.body.data;
    });

    it('应该成功取消订单', async () => {
      const cancelData = {
        reason: '用户主动取消'
      };

      const response = await request(app)
        .post(TEST_CONFIG.endpoints.orders.cancel(testOrder.id))
        .set('Authorization', `Bearer ${user1Token}`)
        .send(cancelData)
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      
      expect(response.body.data.status).toBe('cancelled');
      expect(response.body.data.cancelReason).toBe(cancelData.reason);

      // 验证数据库中的状态
      const dbOrder = await dbHelper.findOrderById(testOrder.id);
      expect(dbOrder.status).toBe('cancelled');
    });

    it('应该拒绝取消其他用户的订单', async () => {
      const response = await request(app)
        .post(TEST_CONFIG.endpoints.orders.cancel(testOrder.id))
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ reason: '测试取消' })
        .expect(403);

      responseValidator.validateErrorResponse(response.body);
    });

    it('应该拒绝重复取消订单', async () => {
      // 先取消一次
      await request(app)
        .post(TEST_CONFIG.endpoints.orders.cancel(testOrder.id))
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ reason: '第一次取消' })
        .expect(200);

      // 再次取消
      const response = await request(app)
        .post(TEST_CONFIG.endpoints.orders.cancel(testOrder.id))
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ reason: '第二次取消' })
        .expect(400);

      responseValidator.validateErrorResponse(response.body);
      expect(response.body.message).toContain('订单已被取消');
    });
  });
});
