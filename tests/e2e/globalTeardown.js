/**
 * E2E测试全局清理
 * 在所有测试结束后运行
 */

const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('🧹 清理E2E测试环境...');

  // 关闭测试服务器
  if (global.__SERVER_INSTANCE__) {
    await new Promise((resolve) => {
      global.__SERVER_INSTANCE__.close(() => {
        console.log('✅ 测试服务器已关闭');
        resolve();
      });
    });
  }

  // 清理测试数据库
  const testDbPath = path.join(__dirname, '../../data/test_e2e.db');
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
      console.log('✅ 测试数据库已清理');
    } catch (error) {
      console.warn('⚠️ 清理测试数据库失败:', error.message);
    }
  }

  console.log('✅ E2E测试环境清理完成');
};
