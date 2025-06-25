/**
 * 简化的E2E测试配置
 */

module.exports = {
  displayName: 'E2E Tests',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/e2e/setup.js'],
  testTimeout: 30000,
  maxWorkers: 1,
  forceExit: true,
  detectOpenHandles: true,
  verbose: true,
  collectCoverage: false,
  
  // 测试环境变量
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  },

  // 忽略的文件模式
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/',
    '/build/'
  ],

  // 清理模拟
  clearMocks: true,
  restoreMocks: true,

  // 报告器配置
  reporters: [
    'default'
  ]
};
