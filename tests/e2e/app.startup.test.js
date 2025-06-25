/**
 * E2E测试 - 应用启动测试
 * 验证应用能够正常启动、健康检查端点正常、数据库连接正常
 */

describe('应用启动测试', () => {
  let client;

  beforeAll(() => {
    client = new APIClient();
  });

  describe('服务器启动验证', () => {
    test('应用服务器应该正常启动并监听端口', async () => {
      // 验证服务器实例存在
      expect(global.__SERVER_INSTANCE__).toBeDefined();
      expect(global.__SERVER_INSTANCE__.listening).toBe(true);

      // 验证端口配置
      expect(global.__TEST_PORT__).toBeDefined();
      expect(typeof global.__TEST_PORT__).toBe('number');
    });

    test('健康检查端点应该返回正常状态', async () => {
      const response = await client.get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Service is healthy',
        timestamp: expect.any(String),
        version: expect.any(String),
        environment: 'test'
      });
      
      // 验证时间戳格式
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    test('API根路径应该可访问', async () => {
      const response = await client.get('/api');
      
      // 应该返回404或者路由信息，但不应该是连接错误
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('数据库连接验证', () => {
    test('数据库应该正常连接并可执行查询', async () => {
      // 通过API调用间接验证数据库连接
      const response = await client.get('/api/auth/test-db');
      
      // 如果没有这个端点，我们通过其他方式验证
      if (response.status === 404) {
        // 尝试访问需要数据库的端点
        const authResponse = await client.post('/api/auth/login', {
          email: 'test@example.com',
          password: 'wrongpassword'
        });
        
        // 应该返回认证错误而不是数据库连接错误
        expect(authResponse.status).toBe(401);
        expect(authResponse.body.success).toBe(false);
      } else {
        expect(response.status).toBe(200);
      }
    });

    test('数据库迁移应该已执行', async () => {
      // 通过尝试创建用户来验证表结构存在
      const testUser = utils.generateTestUser();
      
      const response = await client.post('/api/auth/register', testUser);
      
      // 应该返回成功或者验证错误，而不是表不存在错误
      expect([200, 201, 400, 409]).toContain(response.status);
      
      if (response.status >= 400) {
        // 如果是错误，应该是业务逻辑错误而不是数据库结构错误
        expect(response.body.message).not.toMatch(/table.*doesn't exist/i);
        expect(response.body.message).not.toMatch(/no such table/i);
      }
    });
  });

  describe('基础中间件验证', () => {
    test('CORS中间件应该正常工作', async () => {
      const response = await client.get('/health');
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('JSON解析中间件应该正常工作', async () => {
      const response = await client.post('/api/auth/login', {
        email: 'test@example.com',
        password: 'test'
      });
      
      // 应该能解析JSON，返回结构化响应
      expect(response.body).toBeInstanceOf(Object);
      expect(response.body.success).toBeDefined();
    });

    test('错误处理中间件应该正常工作', async () => {
      const response = await client.get('/api/nonexistent-endpoint');
      
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    test('安全头应该正确设置', async () => {
      const response = await client.get('/health');
      
      // 验证基本安全头
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });
  });

  describe('路由系统验证', () => {
    test('认证路由应该可访问', async () => {
      const response = await client.post('/api/auth/login', {});
      
      // 应该返回验证错误而不是路由不存在
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('订单路由应该需要认证', async () => {
      const response = await client.get('/api/orders');
      
      // 应该返回认证错误
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('报价路由应该需要认证', async () => {
      const response = await client.get('/api/quotes');
      
      // 应该返回认证错误
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('用户路由应该需要认证', async () => {
      const response = await client.get('/api/users/profile');
      
      // 应该返回认证错误
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('环境配置验证', () => {
    test('测试环境变量应该正确设置', () => {
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.PORT).toBe(global.__TEST_PORT__.toString());
      expect(process.env.JWT_SECRET).toBeDefined();
    });

    test('日志级别应该适合测试环境', () => {
      expect(process.env.LOG_LEVEL).toBe('error');
    });
  });
});
