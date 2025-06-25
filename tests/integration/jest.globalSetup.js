/**
 * Jest全局设置
 * 在所有集成测试开始前执行
 */

const { setupIntegrationTestEnvironment } = require('./setup');

module.exports = async () => {
  console.log('🚀 开始全局集成测试环境设置...');

  try {
    // 设置环境变量
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error'; // 减少日志输出

    // 检查是否有数据库连接
    if (process.env.SKIP_DB_SETUP === 'true') {
      console.log('⚠️  跳过数据库设置 (SKIP_DB_SETUP=true)');
      console.log('✅ 全局集成测试环境设置完成（无数据库）');
      return;
    }

    // 初始化集成测试环境
    await setupIntegrationTestEnvironment();

    console.log('✅ 全局集成测试环境设置完成');
  } catch (error) {
    console.error('❌ 全局集成测试环境设置失败:', error.message);
    console.log('💡 提示：如果没有PostgreSQL数据库，可以设置 SKIP_DB_SETUP=true 跳过数据库设置');
    process.exit(1);
  }
};
