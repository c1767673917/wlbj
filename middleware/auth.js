/**
 * 认证中间件
 */

const authUtils = require('../utils/auth');
const logger = require('../config/logger');

/**
 * JWT令牌认证中间件
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return res.status(401).json({
      error: '未提供访问令牌',
    });
  }

  try {
    const decoded = authUtils.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.message === 'Token已过期') {
      return res.status(401).json({
        error: '访问令牌已过期',
      });
    } else {
      return res.status(403).json({
        error: '无效的访问令牌',
      });
    }
  }
}

/**
 * 角色验证中间件生成器
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: '需要身份验证',
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (allowedRoles.includes(userRole)) {
      next();
    } else {
      return res.status(403).json({
        error: '权限不足',
      });
    }
  };
}

/**
 * 可选认证中间件（不强制要求认证）
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (token) {
    try {
      const decoded = authUtils.verifyToken(token);
      req.user = decoded;
    } catch (error) {
      // 可选认证失败时不阻止请求，只是不设置用户信息
      req.user = null;
    }
  } else {
    req.user = null;
  }

  next();
}

/**
 * 资源所有权验证中间件
 */
function requireOwnership(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: '需要身份验证',
    });
  }

  // 管理员可以访问任何资源
  if (req.user.role === 'admin') {
    return next();
  }

  // 检查用户是否是资源所有者
  const userId = req.user.id;
  const resourceUserId = req.params.userId || req.body.userId || req.query.userId;

  if (userId.toString() === resourceUserId.toString()) {
    next();
  } else {
    return res.status(403).json({
      error: '只能访问自己的资源',
    });
  }
}

/**
 * 从Authorization头中提取Bearer令牌
 */
function extractTokenFromHeader(authHeader) {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

module.exports = {
  authenticateToken,
  requireRole,
  optionalAuth,
  requireOwnership,
  extractTokenFromHeader,
};
