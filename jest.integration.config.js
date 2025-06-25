/**
 * Jest集成测试配置
 */

module.exports = {
  // 测试环境
  testEnvironment: 'node',
  
  // 测试文件匹配模式
  testMatch: [
    '**/tests/integration/**/*.test.js'
  ],
  
  // 忽略的测试文件
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/unit/',
    '/tests/e2e/'
  ],
  
  // 设置文件
  setupFilesAfterEnv: [
    '<rootDir>/tests/integration/setup.js'
  ],
  
  // 全局设置
  globalSetup: '<rootDir>/tests/integration/jest.globalSetup.js',
  globalTeardown: '<rootDir>/tests/integration/jest.globalTeardown.js',
  
  // 超时设置
  testTimeout: 60000, // 增加到60秒，处理数据库连接超时
  
  // 覆盖率配置
  collectCoverage: false,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/**',
    '!src/database/migrations/**',
    '!src/scripts/**',
    '!**/node_modules/**'
  ],
  
  // 覆盖率报告
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  
  // 覆盖率输出目录
  coverageDirectory: 'coverage/integration',
  
  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // 清理模拟
  clearMocks: true,
  restoreMocks: true,

  // 详细输出
  verbose: true,

  // 强制退出
  forceExit: true,

  // 检测打开的句柄
  detectOpenHandles: true,

  // 最大工作进程数
  maxWorkers: 1,
  
  // 环境变量
  setupFiles: [
    '<rootDir>/tests/integration/env.setup.js'
  ],

  // 错误处理
  bail: false, // 不要在第一个失败时停止

  // 日志级别
  silent: false, // 允许console输出

  // 测试结果处理器
  testResultsProcessor: undefined
};
