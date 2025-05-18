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

  // 创建物流公司表 (新增)
  db.run(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      accessKey TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL
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
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10; // 默认每页10条
  const offset = (page - 1) * pageSize;

  let params = [];
  let countParams = [];
  let whereClauses = [];

  // 添加状态过滤（强制要求status字段）
  if (status) {
    whereClauses.push('status = ?');
    params.push(status);
    countParams.push(status);
  }
    
  let countQuery = 'SELECT COUNT(*) as total FROM orders';
  let dataQuery = 'SELECT * FROM orders';

  if (whereClauses.length > 0) {
    const whereString = ' WHERE ' + whereClauses.join(' AND ');
    countQuery += whereString;
    dataQuery += whereString;
  }

  dataQuery += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
  params.push(pageSize, offset);

  db.get(countQuery, countParams, (err, countRow) => {
    if (err) {
      console.error("Count query error:", err);
      return res.status(500).json({ error: '获取订单总数失败' });
    }
    const totalItems = countRow.total;
    const totalPages = Math.ceil(totalItems / pageSize);

    db.all(dataQuery, params, (err, items) => {
      if (err) {
        console.error("Data query error:", err);
        return res.status(500).json({ error: '获取订单失败' });
      }
      res.json({
        items: items || [],
        totalItems,
        totalPages,
        currentPage: page,
        pageSize
      });
    });
  });
});

