/**
 * 集成测试环境设置
 * 配置测试数据库、模拟服务等基础设施
 */

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs').promises;

// 测试数据库配置
const TEST_DB_CONFIG = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: process.env.TEST_DB_PORT || 5432,
  database: process.env.TEST_DB_NAME || 'wlbj_test',
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'password',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

let testDbPool = null;

/**
 * 初始化测试数据库连接
 */
async function initTestDatabase() {
  try {
    testDbPool = new Pool(TEST_DB_CONFIG);
    
    // 测试连接
    const client = await testDbPool.connect();
    console.log('✅ 测试数据库连接成功');
    client.release();
    
    return testDbPool;
  } catch (error) {
    console.error('❌ 测试数据库连接失败:', error.message);
    throw error;
  }
}

/**
 * 创建测试数据库表结构
 */
async function createTestTables() {
  const client = await testDbPool.connect();
  
  try {
    // 读取数据库结构文件
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schemaSQL = await fs.readFile(schemaPath, 'utf8');
    
    // 执行表结构创建
    await client.query('BEGIN');
    await client.query(schemaSQL);
    await client.query('COMMIT');
    
    console.log('✅ 测试数据库表结构创建成功');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 创建测试数据库表结构失败:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 清理测试数据库
 */
async function cleanTestDatabase() {
  if (!testDbPool) {
    console.log('⚠️  跳过数据库清理：无数据库连接池');
    return;
  }

  const client = await testDbPool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 清理所有表数据，保持表结构
    const tables = ['quotes', 'orders', 'users'];
    for (const table of tables) {
      await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
    }
    
    await client.query('COMMIT');
    console.log('✅ 测试数据库清理完成');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 清理测试数据库失败:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 插入测试数据
 */
async function seedTestData() {
  const client = await testDbPool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 插入测试用户
    const testUsers = [
      {
        id: 'test-user-1',
        email: 'user1@test.com',
        password_hash: '$2b$10$test.hash.for.user1',
        name: 'Test User 1',
        role: 'user',
        is_active: true
      },
      {
        id: 'test-user-2',
        email: 'user2@test.com',
        password_hash: '$2b$10$test.hash.for.user2',
        name: 'Test User 2',
        role: 'user',
        is_active: true
      },
      {
        id: 'test-admin-1',
        email: 'admin@test.com',
        password_hash: '$2b$10$test.hash.for.admin',
        name: 'Test Admin',
        role: 'admin',
        is_active: true
      }
    ];
    
    for (const user of testUsers) {
      await client.query(`
        INSERT INTO users (id, email, password_hash, name, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [user.id, user.email, user.password_hash, user.name, user.role, user.is_active]);
    }
    
    // 插入测试订单
    const testOrders = [
      {
        id: 'test-order-1',
        user_id: 'test-user-1',
        warehouse: 'Test Warehouse 1',
        goods: 'Test Goods Description 1',
        delivery_address: 'Test Delivery Address 1',
        status: 'active'
      },
      {
        id: 'test-order-2',
        user_id: 'test-user-2',
        warehouse: 'Test Warehouse 2',
        goods: 'Test Goods Description 2',
        delivery_address: 'Test Delivery Address 2',
        status: 'active'
      }
    ];
    
    for (const order of testOrders) {
      await client.query(`
        INSERT INTO orders (id, user_id, warehouse, goods, delivery_address, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [order.id, order.user_id, order.warehouse, order.goods, order.delivery_address, order.status]);
    }
    
    // 插入测试报价
    const testQuotes = [
      {
        id: 'test-quote-1',
        order_id: 'test-order-1',
        provider: 'Test Provider A',
        price: 100.50,
        estimated_delivery: new Date('2025-07-01T10:00:00Z'),
        remarks: 'Test quote remarks 1'
      },
      {
        id: 'test-quote-2',
        order_id: 'test-order-1',
        provider: 'Test Provider B',
        price: 120.00,
        estimated_delivery: new Date('2025-07-02T10:00:00Z'),
        remarks: 'Test quote remarks 2'
      }
    ];
    
    for (const quote of testQuotes) {
      await client.query(`
        INSERT INTO quotes (id, order_id, provider, price, estimated_delivery, remarks, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [quote.id, quote.order_id, quote.provider, quote.price, quote.estimated_delivery, quote.remarks]);
    }
    
    await client.query('COMMIT');
    console.log('✅ 测试数据插入完成');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 插入测试数据失败:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 关闭测试数据库连接
 */
async function closeTestDatabase() {
  if (testDbPool) {
    await testDbPool.end();
    testDbPool = null;
    console.log('✅ 测试数据库连接已关闭');
  }
}

/**
 * 获取测试数据库连接池
 */
function getTestDbPool() {
  return testDbPool;
}

/**
 * 执行测试数据库查询
 */
async function queryTestDb(sql, params = []) {
  const client = await testDbPool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * 集成测试环境完整设置
 */
async function setupIntegrationTestEnvironment() {
  console.log('🚀 开始设置集成测试环境...');
  
  try {
    // 1. 初始化数据库连接
    await initTestDatabase();
    
    // 2. 创建表结构
    await createTestTables();
    
    // 3. 清理现有数据
    await cleanTestDatabase();
    
    // 4. 插入测试数据
    await seedTestData();
    
    console.log('✅ 集成测试环境设置完成');
    return testDbPool;
  } catch (error) {
    console.error('❌ 集成测试环境设置失败:', error.message);
    await closeTestDatabase();
    throw error;
  }
}

/**
 * 清理集成测试环境
 */
async function teardownIntegrationTestEnvironment() {
  console.log('🧹 开始清理集成测试环境...');

  try {
    // 检查是否跳过了数据库设置
    if (process.env.SKIP_DB_SETUP === 'true') {
      console.log('⚠️  跳过数据库清理 (SKIP_DB_SETUP=true)');
      console.log('✅ 集成测试环境清理完成（无数据库）');
      return;
    }

    // 只有在有数据库连接时才进行清理
    if (testDbPool) {
      await cleanTestDatabase();
      await closeTestDatabase();
    }
    console.log('✅ 集成测试环境清理完成');
  } catch (error) {
    console.error('❌ 清理集成测试环境失败:', error.message);
    throw error;
  }
}

/**
 * 创建测试应用实例
 * @returns {Object} Express应用实例
 */
async function createTestApp() {
  try {
    // 设置测试环境变量
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-key';
    process.env.DB_HOST = TEST_DB_CONFIG.host;
    process.env.DB_PORT = TEST_DB_CONFIG.port;
    process.env.DB_NAME = TEST_DB_CONFIG.database;
    process.env.DB_USER = TEST_DB_CONFIG.user;
    process.env.DB_PASSWORD = TEST_DB_CONFIG.password;

    // 导入应用
    const app = require('../../src/app');

    return app;
  } catch (error) {
    console.error('❌ 创建测试应用失败:', error.message);
    throw error;
  }
}

module.exports = {
  initTestDatabase,
  createTestTables,
  cleanTestDatabase,
  seedTestData,
  closeTestDatabase,
  getTestDbPool,
  queryTestDb,
  setupIntegrationTestEnvironment,
  teardownIntegrationTestEnvironment,
  createTestApp,
  TEST_DB_CONFIG
};
