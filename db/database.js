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
        status TEXT DEFAULT 'active'
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
        createdAt TEXT NOT NULL
      )
    `);

    // 创建性能优化索引
    createPerformanceIndexes();

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

// 导出数据库实例
module.exports = db;