// 提交新订单
app.post('/api/orders', (req, res) => {
  const newOrder = {
    id: uuidv4(),
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

// 获取可报价订单 (特定供应商未报价的订单，分页)
app.get('/api/orders/available', (req, res) => {
  const accessKey = req.query.accessKey;
  // const status = req.query.status; // 'status' query parameter no longer primarily drives this, fixed to 'active'
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const offset = (page - 1) * pageSize;

  if (!accessKey) {
    return res.status(400).json({ error: '必须提供 accessKey 进行查询' });
  }

  db.get('SELECT name FROM providers WHERE accessKey = ?', [accessKey], (err, providerRow) => {
    if (err) {
      console.error("Error fetching provider by accessKey:", err);
      return res.status(500).json({ error: '查询物流商信息失败' });
    }
    if (!providerRow) {
      return res.status(404).json({ error: '无效的 accessKey 或物流商不存在' });
    }
    const providerName = providerRow.name;

    // --- Modified Section for Params and Where Clauses ---
    // Parameters for the main query, always filtering for 'active' status
    let queryParams = [providerName, 'active'];
    // Parameters for the count query
    let countQueryParams = [providerName, 'active'];

    let commonWhereClauses = [
      `id NOT IN (SELECT orderId FROM quotes WHERE provider = ?)`,
      `status = ?` // Hardcoded to filter by active status
    ];
    // --- End of Modified Section ---

    // The PRAGMA table_info check and conditional push based on req.query.status are removed
    // as this endpoint now consistently filters for 'active' orders for quoting.

    const whereString = ' WHERE ' + commonWhereClauses.join(' AND ');
    let countQuery = 'SELECT COUNT(*) as total FROM orders' + whereString;
    let dataQuery = 'SELECT * FROM orders' + whereString;

    dataQuery += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    // Add pageSize and offset to the parameters for the data retrieval query
    let finalDataParams = [...queryParams, pageSize, offset];

    db.get(countQuery, countQueryParams, (err, countRow) => {
      if (err) {
        console.error("Count query error (available orders):", err);
        return res.status(500).json({ error: '获取可报价订单总数失败' });
      }
      const totalItems = countRow ? countRow.total : 0; // Ensure countRow is not null
      const totalPages = Math.ceil(totalItems / pageSize);

      db.all(dataQuery, finalDataParams, (err, items) => {
        if (err) {
          console.error("Data query error (available orders):", err);
          return res.status(500).json({ error: '获取可报价订单失败' });
        }
        res.json({
          items: items || [],
          totalItems,
          totalPages,
          currentPage: page,
          pageSize,
          providerName // Optionally return providerName if useful for client
        });
      });
    });
  });
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

// 获取报价 (可按provider过滤, 修改为按 accessKey 过滤)
app.get('/api/quotes', (req, res) => {
  const accessKey = req.query.accessKey;
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const offset = (page - 1) * pageSize;

  let params = [];
  let countParams = [];
  let whereClauses = [];

  if (accessKey) {
    db.get('SELECT name FROM providers WHERE accessKey = ?', [accessKey], (err, providerRow) => {
      if (err) {
        console.error("Error fetching provider by accessKey for quotes:", err);
        return res.status(500).json({ error: '查询物流商信息失败' });
      }
      if (!providerRow) {
        return res.json({ items: [], totalItems: 0, totalPages: 0, currentPage: page, pageSize });
      }
      const providerName = providerRow.name;
      
    whereClauses.push('q.provider = ?'); // Alias quotes table as 'q'
    params.push(providerName);
    countParams.push(providerName);
      
      executeQuery();
    });
  } else {
    executeQuery();
  }
  
  function executeQuery() {
    // Modify countQuery to only count quotes for the specific provider if accessKey is present
    let countQuery = 'SELECT COUNT(*) as total FROM quotes q'; // Alias quotes table as 'q'
    // Select from quotes and join with orders to get order details
    let dataQuery = `
        SELECT 
            q.id, 
            q.orderId, 
            q.provider, 
            q.price, 
            q.estimatedDelivery, 
            q.createdAt,
            o.warehouse AS orderWarehouse, 
            o.deliveryAddress AS orderDeliveryAddress,
            o.goods AS orderGoods -- Also fetching goods for completeness, though not in current HTML table for history
        FROM quotes q
        JOIN orders o ON q.orderId = o.id
    `;

    if (whereClauses.length > 0) {
        const whereString = ' WHERE ' + whereClauses.join(' AND ');
        countQuery += whereString; // Apply WHERE to count query
        dataQuery += whereString; // Apply WHERE to data query
    }

    dataQuery += ' ORDER BY q.createdAt DESC LIMIT ? OFFSET ?'; // Order by quote creation time
    params.push(pageSize, offset);

    db.get(countQuery, countParams, (err, countRow) => {
        if (err) {
            console.error("Count query error (quotes):", err);
            return res.status(500).json({ error: '获取报价总数失败' });
        }
        const totalItems = countRow ? countRow.total : 0;
        const totalPages = Math.ceil(totalItems / pageSize);

        db.all(dataQuery, params, (err, items) => {
            if (err) {
                console.error("Data query error (quotes):", err);
                return res.status(500).json({ error: '获取报价失败' });
            }
            res.json({
                items: items || [],
                totalItems,
                totalPages,
                currentPage: page,
                pageSize
            });
        });
    });
  }
});

// 提交新报价 (修改: 使用 accessKey 确认物流商)
app.post('/api/quotes', (req, res) => {
  const { orderId, price, estimatedDelivery, accessKey } = req.body;

  if (!orderId || !price || !estimatedDelivery || !accessKey) {
    return res.status(400).json({ error: 'orderId, price, estimatedDelivery 和 accessKey 都是必填的' });
  }

  db.get('SELECT name FROM providers WHERE accessKey = ?', [accessKey], (err, providerRow) => {
    if (err) {
      console.error("Error fetching provider by accessKey for submitting quote:", err);
      return res.status(500).json({ error: '查询物流商信息失败' });
    }
    if (!providerRow) {
      return res.status(403).json({ error: '无效的 accessKey 或物流商不允许操作' });
    }
    const providerName = providerRow.name;

    db.get('SELECT status FROM orders WHERE id = ?', [orderId], (err, orderRow) => {
        if (err) {
            console.error("Error fetching order details:", err);
            return res.status(500).json({ error: '查询订单信息失败' });
        }
        if (!orderRow) {
            return res.status(404).json({ error: '订单不存在' });
        }
        if (orderRow.status !== 'active') {
            return res.status(400).json({ error: `订单状态为 "${orderRow.status}"，不可报价` });
        }

        db.get('SELECT id FROM quotes WHERE orderId = ? AND provider = ?', [orderId, providerName], (err, existingQuote) => {
            if (err) {
                console.error("Error checking existing quote:", err);
                return res.status(500).json({ error: '检查现有报价失败' });
            }
            if (existingQuote) {
                return res.status(409).json({ error: '您已对该订单报过价' });
            }

  const newQuote = {
    id: uuidv4(),
              orderId: orderId,
              provider: providerName,
              price: parseFloat(price),
              estimatedDelivery: estimatedDelivery,
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
    });
  });
});

// API - 添加新的物流公司 (新增)
app.post('/api/providers', (req, res) => {
  const { name, customAccessKey } = req.body; // 接收 customAccessKey
  if (!name) {
    return res.status(400).json({ error: '物流公司名称是必填的' });
  }

  let accessKeyToUse = customAccessKey;
  if (customAccessKey) {
    // 基本校验：不允许空格，可以根据需要添加更多校验规则
    if (/\s/.test(customAccessKey) || customAccessKey.length === 0) {
      return res.status(400).json({ error: '自定义链接名不能包含空格且不能为空' });
    }
    // 可选：校验字符集，例如只允许字母、数字、下划线、中划线
    if (!/^[a-zA-Z0-9_-]+$/.test(customAccessKey)) {
        return res.status(400).json({ error: '自定义链接名只能包含字母、数字、下划线和中划线' });
    }
  } else {
    accessKeyToUse = uuidv4(); // 如果未提供，则生成UUID
  }

  const newProvider = {
    id: uuidv4(),
    name: name,
    accessKey: accessKeyToUse, 
    createdAt: new Date().toISOString()
  };

  db.run(
    'INSERT INTO providers (id, name, accessKey, createdAt) VALUES (?, ?, ?, ?)',
    [newProvider.id, newProvider.name, newProvider.accessKey, newProvider.createdAt],
    function(err) {
      if (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed: providers.name')) {
          return res.status(409).json({ error: '该物流公司名称已存在' });
        }
        // 修改错误提示，更明确针对 accessKey
        if (err.message && err.message.includes('UNIQUE constraint failed: providers.accessKey')) {
          const message = customAccessKey ? '自定义链接名已被使用，请更换一个。' : '生成专属链接失败，请重试。';
          return res.status(409).json({ error: message });
        }
        console.error(err);
        return res.status(500).json({ error: '添加物流公司失败' });
      }
      res.status(201).json({
        id: newProvider.id,
        name: newProvider.name,
        accessKey: newProvider.accessKey,
        createdAt: newProvider.createdAt
      });
    }
  );
});

// API - 获取所有物流公司 (新增)
app.get('/api/providers', (req, res) => {
  db.all('SELECT id, name, accessKey, createdAt FROM providers ORDER BY createdAt DESC', [], (err, providers) => {
    if (err) {
      console.error("Error fetching providers:", err);
      return res.status(500).json({ error: '获取物流公司列表失败' });
    }
    res.json(providers); //直接返回数组
  });
});

// API - 修改供应商的 accessKey (新增)
app.put('/api/providers/:id/access-key', (req, res) => {
  const providerId = req.params.id;
  const { newAccessKey } = req.body;

  if (!newAccessKey || typeof newAccessKey !== 'string' || newAccessKey.trim() === '') {
    return res.status(400).json({ error: '新的链接名不能为空' });
  }

  const trimmedNewAccessKey = newAccessKey.trim();

  // 基本校验：不允许空格
  if (/\s/.test(trimmedNewAccessKey)) {
    return res.status(400).json({ error: '新的链接名不能包含空格' });
  }
  // 可选：校验字符集，例如只允许字母、数字、下划线、中划线
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedNewAccessKey)) {
    return res.status(400).json({ error: '新的链接名只能包含字母、数字、下划线和中划线' });
  }

  // 1. 检查新的 accessKey 是否已被其他供应商使用
  db.get('SELECT id FROM providers WHERE accessKey = ? AND id != ?', [trimmedNewAccessKey, providerId], (err, existingProvider) => {
    if (err) {
      console.error("Error checking accessKey uniqueness:", err);
      return res.status(500).json({ error: '检查链接名唯一性失败' });
    }
    if (existingProvider) {
      return res.status(409).json({ error: '该链接名已被其他供应商使用，请选择其他名称' });
    }

    // 2. 更新 accessKey
    db.run('UPDATE providers SET accessKey = ? WHERE id = ?', [trimmedNewAccessKey, providerId], function(err) {
      if (err) {
        console.error("Error updating accessKey:", err);
        return res.status(500).json({ error: '更新链接名失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '未找到指定ID的物流公司' });
      }
      res.json({ message: '链接名更新成功', newAccessKey: trimmedNewAccessKey });
    });
  });
});

// API - 删除指定ID的物流公司 (新增)
app.delete('/api/providers/:id', (req, res) => {
  const providerId = req.params.id;

  // 可选：在删除供应商前，处理其关联的报价。例如，删除或将其标记为无效。
  // 为了简单起见，这里我们直接删除供应商。
  // db.run('DELETE FROM quotes WHERE provider = (SELECT name FROM providers WHERE id = ?)', [providerId], function(err) { ... });

  db.run('DELETE FROM providers WHERE id = ?', [providerId], function(err) {
    if (err) {
      console.error("Error deleting provider:", err);
      return res.status(500).json({ error: '删除物流公司失败' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '未找到指定ID的物流公司' });
    }
    res.json({ message: '物流公司删除成功' });
  });
});

// API - 根据 accessKey 获取单个物流公司详细信息 (新增)
app.get('/api/provider-details', (req, res) => {
  const accessKey = req.query.accessKey;
  if (!accessKey) {
    return res.status(400).json({ error: '必须提供 accessKey' });
  }
  db.get('SELECT id, name, accessKey, createdAt FROM providers WHERE accessKey = ?', [accessKey], (err, provider) => {
    if (err) {
      console.error("Error fetching provider details by accessKey:", err);
      return res.status(500).json({ error: '查询物流公司信息失败' });
    }
    if (!provider) {
      return res.status(404).json({ error: '找不到具有指定 accessKey 的物流公司' });
    }
    res.json(provider);
  });
});

// 前端路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'home.html'));
});

app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/provider/:accessKey', (req, res) => {
  const accessKey = req.params.accessKey;
  db.get('SELECT id, name FROM providers WHERE accessKey = ?', [accessKey], (err, provider) => {
    if (err) {
      console.error('Error validating accessKey:', err);
      return res.status(500).send('服务器错误');
    }
    if (!provider) {
      return res.status(404).send('页面未找到或无效的访问链接。请确保链接正确，或联系管理员。');
    }
  res.sendFile(path.join(__dirname, 'views', 'provider.html'));
  });
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

// 关闭应用时关闭数据库连接
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
}); 