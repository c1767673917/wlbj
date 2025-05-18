const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

// GET /api/orders - 获取所有订单
router.get('/', (req, res) => {
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

// POST /api/orders - 提交新订单
router.post('/', (req, res) => {
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

// GET /api/orders/available - 获取可报价订单
router.get('/available', (req, res) => {
  const accessKey = req.query.accessKey;
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

    let queryParams = [providerName, 'active'];
    let countQueryParams = [providerName, 'active'];

    let commonWhereClauses = [
      `id NOT IN (SELECT orderId FROM quotes WHERE provider = ?)`,
      `status = ?`
    ];

    const whereString = ' WHERE ' + commonWhereClauses.join(' AND ');
    let countQuery = 'SELECT COUNT(*) as total FROM orders' + whereString;
    let dataQuery = 'SELECT * FROM orders' + whereString;

    dataQuery += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    let finalDataParams = [...queryParams, pageSize, offset];

    db.get(countQuery, countQueryParams, (err, countRow) => {
      if (err) {
        console.error("Count query error (available orders):", err);
        return res.status(500).json({ error: '获取可报价订单总数失败' });
      }
      const totalItems = countRow ? countRow.total : 0;
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
          providerName
        });
      });
    });
  });
});

// GET /api/orders/:id - 获取单个订单
router.get('/:id', (req, res) => {
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

// GET /api/orders/:id/quotes - 获取订单的报价
router.get('/:id/quotes', (req, res) => {
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

// PUT /api/orders/:id - 更新订单
router.put('/:id', (req, res) => {
  try {
    const orderId = req.params.id;
    const { warehouse, goods, deliveryAddress } = req.body;
    
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

// PUT /api/orders/:id/close - 关闭订单
router.put('/:id/close', (req, res) => {
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

// POST /api/orders/:id/quotes - 为订单添加报价 (This was originally in app.js, seems more like a quote action but tied to an order)
// For now, keeping it here as it's under /api/orders/:id path.
// If we create a quotesController, this might be a candidate to move or be handled differently.
router.post('/:id/quotes', (req, res) => {
  try {
    const orderId = req.params.id;
    const { provider, price, estimatedDelivery } = req.body;
    
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

module.exports = router;