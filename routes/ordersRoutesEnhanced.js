const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { notifyAllProvidersNewOrder } = require('../utils/wechatNotification');

// 导入认证和权限控制
const { 
  authenticateToken, 
  requirePermission, 
  PERMISSIONS 
} = require('../utils/auth');

// 导入输入验证和速率限制
const { 
  validate, 
  validationRules, 
  createOrderLimiter 
} = require('../middleware/security');

// 导入缓存模块
const { cache, cacheKeys, cacheInvalidation } = require('../utils/redisCache');

// 生成订单号：RX + yymmdd + "-" + 3位流水号
async function generateOrderId() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const dateStr = year + month + day;

  return new Promise((resolve, reject) => {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    db.get(
      'SELECT COUNT(*) as count FROM orders WHERE createdAt >= ? AND createdAt < ?',
      [todayStart, todayEnd],
      (err, row) => {
        if (err) {
          logger.error('生成订单号失败', { error: err.message });
          reject(err);
          return;
        }

        const sequenceNumber = (row.count + 1).toString().padStart(3, '0');
        const orderId = `RX${dateStr}-${sequenceNumber}`;
        resolve(orderId);
      }
    );
  });
}

// 发送企业微信通知的异步函数
async function sendWechatNotifications(order) {
  try {
    db.all('SELECT name, wechat_webhook_url FROM providers WHERE wechat_webhook_url IS NOT NULL AND wechat_webhook_url != ""', [], async (err, providers) => {
      if (err) {
        logger.error('获取物流公司列表失败:', { error: err.message });
        return;
      }

      if (providers.length === 0) {
        logger.debug('没有配置企业微信webhook的物流公司，跳过通知发送');
        return;
      }

      logger.info(`开始向 ${providers.length} 个物流公司发送订单通知...`);

      const results = await notifyAllProvidersNewOrder(order, providers);

      results.forEach(result => {
        if (result.success) {
          logger.info(`✓ 成功向 ${result.providerName} 发送订单通知`);
        } else {
          logger.error(`✗ 向 ${result.providerName} 发送订单通知失败: ${result.message}`);
        }
      });

      const successCount = results.filter(r => r.success).length;
      logger.info(`订单通知发送完成: ${successCount}/${results.length} 成功`);
    });
  } catch (error) {
    logger.error('发送企业微信通知时出错:', { error: error.message });
  }
}

// GET /api/orders/active - 获取活跃订单（用户端专用）
router.get('/active', 
  authenticateToken,
  requirePermission(PERMISSIONS.VIEW_ORDER),
  validate(validationRules.pagination),
  async (req, res) => {
    const search = req.query.search;
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 50, 100);
    
    // 尝试从缓存获取
    const cacheKey = cacheKeys.ordersList('active', page, pageSize);
    const cached = await cache.get(cacheKey);
    
    if (cached && !search) {
      logger.debug('从缓存返回活跃订单列表');
      return res.json(cached);
    }

    // 使用优化的分页查询
    let baseQuery = 'SELECT * FROM orders WHERE status = ?';
    let params = ['active'];

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      baseQuery += ' AND (id LIKE ? OR warehouse LIKE ? OR goods LIKE ? OR deliveryAddress LIKE ?)';
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    baseQuery += ' ORDER BY createdAt DESC';

    db.getPaginated(baseQuery, params, page, pageSize, async (err, result) => {
      if (err) {
        logger.error('获取活跃订单失败', { error: err.message });
        return res.status(500).json({ error: '获取活跃订单失败' });
      }

      // 统一返回格式
      const response = {
        items: result.data || [],
        totalItems: result.total || 0,
        totalPages: result.pages || 0,
        currentPage: result.page || page,
        pageSize: pageSize
      };

      // 如果没有搜索条件，则缓存结果
      if (!search) {
        await cache.set(cacheKey, response, 300); // 缓存5分钟
      }

      res.json(response);
    });
  }
);

