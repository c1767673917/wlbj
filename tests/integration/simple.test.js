/**
 * 简单的集成测试验证
 * 验证基本的测试环境配置
 */

describe('简单集成测试', () => {
  it('应该能够运行基本测试', () => {
    expect(1 + 1).toBe(2);
  });

  it('应该设置正确的环境变量', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('应该能够访问测试配置', () => {
    const { TEST_CONFIG } = require('./config');
    expect(TEST_CONFIG).toBeDefined();
    expect(TEST_CONFIG.database).toBeDefined();
  });
});
