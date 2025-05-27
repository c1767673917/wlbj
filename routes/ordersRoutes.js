const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const { notifyAllProvidersNewOrder } = require('../utils/wechatNotification');

// 生成订单号：RX + yymmdd + "-" + 3位流水号
function generateOrderId() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // 取年份后两位
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 月份补零
  const day = now.getDate().toString().padStart(2, '0'); // 日期补零
  const dateStr = year + month + day;

  return new Promise((resolve, reject) => {
    // 查询今天已有的订单数量来生成流水号
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    db.get(
      'SELECT COUNT(*) as count FROM orders WHERE createdAt >= ? AND createdAt < ?',
      [todayStart, todayEnd],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        const sequenceNumber = (row.count + 1).toString().padStart(3, '0'); // 3位流水号，从001开始
        const orderId = `RX${dateStr}-${sequenceNumber}`;
        resolve(orderId);
      }
    );
  });
}

// 发送企业微信通知的异步函数
async function sendWechatNotifications(order) {
  try {
    // 获取所有配置了企业微信webhook的物流公司
    db.all('SELECT name, wechat_webhook_url FROM providers WHERE wechat_webhook_url IS NOT NULL AND wechat_webhook_url != ""', [], async (err, providers) => {
      if (err) {
        console.error('获取物流公司列表失败:', err);
        return;
      }

      if (providers.length === 0) {
        console.log('没有配置企业微信webhook的物流公司，跳过通知发送');
        return;
      }

      console.log(`开始向 ${providers.length} 个物流公司发送订单通知...`);

      // 发送通知
      const results = await notifyAllProvidersNewOrder(order, providers);

      // 记录发送结果
      results.forEach(result => {
        if (result.success) {
          console.log(`✓ 成功向 ${result.providerName} 发送订单通知`);
        } else {
          console.error(`✗ 向 ${result.providerName} 发送订单通知失败: ${result.message}`);
        }
      });

      const successCount = results.filter(r => r.success).length;
      console.log(`订单通知发送完成: ${successCount}/${results.length} 成功`);
    });
  } catch (error) {
    console.error('发送企业微信通知时出错:', error);
  }
}

// GET /api/orders/active - 获取活跃订单（用户端专用）
router.get('/active', (req, res) => {
  const search = req.query.search;
  const page = parseInt(req.query.page) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize) || 50, 1000);
  const offset = (page - 1) * pageSize;

  let params = ['active'];
  let countParams = ['active'];
  let whereClauses = ['status = ?'];

  // 添加搜索过滤
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    whereClauses.push('(id LIKE ? OR warehouse LIKE ? OR goods LIKE ? OR deliveryAddress LIKE ?)');
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  const whereString = ' WHERE ' + whereClauses.join(' AND ');
  let countQuery = 'SELECT COUNT(*) as total FROM orders' + whereString;
  let dataQuery = 'SELECT id, warehouse, goods, deliveryAddress, createdAt, updatedAt, status FROM orders' + whereString;

  dataQuery += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
  params.push(pageSize, offset);

  db.get(countQuery, countParams, (err, countRow) => {
    if (err) {
      console.error("Count query error (active orders):", err);
      return res.status(500).json({ error: '获取活跃订单总数失败' });
    }
    const totalItems = countRow.total;
    const totalPages = Math.ceil(totalItems / pageSize);

    db.all(dataQuery, params, (err, items) => {
      if (err) {
        console.error("Data query error (active orders):", err);
        return res.status(500).json({ error: '获取活跃订单失败' });
      }
      res.json({
        items: items || [],
        totalItems,
        totalPages,
        currentPage: page,
        pageSize,
        hasSearch: !!search
      });
    });
  });
});