// GET /api/orders/closed - 获取历史订单（用户端专用）
router.get('/closed', 
  authenticateToken,
  requirePermission(PERMISSIONS.VIEW_ORDER),
  validate(validationRules.pagination),
  async (req, res) => {
    const search = req.query.search;
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 50, 100);
    
    // 尝试从缓存获取
    const cacheKey = cacheKeys.ordersList('closed', page, pageSize);
    const cached = await cache.get(cacheKey);
    
    if (cached && !search) {
      logger.debug('从缓存返回历史订单列表');
      return res.json(cached);
    }

    let baseQuery = 'SELECT * FROM orders WHERE status = ?';
    let params = ['closed'];

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      baseQuery += ' AND (id LIKE ? OR warehouse LIKE ? OR goods LIKE ? OR deliveryAddress LIKE ?)';
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    baseQuery += ' ORDER BY selectedAt DESC, createdAt DESC';

    db.getPaginated(baseQuery, params, page, pageSize, async (err, result) => {
      if (err) {
        logger.error('获取历史订单失败', { error: err.message });
        return res.status(500).json({ error: '获取历史订单失败' });
      }

      // 统一返回格式
      const response = {
        items: result.data || [],
        totalItems: result.total || 0,
        totalPages: result.pages || 0,
        currentPage: result.page || page,
        pageSize: pageSize
      };

      // 如果没有搜索条件，则缓存结果
      if (!search) {
        await cache.set(cacheKey, response, 600); // 缓存10分钟
      }

      res.json(response);
    });
  }
);

// POST /api/orders - 提交新订单
router.post('/', 
  authenticateToken,
  requirePermission(PERMISSIONS.CREATE_ORDER),
  createOrderLimiter, // 速率限制
  validate(validationRules.createOrder),
  async (req, res) => {
    try {
      const orderId = await generateOrderId();

      const newOrder = {
        id: orderId,
        warehouse: req.body.warehouse,
        goods: req.body.goods,
        deliveryAddress: req.body.deliveryAddress,
        createdAt: new Date().toISOString(),
        createdBy: req.user.id
      };

      db.run(
        'INSERT INTO orders (id, warehouse, goods, deliveryAddress, createdAt) VALUES (?, ?, ?, ?, ?)',
        [newOrder.id, newOrder.warehouse, newOrder.goods, newOrder.deliveryAddress, newOrder.createdAt],
        async function(err) {
          if (err) {
            logger.error('创建订单失败', { error: err.message, userId: req.user.id });
            return res.status(500).json({ error: '创建订单失败' });
          }

          // 清理相关缓存
          await cacheInvalidation.onOrderCreated();

          // 发送企业微信通知
          sendWechatNotifications(newOrder);

          logger.info('订单创建成功', { orderId: newOrder.id, userId: req.user.id });
          res.status(201).json(newOrder);
        }
      );
    } catch (error) {
      logger.error('生成订单号失败:', { error: error.message });
      res.status(500).json({ error: '创建订单失败' });
    }
  }
);

// GET /api/orders/:id - 获取单个订单
router.get('/:id', 
  authenticateToken,
  requirePermission(PERMISSIONS.VIEW_ORDER),
  validate(validationRules.idParam),
  async (req, res) => {
    const orderId = req.params.id;
    
    // 尝试从缓存获取
    const cacheKey = cacheKeys.orderDetail(orderId);
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      logger.debug('从缓存返回订单详情', { orderId });
      return res.json(cached);
    }

    db.get('SELECT * FROM orders WHERE id = ?', [orderId], async (err, row) => {
      if (err) {
        logger.error('获取订单失败', { error: err.message, orderId });
        return res.status(500).json({ error: '获取订单失败' });
      }

      if (row) {
        // 缓存订单详情
        await cache.set(cacheKey, row, 600); // 缓存10分钟
        res.json(row);
      } else {
        res.status(404).json({ message: '订单未找到' });
      }
    });
  }
);

// GET /api/orders/:id/quotes - 获取订单的报价
router.get('/:id/quotes', 
  authenticateToken,
  requirePermission(PERMISSIONS.VIEW_ORDER),
  validate(validationRules.idParam),
  async (req, res) => {
    const orderId = req.params.id;
    
    // 尝试从缓存获取
    const cacheKey = cacheKeys.orderQuotes(orderId);
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      logger.debug('从缓存返回订单报价', { orderId });
      return res.json(cached);
    }

    db.all(
      'SELECT * FROM quotes WHERE orderId = ? ORDER BY price ASC',
      [orderId],
      async (err, rows) => {
        if (err) {
          logger.error('获取报价失败', { error: err.message, orderId });
          return res.status(500).json({ error: '获取报价失败' });
        }
        
        // 缓存报价列表
        await cache.set(cacheKey, rows, 300); // 缓存5分钟
        res.json(rows);
      }
    );
  }
);

