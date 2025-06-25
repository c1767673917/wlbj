/**
 * E2E测试数据库初始化脚本
 */

const knex = require('knex');
const path = require('path');
const fs = require('fs');

async function setupTestDatabase() {
  console.log('🔧 初始化E2E测试数据库...');

  // 测试数据库路径
  const testDbPath = path.join(__dirname, '../../data/test_e2e.db');
  
  // 确保data目录存在
  const dataDir = path.dirname(testDbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 删除旧的测试数据库
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  // 创建数据库连接
  const db = knex({
    client: 'sqlite3',
    connection: {
      filename: testDbPath
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, '../../migrations')
    }
  });

  try {
    // 运行迁移
    console.log('📦 运行数据库迁移...');
    await db.migrate.latest();
    
    console.log('✅ 数据库迁移完成');

    // 插入基础测试数据
    console.log('📝 插入基础测试数据...');

    // 插入管理员密码配置（如果需要）
    await db('admin_config').insert({
      password: '$2b$12$dummy.hash.for.testing.purposes.only',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    console.log('✅ 基础测试数据插入完成');

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  } finally {
    await db.destroy();
  }

  console.log('✅ E2E测试数据库初始化完成');
}

module.exports = { setupTestDatabase };

// 如果直接运行此脚本
if (require.main === module) {
  setupTestDatabase().catch(console.error);
}
