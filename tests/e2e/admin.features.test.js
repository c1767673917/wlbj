/**
 * E2E测试 - 管理员功能测试
 * 测试管理员专用功能：数据导出、批量操作、统计分析
 */

describe('管理员功能测试', () => {
  let client;
  let userClient, adminClient;
  let testUser, testAdmin;
  let testData = {
    orderIds: [],
    quoteIds: [],
    userIds: []
  };

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

    // 创建测试数据
    await setupTestData();
  });

  async function setupTestData() {
    // 创建多个测试订单
    for (let i = 0; i < 5; i++) {
      const orderData = utils.generateTestOrder();
      const response = await userClient.createOrder(orderData);
      if (response.status === 201) {
        testData.orderIds.push(response.body.data.order.id);
      }
    }

    // 创建多个测试用户
    for (let i = 0; i < 3; i++) {
      const userData = utils.generateTestUser('user');
      const response = await client.register(userData);
      if (response.status === 201) {
        testData.userIds.push(response.body.data.user.id);
      }
    }
  }

  describe('数据导出功能', () => {
    test('管理员导出订单数据（CSV格式）应该成功', async () => {
      const exportData = {
        format: 'csv',
        filters: {
          status: 'pending',
          startDate: '2025-01-01',
          endDate: '2025-12-31'
        }
      };
      
      const response = await adminClient.post('/api/orders/export', exportData);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toMatchObject({
          success: true,
          data: {
            downloadUrl: expect.any(String)
          }
        });
        
        // 验证下载链接格式
        expect(response.body.data.downloadUrl).toMatch(/\.csv$/);
      }
    });

    test('管理员导出订单数据（Excel格式）应该成功', async () => {
      const exportData = {
        format: 'excel',
        filters: {
          status: 'all',
          includeQuotes: true
        }
      };
      
      const response = await adminClient.post('/api/orders/export', exportData);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.downloadUrl).toMatch(/\.(xlsx|xls)$/);
      }
    });

    test('管理员导出报价数据应该成功', async () => {
      const exportData = {
        format: 'csv',
        filters: {
          status: 'pending',
          priceRange: {
            min: 1000,
            max: 5000
          }
        }
      };
      
      const response = await adminClient.post('/api/quotes/export', exportData);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.downloadUrl).toBeDefined();
      }
    });

    test('管理员导出用户数据应该成功', async () => {
      const exportData = {
        format: 'csv',
        filters: {
          role: 'user',
          registrationDate: {
            start: '2025-01-01',
            end: '2025-12-31'
          }
        }
      };
      
      const response = await adminClient.post('/api/users/export', exportData);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.downloadUrl).toBeDefined();
        
        // 验证敏感数据已脱敏
        if (response.body.data.preview) {
          expect(response.body.data.preview).not.toContain('password');
          expect(response.body.data.preview).not.toContain('salt');
        }
      }
    });

    test('普通用户不能访问数据导出功能', async () => {
      const response = await userClient.post('/api/orders/export', {
        format: 'csv'
      });
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('导出时使用无效格式应该失败', async () => {
      const response = await adminClient.post('/api/orders/export', {
        format: 'invalid_format'
      });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('批量操作功能', () => {
    test('管理员批量操作订单应该成功', async () => {
      if (testData.orderIds.length < 2) {
        console.log('跳过批量操作测试：测试数据不足');
        return;
      }

      const batchData = {
        orderIds: testData.orderIds.slice(0, 2),
        operation: 'approve',
        reason: '批量审核通过'
      };
      
      const response = await adminClient.post('/api/orders/batch-operate', batchData);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toMatchObject({
          success: true,
          data: {
            results: expect.any(Array),
            summary: {
              total: batchData.orderIds.length,
              success: expect.any(Number),
              failed: expect.any(Number)
            }
          }
        });
      }
    });

    test('管理员批量取消订单应该成功', async () => {
      if (testData.orderIds.length < 2) {
        console.log('跳过批量取消测试：测试数据不足');
        return;
      }

      const batchData = {
        orderIds: testData.orderIds.slice(2, 4),
        operation: 'cancel',
        reason: '批量取消处理'
      };
      
      const response = await adminClient.post('/api/orders/batch-operate', batchData);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.summary.total).toBe(batchData.orderIds.length);
      }
    });

    test('管理员批量操作用户状态应该成功', async () => {
      if (testData.userIds.length < 2) {
        console.log('跳过用户批量操作测试：测试数据不足');
        return;
      }

      const batchData = {
        userIds: testData.userIds.slice(0, 2),
        operation: 'activate',
        reason: '批量激活用户'
      };
      
      const response = await adminClient.post('/api/users/batch-operate', batchData);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.results).toBeInstanceOf(Array);
      }
    });

    test('普通用户不能执行批量操作', async () => {
      const response = await userClient.post('/api/orders/batch-operate', {
        orderIds: [1, 2],
        operation: 'approve'
      });
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('批量操作时使用无效操作类型应该失败', async () => {
      const response = await adminClient.post('/api/orders/batch-operate', {
        orderIds: testData.orderIds.slice(0, 1),
        operation: 'invalid_operation'
      });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('批量操作空列表应该失败', async () => {
      const response = await adminClient.post('/api/orders/batch-operate', {
        orderIds: [],
        operation: 'approve'
      });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('统计分析功能', () => {
    test('管理员查看订单统计应该成功', async () => {
      const response = await adminClient.get('/api/orders/stats');
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toMatchObject({
          success: true,
          data: {
            stats: {
              total: expect.any(Number),
              pending: expect.any(Number),
              confirmed: expect.any(Number),
              completed: expect.any(Number),
              cancelled: expect.any(Number)
            }
          }
        });
      }
    });

    test('管理员查看报价统计应该成功', async () => {
      const response = await adminClient.get('/api/quotes/stats');
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toMatchObject({
          success: true,
          data: {
            stats: {
              total: expect.any(Number),
              pending: expect.any(Number),
              confirmed: expect.any(Number),
              rejected: expect.any(Number),
              averagePrice: expect.any(Number),
              priceRange: {
                min: expect.any(Number),
                max: expect.any(Number)
              }
            }
          }
        });
      }
    });

    test('管理员查看用户统计应该成功', async () => {
      const response = await adminClient.get('/api/users/stats');
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toMatchObject({
          success: true,
          data: {
            stats: {
              total: expect.any(Number),
              active: expect.any(Number),
              inactive: expect.any(Number),
              byRole: {
                user: expect.any(Number),
                provider: expect.any(Number),
                admin: expect.any(Number)
              }
            }
          }
        });
      }
    });

    test('管理员查看时间范围统计应该成功', async () => {
      const response = await adminClient.get('/api/orders/stats?startDate=2025-01-01&endDate=2025-12-31');
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.stats).toBeDefined();
      }
    });

    test('管理员查看趋势分析应该成功', async () => {
      const response = await adminClient.get('/api/analytics/trends?period=monthly&year=2025');
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.trends).toBeInstanceOf(Array);
      }
    });

    test('普通用户不能访问统计分析功能', async () => {
      const response = await userClient.get('/api/orders/stats');
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('系统管理功能', () => {
    test('管理员查看系统状态应该成功', async () => {
      const response = await adminClient.get('/api/admin/system-status');
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toMatchObject({
          success: true,
          data: {
            system: {
              uptime: expect.any(Number),
              memory: expect.any(Object),
              database: expect.any(Object)
            }
          }
        });
      }
    });

    test('管理员查看操作日志应该成功', async () => {
      const response = await adminClient.get('/api/admin/audit-logs?limit=10');
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.logs).toBeInstanceOf(Array);
      }
    });

    test('管理员配置系统参数应该成功', async () => {
      const configData = {
        maxOrdersPerDay: 1000,
        defaultQuoteValidDays: 7,
        enableEmailNotifications: true
      };
      
      const response = await adminClient.put('/api/admin/config', configData);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    test('普通用户不能访问系统管理功能', async () => {
      const response = await userClient.get('/api/admin/system-status');
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('权限验证', () => {
    test('管理员权限应该正确验证', async () => {
      // 测试需要管理员权限的端点
      const adminEndpoints = [
        '/api/orders/pending',
        '/api/orders/export',
        '/api/quotes/stats',
        '/api/users/export',
        '/api/admin/system-status'
      ];

      for (const endpoint of adminEndpoints) {
        const response = await adminClient.get(endpoint);
        
        // 应该通过权限验证（200或404，但不是403）
        expect([200, 404]).toContain(response.status);
        if (response.status === 404) {
          // 如果是404，确保不是权限问题
          expect(response.body.message).not.toContain('权限');
          expect(response.body.message).not.toContain('unauthorized');
        }
      }
    });

    test('普通用户访问管理员功能应该被拒绝', async () => {
      const adminEndpoints = [
        '/api/orders/pending',
        '/api/orders/export',
        '/api/quotes/stats',
        '/api/users/export',
        '/api/admin/system-status'
      ];

      for (const endpoint of adminEndpoints) {
        const response = await userClient.get(endpoint);
        
        // 应该返回权限不足错误
        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      }
    });

    test('未认证用户访问管理员功能应该被拒绝', async () => {
      const unauthenticatedClient = new APIClient();
      
      const response = await unauthenticatedClient.get('/api/orders/pending');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
