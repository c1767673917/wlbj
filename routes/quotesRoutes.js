const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

// GET /api/quotes - 获取报价 (可按provider过滤, 修改为按 accessKey 过滤)
router.get('/', (req, res) => {
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
    let countQuery = 'SELECT COUNT(*) as total FROM quotes q';
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
            o.goods AS orderGoods
        FROM quotes q
        JOIN orders o ON q.orderId = o.id
    `;

    if (whereClauses.length > 0) {
        const whereString = ' WHERE ' + whereClauses.join(' AND ');
        countQuery += whereString;
        dataQuery += whereString;
    }

    dataQuery += ' ORDER BY q.createdAt DESC LIMIT ? OFFSET ?';
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

// POST /api/quotes - 提交新报价 (使用 accessKey 确认物流商)
router.post('/', (req, res) => {
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

module.exports = router;