const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, param, query, validationResult } = require('express-validator');
const logger = require('../config/logger');

// 创建速率限制器
function createRateLimiter(options = {}) {
  const defaults = {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 限制每个IP 100个请求
    message: '请求过于频繁，请稍后再试',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('速率限制触发', {
        ip: req.ip,
        path: req.path,
        method: req.method,
      });
      res.status(429).json({ error: options.message || defaults.message });
    },
  };

  return rateLimit({ ...defaults, ...options });
}

// API速率限制配置
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100000, // 15分钟内最多100000次请求
});

// 登录速率限制（更严格）
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5, // 15分钟内最多5次登录尝试
  message: '登录尝试过多，请15分钟后再试',
});

// 创建订单速率限制
const createOrderLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 2000, // 每小时最多创建2000个订单
  message: '创建订单过于频繁，请稍后再试',
});

// 报价速率限制
const quoteLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 50, // 每小时最多50个报价
  message: '报价提交过于频繁，请稍后再试',
});

// XSS防护 - 清理HTML标签和危险字符
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }

  // 移除HTML标签
  let cleaned = input.replace(/<[^>]*>/g, '');

  // 转义特殊字符
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  cleaned = cleaned.replace(/[&<>"'/]/g, char => escapeMap[char]);

  return cleaned.trim();
}

// SQL注入防护 - 验证输入是否包含SQL关键字
function containsSQLKeywords(input) {
  if (typeof input !== 'string') {
    return false;
  }

  const sqlKeywords = [
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'CREATE',
    'ALTER',
    'EXEC',
    'EXECUTE',
    'UNION',
    'WHERE',
    'ORDER BY',
    'GROUP BY',
    'HAVING',
    '--',
    '/*',
    '*/',
    'XP_',
    'SP_',
  ];

  const upperInput = input.toUpperCase();
  return sqlKeywords.some(keyword => upperInput.includes(keyword));
}

// 检查是否为URL字段（不需要HTML实体编码的字段）
function isUrlField(key, value) {
  // 企业微信webhook URL字段
  if (key === 'wechat_webhook_url' || key === 'wechatWebhookUrl') {
    return true;
  }

  // 其他URL字段可以在这里添加
  if (key.toLowerCase().includes('url') || key.toLowerCase().includes('webhook')) {
    return true;
  }

  // 检查值是否看起来像URL
  if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
    return true;
  }

  return false;
}

// 输入清理中间件
function sanitizeMiddleware(req, res, next) {
  // 清理body
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        // 对于URL字段，跳过HTML实体编码
        if (isUrlField(key, req.body[key])) {
          // 只移除HTML标签，不进行字符转义
          req.body[key] = req.body[key].replace(/<[^>]*>/g, '').trim();
        } else {
          req.body[key] = sanitizeInput(req.body[key]);
        }
      }
    });
  }

  // 清理query参数
  if (req.query && typeof req.query === 'object') {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        // 对于URL字段，跳过HTML实体编码
        if (isUrlField(key, req.query[key])) {
          req.query[key] = req.query[key].replace(/<[^>]*>/g, '').trim();
        } else {
          req.query[key] = sanitizeInput(req.query[key]);
        }
      }
    });
  }

  // 清理params
  if (req.params && typeof req.params === 'object') {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        // params通常不包含URL，但为了一致性也检查
        if (isUrlField(key, req.params[key])) {
          req.params[key] = req.params[key].replace(/<[^>]*>/g, '').trim();
        } else {
          req.params[key] = sanitizeInput(req.params[key]);
        }
      }
    });
  }

  next();
}

// 验证规则集合
const validationRules = {
  // 订单验证规则
  createOrder: [
    body('warehouse')
      .notEmpty()
      .isLength({ max: 200 })
      .trim()
      .custom(value => !containsSQLKeywords(value))
      .withMessage('输入包含非法字符'),
    body('goods')
      .notEmpty()
      .isLength({ max: 500 })
      .trim()
      .custom(value => !containsSQLKeywords(value))
      .withMessage('输入包含非法字符'),
    body('deliveryAddress')
      .notEmpty()
      .isLength({ max: 500 })
      .trim()
      .custom(value => !containsSQLKeywords(value))
      .withMessage('输入包含非法字符'),
  ],

  updateOrder: [
    param('id').isUUID().withMessage('无效的订单ID'),
    body('warehouse')
      .optional()
      .isLength({ max: 200 })
      .trim()
      .custom(value => !containsSQLKeywords(value))
      .withMessage('输入包含非法字符'),
    body('goods')
      .optional()
      .isLength({ max: 500 })
      .trim()
      .custom(value => !containsSQLKeywords(value))
      .withMessage('输入包含非法字符'),
    body('deliveryAddress')
      .optional()
      .isLength({ max: 500 })
      .trim()
      .custom(value => !containsSQLKeywords(value))
      .withMessage('输入包含非法字符'),
  ],

  // 报价验证规则
  createQuote: [
    body('orderId').isUUID().withMessage('无效的订单ID'),
    body('price')
      .isFloat({ min: 0.01, max: 999999.99 })
      .withMessage('价格必须在0.01-999999.99之间'),
    body('estimatedDelivery')
      .notEmpty()
      .isLength({ max: 100 })
      .trim()
      .custom(value => !containsSQLKeywords(value))
      .withMessage('输入包含非法字符'),
  ],

  // 供应商验证规则
  createProvider: [
    body('name')
      .notEmpty()
      .isLength({ min: 2, max: 100 })
      .trim()
      .custom(value => !containsSQLKeywords(value))
      .withMessage('输入包含非法字符'),
    // 企业微信webhook URL格式校验已关闭
    // body('wechat_webhook_url').optional().isURL().withMessage('无效的Webhook URL')
  ],

  // 分页验证规则
  pagination: [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须大于0'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
    query('search')
      .optional()
      .isLength({ max: 100 })
      .trim()
      .custom(value => !containsSQLKeywords(value))
      .withMessage('搜索内容包含非法字符'),
  ],

  // ID参数验证
  idParam: [param('id').isUUID().withMessage('无效的ID格式')],

  // accessKey验证
  accessKey: [
    param('accessKey')
      .isAlphanumeric()
      .isLength({ min: 10, max: 50 })
      .withMessage('无效的访问密钥'),
  ],
};

// 处理验证错误的中间件
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('输入验证失败', {
      path: req.path,
      method: req.method,
      errors: errors.array(),
      ip: req.ip,
    });
    return res.status(400).json({
      error: '输入验证失败',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  next();
}

// 安全头部设置
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.siliconflow.cn'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// 组合验证中间件
function validate(rules) {
  return [...rules, handleValidation];
}

module.exports = {
  // 速率限制器
  apiLimiter,
  loginLimiter,
  createOrderLimiter,
  quoteLimiter,
  createRateLimiter,

  // 输入清理
  sanitizeMiddleware,
  sanitizeInput,

  // 验证规则
  validationRules,
  validate,

  // 安全头部
  securityHeaders,
};
