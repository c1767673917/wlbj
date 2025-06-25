/**
 * E2E测试全局设置
 * 在所有测试开始前运行
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 测试服务器配置
const TEST_PORT = process.env.TEST_PORT || 3001;
const TEST_DB_PATH = path.join(__dirname, '../../data/test_e2e.db');

module.exports = async () => {
  console.log('🚀 启动E2E测试环境...');

  // 清理测试数据库
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
    console.log('✅ 清理旧的测试数据库');
  }

  // 设置测试环境变量
  process.env.NODE_ENV = 'test';
  process.env.PORT = TEST_PORT.toString();
  process.env.DB_FILENAME = TEST_DB_PATH;
  process.env.JWT_SECRET = 'test-jwt-secret-for-e2e-testing';
  process.env.LOG_LEVEL = 'error'; // 减少日志输出

  // 启动测试服务器
  const app = require(path.join(__dirname, '../../src/app.js'));

  const server = app.listen(TEST_PORT, () => {
    console.log(`✅ 测试服务器已启动，端口: ${TEST_PORT}`);
  });

  // 等待服务器启动
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('服务器启动超时'));
    }, 10000);

    server.on('listening', () => {
      clearTimeout(timeout);
      resolve();
    });

    server.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  // 保存服务器实例以便清理
  global.__SERVER_INSTANCE__ = server;
  global.__TEST_PORT__ = TEST_PORT;
};
