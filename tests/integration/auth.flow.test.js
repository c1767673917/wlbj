/**
 * 用户认证流程集成测试
 * 测试用户注册、登录、权限验证等完整流程
 */

const request = require('supertest');
const { TEST_CONFIG, getAuthHeaders, generateTestData } = require('./config');
const { ApiHelper, DatabaseHelper, ResponseValidator } = require('./helpers');

describe('用户认证流程集成测试', () => {
  let app;
  let apiHelper;
  let dbHelper;
  let responseValidator;

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
  });

  describe('用户注册流程', () => {
    it('应该成功注册新用户', async () => {
      const testData = generateTestData();
      const userData = testData.user;

      const response = await request(app)
        .post(TEST_CONFIG.endpoints.auth.register)
        .send(userData)
        .expect(201);

      // 验证响应格式
      responseValidator.validateSuccessResponse(response.body);
      
      // 验证用户数据
      expect(response.body.data).toMatchObject({
        email: userData.email,
        name: userData.name,
        role: 'user'
      });
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.password).toBeUndefined(); // 密码不应返回

      // 验证数据库中的用户
      const dbUser = await dbHelper.findUserByEmail(userData.email);
      expect(dbUser).toBeTruthy();
      expect(dbUser.email).toBe(userData.email);
      expect(dbUser.name).toBe(userData.name);
      expect(dbUser.role).toBe('user');
    });

    it('应该拒绝重复邮箱注册', async () => {
      const testData = generateTestData();
      const userData = testData.user;

      // 第一次注册
      await request(app)
        .post(TEST_CONFIG.endpoints.auth.register)
        .send(userData)
        .expect(201);

      // 第二次注册相同邮箱
      const response = await request(app)
        .post(TEST_CONFIG.endpoints.auth.register)
        .send(userData)
        .expect(400);

      responseValidator.validateErrorResponse(response.body);
      expect(response.body.message).toContain('邮箱已被注册');
    });

    it('应该验证密码强度', async () => {
      const testData = generateTestData();
      const userData = {
        ...testData.user,
        password: '123' // 弱密码
      };

      const response = await request(app)
        .post(TEST_CONFIG.endpoints.auth.register)
        .send(userData)
        .expect(400);

      responseValidator.validateErrorResponse(response.body);
      expect(response.body.message).toContain('密码强度不足');
    });

    it('应该验证必需字段', async () => {
      const response = await request(app)
        .post(TEST_CONFIG.endpoints.auth.register)
        .send({
          email: 'test@example.com'
          // 缺少 password 和 name
        })
        .expect(400);

      responseValidator.validateErrorResponse(response.body);
      expect(response.body.message).toContain('缺少必需参数');
    });
  });

  describe('用户登录流程', () => {
    let testUser;

    beforeEach(async () => {
      // 创建测试用户
      const testData = generateTestData();
      testUser = testData.user;
      
      await request(app)
        .post(TEST_CONFIG.endpoints.auth.register)
        .send(testUser)
        .expect(201);
    });

    it('应该成功登录并返回JWT token', async () => {
      const response = await request(app)
        .post(TEST_CONFIG.endpoints.auth.login)
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      
      // 验证返回的数据
      expect(response.body.data).toMatchObject({
        user: {
          email: testUser.email,
          name: testUser.name,
          role: 'user'
        },
        token: expect.any(String)
      });

      // 验证JWT token格式
      const token = response.body.data.token;
      expect(token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);
    });

    it('应该拒绝错误的密码', async () => {
      const response = await request(app)
        .post(TEST_CONFIG.endpoints.auth.login)
        .send({
          email: testUser.email,
          password: 'wrong-password'
        })
        .expect(401);

      responseValidator.validateErrorResponse(response.body);
      expect(response.body.message).toContain('密码错误');
    });

    it('应该拒绝不存在的用户', async () => {
      const response = await request(app)
        .post(TEST_CONFIG.endpoints.auth.login)
        .send({
          email: 'nonexistent@example.com',
          password: 'any-password'
        })
        .expect(401);

      responseValidator.validateErrorResponse(response.body);
      expect(response.body.message).toContain('用户不存在');
    });
  });

  describe('JWT token验证流程', () => {
    let testUser;
    let authToken;

    beforeEach(async () => {
      // 创建测试用户并获取token
      const testData = generateTestData();
      testUser = testData.user;
      
      await request(app)
        .post(TEST_CONFIG.endpoints.auth.register)
        .send(testUser)
        .expect(201);

      const loginResponse = await request(app)
        .post(TEST_CONFIG.endpoints.auth.login)
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      authToken = loginResponse.body.data.token;
    });

    it('应该通过有效token获取用户信息', async () => {
      const response = await request(app)
        .get(TEST_CONFIG.endpoints.auth.me)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      
      expect(response.body.data).toMatchObject({
        email: testUser.email,
        name: testUser.name,
        role: 'user'
      });
    });

    it('应该拒绝无效的token', async () => {
      const response = await request(app)
        .get(TEST_CONFIG.endpoints.auth.me)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      responseValidator.validateErrorResponse(response.body);
      expect(response.body.message).toContain('无效的token');
    });

    it('应该拒绝缺少token的请求', async () => {
      const response = await request(app)
        .get(TEST_CONFIG.endpoints.auth.me)
        .expect(401);

      responseValidator.validateErrorResponse(response.body);
      expect(response.body.message).toContain('缺少认证token');
    });

    it('应该拒绝过期的token', async () => {
      // 创建一个过期的token
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { id: 'test-id', email: testUser.email, role: 'user' },
        TEST_CONFIG.jwt.secret,
        { expiresIn: '-1h' } // 1小时前过期
      );

      const response = await request(app)
        .get(TEST_CONFIG.endpoints.auth.me)
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      responseValidator.validateErrorResponse(response.body);
      expect(response.body.message).toContain('token已过期');
    });
  });

  describe('密码管理流程', () => {
    let testUser;
    let authToken;

    beforeEach(async () => {
      // 创建测试用户并获取token
      const testData = generateTestData();
      testUser = testData.user;
      
      await request(app)
        .post(TEST_CONFIG.endpoints.auth.register)
        .send(testUser)
        .expect(201);

      const loginResponse = await request(app)
        .post(TEST_CONFIG.endpoints.auth.login)
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      authToken = loginResponse.body.data.token;
    });

    it('应该成功修改密码', async () => {
      const newPassword = 'NewPassword123!';
      
      const response = await request(app)
        .post(TEST_CONFIG.endpoints.auth.changePassword)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: newPassword
        })
        .expect(200);

      responseValidator.validateSuccessResponse(response.body);
      expect(response.body.message).toContain('密码修改成功');

      // 验证新密码可以登录
      const loginResponse = await request(app)
        .post(TEST_CONFIG.endpoints.auth.login)
        .send({
          email: testUser.email,
          password: newPassword
        })
        .expect(200);

      expect(loginResponse.body.data.token).toBeDefined();
    });

    it('应该拒绝错误的当前密码', async () => {
      const response = await request(app)
        .post(TEST_CONFIG.endpoints.auth.changePassword)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'wrong-password',
          newPassword: 'NewPassword123!'
        })
        .expect(400);

      responseValidator.validateErrorResponse(response.body);
      expect(response.body.message).toContain('当前密码错误');
    });

    it('应该验证新密码强度', async () => {
      const response = await request(app)
        .post(TEST_CONFIG.endpoints.auth.changePassword)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: '123' // 弱密码
        })
        .expect(400);

      responseValidator.validateErrorResponse(response.body);
      expect(response.body.message).toContain('密码强度不足');
    });
  });
});
