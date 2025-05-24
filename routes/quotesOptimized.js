const express = require('express');
const router = express.Router();
const db = require('../db/database');
const CacheManager = require('../utils/cache');

// 批量获取最低报价的优化接口
router.get('/lowest-batch', (req, res) => {
  const orderIds = req.query.orderIds;
  
  if (!orderIds) {
    return res.status(400).json({ error: '缺少订单ID参数' });
  }

  // 解析订单ID数组
  let orderIdArray;
  try {
    orderIdArray = Array.isArray(orderIds) ? orderIds : orderIds.split(',');
  } catch (error) {
    return res.status(400).json({ error: '订单ID格式错误' });
  }

  if (orderIdArray.length === 0) {
    return res.json({});
  }

  // 检查缓存
  const cachedResults = {};
  const uncachedOrderIds = [];

  orderIdArray.forEach(orderId => {
    const cached = CacheManager.getLowestQuoteCache(orderId);
    if (cached !== null) {
      cachedResults[orderId] = cached;
    } else {
      uncachedOrderIds.push(orderId);
    }
  });

  // 如果所有数据都在缓存中
  if (uncachedOrderIds.length === 0) {
    return res.json(cachedResults);
  }

  // 批量查询未缓存的数据
  const placeholders = uncachedOrderIds.map(() => '?').join(',');
  const query = `
    SELECT 
      orderId,
      provider,
      price,
      MIN(price) as minPrice
    FROM quotes 
    WHERE orderId IN (${placeholders})
    GROUP BY orderId
    HAVING price = MIN(price)
  `;

  db.all(query, uncachedOrderIds, (err, rows) => {
    if (err) {
      console.error('批量获取最低报价失败:', err);
      return res.status(500).json({ error: '获取最低报价失败' });
    }

    const dbResults = {};
    
    // 处理查询结果
    rows.forEach(row => {
      const lowestQuote = {
        provider: row.provider,
        price: row.price
      };
      dbResults[row.orderId] = lowestQuote;
      
      // 缓存结果
      CacheManager.setLowestQuoteCache(row.orderId, lowestQuote);
    });

    // 为没有报价的订单设置null并缓存
    uncachedOrderIds.forEach(orderId => {
      if (!dbResults[orderId]) {
        dbResults[orderId] = null;
        CacheManager.setLowestQuoteCache(orderId, null);
      }
    });

    // 合并缓存和数据库结果
    const finalResults = { ...cachedResults, ...dbResults };
    res.json(finalResults);
  });
});

// 获取单个订单的最低报价（优化版本）
router.get('/lowest/:orderId', (req, res) => {
  const orderId = req.params.orderId;

  // 检查缓存
  const cached = CacheManager.getLowestQuoteCache(orderId);
  if (cached !== null) {
    return res.json(cached);
  }

  // 优化的查询，使用索引
  const query = `
    SELECT provider, price
    FROM quotes 
    WHERE orderId = ?
    ORDER BY price ASC
    LIMIT 1
  `;

  db.get(query, [orderId], (err, row) => {
    if (err) {
      console.error('获取最低报价失败:', err);
      return res.status(500).json({ error: '获取最低报价失败' });
    }

    const result = row ? { provider: row.provider, price: row.price } : null;
    
    // 缓存结果
    CacheManager.setLowestQuoteCache(orderId, result);
    
    res.json(result);
  });
});

// 获取订单的所有报价（优化版本）
router.get('/order/:orderId', (req, res) => {
  const orderId = req.params.orderId;

  // 检查缓存
  const cached = CacheManager.getQuotesCache(orderId);
  if (cached !== null) {
    return res.json(cached);
  }

  // 优化查询，使用索引排序
  const query = `
    SELECT id, orderId, provider, price, estimatedDelivery, createdAt
    FROM quotes 
    WHERE orderId = ? 
    ORDER BY price ASC, createdAt DESC
  `;

  db.all(query, [orderId], (err, rows) => {
    if (err) {
      console.error('获取订单报价失败:', err);
      return res.status(500).json({ error: '获取报价失败' });
    }

    const result = rows || [];
    
    // 缓存结果
    CacheManager.setQuotesCache(orderId, result);
    
    res.json(result);
  });
});

module.exports = router;
