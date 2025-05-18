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
    console.log('Database tables checked/created.');
  });
}

// 导出数据库实例
module.exports = db;