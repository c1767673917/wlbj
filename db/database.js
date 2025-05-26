const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 确保数据文件夹存在
const dataDir = path.join(__dirname, '..', 'data'); // Adjusted path relative to db/database.js
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true }); // Ensure parent 'data' dir can be created if not exists
}

// 设置SQLite数据库路径
const dbPath = path.join(dataDir, 'logistics.db');

// 创建数据库实例
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDB(); // Call initialization after connection
  }
});

// 初始化数据库表函数
function initializeDB() {
  db.serialize(() => {
    // 创建订单表
    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        warehouse TEXT NOT NULL,
        goods TEXT NOT NULL,
        deliveryAddress TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT,
        status TEXT DEFAULT 'active',
        selectedProvider TEXT,
        selectedPrice REAL,
        selectedAt TEXT
      )
    `);

    // 创建报价表
    db.run(`
      CREATE TABLE IF NOT EXISTS quotes (
        id TEXT PRIMARY KEY,
        orderId TEXT NOT NULL,
        provider TEXT NOT NULL,
        price REAL NOT NULL,
        estimatedDelivery TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (orderId) REFERENCES orders(id)
      )
    `);

    // 创建物流公司表
    db.run(`
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        accessKey TEXT NOT NULL UNIQUE,
        createdAt TEXT NOT NULL,
        wechat_webhook_url TEXT
      )
    `);

    // 创建性能优化索引
    createPerformanceIndexes();

    // 数据库迁移：为现有providers表添加wechat_webhook_url字段
    migrateProvidersTable();

    // 数据库迁移：为现有orders表添加选择物流商相关字段
    migrateOrdersTable();

    console.log('Database tables checked/created.');
  });
}

// 创建性能优化索引
function createPerformanceIndexes() {
  const indexes = [
    // 订单表索引
    'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
    'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(createdAt DESC)',
    'CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, createdAt DESC)',
    'CREATE INDEX IF NOT EXISTS idx_orders_warehouse ON orders(warehouse)',

    // 报价表索引
    'CREATE INDEX IF NOT EXISTS idx_quotes_order_id ON quotes(orderId)',
    'CREATE INDEX IF NOT EXISTS idx_quotes_provider ON quotes(provider)',
    'CREATE INDEX IF NOT EXISTS idx_quotes_order_provider ON quotes(orderId, provider)',
    'CREATE INDEX IF NOT EXISTS idx_quotes_price ON quotes(price)',
    'CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(createdAt DESC)',

    // 物流公司表索引
    'CREATE INDEX IF NOT EXISTS idx_providers_access_key ON providers(accessKey)',
    'CREATE INDEX IF NOT EXISTS idx_providers_name ON providers(name)'
  ];

  indexes.forEach((indexSQL, i) => {
    db.run(indexSQL, (err) => {
      if (err) {
        console.error(`创建索引失败 (${i + 1}):`, err.message);
      } else {
        console.log(`索引创建成功 (${i + 1}/${indexes.length})`);
      }
    });
  });
}

// 数据库迁移：为现有providers表添加wechat_webhook_url字段
function migrateProvidersTable() {
  // 检查wechat_webhook_url字段是否已存在
  db.all("PRAGMA table_info(providers)", (err, columns) => {
    if (err) {
      console.error('检查providers表结构失败:', err.message);
      return;
    }

    const hasWebhookColumn = columns.some(col => col.name === 'wechat_webhook_url');

    if (!hasWebhookColumn) {
      db.run('ALTER TABLE providers ADD COLUMN wechat_webhook_url TEXT', (err) => {
        if (err) {
          console.error('添加wechat_webhook_url字段失败:', err.message);
        } else {
          console.log('成功为providers表添加wechat_webhook_url字段');
        }
      });
    } else {
      console.log('providers表已包含wechat_webhook_url字段');
    }
  });
}

// 数据库迁移：为现有orders表添加选择物流商相关字段
function migrateOrdersTable() {
  // 检查orders表结构
  db.all("PRAGMA table_info(orders)", (err, columns) => {
    if (err) {
      console.error('检查orders表结构失败:', err.message);
      return;
    }

    const columnNames = columns.map(col => col.name);
    const hasSelectedProvider = columnNames.includes('selectedProvider');
    const hasSelectedPrice = columnNames.includes('selectedPrice');
    const hasSelectedAt = columnNames.includes('selectedAt');

    // 添加缺失的字段
    if (!hasSelectedProvider) {
      db.run('ALTER TABLE orders ADD COLUMN selectedProvider TEXT', (err) => {
        if (err) {
          console.error('添加selectedProvider字段失败:', err.message);
        } else {
          console.log('成功为orders表添加selectedProvider字段');
        }
      });
    }

    if (!hasSelectedPrice) {
      db.run('ALTER TABLE orders ADD COLUMN selectedPrice REAL', (err) => {
        if (err) {
          console.error('添加selectedPrice字段失败:', err.message);
        } else {
          console.log('成功为orders表添加selectedPrice字段');
        }
      });
    }

    if (!hasSelectedAt) {
      db.run('ALTER TABLE orders ADD COLUMN selectedAt TEXT', (err) => {
        if (err) {
          console.error('添加selectedAt字段失败:', err.message);
        } else {
          console.log('成功为orders表添加selectedAt字段');
        }
      });
    }

    if (hasSelectedProvider && hasSelectedPrice && hasSelectedAt) {
      console.log('orders表已包含所有选择物流商相关字段');
    }
  });
}

// 导出数据库实例
module.exports = db;