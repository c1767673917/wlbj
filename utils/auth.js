const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/env');
const logger = require('../config/logger');

// JWT配置
const JWT_SECRET = config.jwtSecret;
const ACCESS_TOKEN_EXPIRE = '15m'; // 访问token过期时间
const REFRESH_TOKEN_EXPIRE = '7d'; // 刷新token过期时间

// 用户角色定义
const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  PROVIDER: 'provider',
};

// 权限定义
const PERMISSIONS = {
  // 用户权限
  CREATE_ORDER: 'create_order',
  VIEW_ORDER: 'view_order',
  UPDATE_ORDER: 'update_order',
  DELETE_ORDER: 'delete_order',
  CLOSE_ORDER: 'close_order',
  SELECT_PROVIDER: 'select_provider',

  // 供应商权限
  VIEW_AVAILABLE_ORDERS: 'view_available_orders',
  CREATE_QUOTE: 'create_quote',
  VIEW_OWN_QUOTES: 'view_own_quotes',

  // 管理员权限
  MANAGE_PROVIDERS: 'manage_providers',
  EXPORT_DATA: 'export_data',
  VIEW_ALL_DATA: 'view_all_data',
};

// 角色权限映射
const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS), // 管理员拥有所有权限
  [ROLES.USER]: [
    PERMISSIONS.CREATE_ORDER,
    PERMISSIONS.VIEW_ORDER,
    PERMISSIONS.UPDATE_ORDER,
    PERMISSIONS.DELETE_ORDER,
    PERMISSIONS.CLOSE_ORDER,
    PERMISSIONS.SELECT_PROVIDER,
    PERMISSIONS.MANAGE_PROVIDERS,
    PERMISSIONS.EXPORT_DATA,
  ],
  [ROLES.PROVIDER]: [
    PERMISSIONS.VIEW_AVAILABLE_ORDERS,
    PERMISSIONS.CREATE_QUOTE,
    PERMISSIONS.VIEW_OWN_QUOTES,
  ],
};

// 生成访问token
function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRE });
}

// 生成刷新token
function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRE });
}

// 验证token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token已过期');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('无效的Token');
    }
    throw error;
  }
}

// 生成密码哈希
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// 验证密码
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// 检查用户是否有特定权限
function hasPermission(userRole, requiredPermission) {
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return rolePermissions.includes(requiredPermission);
}

// 检查用户是否有多个权限中的任意一个
function hasAnyPermission(userRole, requiredPermissions) {
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return requiredPermissions.some(permission => rolePermissions.includes(permission));
}

// 检查用户是否有所有指定权限
function hasAllPermissions(userRole, requiredPermissions) {
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return requiredPermissions.every(permission => rolePermissions.includes(permission));
}

// JWT认证中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    logger.warn('认证失败：缺少token', { ip: req.ip, path: req.path });
    return res.status(401).json({ error: '需要认证' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    logger.debug('用户认证成功', { userId: decoded.id, role: decoded.role, ip: req.ip });
    next();
  } catch (error) {
    logger.warn('认证失败：' + error.message, { ip: req.ip, path: req.path });
    return res.status(403).json({ error: error.message });
  }
}

// 权限检查中间件生成器
function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '需要认证' });
    }

    if (hasAnyPermission(req.user.role, permissions)) {
      next();
    } else {
      logger.warn('权限不足', {
        userId: req.user.id,
        role: req.user.role,
        requiredPermissions: permissions,
        path: req.path,
      });
      return res.status(403).json({ error: '权限不足' });
    }
  };
}

// 角色检查中间件生成器
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '需要认证' });
    }

    if (roles.includes(req.user.role)) {
      next();
    } else {
      logger.warn('角色不匹配', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.path,
      });
      return res.status(403).json({ error: '角色权限不足' });
    }
  };
}

// 刷新token
function refreshAccessToken(refreshToken) {
  try {
    const decoded = verifyToken(refreshToken);
    // 生成新的访问token，但保留原有的刷新token
    const newAccessToken = generateAccessToken({
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
    });
    return newAccessToken;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  authenticateToken,
  requirePermission,
  requireRole,
  refreshAccessToken,
};
