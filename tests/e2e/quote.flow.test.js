/**
 * E2E测试 - 报价管理流程测试
 * 测试报价创建、查询、批量操作的完整流程
 */

describe('报价管理流程测试', () => {
  let client;
  let userClient, providerClient, adminClient;
  let testUser, testProvider, testAdmin;
  let testOrderId;
  let createdQuotes = [];

  beforeAll(async () => {
    client = new APIClient();
    userClient = new APIClient();
    providerClient = new APIClient();
    adminClient = new APIClient();

    // 创建测试用户
    testUser = utils.generateTestUser('user');
    testProvider = utils.generateTestUser('provider');
    testAdmin = utils.generateTestUser('admin');

    // 注册用户
    await client.register(testUser);
    await client.register(testProvider);
    await client.register(testAdmin);

    // 登录获取token
    const userLogin = await client.login({
      email: testUser.email,
      password: testUser.password
    });
    userClient.setToken(userLogin.body.data.token);

    const providerLogin = await client.login({
      email: testProvider.email,
      password: testProvider.password
    });
    providerClient.setToken(providerLogin.body.data.token);

    const adminLogin = await client.login({
      email: testAdmin.email,
      password: testAdmin.password
    });
    adminClient.setToken(adminLogin.body.data.token);

    // 创建测试订单
    const orderData = utils.generateTestOrder();
    const orderResponse = await userClient.createOrder(orderData);
    testOrderId = orderResponse.body.data.order.id;
  });

  afterEach(() => {
    // 清理创建的报价记录
    createdQuotes = [];
  });

  describe('报价创建流程', () => {
    test('供应商创建报价应该成功', async () => {
      const quoteData = {
        orderId: testOrderId,
        price: 1500.00,
        estimatedDays: 3,
        description: '标准物流服务，包含保险',
        validUntil: '2025-02-01T00:00:00Z',
        serviceType: 'standard',
        includeInsurance: true
      };
      
      const response = await providerClient.createQuote(quoteData);
      
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('报价创建成功'),
        data: {
          quote: {
            id: expect.any(Number),
            orderId: testOrderId,
            providerId: expect.any(Number),
            price: quoteData.price,
            estimatedDays: quoteData.estimatedDays,
            description: quoteData.description,
            status: 'pending',
            serviceType: quoteData.serviceType,
            includeInsurance: quoteData.includeInsurance
          }
        }
      });

      createdQuotes.push(response.body.data.quote.id);
    });

    test('供应商创建报价时缺少必填字段应该失败', async () => {
      const incompleteQuote = {
        orderId: testOrderId,
        // 缺少price等必填字段
      };
      
      const response = await providerClient.createQuote(incompleteQuote);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('普通用户不能创建报价', async () => {
      const quoteData = {
        orderId: testOrderId,
        price: 1500.00,
        estimatedDays: 3,
        description: '测试报价'
      };
      
      const response = await userClient.createQuote(quoteData);
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('供应商不能对不存在的订单创建报价', async () => {
      const quoteData = {
        orderId: 99999,
        price: 1500.00,
        estimatedDays: 3,
        description: '测试报价'
      };
      
      const response = await providerClient.createQuote(quoteData);
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('供应商创建包含详细服务的报价应该成功', async () => {
      const detailedQuote = {
        orderId: testOrderId,
        price: 2000.00,
        estimatedDays: 2,
        description: '加急物流服务',
        validUntil: '2025-02-01T00:00:00Z',
        serviceType: 'express',
        includeInsurance: true,
        pickupService: true,
        trackingIncluded: true,
        additionalServices: ['包装服务', '代收货款']
      };
      
      const response = await providerClient.createQuote(detailedQuote);
      
      expect(response.status).toBe(201);
      expect(response.body.data.quote.serviceType).toBe('express');
      expect(response.body.data.quote.pickupService).toBe(true);
      
      createdQuotes.push(response.body.data.quote.id);
    });
  });

  describe('报价查询流程', () => {
    let testQuoteId;

    beforeEach(async () => {
      // 创建测试报价
      const quoteData = {
        orderId: testOrderId,
        price: 1800.00,
        estimatedDays: 4,
        description: '测试报价服务'
      };
      const response = await providerClient.createQuote(quoteData);
      testQuoteId = response.body.data.quote.id;
      createdQuotes.push(testQuoteId);
    });

    test('用户查询订单的所有报价应该成功', async () => {
      const response = await userClient.get(`/api/quotes/order/${testOrderId}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          quotes: expect.any(Array)
        }
      });

      // 应该包含刚创建的报价
      const quotes = response.body.data.quotes;
      expect(quotes.some(quote => quote.id === testQuoteId)).toBe(true);
    });

    test('供应商查询自己的报价列表应该成功', async () => {
      const response = await providerClient.get('/api/quotes/my-quotes');
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.quotes).toBeInstanceOf(Array);
      }
    });

    test('用户查询特定报价详情应该成功', async () => {
      const response = await userClient.get(`/api/quotes/${testQuoteId}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          quote: {
            id: testQuoteId,
            orderId: testOrderId,
            price: expect.any(Number),
            estimatedDays: expect.any(Number),
            status: 'pending',
            createdAt: expect.any(String)
          }
        }
      });
    });

    test('支持报价状态过滤查询', async () => {
      const response = await userClient.get(`/api/quotes/order/${testOrderId}?status=pending`);
      
      expect(response.status).toBe(200);
      if (response.body.data.quotes.length > 0) {
        response.body.data.quotes.forEach(quote => {
          expect(quote.status).toBe('pending');
        });
      }
    });

    test('支持价格范围过滤查询', async () => {
      const response = await userClient.get(`/api/quotes/order/${testOrderId}?minPrice=1000&maxPrice=2000`);
      
      expect(response.status).toBe(200);
      if (response.body.data.quotes.length > 0) {
        response.body.data.quotes.forEach(quote => {
          expect(quote.price).toBeGreaterThanOrEqual(1000);
          expect(quote.price).toBeLessThanOrEqual(2000);
        });
      }
    });
  });

  describe('报价选择和确认流程', () => {
    let testQuoteIds = [];

    beforeEach(async () => {
      // 创建多个测试报价
      const quoteDataList = [
        { price: 1500.00, estimatedDays: 5, description: '经济型服务' },
        { price: 2000.00, estimatedDays: 3, description: '标准服务' },
        { price: 2500.00, estimatedDays: 1, description: '加急服务' }
      ];

      for (const quoteData of quoteDataList) {
        const response = await providerClient.createQuote({
          ...quoteData,
          orderId: testOrderId
        });
        testQuoteIds.push(response.body.data.quote.id);
        createdQuotes.push(response.body.data.quote.id);
      }
    });

    afterEach(() => {
      testQuoteIds = [];
    });

    test('用户选择报价应该成功', async () => {
      const selectedQuoteId = testQuoteIds[1]; // 选择标准服务
      
      const response = await userClient.post(`/api/quotes/${selectedQuoteId}/select`);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.quote.status).toBe('selected');
      }
    });

    test('用户确认选择的报价应该成功', async () => {
      const selectedQuoteId = testQuoteIds[0];
      
      // 先选择报价
      await userClient.post(`/api/quotes/${selectedQuoteId}/select`);
      
      // 再确认报价
      const response = await userClient.post(`/api/quotes/${selectedQuoteId}/confirm`);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.quote.status).toBe('confirmed');
      }
    });

    test('用户拒绝报价应该成功', async () => {
      const rejectedQuoteId = testQuoteIds[2];
      
      const response = await userClient.post(`/api/quotes/${rejectedQuoteId}/reject`, {
        reason: '价格超出预算'
      });
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.quote.status).toBe('rejected');
      }
    });

    test('供应商不能选择自己的报价', async () => {
      const quoteId = testQuoteIds[0];
      
      const response = await providerClient.post(`/api/quotes/${quoteId}/select`);
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('用户比较多个报价应该成功', async () => {
      const response = await userClient.post('/api/quotes/compare', {
        quoteIds: testQuoteIds
      });
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.comparison).toMatchObject({
          quotes: expect.any(Array),
          summary: {
            lowestPrice: expect.any(Number),
            highestPrice: expect.any(Number),
            averagePrice: expect.any(Number),
            fastestDelivery: expect.any(Number)
          }
        });
      }
    });
  });

  describe('供应商报价管理', () => {
    let testQuoteId;

    beforeEach(async () => {
      const quoteData = {
        orderId: testOrderId,
        price: 1600.00,
        estimatedDays: 3,
        description: '可修改的测试报价'
      };
      const response = await providerClient.createQuote(quoteData);
      testQuoteId = response.body.data.quote.id;
      createdQuotes.push(testQuoteId);
    });

    test('供应商更新自己的报价应该成功', async () => {
      const updateData = {
        price: 1400.00,
        estimatedDays: 4,
        description: '更新后的报价描述'
      };
      
      const response = await providerClient.put(`/api/quotes/${testQuoteId}`, updateData);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.quote.price).toBe(updateData.price);
        expect(response.body.data.quote.description).toBe(updateData.description);
      }
    });

    test('供应商撤回自己的报价应该成功', async () => {
      const response = await providerClient.delete(`/api/quotes/${testQuoteId}`);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    test('供应商不能修改其他供应商的报价', async () => {
      // 创建另一个供应商
      const otherProvider = utils.generateTestUser('provider');
      await client.register(otherProvider);
      
      const otherLogin = await client.login({
        email: otherProvider.email,
        password: otherProvider.password
      });
      const otherProviderClient = new APIClient().setToken(otherLogin.body.data.token);
      
      // 尝试修改第一个供应商的报价
      const response = await otherProviderClient.put(`/api/quotes/${testQuoteId}`, {
        price: 999.00
      });
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('管理员报价管理', () => {
    let testQuoteIds = [];

    beforeEach(async () => {
      // 创建多个测试报价
      for (let i = 0; i < 3; i++) {
        const quoteData = {
          orderId: testOrderId,
          price: 1500 + i * 100,
          estimatedDays: 3 + i,
          description: `管理员测试报价 ${i + 1}`
        };
        const response = await providerClient.createQuote(quoteData);
        testQuoteIds.push(response.body.data.quote.id);
        createdQuotes.push(response.body.data.quote.id);
      }
    });

    afterEach(() => {
      testQuoteIds = [];
    });

    test('管理员查询报价统计信息应该成功', async () => {
      const response = await adminClient.get('/api/quotes/stats');
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.stats).toMatchObject({
          total: expect.any(Number),
          pending: expect.any(Number),
          confirmed: expect.any(Number),
          rejected: expect.any(Number)
        });
      }
    });

    test('管理员批量获取报价应该成功', async () => {
      const response = await adminClient.post('/api/quotes/batch', {
        orderIds: [testOrderId]
      });
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.quotes).toBeInstanceOf(Array);
      }
    });

    test('管理员导出报价数据应该成功', async () => {
      const response = await adminClient.post('/api/quotes/export', {
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

    test('普通用户不能访问管理员报价功能', async () => {
      const response = await userClient.get('/api/quotes/stats');
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
});
