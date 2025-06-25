/**
 * Jest 基础配置
 * 用于单元测试和基础测试配置
 */

module.exports = {
  // 测试环境
  testEnvironment: 'node',
  
  // 测试文件匹配模式
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/unit/**/*.spec.js'
  ],
  
  // 忽略的测试文件
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/integration/',
    '/tests/e2e/',
    '/coverage/',
    '/dist/'
  ],
  
  // 设置文件
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  
  // 超时设置
  testTimeout: 10000,
  
  // 覆盖率配置（默认关闭，由覆盖率配置文件控制）
  collectCoverage: false,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/**/index.js',
    '!src/config/**',
    '!src/migrations/**',
    '!src/seeds/**',
    '!src/scripts/**'
  ],
  
  // 覆盖率报告格式
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  
  // 覆盖率输出目录
  coverageDirectory: 'coverage',
  
  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // 清理模拟
  clearMocks: true,
  restoreMocks: true,

  // 详细输出
  verbose: false,

  // 强制退出
  forceExit: false,

  // 检测打开的句柄
  detectOpenHandles: false,

  // 最大工作进程数
  maxWorkers: '50%',
  
  // 环境变量设置
  setupFiles: [
    '<rootDir>/tests/env.setup.js'
  ],

  // 转换配置
  transform: {
    '^.+\\.js$': 'babel-jest'
  },

  // 忽略转换的模块
  transformIgnorePatterns: [
    '/node_modules/(?!(some-es6-module)/)'
  ],

  // 模块文件扩展名
  moduleFileExtensions: [
    'js',
    'json',
    'node'
  ],

  // 全局变量
  globals: {
    'NODE_ENV': 'test'
  }
};
