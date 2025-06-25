require('dotenv').config();

// 测试环境默认配置
if (process.env.NODE_ENV === 'test') {
  // 为测试环境设置默认值
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  }
  if (!process.env.LOG_LEVEL) {
    process.env.LOG_LEVEL = 'error';
  }
}

// 环境变量验证
const requiredEnvVars = ['JWT_SECRET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`缺少必需的环境变量: ${envVar}`);
  }
}

const config = {
  // 应用配置
  app: {
    name: process.env.APP_NAME || 'wlbj-refactored',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || '0.0.0.0',
  },

  // 数据库配置
  database: {
    client: process.env.DB_CLIENT || 'sqlite3',
    filename: process.env.DB_FILENAME || './data/logistics.db',
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // 安全配置
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15分钟
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log',
  },

  // 企业微信配置
  wechat: {
    webhookUrl: process.env.WECHAT_WEBHOOK_URL,
  },

  // 文件上传配置
  upload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE, 10) || 10485760, // 10MB
    allowedTypes: process.env.UPLOAD_ALLOWED_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
      'application/pdf',
    ],
  },

  // 缓存配置
  cache: {
    ttl: parseInt(process.env.CACHE_TTL, 10) || 300, // 5分钟
    maxSize: parseInt(process.env.CACHE_MAX_SIZE, 10) || 1000,
  },

  // 监控配置
  monitoring: {
    enabled: process.env.ENABLE_METRICS === 'true',
    port: parseInt(process.env.METRICS_PORT, 10) || 9090,
  },

  // 备份配置
  backup: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    interval: parseInt(process.env.BACKUP_INTERVAL, 10) || 86400000, // 24小时
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 30,
  },
};

// 开发环境特殊配置
if (config.app.env === 'development') {
  config.logging.level = 'debug';
}

// 生产环境特殊配置
if (config.app.env === 'production') {
  config.security.rateLimitMaxRequests = 50; // 生产环境更严格的限制
}

module.exports = config;
