const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger'); // 添加日志支持

// 确保数据文件夹存在
const dataDir = path.join(__dirname, '..', 'data'); // Adjusted path relative to db/database.js
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true }); // Ensure parent 'data' dir can be created if not exists
}

// 设置SQLite数据库路径
const dbPath = path.join(dataDir, 'logistics.db');

// 创建数据库实例 - 启用缓存模式以提升性能
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    // 优化SQLite性能设置
    optimizeDatabase();
    initializeDB(); // Call initialization after connection
  }
});

// 优化数据库性能设置
function optimizeDatabase() {
  // 启用WAL模式，提升并发性能
  db.run('PRAGMA journal_mode = WAL', (err) => {
    if (err) {
      logger.error('设置WAL模式失败:', err.message);
    } else {
      logger.info('SQLite WAL模式已启用');
    }
  });

  // 设置缓存大小（-2000表示2000KB）
  db.run('PRAGMA cache_size = -2000', (err) => {
    if (err) {
      logger.error('设置缓存大小失败:', err.message);
    }
  });

  // 设置临时存储在内存中
  db.run('PRAGMA temp_store = MEMORY', (err) => {
    if (err) {
      logger.error('设置临时存储失败:', err.message);
    }
  });

  // 启用查询优化
  db.run('PRAGMA optimize');
}

// 查询性能监控装饰器
function trackQueryPerformance(queryName, query, params, callback) {
  const startTime = Date.now();

  const wrappedCallback = (err, result) => {
    const duration = Date.now() - startTime;

    // 记录慢查询（超过100ms）
    if (duration > 100) {
      logger.warn('慢查询检测', {
        queryName,
        duration: `${duration}ms`,
        query: query.substring(0, 200), // 只记录前200个字符
        paramsCount: params ? params.length : 0
      });
    } else if (duration > 50) {
      logger.debug('查询性能', {
        queryName,
        duration: `${duration}ms`
      });
    }

    callback(err, result);
  };

  return wrappedCallback;
}

// 包装数据库方法以添加性能监控
const originalRun = db.run.bind(db);
const originalGet = db.get.bind(db);
const originalAll = db.all.bind(db);

// 重写run方法
db.run = function(query, params, callback) {
  if (typeof params === 'function') {
    callback = params;
    params = [];
  }

  const trackedCallback = callback ? trackQueryPerformance('run', query, params, callback) : undefined;
  return originalRun(query, params, trackedCallback);
};

// 重写get方法
db.get = function(query, params, callback) {
  if (typeof params === 'function') {
    callback = params;
    params = [];
  }

  const trackedCallback = callback ? trackQueryPerformance('get', query, params, callback) : undefined;
  return originalGet(query, params, trackedCallback);
};

// 重写all方法
db.all = function(query, params, callback) {
  if (typeof params === 'function') {
    callback = params;
    params = [];
  }

  const trackedCallback = callback ? trackQueryPerformance('all', query, params, callback) : undefined;
  return originalAll(query, params, trackedCallback);
};

