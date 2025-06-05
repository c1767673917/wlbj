const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const logger = require('../config/logger');
const {
  ROLES,
  generateAccessToken,
  generateRefreshToken,
  authenticateToken,
  requireRole
} = require('../utils/auth');

// 管理员登录验证规则
const adminLoginValidation = [
  body('password').notEmpty().isLength({ min: 4 }).trim()
];

// 管理员密码更新验证规则
const updatePasswordValidation = [
  body('currentPassword').notEmpty().trim(),
  body('newPassword').isLength({ min: 4 }).trim()
];

// 处理验证错误
function handleValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return null;
}

// 管理员登录
router.post('/login', adminLoginValidation, async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { password } = req.body;

  try {
    // 从数据库获取管理员密码
    db.get('SELECT password FROM admin_config ORDER BY id DESC LIMIT 1', async (err, config) => {
      if (err) {
        logger.error('获取管理员配置失败', { error: err.message });
        return res.status(500).json({ error: '服务器错误' });
      }

      if (!config) {
        logger.error('管理员配置不存在');
        return res.status(500).json({ error: '管理员配置未初始化' });
      }

      // 验证密码
      const isValidPassword = await bcrypt.compare(password, config.password);
      if (!isValidPassword) {
        logger.warn('管理员登录失败：密码错误', { ip: req.ip });
        return res.status(401).json({ error: '密码错误' });
      }

      // 生成管理员用户信息
      const adminUser = {
        id: 'admin',
        email: 'admin@system.local',
        name: '系统管理员',
        role: ROLES.ADMIN
      };

      // 生成tokens
      const accessToken = generateAccessToken(adminUser);
      const refreshToken = generateRefreshToken(adminUser);

      logger.info('管理员登录成功', { ip: req.ip });

      res.json({
        accessToken,
        refreshToken,
        user: adminUser
      });
    });
  } catch (error) {
    logger.error('管理员登录处理失败', { error: error.message, stack: error.stack });
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// 更新管理员密码
router.put('/password',
  authenticateToken,
  requireRole(ROLES.ADMIN),
  updatePasswordValidation,
  async (req, res) => {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const { currentPassword, newPassword } = req.body;

    try {
      // 验证当前密码
      db.get('SELECT password FROM admin_config ORDER BY id DESC LIMIT 1', async (err, config) => {
        if (err) {
          logger.error('获取管理员配置失败', { error: err.message });
          return res.status(500).json({ error: '服务器错误' });
        }

        if (!config) {
          return res.status(500).json({ error: '管理员配置不存在' });
        }

        const isValidPassword = await bcrypt.compare(currentPassword, config.password);
        if (!isValidPassword) {
          logger.warn('管理员密码更新失败：当前密码错误', { adminId: req.user.id });
          return res.status(401).json({ error: '当前密码错误' });
        }

        // 生成新密码哈希
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        const updatedAt = new Date().toISOString();

        // 更新密码
        db.run(
          'UPDATE admin_config SET password = ?, updatedAt = ? WHERE id = (SELECT id FROM admin_config ORDER BY id DESC LIMIT 1)',
          [hashedNewPassword, updatedAt],
          function(err) {
            if (err) {
              logger.error('更新管理员密码失败', { error: err.message });
              return res.status(500).json({ error: '密码更新失败' });
            }

            logger.info('管理员密码更新成功', { adminId: req.user.id });
            res.json({ message: '密码更新成功' });
          }
        );
      });
    } catch (error) {
      logger.error('管理员密码更新处理失败', { error: error.message });
      res.status(500).json({ error: '密码更新失败' });
    }
  }
);

// 获取系统统计信息
router.get('/stats',
  authenticateToken,
  requireRole(ROLES.ADMIN),
  (req, res) => {
    const stats = {
      users: { total: 0, active: 0, inactive: 0 },
      orders: { total: 0, active: 0, closed: 0 },
      providers: { total: 0 },
      quotes: { total: 0 }
    };
    let completed = 0;
    const totalQueries = 6;

    function checkComplete() {
      completed++;
      if (completed === totalQueries) {
        res.json(stats);
      }
    }

    // 用户统计
    db.get('SELECT COUNT(*) as total, SUM(isActive) as active FROM users', (err, result) => {
      if (err) {
        logger.error('获取用户统计失败', { error: err.message });
      } else {
        stats.users = {
          total: result.total || 0,
          active: result.active || 0,
          inactive: (result.total || 0) - (result.active || 0)
        };
      }
      checkComplete();
    });

    // 订单统计
    db.get('SELECT COUNT(*) as total FROM orders', (err, result) => {
      if (err) {
        logger.error('获取订单总数失败', { error: err.message });
      } else {
        stats.orders.total = result.total || 0;
      }
      checkComplete();
    });

    // 活跃订单统计
    db.get('SELECT COUNT(*) as active FROM orders WHERE status = ?', ['active'], (err, result) => {
      if (err) {
        logger.error('获取活跃订单数失败', { error: err.message });
      } else {
        stats.orders.active = result.active || 0;
      }
      checkComplete();
    });

    // 已关闭订单统计
    db.get('SELECT COUNT(*) as closed FROM orders WHERE status = ?', ['closed'], (err, result) => {
      if (err) {
        logger.error('获取已关闭订单数失败', { error: err.message });
      } else {
        stats.orders.closed = result.closed || 0;
      }
      checkComplete();
    });

    // 物流公司统计
    db.get('SELECT COUNT(*) as total FROM providers', (err, result) => {
      if (err) {
        logger.error('获取物流公司统计失败', { error: err.message });
      } else {
        stats.providers.total = result.total || 0;
      }
      checkComplete();
    });

    // 报价统计
    db.get('SELECT COUNT(*) as total FROM quotes', (err, result) => {
      if (err) {
        logger.error('获取报价统计失败', { error: err.message });
      } else {
        stats.quotes.total = result.total || 0;
      }
      checkComplete();
    });
  }
);

// 获取所有订单（管理员视图）
router.get('/orders',
  authenticateToken,
  requireRole(ROLES.ADMIN),
  (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const status = req.query.status || '';

    let query = `
      SELECT o.*, u.email as userEmail, u.name as userName
      FROM orders o
      LEFT JOIN users u ON o.userId = u.id
    `;
    let params = [];

    const conditions = [];
    if (search) {
      conditions.push('(o.id LIKE ? OR o.warehouse LIKE ? OR o.goods LIKE ? OR o.deliveryAddress LIKE ? OR u.email LIKE ? OR u.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      conditions.push('o.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY o.createdAt DESC';

    db.getPaginated(query, params, page, limit, (err, result) => {
      if (err) {
        logger.error('获取管理员订单列表失败', { error: err.message });
        return res.status(500).json({ error: '获取订单列表失败' });
      }

      res.json(result);
    });
  }
);

// 获取用户活动记录
router.get('/user-activities',
  authenticateToken,
  requireRole(ROLES.ADMIN),
  (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const userId = req.query.userId || '';

    let query = `
      SELECT
        o.id as orderId,
        o.createdAt,
        o.status,
        o.warehouse,
        o.goods,
        o.selectedProvider,
        o.selectedPrice,
        u.email as userEmail,
        u.name as userName
      FROM orders o
      LEFT JOIN users u ON o.userId = u.id
    `;
    let params = [];

    if (userId) {
      query += ' WHERE o.userId = ?';
      params.push(userId);
    }

    query += ' ORDER BY o.createdAt DESC';

    db.getPaginated(query, params, page, limit, (err, result) => {
      if (err) {
        logger.error('获取用户活动记录失败', { error: err.message });
        return res.status(500).json({ error: '获取活动记录失败' });
      }

      res.json(result);
    });
  }
);

module.exports = router;
