/**
 * Jest测试设置
 * 在每个测试文件执行前运行
 */

const { cleanTestDatabase, getTestDbPool } = require('./setup');
const { DatabaseHelper } = require('./helpers');

// 全局变量
global.testDbHelper = null;

// 在每个测试文件开始前执行
beforeAll(async () => {
  // 初始化数据库辅助工具
  const dbPool = getTestDbPool();
  if (dbPool) {
    global.testDbHelper = new DatabaseHelper(dbPool);
  }
});

// 在每个测试用例后执行
afterEach(async () => {
  // 清理测试数据
  if (global.testDbHelper) {
    try {
      await cleanTestDatabase();
    } catch (error) {
      console.warn('清理测试数据失败:', error.message);
    }
  }
});

// 在每个测试文件结束后执行
afterAll(async () => {
  // 清理全局变量
  global.testDbHelper = null;
});

// 设置Jest超时
jest.setTimeout(15000);
