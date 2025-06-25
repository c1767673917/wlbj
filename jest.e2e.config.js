/**
 * Jest配置文件 - 端到端测试
 * 用于运行完整的应用流程测试
 */

module.exports = {
  displayName: 'E2E Tests',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/e2e/setup.js'],
  globalSetup: '<rootDir>/tests/e2e/globalSetup.js',
  globalTeardown: '<rootDir>/tests/e2e/globalTeardown.js',
  testTimeout: 30000, // 30秒超时，适合端到端测试
  maxWorkers: 1, // 串行执行，避免端口冲突
  forceExit: true,
  detectOpenHandles: true,
  verbose: true,
  collectCoverage: false, // E2E测试不收集覆盖率
  
  // 测试环境变量
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  },

  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
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
