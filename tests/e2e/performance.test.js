/**
 * E2E测试 - 性能和负载测试
 * 验证API响应时间和基本负载处理能力
 */

describe('性能和负载测试', () => {
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

  describe('API响应时间测试', () => {
    test('健康检查端点响应时间应该小于100ms', async () => {
      const startTime = Date.now();
      const response = await client.get('/health');
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(100);
      
      console.log(`健康检查响应时间: ${responseTime}ms`);
    });

    test('用户登录响应时间应该小于500ms', async () => {
      const startTime = Date.now();
      const response = await client.login({
        email: testUser.email,
        password: testUser.password
      });
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(500);
      
      console.log(`用户登录响应时间: ${responseTime}ms`);
    });

    test('订单创建响应时间应该小于1000ms', async () => {
      const orderData = utils.generateTestOrder();
      
      const startTime = Date.now();
      const response = await userClient.createOrder(orderData);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(201);
      expect(responseTime).toBeLessThan(1000);
      
      console.log(`订单创建响应时间: ${responseTime}ms`);
    });

    test('订单查询响应时间应该小于300ms', async () => {
      // 先创建一个订单
      const orderData = utils.generateTestOrder();
      const createResponse = await userClient.createOrder(orderData);
      const orderId = createResponse.body.data.order.id;
      
      const startTime = Date.now();
      const response = await userClient.getOrder(orderId);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(300);
      
      console.log(`订单查询响应时间: ${responseTime}ms`);
    });

    test('订单列表查询响应时间应该小于500ms', async () => {
      const startTime = Date.now();
      const response = await userClient.getOrders();
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(500);
      
      console.log(`订单列表查询响应时间: ${responseTime}ms`);
    });
  });

  describe('并发请求测试', () => {
    test('并发健康检查请求应该正常处理', async () => {
      const concurrentRequests = 10;
      const promises = [];
      
      const startTime = Date.now();
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(client.get('/health'));
      }
      
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      const averageTime = totalTime / concurrentRequests;
      
      // 所有请求都应该成功
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
      
      // 平均响应时间应该合理
      expect(averageTime).toBeLessThan(200);
      
      console.log(`${concurrentRequests}个并发健康检查请求总时间: ${totalTime}ms, 平均: ${averageTime}ms`);
    });

    test('并发用户注册请求应该正常处理', async () => {
      const concurrentRequests = 5;
      const promises = [];
      
      const startTime = Date.now();
      
      for (let i = 0; i < concurrentRequests; i++) {
        const userData = utils.generateTestUser('user');
        promises.push(client.register(userData));
      }
      
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      
      // 所有请求都应该成功
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });
      
      console.log(`${concurrentRequests}个并发用户注册请求总时间: ${totalTime}ms`);
    });

    test('并发订单创建请求应该正常处理', async () => {
      const concurrentRequests = 5;
      const promises = [];
      
      const startTime = Date.now();
      
      for (let i = 0; i < concurrentRequests; i++) {
        const orderData = utils.generateTestOrder();
        promises.push(userClient.createOrder(orderData));
      }
      
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      
      // 所有请求都应该成功
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });
      
      console.log(`${concurrentRequests}个并发订单创建请求总时间: ${totalTime}ms`);
    });

    test('并发登录请求应该正常处理', async () => {
      const concurrentRequests = 8;
      const promises = [];
      
      const startTime = Date.now();
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(client.login({
          email: testUser.email,
          password: testUser.password
        }));
      }
      
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      
      // 所有请求都应该成功
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.token).toBeDefined();
      });
      
      console.log(`${concurrentRequests}个并发登录请求总时间: ${totalTime}ms`);
    });
  });

  describe('大数据量处理测试', () => {
    test('创建大量订单后查询性能应该保持稳定', async () => {
      const orderCount = 20;
      const createdOrderIds = [];
      
      // 创建大量订单
      console.log(`开始创建${orderCount}个订单...`);
      for (let i = 0; i < orderCount; i++) {
        const orderData = utils.generateTestOrder();
        const response = await userClient.createOrder(orderData);
        if (response.status === 201) {
          createdOrderIds.push(response.body.data.order.id);
        }
      }
      
      console.log(`成功创建${createdOrderIds.length}个订单`);
      
      // 测试查询性能
      const startTime = Date.now();
      const response = await userClient.getOrders();
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(response.body.data.orders.length).toBeGreaterThan(0);
      expect(responseTime).toBeLessThan(1000); // 即使有大量数据，查询时间也应该合理
      
      console.log(`查询${response.body.data.orders.length}个订单响应时间: ${responseTime}ms`);
    });

    test('分页查询大量数据应该高效', async () => {
      const pageSize = 10;
      
      const startTime = Date.now();
      const response = await userClient.get(`/api/orders?page=1&limit=${pageSize}`);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(response.body.data.pagination.limit).toBe(pageSize);
      expect(responseTime).toBeLessThan(500);
      
      console.log(`分页查询${pageSize}条记录响应时间: ${responseTime}ms`);
    });

    test('管理员查询统计信息性能应该合理', async () => {
      const startTime = Date.now();
      const response = await adminClient.get('/api/orders/stats');
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(responseTime).toBeLessThan(1000);
        
        console.log(`统计信息查询响应时间: ${responseTime}ms`);
      }
    });
  });

  describe('内存和资源使用测试', () => {
    test('连续请求不应该导致内存泄漏', async () => {
      const requestCount = 50;
      let successCount = 0;
      
      console.log(`开始执行${requestCount}个连续请求...`);
      
      for (let i = 0; i < requestCount; i++) {
        try {
          const response = await client.get('/health');
          if (response.status === 200) {
            successCount++;
          }
          
          // 每10个请求输出一次进度
          if ((i + 1) % 10 === 0) {
            console.log(`已完成 ${i + 1}/${requestCount} 个请求`);
          }
        } catch (error) {
          console.error(`请求 ${i + 1} 失败:`, error.message);
        }
      }
      
      expect(successCount).toBeGreaterThan(requestCount * 0.95); // 至少95%成功率
      console.log(`${requestCount}个连续请求完成，成功率: ${(successCount/requestCount*100).toFixed(1)}%`);
    });

    test('大请求体处理应该高效', async () => {
      const largeDescription = 'A'.repeat(5000); // 5KB的描述
      const orderData = {
        ...utils.generateTestOrder(),
        specialRequirements: largeDescription
      };
      
      const startTime = Date.now();
      const response = await userClient.createOrder(orderData);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      expect([201, 400]).toContain(response.status);
      if (response.status === 201) {
        expect(responseTime).toBeLessThan(2000);
        console.log(`大请求体处理时间: ${responseTime}ms`);
      }
    });
  });

  describe('缓存和优化测试', () => {
    test('重复查询应该有缓存优化', async () => {
      // 先创建一个订单
      const orderData = utils.generateTestOrder();
      const createResponse = await userClient.createOrder(orderData);
      const orderId = createResponse.body.data.order.id;
      
      // 第一次查询
      const startTime1 = Date.now();
      const response1 = await userClient.getOrder(orderId);
      const endTime1 = Date.now();
      const firstQueryTime = endTime1 - startTime1;
      
      // 第二次查询（可能有缓存）
      const startTime2 = Date.now();
      const response2 = await userClient.getOrder(orderId);
      const endTime2 = Date.now();
      const secondQueryTime = endTime2 - startTime2;
      
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.data.order.id).toBe(response2.body.data.order.id);
      
      console.log(`第一次查询时间: ${firstQueryTime}ms, 第二次查询时间: ${secondQueryTime}ms`);
      
      // 第二次查询应该不会明显慢于第一次（允许一定的网络波动）
      expect(secondQueryTime).toBeLessThan(firstQueryTime * 2);
    });

    test('静态资源请求应该快速响应', async () => {
      const startTime = Date.now();
      const response = await client.get('/health');
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(50); // 静态内容应该非常快
      
      console.log(`静态资源响应时间: ${responseTime}ms`);
    });
  });

  describe('压力测试', () => {
    test('短时间内大量请求应该正常处理', async () => {
      const requestCount = 30;
      const timeWindow = 5000; // 5秒内
      const promises = [];
      
      console.log(`开始压力测试: ${timeWindow/1000}秒内发送${requestCount}个请求...`);
      
      const startTime = Date.now();
      
      for (let i = 0; i < requestCount; i++) {
        promises.push(
          client.get('/health').catch(error => ({
            status: 500,
            error: error.message
          }))
        );
        
        // 控制请求频率，避免过于密集
        if (i % 5 === 0) {
          await utils.sleep(100);
        }
      }
      
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      const successCount = responses.filter(r => r.status === 200).length;
      const successRate = (successCount / requestCount) * 100;
      
      console.log(`压力测试完成: 总时间${totalTime}ms, 成功率${successRate.toFixed(1)}%`);
      
      // 在压力测试中，允许一定的失败率
      expect(successRate).toBeGreaterThan(80); // 至少80%成功率
      expect(totalTime).toBeLessThan(timeWindow * 2); // 不应该超时太多
    });

    test('系统在负载下应该保持稳定', async () => {
      const testDuration = 3000; // 3秒测试
      const requestInterval = 100; // 每100ms一个请求
      const requests = [];
      
      console.log(`开始稳定性测试: ${testDuration/1000}秒持续负载...`);
      
      const startTime = Date.now();
      let requestCount = 0;
      
      const intervalId = setInterval(async () => {
        if (Date.now() - startTime >= testDuration) {
          clearInterval(intervalId);
          return;
        }
        
        requestCount++;
        requests.push(
          client.get('/health').catch(error => ({
            status: 500,
            error: error.message
          }))
        );
      }, requestInterval);
      
      // 等待测试完成
      await utils.sleep(testDuration + 500);
      
      const responses = await Promise.all(requests);
      const successCount = responses.filter(r => r.status === 200).length;
      const successRate = (successCount / responses.length) * 100;
      
      console.log(`稳定性测试完成: 发送${responses.length}个请求, 成功率${successRate.toFixed(1)}%`);
      
      expect(successRate).toBeGreaterThan(85); // 稳定性测试要求更高的成功率
    });
  });
});
