const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// 确保数据文件夹存在
const dataDir = path.join(__dirname, 'data');
const fs = require('fs');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// 设置SQLite数据库
const dbPath = path.join(dataDir, 'logistics.db');

// 如果需要重建数据库，请取消注释下面一行
// // if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const db = new sqlite3.Database(dbPath);

// 初始化数据库表
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
});

// 中间件
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/xlsx', express.static(path.join(__dirname, 'node_modules/xlsx/dist')));

// 添加CORS支持
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// 路由 - 获取所有订单
app.get('/api/orders', (req, res) => {
  const status = req.query.status;
  
  // 检查数据库中orders表是否有status列
  db.get("PRAGMA table_info(orders)", (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: '数据库查询失败' });
    }
    
    let query = 'SELECT * FROM orders';
    let params = [];
    
    // 检查rows中是否有名为'status'的列
    const hasStatusColumn = Array.isArray(rows) && rows.some(row => row.name === 'status');
    
    if (hasStatusColumn && status) {
      // 如果有status列且提供了status参数，按status过滤
      query += ' WHERE status = ? ORDER BY createdAt DESC';
      params = [status];
    } else {
      // 否则返回所有订单
      query += ' ORDER BY createdAt DESC';
    }
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: '获取订单失败' });
      }
      res.json(rows || []);
    });
  });
});

// 提交新订单
app.post('/api/orders', (req, res) => {
  const newOrder = {
    id: Date.now().toString(),
    warehouse: req.body.warehouse,
    goods: req.body.goods,
    deliveryAddress: req.body.deliveryAddress,
    createdAt: new Date().toISOString()
  };
  
  db.run(
    'INSERT INTO orders (id, warehouse, goods, deliveryAddress, createdAt) VALUES (?, ?, ?, ?, ?)',
    [newOrder.id, newOrder.warehouse, newOrder.goods, newOrder.deliveryAddress, newOrder.createdAt],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: '创建订单失败' });
      }
      res.status(201).json(newOrder);
    }
  );
});

// 获取单个订单
app.get('/api/orders/:id', (req, res) => {
  db.get('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: '获取订单失败' });
    }
    
    if (row) {
      res.json(row);
    } else {
      res.status(404).json({ message: '订单未找到' });
    }
  });
});

// 获取订单的报价
app.get('/api/orders/:id/quotes', (req, res) => {
  db.all(
    'SELECT * FROM quotes WHERE orderId = ? ORDER BY price ASC',
    [req.params.id],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: '获取报价失败' });
      }
      res.json(rows);
    }
  );
});

// 提交新报价
app.post('/api/quotes', (req, res) => {
  const newQuote = {
    id: Date.now().toString(),
    orderId: req.body.orderId,
    provider: req.body.provider,
    price: parseFloat(req.body.price),
    estimatedDelivery: req.body.estimatedDelivery,
    createdAt: new Date().toISOString()
  };
  
  db.run(
    'INSERT INTO quotes (id, orderId, provider, price, estimatedDelivery, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [newQuote.id, newQuote.orderId, newQuote.provider, newQuote.price, newQuote.estimatedDelivery, newQuote.createdAt],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: '创建报价失败' });
      }
      res.status(201).json(newQuote);
    }
  );
});

// 前端路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'home.html'));
});

app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/provider', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'provider.html'));
});

// 更新订单
app.put('/api/orders/:id', (req, res) => {
  try {
    const orderId = req.params.id;
    const { warehouse, goods, deliveryAddress } = req.body;
    
    // 简单验证
    if (!warehouse || !goods || !deliveryAddress) {
      return res.status(400).json({ error: '所有字段都是必填的' });
    }
    
    const updatedAt = new Date().toISOString();
    
    db.run(
      'UPDATE orders SET warehouse = ?, goods = ?, deliveryAddress = ?, updatedAt = ? WHERE id = ?',
      [warehouse, goods, deliveryAddress, updatedAt, orderId],
      function(err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: '更新订单失败' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: '订单不存在' });
        }
        
        // 获取更新后的订单
        db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, row) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: '获取更新后的订单失败' });
          }
          res.json(row);
        });
      }
    );
  } catch (error) {
    console.error('更新订单失败:', error);
    res.status(500).json({ error: '更新订单失败' });
  }
});

// 关闭订单（移动到历史）
app.put('/api/orders/:id/close', (req, res) => {
  try {
    const orderId = req.params.id;
    const updatedAt = new Date().toISOString();
    
    db.run(
      'UPDATE orders SET status = ?, updatedAt = ? WHERE id = ?',
      ['closed', updatedAt, orderId],
      function(err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: '关闭订单失败' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: '订单不存在' });
        }
        
        // 获取更新后的订单
        db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, row) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: '获取更新后的订单失败' });
          }
          res.json(row);
        });
      }
    );
  } catch (error) {
    console.error('关闭订单失败:', error);
    res.status(500).json({ error: '关闭订单失败' });
  }
});

// 为订单添加报价
app.post('/api/orders/:id/quotes', (req, res) => {
  try {
    const orderId = req.params.id;
    const { provider, price, estimatedDelivery } = req.body;
    
    // 简单验证
    if (!provider || !price || !estimatedDelivery) {
      return res.status(400).json({ error: '所有字段都是必填的' });
    }
    
    const quote = {
      id: uuidv4(),
      orderId,
      provider,
      price: parseFloat(price),
      estimatedDelivery,
      createdAt: new Date().toISOString()
    };
    
    db.run(
      'INSERT INTO quotes (id, orderId, provider, price, estimatedDelivery, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [quote.id, quote.orderId, quote.provider, quote.price, quote.estimatedDelivery, quote.createdAt],
      function(err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: '创建报价失败' });
        }
        res.status(201).json(quote);
      }
    );
  } catch (error) {
    console.error('创建报价失败:', error);
    res.status(500).json({ error: '创建报价失败' });
  }
});

// 数据迁移：从JSON文件导入到SQLite
const migrateData = () => {
  const ordersFile = path.join(dataDir, 'orders.json');
  const quotesFile = path.join(dataDir, 'quotes.json');
  
  // 导入订单数据
  if (fs.existsSync(ordersFile)) {
    try {
      const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
      if (orders.length > 0) {
        const stmt = db.prepare('INSERT OR IGNORE INTO orders (id, warehouse, goods, deliveryAddress, createdAt, status) VALUES (?, ?, ?, ?, ?, ?)');
        orders.forEach(order => {
          // 默认所有导入的订单为活跃状态
          stmt.run(order.id, order.warehouse, order.goods, order.deliveryAddress, order.createdAt, 'active');
        });
        stmt.finalize();
        console.log(`已成功导入 ${orders.length} 条订单数据`);
      }
    } catch (error) {
      console.error('导入订单数据失败:', error);
    }
  }
  
  // 导入报价数据
  if (fs.existsSync(quotesFile)) {
    try {
      const quotes = JSON.parse(fs.readFileSync(quotesFile, 'utf8'));
      if (quotes.length > 0) {
        const stmt = db.prepare('INSERT OR IGNORE INTO quotes (id, orderId, provider, price, estimatedDelivery, createdAt) VALUES (?, ?, ?, ?, ?, ?)');
        quotes.forEach(quote => {
          stmt.run(quote.id, quote.orderId, quote.provider, quote.price, quote.estimatedDelivery, quote.createdAt);
        });
        stmt.finalize();
        console.log(`已成功导入 ${quotes.length} 条报价数据`);
      }
    } catch (error) {
      console.error('导入报价数据失败:', error);
    }
  }
};

// 执行数据迁移
migrateData();

// 关闭应用时关闭数据库连接
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
}); 