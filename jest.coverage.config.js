/**
 * Jest 测试覆盖率配置
 * 定义覆盖率收集规则和质量门禁
 */

module.exports = {
  // 继承基础配置
  ...require('./jest.config.js'),
  
  // 覆盖率收集配置
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/**/index.js',
    '!src/config/**',
    '!src/migrations/**',
    '!src/seeds/**'
  ],
  
  // 覆盖率报告格式
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json',
    'clover'
  ],
  
  // 覆盖率输出目录
  coverageDirectory: 'coverage',
  
  // 覆盖率阈值 - 质量门禁
  coverageThreshold: {
    global: {
      branches: 80,      // 分支覆盖率 >= 80%
      functions: 85,     // 函数覆盖率 >= 85%
      lines: 85,         // 行覆盖率 >= 85%
      statements: 85     // 语句覆盖率 >= 85%
    },
    // 核心业务模块要求更高覆盖率
    'src/services/**/*.js': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    'src/repositories/**/*.js': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'src/controllers/**/*.js': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    // 工具类和中间件
    'src/utils/**/*.js': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    'src/middleware/**/*.js': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // 覆盖率路径映射
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/coverage/',
    '/dist/',
    '/docs/',
    '/scripts/',
    'jest.*.config.js',
    'knexfile.js'
  ],
  
  // 详细的覆盖率报告
  verbose: true,
  
  // 在覆盖率不达标时失败（Jest不支持此选项，已移除）
  // coverageFailOnError: true,

  // 显示未覆盖的文件（已弃用，使用collectCoverageFrom替代）
  // collectCoverageOnlyFrom: {
  //   'src/**/*.js': true
  // }
};
