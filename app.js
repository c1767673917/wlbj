const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // uuid is still used for generating IDs in routes
const db = require('./db/database'); // Import the database instance
const fs = require('fs'); // 文件系统模块
const morgan = require('morgan'); // HTTP request logger
const logger = require('./config/logger'); // Winston logger
const config = require('./config/env'); // 环境变量配置

// 导入安全中间件
const {
  apiLimiter,
  sanitizeMiddleware,
  securityHeaders
} = require('./middleware/security');

// 导入缓存模块
const { cache, cacheInvalidation } = require('./utils/redisCache');
const dataLoader = require('./utils/dataLoader');

// 验证环境变量
try {
  config.validate();
} catch (error) {
  logger.error('环境变量验证失败:', error.message);
  if (config.isProduction()) {
    process.exit(1);
  }
}

const app = express();
const PORT = config.port;

// 应用安全头部
app.use(securityHeaders);

// 应用全局速率限制
app.use('/api/', apiLimiter);

// --- HTTP Request Logging with Morgan and Winston ---
// Morgan stream to Winston
const morganStream = {
  write: (message) => {
    logger.info(message.trim()); // Log HTTP requests at info level
  },
};
// Setup morgan to use the stream with 'combined' format for detailed logs
// or use 'dev' for colorized concise output during development
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', { stream: morganStream }));
// --- End HTTP Request Logging ---

// --- 注意：旧版认证系统已移除 ---
// APP_PASSWORD 现在专门用于管理员密码配置
// 用户认证已完全迁移到JWT系统，请使用 /api/auth/login 接口
// --- 认证相关配置结束 ---

// 中间件
// 配置 trust proxy 以支持反向代理环境
// 根据部署环境选择合适的配置：
// - 'loopback': 仅信任本地回环地址（推荐用于单机部署）
// - 1: 信任第一层代理（推荐用于 Nginx/Apache 代理）
// - ['127.0.0.1', '::1']: 信任特定IP地址
// - true: 信任所有代理（不推荐，安全风险）

// 配置 trust proxy
let trustProxyConfig = config.trustProxy;

if (trustProxyConfig === 'auto') {
  // 自动配置：生产环境信任第一层代理，开发环境不信任
  trustProxyConfig = config.isProduction() ? 1 : false;
} else if (trustProxyConfig === 'true') {
  trustProxyConfig = true;
} else if (trustProxyConfig === 'false') {
  trustProxyConfig = false;
} else if (trustProxyConfig === 'loopback') {
  trustProxyConfig = 'loopback';
} else if (trustProxyConfig.includes(',')) {
  // 支持多个IP地址，用逗号分隔
  trustProxyConfig = trustProxyConfig.split(',').map(ip => ip.trim());
}

app.set('trust proxy', trustProxyConfig);
logger.info(`Trust proxy 配置: ${JSON.stringify(trustProxyConfig)}`);

// 验证代理配置
if (config.isProduction() && trustProxyConfig === false) {
  logger.warn('⚠️  生产环境建议配置 trust proxy 以支持反向代理');
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 应用输入清理中间件
app.use(sanitizeMiddleware);

// 在开发环境中，前端由Vite开发服务器提供服务
// 在生产环境中，服务构建后的静态文件
if (process.env.NODE_ENV === 'production') {
  // 服务构建后的React应用静态文件
  app.use(express.static(path.join(__dirname, 'frontend/dist')));
} else {
  // 开发环境下，前端由Vite开发服务器在5173端口提供服务
  logger.info('开发环境：前端由Vite开发服务器提供服务 (http://localhost:5173)');
}

// 添加CORS支持
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
});

// API Routes
const authRoutes = require('./routes/authRoutes'); // JWT认证路由
const usersRoutes = require('./routes/usersRoutes'); // 用户管理路由
const adminRoutes = require('./routes/adminRoutes'); // 管理员路由
const ordersRoutes = require('./routes/ordersRoutes');
const quotesRoutes = require('./routes/quotesRoutes');
const providersRoutes = require('./routes/providersRoutes');
const exportRoutes = require('./routes/exportRoutes'); // 导出路由
const backupRoutes = require('./routes/backupRoutes'); // 备份路由