// GET /api/orders/closed - 获取历史订单（用户端专用）
router.get('/closed', (req, res) => {
  const search = req.query.search;
  const page = parseInt(req.query.page) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize) || 50, 1000);
  const offset = (page - 1) * pageSize;

  let params = ['closed'];
  let countParams = ['closed'];
  let whereClauses = ['status = ?'];

  // 添加搜索过滤
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    whereClauses.push('(id LIKE ? OR warehouse LIKE ? OR goods LIKE ? OR deliveryAddress LIKE ?)');
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  const whereString = ' WHERE ' + whereClauses.join(' AND ');
  let countQuery = 'SELECT COUNT(*) as total FROM orders' + whereString;
  // 历史订单需要包含选择的物流商信息
  let dataQuery = 'SELECT id, warehouse, goods, deliveryAddress, createdAt, updatedAt, status, selectedProvider, selectedPrice, selectedAt FROM orders' + whereString;

  dataQuery += ' ORDER BY selectedAt DESC, createdAt DESC LIMIT ? OFFSET ?';
  params.push(pageSize, offset);

  db.get(countQuery, countParams, (err, countRow) => {
    if (err) {
      console.error("Count query error (closed orders):", err);
      return res.status(500).json({ error: '获取历史订单总数失败' });
    }
    const totalItems = countRow.total;
    const totalPages = Math.ceil(totalItems / pageSize);

    db.all(dataQuery, params, (err, items) => {
      if (err) {
        console.error("Data query error (closed orders):", err);
        return res.status(500).json({ error: '获取历史订单失败' });
      }
      res.json({
        items: items || [],
        totalItems,
        totalPages,
        currentPage: page,
        pageSize,
        hasSearch: !!search
      });
    });
  });
});

// GET /api/orders - 获取所有订单（管理员用，优化版本）
router.get('/', (req, res) => {
  const status = req.query.status;
  const search = req.query.search; // 新增搜索参数
  const page = parseInt(req.query.page) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize) || 10, 50); // 限制最大页面大小
  const offset = (page - 1) * pageSize;

  let params = [];
  let countParams = [];
  let whereClauses = [];

  // 添加状态过滤
  if (status) {
    whereClauses.push('status = ?');
    params.push(status);
    countParams.push(status);
  }

  // 添加搜索过滤
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    whereClauses.push('(id LIKE ? OR warehouse LIKE ? OR goods LIKE ? OR deliveryAddress LIKE ?)');
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  let countQuery = 'SELECT COUNT(*) as total FROM orders';
  // 包含选择物流商相关字段，用于订单历史显示
  let dataQuery = 'SELECT id, warehouse, goods, deliveryAddress, createdAt, updatedAt, status, selectedProvider, selectedPrice, selectedAt FROM orders';

  if (whereClauses.length > 0) {
    const whereString = ' WHERE ' + whereClauses.join(' AND ');
    countQuery += whereString;
    dataQuery += whereString;
  }

  // 使用索引优化的排序
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
        pageSize,
        hasSearch: !!search
      });
    });
  });
});

// POST /api/orders - 提交新订单
router.post('/', async (req, res) => {
  try {
    // 生成新的订单号格式
    const orderId = await generateOrderId();

    const newOrder = {
      id: orderId,
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

        // 订单创建成功后，发送企业微信通知
        sendWechatNotifications(newOrder);

        res.status(201).json(newOrder);
      }
    );
  } catch (error) {
    console.error('生成订单号失败:', error);
    res.status(500).json({ error: '创建订单失败' });
  }
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

// PUT /api/orders/:id/select-provider - 选择物流商
router.put('/:id/select-provider', (req, res) => {
  try {
    const orderId = req.params.id;
    const { provider, price } = req.body;

    if (!provider || !price) {
      return res.status(400).json({ error: '物流商名称和报价金额都是必填的' });
    }

    const updatedAt = new Date().toISOString();
    const selectedAt = new Date().toISOString();

    // 首先验证该报价是否存在
    db.get(
      'SELECT * FROM quotes WHERE orderId = ? AND provider = ? AND price = ?',
      [orderId, provider, parseFloat(price)],
      (err, quote) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: '验证报价失败' });
        }

        if (!quote) {
          return res.status(400).json({ error: '选择的报价不存在或已失效' });
        }

        // 更新订单状态为已关闭，并记录选择的物流商信息
        db.run(
          'UPDATE orders SET status = ?, selectedProvider = ?, selectedPrice = ?, selectedAt = ?, updatedAt = ? WHERE id = ? AND status = ?',
          ['closed', provider, parseFloat(price), selectedAt, updatedAt, orderId, 'active'],
          function(err) {
            if (err) {
              console.error(err);
              return res.status(500).json({ error: '选择物流商失败' });
            }

            if (this.changes === 0) {
              return res.status(404).json({ error: '订单不存在或已关闭' });
            }

            // 返回更新后的订单信息
            db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, row) => {
              if (err) {
                console.error(err);
                return res.status(500).json({ error: '获取更新后的订单失败' });
              }
              res.json({
                ...row,
                message: '成功选择物流商，订单已移至历史记录'
              });
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('选择物流商失败:', error);
    res.status(500).json({ error: '选择物流商失败' });
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