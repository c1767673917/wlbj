/**
 * 基础API集成测试
 * 测试应用基本功能和新架构
 */

const request = require('supertest');
const { TEST_CONFIG } = require('./config');

describe('基础API集成测试', () => {
  let app;

  beforeAll(async () => {
    // 初始化测试环境
    const { createTestApp } = require('./setup');
    app = await createTestApp();
  });

  afterAll(async () => {
    // 关闭服务器
    if (app && app.closeServer) {
      await app.closeServer();
    }
  });

  describe('健康检查', () => {
    it('应该返回健康状态', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Service is healthy',
        version: expect.any(String),
        environment: 'test'
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('路由结构测试', () => {
    it('应该正确处理不存在的路由', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: '接口不存在'
      });
    });

    it('应该正确处理认证路由', async () => {
      // 测试注册端点是否存在
      const response = await request(app)
        .post('/api/auth/register')
        .send({})
        .expect(400); // 应该返回验证错误，而不是404

      expect(response.body).toMatchObject({
        success: false
      });
    });

    it('应该正确处理订单路由', async () => {
      // 测试订单端点是否存在（应该需要认证）
      const response = await request(app)
        .get('/api/orders')
        .expect(401); // 应该返回未认证错误，而不是404

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });

    it('应该正确处理报价路由', async () => {
      // 测试报价端点是否存在（应该需要认证）
      // 使用实际存在的路由：/api/quotes/orders/:orderId
      const response = await request(app)
        .get('/api/quotes/orders/test-order-id')
        .expect(401); // 应该返回未认证错误，而不是404

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });

    it('应该正确处理用户路由', async () => {
      // 测试用户端点是否存在（应该需要认证）
      // 使用实际存在的路由：/api/users/profile
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401); // 应该返回未认证错误，而不是404

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('认证')
      });
    });
  });

  describe('中间件功能测试', () => {
    it('应该正确设置CORS头', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('应该正确处理JSON请求', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json')
        .expect(400); // 验证错误，但能正确解析JSON

      expect(response.body).toBeDefined();
      expect(typeof response.body).toBe('object');
    });

    it('应该正确处理安全头', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // 检查一些基本的安全头
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('错误处理测试', () => {
    it('应该正确处理无效的JSON', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: '请求参数错误'
      });
    });

    it('应该正确处理过大的请求体', async () => {
      const largeData = 'x'.repeat(11 * 1024 * 1024); // 11MB，超过10MB限制
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({ data: largeData })
        .expect(413);

      expect(response.body).toMatchObject({
        success: false
      });
    });
  });
});
