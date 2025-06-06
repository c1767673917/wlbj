const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const logger = require('../config/logger');
const {
  ROLES,
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  verifyPassword,
  refreshAccessToken,
  authenticateToken
} = require('../utils/auth');

// 用户登录验证规则
const loginValidation = [
  body('email').notEmpty().trim().isLength({ min: 1, max: 255 }).withMessage('用户名/邮箱不能为空'),
  body('password').notEmpty().isLength({ min: 4 }).trim().withMessage('密码不能为空且至少4个字符'),
  body('role').optional().isIn(Object.values(ROLES))
];

// 刷新token验证规则
const refreshValidation = [
  body('refreshToken').notEmpty().trim()
];

// 处理验证错误
function handleValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return null;
}

// 用户登录（仅支持用户名+密码登录）
router.post('/login', loginValidation, async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { email, password, role = ROLES.USER } = req.body;

  try {
    // 必须提供用户名/邮箱，支持邮箱或用户名登录
    const query = 'SELECT * FROM users WHERE (email = ? OR name = ?) AND isActive = 1';
    db.get(query, [email, email], async (err, user) => {
      if (err) {
        logger.error('用户登录查询失败', { error: err.message });
        return res.status(500).json({ error: '服务器错误' });
      }

      if (!user) {
        logger.warn('用户登录失败：用户不存在或已禁用', { identifier: email, ip: req.ip });
        return res.status(401).json({ error: '用户名/邮箱或密码错误' });
      }

      // 验证密码
      const bcrypt = require('bcryptjs');
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        logger.warn('用户登录失败：密码错误', { identifier: email, ip: req.ip });
        return res.status(401).json({ error: '用户名/邮箱或密码错误' });
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

      logger.info('用户登录成功', {
        userId: user.id,
        email: user.email,
        name: user.name,
        loginIdentifier: email,
        ip: req.ip
      });

      return res.json({
        accessToken,
        refreshToken,
        user: userInfo
      });
    });

  } catch (error) {
    logger.error('登录处理失败', { error: error.message, stack: error.stack });
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// 供应商登录（通过accessKey）
router.post('/login/provider', [
  body('accessKey').notEmpty().trim()
], async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { accessKey } = req.body;

  db.get('SELECT id, name FROM providers WHERE accessKey = ?', [accessKey], (err, provider) => {
    if (err) {
      logger.error('供应商登录查询失败', { error: err.message });
      return res.status(500).json({ error: '服务器错误' });
    }

    if (!provider) {
      logger.warn('供应商登录失败：无效的accessKey', { accessKey, ip: req.ip });
      return res.status(401).json({ error: '无效的访问密钥' });
    }

    // 生成供应商用户信息
    const user = {
      id: provider.id,
      name: provider.name,
      role: ROLES.PROVIDER,
      providerId: provider.id
    };

    // 生成tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    logger.info('供应商登录成功', {
      providerId: provider.id,
      providerName: provider.name,
      ip: req.ip
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        providerId: user.providerId
      }
    });
  });
});

// 刷新token
router.post('/refresh', refreshValidation, (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { refreshToken } = req.body;

  try {
    const newAccessToken = refreshAccessToken(refreshToken);

    logger.info('Token刷新成功', { ip: req.ip });

    res.json({
      accessToken: newAccessToken
    });
  } catch (error) {
    logger.warn('Token刷新失败', { error: error.message, ip: req.ip });
    res.status(403).json({ error: 'Token刷新失败：' + error.message });
  }
});

// 登出（可选，主要用于记录）
router.post('/logout', authenticateToken, (req, res) => {
  logger.info('用户登出', {
    userId: req.user.id,
    role: req.user.role,
    ip: req.ip
  });

  // 实际的token失效应该在客户端处理
  // 或者维护一个token黑名单（需要额外的存储）
  res.json({ message: '登出成功' });
});

// 获取当前用户信息
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      name: req.user.name,
      providerId: req.user.providerId
    }
  });
});

module.exports = router;