const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');
const {
  ROLES,
  PERMISSIONS,
  generateAccessToken,
  generateRefreshToken,
  authenticateToken,
  requirePermission,
  requireRole
} = require('../utils/auth');

// 用户注册验证规则
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 4 }).trim(),
  body('name').optional().trim().isLength({ min: 1, max: 100 })
];

// 用户更新验证规则
const updateUserValidation = [
  body('email').optional().isEmail().normalizeEmail(),
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('isActive').optional().isBoolean()
];

// 密码更新验证规则
const updatePasswordValidation = [
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

// 用户注册
router.post('/register', registerValidation, async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { email, password, name } = req.body;

  try {
    // 检查邮箱是否已存在
    db.get('SELECT id FROM users WHERE email = ?', [email], async (err, existingUser) => {
      if (err) {
        logger.error('检查用户邮箱失败', { error: err.message });
        return res.status(500).json({ error: '服务器错误' });
      }

      if (existingUser) {
        return res.status(400).json({ error: '该邮箱已被注册' });
      }

      // 生成密码哈希
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      const now = new Date().toISOString();

      // 创建用户
      db.run(
        'INSERT INTO users (id, email, password, name, role, createdAt, updatedAt, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, email, hashedPassword, name || '', ROLES.USER, now, now, 1],
        function(err) {
          if (err) {
            logger.error('创建用户失败', { error: err.message, email });
            return res.status(500).json({ error: '创建用户失败' });
          }

          logger.info('用户注册成功', { userId, email, ip: req.ip });

          // 生成tokens
          const user = {
            id: userId,
            email,
            name: name || '',
            role: ROLES.USER
          };

          const accessToken = generateAccessToken(user);
          const refreshToken = generateRefreshToken(user);

          res.status(201).json({
            message: '注册成功',
            accessToken,
            refreshToken,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role
            }
          });
        }
      );
    });
  } catch (error) {
    logger.error('用户注册处理失败', { error: error.message, stack: error.stack });
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

// 用户登录（邮箱密码方式）
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().trim()
], async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { email, password } = req.body;

  try {
    db.get('SELECT * FROM users WHERE email = ? AND isActive = 1', [email], async (err, user) => {
      if (err) {
        logger.error('用户登录查询失败', { error: err.message });
        return res.status(500).json({ error: '服务器错误' });
      }

      if (!user) {
        logger.warn('用户登录失败：用户不存在或已禁用', { email, ip: req.ip });
        return res.status(401).json({ error: '邮箱或密码错误' });
      }

      // 验证密码
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        logger.warn('用户登录失败：密码错误', { email, ip: req.ip });
        return res.status(401).json({ error: '邮箱或密码错误' });
      }

      // 生成tokens
      const userInfo = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      };

      const accessToken = generateAccessToken(userInfo);
      const refreshToken = generateRefreshToken(userInfo);

      logger.info('用户登录成功', { userId: user.id, email, ip: req.ip });

      res.json({
        accessToken,
        refreshToken,
        user: userInfo
      });
    });
  } catch (error) {
    logger.error('用户登录处理失败', { error: error.message, stack: error.stack });
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// 获取所有用户（管理员专用）
router.get('/',
  authenticateToken,
  requireRole(ROLES.ADMIN),
  (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';

    let query = 'SELECT id, email, name, role, createdAt, updatedAt, isActive FROM users';
    let params = [];

    if (search) {
      query += ' WHERE email LIKE ? OR name LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY createdAt DESC';

    db.getPaginated(query, params, page, limit, (err, result) => {
      if (err) {
        logger.error('获取用户列表失败', { error: err.message });
        return res.status(500).json({ error: '获取用户列表失败' });
      }

      res.json(result);
    });
  }
);

// 获取单个用户信息（管理员专用）
router.get('/:id',
  authenticateToken,
  requireRole(ROLES.ADMIN),
  (req, res) => {
    const userId = req.params.id;

    db.get(
      'SELECT id, email, name, role, createdAt, updatedAt, isActive FROM users WHERE id = ?',
      [userId],
      (err, user) => {
        if (err) {
          logger.error('获取用户信息失败', { error: err.message, userId });
          return res.status(500).json({ error: '获取用户信息失败' });
        }

        if (!user) {
          return res.status(404).json({ error: '用户不存在' });
        }

        res.json(user);
      }
    );
  }
);

// 更新用户信息（管理员专用）
router.put('/:id',
  authenticateToken,
  requireRole(ROLES.ADMIN),
  updateUserValidation,
  (req, res) => {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const userId = req.params.id;
    const { email, name, isActive } = req.body;
    const updatedAt = new Date().toISOString();

    // 构建更新字段
    const updates = [];
    const params = [];

    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (isActive !== undefined) {
      updates.push('isActive = ?');
      params.push(isActive ? 1 : 0);
    }

    updates.push('updatedAt = ?');
    params.push(updatedAt);
    params.push(userId);

    if (updates.length === 1) { // 只有updatedAt
      return res.status(400).json({ error: '没有提供要更新的字段' });
    }

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

    db.run(query, params, function(err) {
      if (err) {
        logger.error('更新用户信息失败', { error: err.message, userId });
        return res.status(500).json({ error: '更新用户信息失败' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }

      logger.info('用户信息更新成功', { userId, adminId: req.user.id });
      res.json({ message: '用户信息更新成功' });
    });
  }
);

// 重置用户密码（管理员专用）
router.put('/:id/password',
  authenticateToken,
  requireRole(ROLES.ADMIN),
  updatePasswordValidation,
  async (req, res) => {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const userId = req.params.id;
    const { newPassword } = req.body;

    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const updatedAt = new Date().toISOString();

      db.run(
        'UPDATE users SET password = ?, updatedAt = ? WHERE id = ?',
        [hashedPassword, updatedAt, userId],
        function(err) {
          if (err) {
            logger.error('重置用户密码失败', { error: err.message, userId });
            return res.status(500).json({ error: '重置密码失败' });
          }

          if (this.changes === 0) {
            return res.status(404).json({ error: '用户不存在' });
          }

          logger.info('用户密码重置成功', { userId, adminId: req.user.id });
          res.json({ message: '密码重置成功' });
        }
      );
    } catch (error) {
      logger.error('重置密码处理失败', { error: error.message, userId });
      res.status(500).json({ error: '重置密码失败' });
    }
  }
);

// 删除用户（管理员专用）
router.delete('/:id',
  authenticateToken,
  requireRole(ROLES.ADMIN),
  (req, res) => {
    const userId = req.params.id;

    // 检查用户是否存在以及是否有关联的订单
    db.get('SELECT COUNT(*) as orderCount FROM orders WHERE userId = ?', [userId], (err, result) => {
      if (err) {
        logger.error('检查用户订单失败', { error: err.message, userId });
        return res.status(500).json({ error: '删除用户失败' });
      }

      if (result.orderCount > 0) {
        return res.status(400).json({
          error: '无法删除该用户，因为该用户有关联的订单数据',
          orderCount: result.orderCount
        });
      }

      // 删除用户
      db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
        if (err) {
          logger.error('删除用户失败', { error: err.message, userId });
          return res.status(500).json({ error: '删除用户失败' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: '用户不存在' });
        }

        logger.info('用户删除成功', { userId, adminId: req.user.id });
        res.json({ message: '用户删除成功' });
      });
    });
  }
);

module.exports = router;
