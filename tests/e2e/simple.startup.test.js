/**
 * 简化的E2E测试 - 基础启动测试
 * 验证应用基本功能
 */

const request = require('supertest');
const app = require('../../src/app');

describe('简化E2E测试', () => {
  test('健康检查端点应该正常工作', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Service is healthy'
    });
  });

  test('API根路径应该返回404', async () => {
    const response = await request(app).get('/api');
    
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false
    });
  });

  test('未认证访问受保护端点应该返回401', async () => {
    const response = await request(app).get('/api/users/profile');
    
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false
    });
  });

  test('CORS头应该正确设置', async () => {
    const response = await request(app).get('/health');
    
    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });

  test('安全头应该正确设置', async () => {
    const response = await request(app).get('/health');
    
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});
