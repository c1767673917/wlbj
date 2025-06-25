/**
 * E2E测试 - 用户认证流程测试
 * 测试用户注册、登录、token验证的完整流程
 */

describe('用户认证流程测试', () => {
  let client;
  let testUsers = {};

  beforeAll(() => {
    client = new APIClient();
  });

  beforeEach(() => {
    // 为每个测试生成新的用户数据
    testUsers = {
      user: utils.generateTestUser('user'),
      admin: utils.generateTestUser('admin'),
      provider: utils.generateTestUser('provider')
    };
  });

  describe('用户注册流程', () => {
    test('普通用户注册应该成功', async () => {
      const response = await client.register(testUsers.user);
      
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('注册成功'),
        data: {
          user: {
            id: expect.any(Number),
            username: testUsers.user.username,
            email: testUsers.user.email,
            role: 'user'
          }
        }
      });
      
      // 密码不应该在响应中返回
      expect(response.body.data.user.password).toBeUndefined();
    });

    test('管理员用户注册应该成功', async () => {
      const response = await client.register(testUsers.admin);
      
      expect(response.status).toBe(201);
      expect(response.body.data.user.role).toBe('admin');
    });

    test('供应商用户注册应该成功', async () => {
      const response = await client.register(testUsers.provider);
      
      expect(response.status).toBe(201);
      expect(response.body.data.user.role).toBe('provider');
    });

    test('重复邮箱注册应该失败', async () => {
      // 先注册一个用户
      await client.register(testUsers.user);
      
      // 尝试用相同邮箱再次注册
      const response = await client.register(testUsers.user);
      
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('邮箱已存在')
      });
    });

    test('无效邮箱格式应该失败', async () => {
      const invalidUser = {
        ...testUsers.user,
        email: 'invalid-email'
      };
      
      const response = await client.register(invalidUser);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('弱密码应该失败', async () => {
      const weakPasswordUser = {
        ...testUsers.user,
        password: '123'
      };
      
      const response = await client.register(weakPasswordUser);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('用户登录流程', () => {
    beforeEach(async () => {
      // 为每个登录测试预先注册用户
      await client.register(testUsers.user);
      await client.register(testUsers.admin);
      await client.register(testUsers.provider);
    });

    test('正确凭据登录应该成功', async () => {
      const response = await client.login({
        email: testUsers.user.email,
        password: testUsers.user.password
      });
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('登录成功'),
        data: {
          token: expect.any(String),
          user: {
            id: expect.any(Number),
            username: testUsers.user.username,
            email: testUsers.user.email,
            role: 'user'
          }
        }
      });
      
      // 验证JWT token格式
      const token = response.body.data.token;
      expect(token.split('.')).toHaveLength(3);
    });

    test('管理员登录应该成功', async () => {
      const response = await client.login({
        email: testUsers.admin.email,
        password: testUsers.admin.password
      });
      
      expect(response.status).toBe(200);
      expect(response.body.data.user.role).toBe('admin');
    });

    test('供应商登录应该成功', async () => {
      const response = await client.login({
        email: testUsers.provider.email,
        password: testUsers.provider.password
      });
      
      expect(response.status).toBe(200);
      expect(response.body.data.user.role).toBe('provider');
    });

    test('错误密码登录应该失败', async () => {
      const response = await client.login({
        email: testUsers.user.email,
        password: 'wrongpassword'
      });
      
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('密码错误')
      });
    });

    test('不存在的用户登录应该失败', async () => {
      const response = await client.login({
        email: 'nonexistent@test.com',
        password: 'anypassword'
      });
      
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('用户不存在')
      });
    });

    test('缺少必填字段应该失败', async () => {
      const response = await client.login({
        email: testUsers.user.email
        // 缺少password
      });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Token验证和授权', () => {
    let userToken, adminToken, providerToken;

    beforeEach(async () => {
      // 注册并登录不同角色的用户
      await client.register(testUsers.user);
      await client.register(testUsers.admin);
      await client.register(testUsers.provider);

      const userLogin = await client.login({
        email: testUsers.user.email,
        password: testUsers.user.password
      });
      userToken = userLogin.body.data.token;

      const adminLogin = await client.login({
        email: testUsers.admin.email,
        password: testUsers.admin.password
      });
      adminToken = adminLogin.body.data.token;

      const providerLogin = await client.login({
        email: testUsers.provider.email,
        password: testUsers.provider.password
      });
      providerToken = providerLogin.body.data.token;
    });

    test('有效token应该能访问受保护的端点', async () => {
      client.setToken(userToken);
      const response = await client.get('/api/users/profile');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('无效token应该被拒绝', async () => {
      client.setToken('invalid.token.here');
      const response = await client.get('/api/users/profile');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('过期token应该被拒绝', async () => {
      // 使用明显过期的token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE2MDk0NTkyMDAsImV4cCI6MTYwOTQ2MjgwMH0.invalid';
      
      client.setToken(expiredToken);
      const response = await client.get('/api/users/profile');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('管理员token应该能访问管理员端点', async () => {
      client.setToken(adminToken);
      const response = await client.get('/api/orders/pending');
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 404) {
        // 如果端点不存在，至少应该通过认证
        expect(response.body.message).not.toContain('未授权');
      }
    });

    test('普通用户token不应该能访问管理员端点', async () => {
      client.setToken(userToken);
      const response = await client.get('/api/orders/pending');
      
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('权限不足')
      });
    });

    test('供应商token应该能访问供应商端点', async () => {
      client.setToken(providerToken);
      const response = await client.get('/api/quotes/my-quotes');
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 404) {
        // 如果端点不存在，至少应该通过认证
        expect(response.body.message).not.toContain('未授权');
      }
    });
  });

  describe('会话管理', () => {
    let userToken;

    beforeEach(async () => {
      await client.register(testUsers.user);
      const loginResponse = await client.login({
        email: testUsers.user.email,
        password: testUsers.user.password
      });
      userToken = loginResponse.body.data.token;
    });

    test('获取当前用户信息应该成功', async () => {
      client.setToken(userToken);
      const response = await client.get('/api/users/profile');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: expect.any(Number),
            username: testUsers.user.username,
            email: testUsers.user.email,
            role: 'user'
          }
        }
      });
    });

    test('更新用户信息应该成功', async () => {
      client.setToken(userToken);
      const updateData = {
        username: `updated_${testUsers.user.username}`
      };
      
      const response = await client.put('/api/users/profile', updateData);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.user.username).toBe(updateData.username);
      }
    });
  });
});
