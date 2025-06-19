#!/usr/bin/env node

/**
 * P2级单元测试体系建立脚本
 *
 * 功能：
 * 1. 安装测试框架和工具
 * 2. 配置Jest测试环境
 * 3. 创建测试目录结构
 * 4. 生成核心业务逻辑测试模板
 * 5. 设置测试覆盖率报告
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class UnitTestSetup {
  constructor() {
    this.projectRoot = path.join(__dirname, '../..');
    this.testDir = path.join(this.projectRoot, 'tests/unit');
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix =
      type === 'error' ? '❌' : type === 'warn' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  // 安装测试依赖
  async installTestDependencies() {
    this.log('安装测试框架和工具...');

    const testDependencies = [
      'jest@^29.7.0',
      'supertest@^6.3.0',
      '@jest/globals@^29.7.0',
      'jest-environment-node@^29.7.0',
      'jest-coverage-badges@^1.1.2',
      'sqlite3@^5.1.6',
    ];

    try {
      this.log('正在安装测试依赖...');
      const installCommand = `npm install --save-dev ${testDependencies.join(' ')}`;
      execSync(installCommand, {
        cwd: this.projectRoot,
        stdio: 'inherit',
      });

      this.log('✅ 测试依赖安装完成', 'success');
      return true;
    } catch (error) {
      this.log(`测试依赖安装失败: ${error.message}`, 'error');
      return false;
    }
  }

  // 创建Jest配置
  createJestConfig() {
    this.log('创建Jest配置...');

    const jestConfig = {
      testEnvironment: 'node',
      roots: ['<rootDir>/tests/unit'],
      testMatch: ['**/tests/unit/**/*.test.js', '**/tests/unit/**/*.spec.js'],
      collectCoverageFrom: [
        'routes/**/*.js',
        'utils/**/*.js',
        'middleware/**/*.js',
        'db/**/*.js',
        '!**/node_modules/**',
        '!**/tests/**',
        '!**/coverage/**',
      ],
      coverageDirectory: 'coverage',
      coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
      coverageThreshold: {
        global: {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60,
        },
      },
      setupFilesAfterEnv: ['<rootDir>/tests/unit/setup.js'],
      testTimeout: 10000,
      verbose: true,
      forceExit: true,
      clearMocks: true,
      resetMocks: true,
      restoreMocks: true,
    };

    const configPath = path.join(this.projectRoot, 'jest.config.js');
    const configContent = `module.exports = ${JSON.stringify(jestConfig, null, 2)};`;

    fs.writeFileSync(configPath, configContent);

    this.log('✅ Jest配置创建完成', 'success');
    return true;
  }

  // 创建测试目录结构
  createTestDirectories() {
    this.log('创建测试目录结构...');

    const directories = [
      'tests/unit',
      'tests/unit/routes',
      'tests/unit/utils',
      'tests/unit/middleware',
      'tests/unit/db',
      'tests/unit/fixtures',
      'tests/unit/mocks',
    ];

    directories.forEach(dir => {
      const fullPath = path.join(this.projectRoot, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        this.log(`创建目录: ${dir}`);
      }
    });

    this.log('✅ 测试目录结构创建完成', 'success');
    return true;
  }

  // 创建测试设置文件
  createTestSetup() {
    this.log('创建测试设置文件...');

    const setupContent = `/**
 * Jest测试环境设置
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.DB_PATH = ':memory:';

// 全局测试工具
global.testUtils = {
  // 创建测试用户
  createTestUser: () => ({
    id: 1,
    username: 'testuser',
    password: 'hashedpassword',
    role: 'user',
    created_at: new Date().toISOString()
  }),

  // 创建测试订单
  createTestOrder: () => ({
    id: 'test-order-001',
    user_id: 1,
    provider_id: 1,
    status: 'pending',
    created_at: new Date().toISOString()
  }),

  // 创建测试供应商
  createTestProvider: () => ({
    id: 1,
    name: 'Test Provider',
    api_url: 'https://test-api.example.com',
    status: 'active'
  })
};

// 测试数据库清理
afterEach(async () => {
  // 清理测试数据
  if (global.testDb) {
    // 清理逻辑将在具体测试中实现
  }
});

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});`;

    const setupPath = path.join(this.testDir, 'setup.js');
    fs.writeFileSync(setupPath, setupContent);

    this.log('✅ 测试设置文件创建完成', 'success');
    return true;
  }

  // 创建数据库工具测试模板
  createDatabaseTests() {
    this.log('创建数据库工具测试模板...');

    const dbTestContent = `/**
 * 数据库工具测试
 */

const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const Database = require('../../db/database');

describe('Database Utils', () => {
  let db;

  beforeAll(async () => {
    // 使用内存数据库进行测试
    db = new Database(':memory:');
    await db.init();
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  describe('用户管理', () => {
    test('应该能够创建用户', async () => {
      const userData = {
        username: 'testuser',
        password: 'hashedpassword',
        role: 'user'
      };

      const userId = await db.createUser(userData);
      expect(userId).toBeDefined();
      expect(typeof userId).toBe('number');
    });

    test('应该能够根据用户名查找用户', async () => {
      const user = await db.getUserByUsername('testuser');
      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
    });

    test('应该能够验证用户密码', async () => {
      // 这里需要根据实际的密码验证逻辑进行测试
      const user = await db.getUserByUsername('testuser');
      expect(user).toBeDefined();
    });
  });

  describe('订单管理', () => {
    test('应该能够创建订单', async () => {
      const orderData = {
        user_id: 1,
        provider_id: 1,
        details: JSON.stringify({ test: 'data' }),
        status: 'pending'
      };

      const orderId = await db.createOrder(orderData);
      expect(orderId).toBeDefined();
      expect(typeof orderId).toBe('string');
    });

    test('应该能够查询用户订单', async () => {
      const orders = await db.getUserOrders(1);
      expect(Array.isArray(orders)).toBe(true);
      expect(orders.length).toBeGreaterThan(0);
    });
  });

  describe('供应商管理', () => {
    test('应该能够获取活跃供应商', async () => {
      const providers = await db.getActiveProviders();
      expect(Array.isArray(providers)).toBe(true);
    });
  });
});`;

    const dbTestPath = path.join(this.testDir, 'db/database.test.js');
    fs.writeFileSync(dbTestPath, dbTestContent);

    this.log('✅ 数据库测试模板创建完成', 'success');
    return true;
  }

  // 更新package.json脚本
  updatePackageScripts() {
    this.log('更新package.json测试脚本...');

    const packagePath = path.join(this.projectRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    // 添加测试脚本
    packageJson.scripts = {
      ...packageJson.scripts,
      test: 'jest',
      'test:watch': 'jest --watch',
      'test:coverage': 'jest --coverage',
      'test:ci': 'jest --coverage --ci --watchAll=false',
      'test:unit': 'jest tests/unit',
      'test:db': 'jest tests/unit/db',
      'test:routes': 'jest tests/unit/routes',
      'test:utils': 'jest tests/unit/utils',
    };

    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

    this.log('✅ package.json测试脚本更新完成', 'success');
    return true;
  }

  // 主执行方法
  async run() {
    this.log('🚀 开始建立单元测试体系...');

    try {
      // 安装测试依赖
      if (!(await this.installTestDependencies())) {
        throw new Error('测试依赖安装失败');
      }

      // 创建配置和目录
      this.createJestConfig();
      this.createTestDirectories();
      this.createTestSetup();
      this.createDatabaseTests();
      this.updatePackageScripts();

      const duration = Date.now() - this.startTime;
      this.log(`🎉 单元测试体系建立完成！用时: ${Math.round(duration / 1000)}秒`, 'success');

      this.log('');
      this.log('📋 下一步操作：');
      this.log('1. 运行 npm test 执行所有测试');
      this.log('2. 运行 npm run test:coverage 查看覆盖率');
      this.log('3. 运行 npm run test:watch 开启监视模式');
      this.log('4. 在 tests/unit/ 目录下添加更多测试文件');

      return true;
    } catch (error) {
      this.log(`单元测试体系建立失败: ${error.message}`, 'error');
      return false;
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const setup = new UnitTestSetup();
  setup.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = UnitTestSetup;
