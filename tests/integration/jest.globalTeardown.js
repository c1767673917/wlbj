/**
 * Jest全局清理
 * 在所有集成测试结束后执行
 */

const { teardownIntegrationTestEnvironment } = require('./setup');

module.exports = async () => {
  console.log('🧹 开始全局集成测试环境清理...');
  
  try {
    // 清理集成测试环境
    await teardownIntegrationTestEnvironment();
    
    console.log('✅ 全局集成测试环境清理完成');
  } catch (error) {
    console.error('❌ 全局集成测试环境清理失败:', error);
  }
};
