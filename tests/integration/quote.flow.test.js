/**
 * 报价管理流程集成测试
 * 测试供应商报价创建、查询、更新等完整流程
 */

const request = require('supertest');
const { TEST_CONFIG, getAuthHeaders, getProviderHeaders, generateTestData } = require('./config');
const { ApiHelper, DatabaseHelper, ResponseValidator } = require('./helpers');

describe('报价管理流程集成测试', () => {
  let app;
  let apiHelper;
  let dbHelper;
  let responseValidator;
  let testUser, adminUser;
  let userToken, adminToken;
  let testOrder;
  let testProvider1, testProvider2;

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
    const userData = generateTestData();
    const adminData = generateTestData();
    
    testUser = userData.user;
    adminUser = { ...adminData.user, role: 'admin' };

    // 注册用户
    await request(app)
      .post(TEST_CONFIG.endpoints.auth.register)
      .send(testUser)
      .expect(201);

    await request(app)
      .post(TEST_CONFIG.endpoints.auth.register)
      .send(adminUser)
      .expect(201);

    // 获取认证token
    const userLogin = await request(app)
      .post(TEST_CONFIG.endpoints.auth.login)
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);
    userToken = userLogin.body.data.token;

    const adminLogin = await request(app)
      .post(TEST_CONFIG.endpoints.auth.login)
      .send({ email: adminUser.email, password: adminUser.password })
      .expect(200);
    adminToken = adminLogin.body.data.token;

    // 创建测试订单
    const orderData = generateTestData();
    const orderResponse = await request(app)
      .post(TEST_CONFIG.endpoints.orders.create)
      .set('Authorization', `Bearer ${userToken}`)
      .send(orderData.order)
      .expect(201);
    testOrder = orderResponse.body.data;

    // 创建测试供应商
    testProvider1 = {
      name: 'Test Provider A',
      accessKey: 'test-access-key-a'
    };
    testProvider2 = {
      name: 'Test Provider B',
      accessKey: 'test-access-key-b'
    };

    await dbHelper.createProvider(testProvider1);
    await dbHelper.createProvider(testProvider2);
  });

  describe('供应商报价创建流程', () => {
    it('应该成功创建报价', async () => {
      const quoteData = {
        price: 150.50,
        estimatedDelivery: '2025-07-01T10:00:00.000Z',
        remarks: 'Test quote remarks'
      };

      const response = await request(app)
        .post(TEST_CONFIG.endpoints.quotes.createOrUpdate(testOrder.id))
        .set('x-provider-name', testProvider1.name)
        .set('x-access-key', testProvider1.accessKey)
        .send(quoteData)
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      
      // 验证报价数据
      expect(response.body.data).toMatchObject({
        orderId: testOrder.id,
        provider: testProvider1.name,
        price: quoteData.price,
        estimatedDelivery: quoteData.estimatedDelivery,
        remarks: quoteData.remarks
      });
      expect(response.body.data.id).toBeDefined();

      // 验证数据库中的报价
      const dbQuote = await dbHelper.findQuoteById(response.body.data.id);
      expect(dbQuote).toBeTruthy();
      expect(dbQuote.provider).toBe(testProvider1.name);
    });

    it('应该验证必需字段', async () => {
      const response = await request(app)
        .post(TEST_CONFIG.endpoints.quotes.createOrUpdate(testOrder.id))
        .set('x-provider-name', testProvider1.name)
        .set('x-access-key', testProvider1.accessKey)
        .send({
          price: 150.50
          // 缺少 estimatedDelivery
        })
        .expect(400);

      responseValidator.validateErrorResponse(response.body);
      expect(response.body.message).toContain('缺少必需参数');
    });

    it('应该验证供应商认证信息', async () => {
      const quoteData = {
        price: 150.50,
        estimatedDelivery: '2025-07-01T10:00:00.000Z'
      };

      const response = await request(app)
        .post(TEST_CONFIG.endpoints.quotes.createOrUpdate(testOrder.id))
        .send(quoteData)
        .expect(401);

      responseValidator.validateErrorResponse(response.body);
      expect(response.body.message).toContain('缺少供应商认证信息');
    });

    it('应该拒绝无效的访问密钥', async () => {
      const quoteData = {
        price: 150.50,
        estimatedDelivery: '2025-07-01T10:00:00.000Z'
      };

      const response = await request(app)
        .post(TEST_CONFIG.endpoints.quotes.createOrUpdate(testOrder.id))
        .set('x-provider-name', testProvider1.name)
        .set('x-access-key', 'invalid-access-key')
        .send(quoteData)
        .expect(401);

      responseValidator.validateErrorResponse(response.body);
      expect(response.body.message).toContain('无效的访问密钥');
    });

    it('应该验证价格格式', async () => {
      const quoteData = {
        price: 'invalid-price',
        estimatedDelivery: '2025-07-01T10:00:00.000Z'
      };

      const response = await request(app)
        .post(TEST_CONFIG.endpoints.quotes.createOrUpdate(testOrder.id))
        .set('x-provider-name', testProvider1.name)
        .set('x-access-key', testProvider1.accessKey)
        .send(quoteData)
        .expect(400);

      responseValidator.validateErrorResponse(response.body);
      expect(response.body.message).toContain('价格格式无效');
    });
  });

  describe('报价更新流程', () => {
    let existingQuote;

    beforeEach(async () => {
      // 创建初始报价
      const quoteData = {
        price: 150.50,
        estimatedDelivery: '2025-07-01T10:00:00.000Z',
        remarks: 'Initial quote'
      };

      const response = await request(app)
        .post(TEST_CONFIG.endpoints.quotes.createOrUpdate(testOrder.id))
        .set('x-provider-name', testProvider1.name)
        .set('x-access-key', testProvider1.accessKey)
        .send(quoteData)
        .expect(200);

      existingQuote = response.body.data;
    });

    it('应该成功更新现有报价', async () => {
      const updatedQuoteData = {
        price: 120.00,
        estimatedDelivery: '2025-06-30T10:00:00.000Z',
        remarks: 'Updated quote with better price'
      };

      const response = await request(app)
        .post(TEST_CONFIG.endpoints.quotes.createOrUpdate(testOrder.id))
        .set('x-provider-name', testProvider1.name)
        .set('x-access-key', testProvider1.accessKey)
        .send(updatedQuoteData)
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      
      // 验证更新后的数据
      expect(response.body.data).toMatchObject({
        id: existingQuote.id, // 应该是同一个报价ID
        orderId: testOrder.id,
        provider: testProvider1.name,
        price: updatedQuoteData.price,
        estimatedDelivery: updatedQuoteData.estimatedDelivery,
        remarks: updatedQuoteData.remarks
      });

      // 验证数据库中的更新
      const dbQuote = await dbHelper.findQuoteById(existingQuote.id);
      expect(dbQuote.price).toBe(updatedQuoteData.price);
    });

    it('应该拒绝其他供应商更新报价', async () => {
      const updatedQuoteData = {
        price: 120.00,
        estimatedDelivery: '2025-06-30T10:00:00.000Z'
      };

      const response = await request(app)
        .post(TEST_CONFIG.endpoints.quotes.createOrUpdate(testOrder.id))
        .set('x-provider-name', testProvider2.name)
        .set('x-access-key', testProvider2.accessKey)
        .send(updatedQuoteData)
        .expect(200); // 这会创建新报价，而不是更新现有报价

      // 验证创建了新的报价
      expect(response.body.data.id).not.toBe(existingQuote.id);
      expect(response.body.data.provider).toBe(testProvider2.name);
    });
  });

  describe('报价查询流程', () => {
    let quote1, quote2;

    beforeEach(async () => {
      // 创建多个报价
      const quoteData1 = {
        price: 150.50,
        estimatedDelivery: '2025-07-01T10:00:00.000Z',
        remarks: 'Quote from Provider A'
      };

      const quoteData2 = {
        price: 120.00,
        estimatedDelivery: '2025-06-30T10:00:00.000Z',
        remarks: 'Quote from Provider B'
      };

      const response1 = await request(app)
        .post(TEST_CONFIG.endpoints.quotes.createOrUpdate(testOrder.id))
        .set('x-provider-name', testProvider1.name)
        .set('x-access-key', testProvider1.accessKey)
        .send(quoteData1)
        .expect(200);
      quote1 = response1.body.data;

      const response2 = await request(app)
        .post(TEST_CONFIG.endpoints.quotes.createOrUpdate(testOrder.id))
        .set('x-provider-name', testProvider2.name)
        .set('x-access-key', testProvider2.accessKey)
        .send(quoteData2)
        .expect(200);
      quote2 = response2.body.data;
    });

    it('用户应该能够查看订单的所有报价', async () => {
      const response = await request(app)
        .get(TEST_CONFIG.endpoints.quotes.getByOrder(testOrder.id))
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: quote1.id }),
          expect.objectContaining({ id: quote2.id })
        ])
      );
    });

    it('应该支持按价格排序', async () => {
      const response = await request(app)
        .get(TEST_CONFIG.endpoints.quotes.getByOrder(testOrder.id))
        .query({ sortBy: 'price', sortOrder: 'asc' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      
      // 验证按价格升序排列
      expect(response.body.data[0].price).toBeLessThan(response.body.data[1].price);
    });

    it('应该能够获取最低报价', async () => {
      const response = await request(app)
        .get(TEST_CONFIG.endpoints.quotes.getLowest(testOrder.id))
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      
      // 应该返回价格最低的报价
      expect(response.body.data.id).toBe(quote2.id); // quote2 价格更低
      expect(response.body.data.price).toBe(120.00);
    });

    it('应该支持价格范围查询', async () => {
      const response = await request(app)
        .get(TEST_CONFIG.endpoints.quotes.getByPriceRange(testOrder.id))
        .query({ minPrice: 100, maxPrice: 140 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      
      // 只有quote2在价格范围内
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(quote2.id);
    });

    it('供应商应该能够查看自己的报价', async () => {
      const response = await request(app)
        .get(TEST_CONFIG.endpoints.quotes.getByProvider(testProvider1.name))
        .set('x-provider-name', testProvider1.name)
        .set('x-access-key', testProvider1.accessKey)
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      
      // 只能看到自己的报价
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(quote1.id);
    });

    it('应该拒绝未认证用户查看报价', async () => {
      const response = await request(app)
        .get(TEST_CONFIG.endpoints.quotes.getByOrder(testOrder.id))
        .expect(401);

      responseValidator.validateErrorResponse(response.body);
    });
  });

  describe('报价删除流程', () => {
    let testQuote;

    beforeEach(async () => {
      // 创建测试报价
      const quoteData = {
        price: 150.50,
        estimatedDelivery: '2025-07-01T10:00:00.000Z',
        remarks: 'Test quote for deletion'
      };

      const response = await request(app)
        .post(TEST_CONFIG.endpoints.quotes.createOrUpdate(testOrder.id))
        .set('x-provider-name', testProvider1.name)
        .set('x-access-key', testProvider1.accessKey)
        .send(quoteData)
        .expect(200);

      testQuote = response.body.data;
    });

    it('供应商应该能够删除自己的报价', async () => {
      const response = await request(app)
        .delete(TEST_CONFIG.endpoints.quotes.delete(testOrder.id, testProvider1.name))
        .set('x-provider-name', testProvider1.name)
        .set('x-access-key', testProvider1.accessKey)
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      
      // 验证报价已被删除
      const dbQuote = await dbHelper.findQuoteById(testQuote.id);
      expect(dbQuote).toBeNull();
    });

    it('应该拒绝删除其他供应商的报价', async () => {
      const response = await request(app)
        .delete(TEST_CONFIG.endpoints.quotes.delete(testOrder.id, testProvider1.name))
        .set('x-provider-name', testProvider2.name)
        .set('x-access-key', testProvider2.accessKey)
        .expect(403);

      responseValidator.validateErrorResponse(response.body);
    });

    it('管理员应该能够删除任何报价', async () => {
      const response = await request(app)
        .delete(TEST_CONFIG.endpoints.quotes.delete(testOrder.id, testProvider1.name))
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      
      // 验证报价已被删除
      const dbQuote = await dbHelper.findQuoteById(testQuote.id);
      expect(dbQuote).toBeNull();
    });
  });
});