app.use('/api/auth', authRoutes); // JWT认证相关API
app.use('/api/users', usersRoutes); // 用户管理API
app.use('/api/admin', adminRoutes); // 管理员API
app.use('/api/orders', ordersRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/quotes', require('./routes/quotesOptimized')); // 优化的报价路由
app.use('/api/providers', providersRoutes);
app.use('/api/export', exportRoutes); // 添加导出路由
app.use('/api/backup', backupRoutes); // 添加备份路由

// 前端路由
app.get('/', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    // 生产环境：服务React应用
    res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
  } else {
    // 开发环境：重定向到Vite开发服务器
    res.redirect('http://localhost:5173/');
  }
});

// 用户端登录页面 - 现在由React前端处理
app.get('/login-user-page', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    // 生产环境：服务React应用，让前端路由处理
    res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
  } else {
    // 开发环境：重定向到Vite开发服务器
    res.redirect('http://localhost:5173/login-user-page');
  }
});

// 用户端页面路由 - 现在使用JWT认证
app.get('/user', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    // 生产环境：服务React应用
    res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
  } else {
    // 开发环境：重定向到Vite开发服务器
    res.redirect('http://localhost:5173/user');
  }
});

app.get('/provider/:accessKey', (req, res) => {
  const accessKey = req.params.accessKey;
  db.get('SELECT id, name FROM providers WHERE accessKey = ?', [accessKey], (err, provider) => {
    if (err) {
      logger.error('校验供应商 accessKey 失败:', { accessKey, message: err.message, stack: err.stack });
      return res.status(500).send('服务器错误');
    }
    if (!provider) {
      logger.warn('无效的供应商 accessKey 尝试访问:', { accessKey, ip: req.ip });
      return res.status(404).send('页面未找到或无效的访问链接。请确保链接正确，或联系管理员。');
    }
    logger.debug(`供应商 ${provider.name} (${accessKey}) 访问页面。`);
    if (process.env.NODE_ENV === 'production') {
      // 生产环境：服务React应用
      res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
    } else {
      // 开发环境：重定向到Vite开发服务器
      res.redirect(`http://localhost:5173/provider/${accessKey}`);
    }
  });
});

// The routes for PUT /api/orders/:id, PUT /api/orders/:id/close,
// and POST /api/orders/:id/quotes have been moved to wlbj/routes/ordersRoutes.js

// Catch-all handler: 对于所有其他路由，返回React应用
// 这必须在所有其他路由之后定义
app.get('*', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    // 生产环境：服务React应用，让前端路由处理
    res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
  } else {
    // 开发环境：重定向到Vite开发服务器，保持原始路径
    res.redirect(`http://localhost:5173${req.path}`);
  }
});

// 全局错误处理中间件 (示例)
app.use((err, req, res, next) => {
  logger.error('未捕获的服务器错误:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  res.status(500).send('服务器内部错误，请稍后重试。');
});

// 启动缓存预热
if (config.isProduction()) {
  setTimeout(async () => {
    try {
      await cache.warmUp(dataLoader);
      logger.info('生产环境缓存预热完成');
    } catch (error) {
      logger.error('缓存预热失败', { error: error.message });
    }
  }, 5000); // 延迟5秒启动，确保数据库已准备好
}

// 关闭应用时关闭数据库连接
process.on('SIGINT', () => {
  logger.info('收到 SIGINT 信号，准备关闭应用...');
  db.close((err) => {
    if (err) {
      logger.error('关闭数据库连接失败:', { message: err.message, stack: err.stack });
      process.exit(1); // 带错误码退出
    }
    logger.info('数据库连接已关闭。');
    process.exit(0);
  });
});

// 启动服务器
app.listen(PORT, () => {
  logger.info(`服务器运行在 http://localhost:${PORT}`);

  // 显示管理员密码配置状态
  if (process.env.APP_PASSWORD && process.env.APP_PASSWORD !== 'your_secure_admin_password_here_change_this') {
    logger.info('✅ 管理员密码已通过环境变量配置');
  } else {
    logger.warn('⚠️  管理员密码使用默认值，建议在.env文件中设置APP_PASSWORD');
  }

  logger.info('服务器启动完成，已启用以下安全特性：');
  logger.info('- JWT认证系统');
  logger.info('- 输入验证和XSS防护');
  logger.info('- SQL注入防护');
  logger.info('- 速率限制');
  logger.info('- 安全响应头');
  logger.info('- 多级缓存系统（内存+Redis）');
  logger.info('- 数据库查询性能监控');
});