// PUT /api/orders/:id - 更新订单
router.put('/:id', 
  authenticateToken,
  requirePermission(PERMISSIONS.UPDATE_ORDER),
  validate(validationRules.updateOrder),
  async (req, res) => {
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
        async function(err) {
          if (err) {
            logger.error('更新订单失败', { error: err.message, orderId });
            return res.status(500).json({ error: '更新订单失败' });
          }

          if (this.changes === 0) {
            return res.status(404).json({ error: '订单不存在' });
          }

          // 清理相关缓存
          await cacheInvalidation.onOrderUpdated(orderId);

          db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, row) => {
            if (err) {
              logger.error('获取更新后的订单失败', { error: err.message, orderId });
              return res.status(500).json({ error: '获取更新后的订单失败' });
            }
            
            logger.info('订单更新成功', { orderId, userId: req.user.id });
            res.json(row);
          });
        }
      );
    } catch (error) {
      logger.error('更新订单失败:', { error: error.message });
      res.status(500).json({ error: '更新订单失败' });
    }
  }
);

// PUT /api/orders/:id/close - 关闭订单
router.put('/:id/close', 
  authenticateToken,
  requirePermission(PERMISSIONS.CLOSE_ORDER),
  validate(validationRules.idParam),
  async (req, res) => {
    try {
      const orderId = req.params.id;
      const updatedAt = new Date().toISOString();

      db.run(
        'UPDATE orders SET status = ?, updatedAt = ? WHERE id = ?',
        ['closed', updatedAt, orderId],
        async function(err) {
          if (err) {
            logger.error('关闭订单失败', { error: err.message, orderId });
            return res.status(500).json({ error: '关闭订单失败' });
          }

          if (this.changes === 0) {
            return res.status(404).json({ error: '订单不存在' });
          }

          // 清理相关缓存
          await cacheInvalidation.onOrderUpdated(orderId);

          db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, row) => {
            if (err) {
              logger.error('获取更新后的订单失败', { error: err.message, orderId });
              return res.status(500).json({ error: '获取更新后的订单失败' });
            }
            
            logger.info('订单关闭成功', { orderId, userId: req.user.id });
            res.json(row);
          });
        }
      );
    } catch (error) {
      logger.error('关闭订单失败:', { error: error.message });
      res.status(500).json({ error: '关闭订单失败' });
    }
  }
);

// PUT /api/orders/:id/select-provider - 选择物流商
router.put('/:id/select-provider', 
  authenticateToken,
  requirePermission(PERMISSIONS.SELECT_PROVIDER),
  async (req, res) => {
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
            logger.error('验证报价失败', { error: err.message, orderId });
            return res.status(500).json({ error: '验证报价失败' });
          }

          if (!quote) {
            return res.status(400).json({ error: '选择的报价不存在或已失效' });
          }

          // 更新订单状态为已关闭，并记录选择的物流商信息
          db.run(
            'UPDATE orders SET status = ?, selectedProvider = ?, selectedPrice = ?, selectedAt = ?, updatedAt = ? WHERE id = ? AND status = ?',
            ['closed', provider, parseFloat(price), selectedAt, updatedAt, orderId, 'active'],
            async function(err) {
              if (err) {
                logger.error('选择物流商失败', { error: err.message, orderId });
                return res.status(500).json({ error: '选择物流商失败' });
              }

              if (this.changes === 0) {
                return res.status(404).json({ error: '订单不存在或已关闭' });
              }

              // 清理相关缓存
              await cacheInvalidation.onOrderUpdated(orderId);

              // 返回更新后的订单信息
              db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, row) => {
                if (err) {
                  logger.error('获取更新后的订单失败', { error: err.message, orderId });
                  return res.status(500).json({ error: '获取更新后的订单失败' });
                }
                
                logger.info('选择物流商成功', { 
                  orderId, 
                  provider, 
                  price, 
                  userId: req.user.id 
                });
                
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
      logger.error('选择物流商失败:', { error: error.message });
      res.status(500).json({ error: '选择物流商失败' });
    }
  }
);

module.exports = router; 