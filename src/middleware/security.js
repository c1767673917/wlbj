/**
 * 安全中间件
 * 提供安全相关的中间件功能
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { logger } = require('../config/logger');

/**
 * IP白名单配置
 * 在生产环境中应该从环境变量或配置文件中读取
 */
const IP_WHITELIST = process.env.IP_WHITELIST
  ? process.env.IP_WHITELIST.split(',').map(ip => ip.trim())
  : ['127.0.0.1', '::1', 'localhost'];

/**
 * 获取客户端真实IP地址
 * @param {Object} req - Express请求对象
 * @returns {string} 客户端IP地址
 */
const getClientIP = req => {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    'unknown'
  );
};

/**
 * IP白名单检查中间件
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 * @param {Function} next - Express下一个中间件函数
 */
const checkIPWhitelist = (req, res, next) => {
  // 在测试环境中跳过IP检查
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const clientIP = getClientIP(req);

  // 检查IP是否在白名单中
  const isWhitelisted = IP_WHITELIST.some(whitelistedIP => {
    if (whitelistedIP === 'localhost' && (clientIP === '127.0.0.1' || clientIP === '::1')) {
      return true;
    }
    return clientIP === whitelistedIP;
  });

  if (!isWhitelisted) {
    logger.warn('IP访问被拒绝', {
      clientIP,
      userAgent: req.headers['user-agent'],
      url: req.originalUrl,
      method: req.method,
    });

    return res.status(403).json({
      success: false,
      message: '访问被拒绝',
    });
  }

  next();
};

/**
 * 通用限流配置
 */
const createRateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: process.env.NODE_ENV === 'test' ? 10000 : 100, // 测试环境放宽限制
    message: {
      success: false,
      message: '请求过于频繁，请稍后再试',
    },
    standardHeaders: true,
    legacyHeaders: false,
    // 在开发环境中跳过trust proxy验证
    skip: process.env.NODE_ENV === 'development' ? () => false : undefined,
    keyGenerator: req => {
      // 在开发环境中使用简单的IP获取方式
      if (process.env.NODE_ENV === 'development') {
        return req.ip || req.connection.remoteAddress || '127.0.0.1';
      }
      return getClientIP(req);
    },
    handler: (req, res) => {
      logger.warn('请求频率限制触发', {
        clientIP: getClientIP(req),
        userAgent: req.headers['user-agent'],
        url: req.originalUrl,
        method: req.method,
      });

      res.status(429).json(
        options.message || {
          success: false,
          message: '请求过于频繁，请稍后再试',
        }
      );
    },
  };

  return rateLimit({ ...defaultOptions, ...options });
};

/**
 * API限流中间件
 */
const apiRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: process.env.NODE_ENV === 'test' ? 10000 : 100,
});

/**
 * 认证API限流中间件（更严格）
 */
const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: process.env.NODE_ENV === 'test' ? 1000 : 10, // 认证接口限制更严格
  message: {
    success: false,
    message: '认证请求过于频繁，请稍后再试',
  },
});

/**
 * 文件上传限流中间件
 */
const uploadRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1小时
  max: process.env.NODE_ENV === 'test' ? 1000 : 20, // 每小时最多20次上传
  message: {
    success: false,
    message: '文件上传过于频繁，请稍后再试',
  },
});

/**
 * 安全头配置
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // 根据需要调整
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/**
 * 请求日志中间件
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 * @param {Function} next - Express下一个中间件函数
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const clientIP = getClientIP(req);

  // 记录请求开始
  logger.info('请求开始', {
    method: req.method,
    url: req.originalUrl,
    clientIP,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString(),
  });

  // 监听响应结束
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel]('请求完成', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      clientIP,
      timestamp: new Date().toISOString(),
    });
  });

  next();
};

/**
 * 敏感信息过滤中间件
 * 过滤请求和响应中的敏感信息
 */
const sanitizeData = (req, res, next) => {
  // 过滤请求体中的敏感信息
  if (req.body) {
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    sensitiveFields.forEach(field => {
      if (req.body[field]) {
        req.body[field] = '***';
      }
    });
  }

  next();
};

module.exports = {
  checkIPWhitelist,
  createRateLimiter,
  apiRateLimit,
  authRateLimit,
  uploadRateLimit,
  securityHeaders,
  requestLogger,
  sanitizeData,
  getClientIP,
};