// 初始化数据库表函数
function initializeDB() {
  db.serialize(() => {
    // 创建用户表
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'user',
        createdAt TEXT NOT NULL,
        updatedAt TEXT,
        isActive INTEGER DEFAULT 1
      )
    `);

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
        selectedAt TEXT,
        userId TEXT,
        FOREIGN KEY (userId) REFERENCES users(id)
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

    // 创建管理员配置表
    db.run(`
      CREATE TABLE IF NOT EXISTS admin_config (
        id INTEGER PRIMARY KEY,
        password TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // 创建备份配置表
    db.run(`
      CREATE TABLE IF NOT EXISTS backup_config (
        id INTEGER PRIMARY KEY,
        qiniu_access_key TEXT,
        qiniu_secret_key TEXT,
        qiniu_bucket TEXT,
        qiniu_zone TEXT DEFAULT 'z0',
        backup_frequency TEXT DEFAULT 'daily',
        auto_backup_enabled INTEGER DEFAULT 0,
        last_backup_time TEXT,
        last_backup_status TEXT,
        last_backup_size TEXT,
        retention_days INTEGER DEFAULT 30,
        wechat_webhook_url TEXT,
        notification_enabled INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 数据库迁移：为现有providers表添加wechat_webhook_url字段
    migrateProvidersTable();

    // 数据库迁移：为现有orders表添加选择物流商相关字段
    migrateOrdersTable();

    // 数据库迁移：为现有orders表添加用户ID字段
    migrateOrdersTableForUsers();

    // 在所有迁移完成后创建性能优化索引
    setTimeout(() => {
      createPerformanceIndexes();
    }, 1000);

    // 初始化管理员配置
    initializeAdminConfig();

    // 初始化备份配置
    initializeBackupConfig();

    console.log('Database tables checked/created.');
  });
}

// 创建性能优化索引
function createPerformanceIndexes() {
  const indexes = [
    // 用户表索引
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
    'CREATE INDEX IF NOT EXISTS idx_users_active ON users(isActive)',

    // 订单表索引
    'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
    'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(createdAt DESC)',
    'CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, createdAt DESC)',
    'CREATE INDEX IF NOT EXISTS idx_orders_warehouse ON orders(warehouse)',
    'CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(userId)',
    'CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(userId, status)',

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

// 批量操作优化函数
db.batchInsert = function(table, columns, values, callback) {
  const placeholders = columns.map(() => '?').join(',');
  const query = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`;

  const stmt = db.prepare(query);
  let completed = 0;
  let hasError = false;

  db.run('BEGIN TRANSACTION');

  values.forEach((valueSet, index) => {
    stmt.run(valueSet, (err) => {
      if (err && !hasError) {
        hasError = true;
        db.run('ROLLBACK');
        return callback(err);
      }

      completed++;
      if (completed === values.length && !hasError) {
        db.run('COMMIT', (err) => {
          stmt.finalize();
          callback(err);
        });
      }
    });
  });
};

// 查询结果预加载和分页优化
db.getPaginated = function(query, params, page, limit, callback) {
  const offset = (page - 1) * limit;
  const paginatedQuery = `${query} LIMIT ? OFFSET ?`;
  const countQuery = query.replace(/SELECT.*FROM/i, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY.*/i, '');

  // 并行执行计数和数据查询
  let results = {};
  let completed = 0;
  let hasError = false;

  // 获取总数
  db.get(countQuery, params, (err, row) => {
    if (err) {
      hasError = true;
      return callback(err);
    }
    results.total = row.total;
    completed++;
    if (completed === 2 && !hasError) {
      callback(null, results);
    }
  });

  // 获取分页数据
  db.all(paginatedQuery, [...params, limit, offset], (err, rows) => {
    if (err) {
      hasError = true;
      return callback(err);
    }
    results.data = rows;
    results.page = page;
    results.limit = limit;
    results.pages = Math.ceil(results.total / limit);
    completed++;
    if (completed === 2 && !hasError) {
      callback(null, results);
    }
  });
};

// 添加查询分析功能
db.explainQuery = function(query, params, callback) {
  const explainQuery = `EXPLAIN QUERY PLAN ${query}`;
  db.all(explainQuery, params, (err, plan) => {
    if (err) {
      logger.error('查询计划分析失败', { error: err.message });
      return callback(err);
    }

    logger.info('查询执行计划', {
      query: query.substring(0, 200),
      plan: plan
    });

    callback(null, plan);
  });
};

// 定期优化数据库（每天执行一次）
setInterval(() => {
  db.run('PRAGMA optimize', (err) => {
    if (err) {
      logger.error('数据库优化失败', { error: err.message });
    } else {
      logger.info('数据库优化完成');
    }
  });

  // 执行VACUUM以减少数据库文件大小
  db.run('VACUUM', (err) => {
    if (err) {
      logger.error('VACUUM操作失败', { error: err.message });
    } else {
      logger.info('数据库VACUUM完成');
    }
  });
}, 24 * 60 * 60 * 1000); // 24小时

// 数据库迁移：为现有orders表添加用户ID字段
function migrateOrdersTableForUsers() {
  db.all("PRAGMA table_info(orders)", (err, columns) => {
    if (err) {
      console.error('获取orders表列信息失败:', err.message);
      return;
    }

    const columnNames = columns.map(col => col.name);

    // 添加userId字段
    if (!columnNames.includes('userId')) {
      db.run('ALTER TABLE orders ADD COLUMN userId TEXT', (err) => {
        if (err) {
          console.error('添加userId字段失败:', err.message);
        } else {
          console.log('成功为orders表添加userId字段');
        }
      });
    } else {
      console.log('orders表已包含userId字段');
    }
  });
}

// 初始化管理员配置
function initializeAdminConfig() {
  db.get('SELECT COUNT(*) as count FROM admin_config', (err, row) => {
    if (err) {
      console.error('检查管理员配置失败:', err.message);
      return;
    }

    // 如果没有管理员配置，创建默认配置
    if (row.count === 0) {
      const bcrypt = require('bcryptjs');
      const defaultPassword = 'admin123'; // 默认管理员密码

      bcrypt.hash(defaultPassword, 10, (err, hashedPassword) => {
        if (err) {
          console.error('生成管理员密码哈希失败:', err.message);
          return;
        }

        db.run(
          'INSERT INTO admin_config (password, updatedAt) VALUES (?, ?)',
          [hashedPassword, new Date().toISOString()],
          (err) => {
            if (err) {
              console.error('初始化管理员配置失败:', err.message);
            } else {
              console.log('已初始化管理员配置，默认密码: admin123');
            }
          }
        );
      });
    } else {
      console.log('管理员配置已存在');
    }
  });
}

// 初始化备份配置
function initializeBackupConfig() {
  db.get('SELECT COUNT(*) as count FROM backup_config', (err, row) => {
    if (err) {
      console.error('检查备份配置失败:', err.message);
      return;
    }

    // 如果没有备份配置，创建默认配置
    if (row.count === 0) {
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO backup_config (
          qiniu_zone, backup_frequency, auto_backup_enabled,
          retention_days, notification_enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['z0', 'daily', 0, 30, 1, now, now],
        (err) => {
          if (err) {
            console.error('初始化备份配置失败:', err.message);
          } else {
            console.log('已初始化默认备份配置');
          }
        }
      );
    } else {
      console.log('备份配置已存在');
    }
  });
}

// 导出数据库实例
module.exports = db;