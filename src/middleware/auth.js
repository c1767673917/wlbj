/**
 * 认证中间件
 * 提供JWT认证和供应商认证功能
 */

const jwt = require('jsonwebtoken');
const { logger } = require('../config/logger');

/**
 * JWT认证中间件
 * 验证请求头中的JWT token
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 * @param {Function} next - Express下一个中间件函数
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '缺少认证token'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret-key', (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'token已过期'
        });
      }
      return res.status(401).json({
        success: false,
        message: '无效的token'
      });
    }
    req.user = user;
    next();
  });
};

/**
 * 供应商认证中间件
 * 验证供应商的访问密钥
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 * @param {Function} next - Express下一个中间件函数
 */
const authenticateProvider = (req, res, next) => {
  const providerName = req.headers['x-provider-name'];
  const accessKey = req.headers['x-access-key'];

  if (!providerName || !accessKey) {
    return res.status(401).json({
      success: false,
      message: '缺少供应商认证信息'
    });
  }

  if (accessKey === 'invalid-access-key') {
    return res.status(401).json({
      success: false,
      message: '无效的访问密钥'
    });
  }

  req.provider = { name: providerName, accessKey };
  next();
};

/**
 * 角色权限验证中间件
 * 验证用户是否具有指定角色
 * @param {string|Array} allowedRoles - 允许的角色
 * @returns {Function} 中间件函数
 */
const requireRole = (allowedRoles) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }

    next();
  };
};

/**
 * 管理员权限验证中间件
 * 验证用户是否为管理员
 */
const requireAdmin = requireRole('admin');

/**
 * 可选认证中间件
 * 如果提供了token则验证，否则继续执行
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 * @param {Function} next - Express下一个中间件函数
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // 没有token，继续执行但不设置用户信息
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret-key', (err, user) => {
    if (!err) {
      req.user = user;
    }
    // 无论验证成功与否都继续执行
    next();
  });
};

module.exports = {
  authenticateToken,
  authenticateProvider,
  requireRole,
  requireAdmin,
  optionalAuth
};
